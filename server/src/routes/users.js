const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireManagerOrAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { normalizeEmail, normalizeName } = require('../utils/normalize');
const { maskUserName, maskUserNames, canSeeFullNames } = require('../utils/namePrivacy');
const { processProfilePhoto } = require('../services/photoProcessor');
const {
  createWorkspaceUser, suspendWorkspaceUser, unsuspendWorkspaceUser,
  generateWorkspaceEmail, updateWorkspaceUser, updateWorkspacePhoto,
} = require('../services/google/googleWorkspace');
const { sendEmail } = require('../services/notifications/emailService');
const {
  getDriveClient, ensureEmployeeFolder, uploadFile, getDirectImageUrl,
} = require('../services/google/googleDrive');

const router = express.Router();

// ─── Workspace helper: is this email on the configured Workspace domain? ───────
function isWorkspaceEmail(email) {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  return domain && email && email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

// ═══════════════════════════════════════════════
// Change-log helper — logs profile changes to ProfileChangeLog
// ═══════════════════════════════════════════════
async function logChanges(prisma, { userId, changedBy, section, changes, action = 'update' }) {
  const entries = [];
  for (const { field, oldValue, newValue } of changes) {
    const oldStr = oldValue != null ? String(oldValue) : null;
    const newStr = newValue != null ? String(newValue) : null;
    if (oldStr !== newStr) {
      entries.push({ userId, changedBy, section, field, oldValue: oldStr, newValue: newStr, action });
    }
  }
  if (entries.length > 0) {
    await prisma.profileChangeLog.createMany({ data: entries });
  }
  return entries.length;
}

// ═══════════════════════════════════════════════
// Photo Upload (base64 input → Google Drive storage)
// ═══════════════════════════════════════════════

// POST /api/users/:id/photo — Upload profile photo (self or admin)
// Accepts base64 data URL from frontend, processes via AI + Sharp pipeline,
// then stores in Google Drive (NOT in database) to save Neon storage.
router.post('/:id/photo', authenticate, express.json({ limit: '5mb' }), asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'sub_admin';
  if (!isSelf && !isAdmin) throw forbidden('You can only upload your own photo.');

  const { photo } = req.body;
  if (!photo || !photo.startsWith('data:image/')) throw badRequest('Invalid image data.');

  // Look up existing info for AI processing + Drive folder
  const user = await req.prisma.user.findUnique({
    where:  { id: targetId },
    select: { id: true, name: true, email: true, employeeId: true, driveFolderId: true, gender: true, profilePhotoUrl: true, driveProfilePhotoUrl: true },
  });
  if (!user) throw notFound('User');

  // Decode base64 data URL → buffer
  const commaIdx = photo.indexOf(',');
  const inputMime = photo.slice(5, photo.indexOf(';'));
  const inputBuf  = Buffer.from(photo.slice(commaIdx + 1), 'base64');

  // Run through AI + sharp pipeline
  const { buffer: processed, mimeType: outMime } = await processProfilePhoto(
    inputBuf, inputMime, { gender: user.gender ?? null, prisma: req.prisma }
  );

  // Upload to Google Drive (same pattern as /api/files/upload-profile-photo)
  const uploadName = `profile-${user.employeeId || user.id}.jpg`;
  const drive = await getDriveClient();
  const folderId = await ensureEmployeeFolder(drive, user, req.prisma);
  const result = await uploadFile(drive, folderId, uploadName, outMime, processed);

  // Create DriveFile record for tracking
  await req.prisma.driveFile.create({
    data: {
      userId: targetId,
      driveFileId: result.fileId,
      driveFolderId: folderId,
      fileName: uploadName,
      mimeType: outMime,
      fileSize: processed.length,
      driveUrl: result.webViewLink,
      thumbnailUrl: result.thumbnailLink || null,
      category: 'photo',
      description: 'Profile photo',
    },
  });

  // Set Drive URL and clear old base64 to free DB space
  const directPhotoUrl = getDirectImageUrl(result.fileId);
  await req.prisma.user.update({
    where: { id: targetId },
    data: { driveProfilePhotoUrl: directPhotoUrl, profilePhotoUrl: null },
  });

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'photo',
    changes: [{ field: 'driveProfilePhotoUrl', oldValue: user.driveProfilePhotoUrl || null, newValue: directPhotoUrl }],
    action: user.driveProfilePhotoUrl ? 'update' : 'add',
  });

  // Sync photo → Workspace (non-blocking)
  if (isWorkspaceEmail(user.email)) {
    try {
      await updateWorkspacePhoto(user.email, processed);
    } catch (err) {
      console.error(`Workspace photo sync failed for ${user.email}:`, err.message);
    }
  }

  res.json({ driveProfilePhotoUrl: directPhotoUrl });
}));

// ═══════════════════════════════════════════════
// Employee Directory & Profile (HR)
// ═══════════════════════════════════════════════

// POST /api/users/backfill-dates — Backfill confirmationDate & probationEndDate from DOJ + 6 months
// Only updates records where DOJ exists but confirmationDate or probationEndDate is missing
router.post('/backfill-dates', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({
    where: {
      dateOfJoining: { not: null },
      OR: [
        { confirmationDate: null },
        { probationEndDate: null },
      ],
    },
    select: { id: true, name: true, dateOfJoining: true, confirmationDate: true, probationEndDate: true, confirmationStatus: true },
  });

  let updated = 0;
  for (const u of users) {
    const dojDate = new Date(u.dateOfJoining);
    dojDate.setMonth(dojDate.getMonth() + 6);
    const sixMonthDate = dojDate.toISOString().slice(0, 10);

    const data = {};
    if (!u.confirmationDate) data.confirmationDate = sixMonthDate;
    if (!u.probationEndDate) data.probationEndDate = sixMonthDate;
    if (!u.confirmationStatus) data.confirmationStatus = 'pending';

    if (Object.keys(data).length > 0) {
      await req.prisma.user.update({ where: { id: u.id }, data });
      updated++;
    }
  }

  res.json({ message: `Backfilled ${updated} employees`, total: users.length, updated });
}));

// GET /api/users/export — Export all employee data (admin only)
router.get('/export', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.activeOnly === 'true') where.isActive = true;
  if (req.query.department && req.query.department !== 'all') where.department = req.query.department;
  if (req.query.company && req.query.company !== 'all') where.companyId = parseInt(req.query.company);

  const employees = await req.prisma.user.findMany({
    where,
    select: {
      id: true, employeeId: true, name: true, email: true, role: true,
      department: true, designation: true, dateOfJoining: true, dateOfBirth: true,
      employmentType: true, employmentStatus: true, phone: true, personalEmail: true,
      gender: true, bloodGroup: true, maritalStatus: true, nationality: true,
      fatherName: true, spouseName: true, religion: true, placeOfBirth: true,
      address: true, permanentAddress: true,
      aadhaarNumber: true, panNumber: true, passportNumber: true, passportExpiry: true,
      drivingLicense: true, uanNumber: true,
      bankName: true, bankAccountNumber: true, bankBranch: true, bankIfscCode: true,
      confirmationDate: true, confirmationStatus: true, probationEndDate: true,
      noticePeriodDays: true, previousExperience: true, location: true, grade: true, shift: true,
      isActive: true, emergencyContact: true,
      reportingManager: { select: { name: true, employeeId: true } },
      company: { select: { name: true, shortName: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json(employees);
}));

// GET /api/users/directory — Employee directory
// ?status=all|active|notice_period|separated|terminated|absconding (admin only; default 'active' for non-admin)
// ?confirmation=all|confirmed|probation (admin only)
router.get('/directory', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  const statusFilter = req.query.status || (isAdmin ? 'all' : 'active');
  const confirmationFilter = isAdmin ? (req.query.confirmation || 'all') : 'all';
  const where = {};
  if (!isAdmin || statusFilter !== 'all') {
    where.employmentStatus = statusFilter !== 'all' ? statusFilter : undefined;
    if (!isAdmin) where.isActive = true;
  }
  if (confirmationFilter === 'confirmed') {
    where.confirmationStatus = 'confirmed';
  } else if (confirmationFilter === 'probation') {
    where.confirmationStatus = { in: ['pending', 'extended'] };
  }
  if (req.query.department && req.query.department !== 'all') where.department = req.query.department;
  if (req.query.company && req.query.company !== 'all') where.companyId = parseInt(req.query.company);
  if (req.query.location && req.query.location !== 'all') where.location = req.query.location;
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search } },
      { email: { contains: req.query.search } },
      { designation: { contains: req.query.search } },
      { employeeId: { contains: req.query.search } },
    ];
  }

  const employees = await req.prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, department: true, designation: true, employeeId: true,
      profilePhotoUrl: true, driveProfilePhotoUrl: true, phone: true, dateOfJoining: true, role: true, location: true,
      employmentStatus: true, confirmationStatus: true, isActive: true,
      reportingManagerId: true, companyId: true,
      reportingManager: { select: { id: true, name: true, employeeId: true } },
      company: { select: { id: true, name: true, shortName: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Name privacy: non-admin users see only first name + last initial
  const result = !canSeeFullNames(req.user) ? maskUserNames(employees, ['reportingManager']) : employees;
  res.json({ users: result });
}));

// GET /api/users/departments — List unique departments (excludes 'General' placeholder)
router.get('/departments', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const departments = await req.prisma.user.findMany({
    where: { isActive: true, department: { not: 'General' } },
    select: { department: true }, distinct: ['department'], orderBy: { department: 'asc' },
  });
  res.json(departments.map((d) => d.department));
}));

// GET /api/users/locations — List unique office locations
router.get('/locations', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const rows = await req.prisma.user.findMany({
    where: { isActive: true, location: { not: null } },
    select: { location: true }, distinct: ['location'], orderBy: { location: 'asc' },
  });
  res.json(rows.map((r) => r.location).filter(Boolean));
}));

// GET /api/users/org-chart — Org chart data (reporting hierarchy)
router.get('/org-chart', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employeeId: true, designation: true, department: true, profilePhotoUrl: true, driveProfilePhotoUrl: true, reportingManagerId: true, role: true },
    orderBy: { name: 'asc' },
  });

  // Name privacy: non-admin users see only first name + last initial
  res.json(canSeeFullNames(req.user) ? users : maskUserNames(users));
}));

// GET /api/users/:id/profile — Full employee profile (self or admin/manager)
router.get('/:id/profile', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'sub_admin' || req.user.role === 'team_lead';
  if (!isSelf && !isAdminOrLead) throw forbidden('You can only view your own profile or profiles in your team.');

  if (req.user.role === 'team_lead' && !isSelf) {
    const target = await req.prisma.user.findUnique({ where: { id: targetId }, select: { department: true } });
    if (!target || target.department !== req.user.department) throw forbidden('You can only view profiles in your department.');
  }

  const user = await req.prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, email: true, role: true, department: true, isActive: true, createdAt: true,
      employeeId: true, designation: true, dateOfJoining: true, dateOfBirth: true,
      employmentType: true, phone: true, personalEmail: true, address: true,
      emergencyContact: true, gender: true, bloodGroup: true, profilePhotoUrl: true, driveProfilePhotoUrl: true, reportingManagerId: true,
      maritalStatus: true, nationality: true, fatherName: true, spouseName: true,
      religion: true, placeOfBirth: true, permanentAddress: true,
      aadhaarNumber: true, panNumber: true, passportNumber: true, passportExpiry: true,
      drivingLicense: true, uanNumber: true,
      bankName: true, bankAccountNumber: true, bankBranch: true, bankIfscCode: true,
      confirmationDate: true, probationEndDate: true, noticePeriodDays: true,
      previousExperience: true, location: true, grade: true, shift: true, companyId: true,
      employeeType: true, branchId: true, costCenterId: true,
      confirmationStatus: true, confirmedAt: true, benefitsUnlocked: true, officialEmailDisabled: true,
      sectionPermissions: true,
      company: { select: { id: true, name: true, shortName: true } },
      branch: { select: { id: true, name: true, state: true, city: true } },
      costCenter: { select: { id: true, name: true, shortName: true } },
      reportingManager: { select: { id: true, name: true, employeeId: true, designation: true, department: true, profilePhotoUrl: true, driveProfilePhotoUrl: true } },
      subordinates: { select: { id: true, name: true, employeeId: true, designation: true, department: true, profilePhotoUrl: true, driveProfilePhotoUrl: true } },
      educations: { orderBy: { id: 'desc' } },
      familyMembers: { orderBy: { id: 'asc' } },
      previousEmployments: { orderBy: { id: 'desc' } },
    },
  });
  if (!user) throw notFound('User');

  // Name privacy: non-admin viewing someone else's profile sees masked names
  const isSelfProfile = req.user.id === targetId;
  if (!isSelfProfile && !canSeeFullNames(req.user)) {
    res.json(maskUserName(user, ['reportingManager']));
  } else if (canSeeFullNames(req.user)) {
    res.json(user);
  } else {
    // Self-view: mask other people's names (manager, subordinates) but keep own name
    const result = { ...user };
    if (result.reportingManager) result.reportingManager = maskUserName(result.reportingManager);
    if (result.subordinates) result.subordinates = maskUserNames(result.subordinates);
    res.json(result);
  }
}));

// PUT /api/users/:id/profile — Update employee profile (admin only, or self for limited fields)
router.put('/:id/profile', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'sub_admin';
  if (!isSelf && !isAdmin) throw forbidden();

  const data = {};

  if (isSelf || isAdmin) {
    const selfFields = ['name', 'phone', 'personalEmail', 'address', 'permanentAddress', 'emergencyContact', 'profilePhotoUrl'];
    selfFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
  }

  if (isAdmin) {
    const adminFields = [
      'name', 'email', 'role', 'department', 'employeeId', 'designation', 'dateOfJoining', 'dateOfBirth', 'employmentType', 'gender', 'bloodGroup',
      'maritalStatus', 'nationality', 'fatherName', 'spouseName', 'religion', 'placeOfBirth',
      'aadhaarNumber', 'panNumber', 'passportNumber', 'passportExpiry', 'drivingLicense', 'uanNumber',
      'bankName', 'bankAccountNumber', 'bankBranch', 'bankIfscCode',
      'confirmationDate', 'probationEndDate', 'noticePeriodDays', 'previousExperience', 'location', 'grade', 'shift',
      'employeeType', 'officialEmailDisabled', 'confirmationStatus', 'confirmedAt', 'benefitsUnlocked',
    ];
    adminFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.body.reportingManagerId !== undefined) data.reportingManagerId = req.body.reportingManagerId || null;
    if (req.body.companyId !== undefined) data.companyId = req.body.companyId ? parseInt(req.body.companyId) : null;
    if (req.body.branchId !== undefined) data.branchId = req.body.branchId ? parseInt(req.body.branchId) : null;
    if (req.body.costCenterId !== undefined) data.costCenterId = req.body.costCenterId ? parseInt(req.body.costCenterId) : null;
  }

  if (data.name) data.name = normalizeName(data.name);
  if (data.email) data.email = normalizeEmail(data.email);
  if (data.personalEmail) data.personalEmail = normalizeEmail(data.personalEmail);
  if (data.fatherName) data.fatherName = normalizeName(data.fatherName);
  if (data.spouseName) data.spouseName = normalizeName(data.spouseName);

  if (Object.keys(data).length === 0) throw badRequest('No fields to update.');

  const oldUser = await req.prisma.user.findUnique({ where: { id: targetId } });

  // Auto-calculate confirmationDate & probationEndDate when DOJ changes (DOJ + 6 months)
  // Only auto-set if the field is NOT being explicitly set in this request
  if (isAdmin && data.dateOfJoining && data.dateOfJoining !== oldUser?.dateOfJoining) {
    const dojDate = new Date(data.dateOfJoining);
    dojDate.setMonth(dojDate.getMonth() + 6);
    const sixMonthDate = dojDate.toISOString().slice(0, 10);
    if (req.body.confirmationDate === undefined) data.confirmationDate = sixMonthDate;
    if (req.body.probationEndDate === undefined) data.probationEndDate = sixMonthDate;
  }

  const user = await req.prisma.user.update({
    where: { id: targetId },
    data,
    select: {
      id: true, name: true, email: true, role: true, department: true,
      employeeId: true, designation: true, dateOfJoining: true,
      employmentType: true, phone: true, personalEmail: true,
      gender: true, bloodGroup: true, profilePhotoUrl: true, driveProfilePhotoUrl: true, reportingManagerId: true,
      maritalStatus: true, nationality: true, fatherName: true, spouseName: true,
      religion: true, placeOfBirth: true, permanentAddress: true, address: true,
      aadhaarNumber: true, panNumber: true, passportNumber: true, passportExpiry: true,
      drivingLicense: true, uanNumber: true,
      bankName: true, bankAccountNumber: true, bankBranch: true, bankIfscCode: true,
      confirmationDate: true, probationEndDate: true, noticePeriodDays: true,
      previousExperience: true, location: true, grade: true, shift: true,
      dateOfBirth: true, emergencyContact: true, companyId: true,
      employeeType: true, branchId: true, costCenterId: true,
      confirmationStatus: true, confirmedAt: true, benefitsUnlocked: true, officialEmailDisabled: true,
      company: { select: { id: true, name: true, shortName: true } },
      branch: { select: { id: true, name: true, state: true, city: true } },
      costCenter: { select: { id: true, name: true, shortName: true } },
    },
  });

  const changes = Object.keys(data).map((field) => ({ field, oldValue: oldUser[field], newValue: data[field] }));
  await logChanges(req.prisma, { userId: targetId, changedBy: req.user.id, section: 'profile', changes });

  // ── Push relevant changes → Google Workspace (non-blocking) ──
  const wsFields = ['name', 'department', 'employeeId', 'reportingManagerId'];
  const wsChanged = wsFields.some((f) => data[f] !== undefined && String(data[f] ?? '') !== String(oldUser[f] ?? ''));
  if (wsChanged && isWorkspaceEmail(user.email)) {
    try {
      const wsUpdate = {};
      if (data.name !== undefined) wsUpdate.name = user.name;
      if (data.department !== undefined) wsUpdate.department = data.department;
      if (data.employeeId !== undefined) wsUpdate.employeeId = data.employeeId;
      if (data.reportingManagerId !== undefined) {
        if (data.reportingManagerId) {
          const mgr = await req.prisma.user.findUnique({
            where: { id: data.reportingManagerId }, select: { email: true },
          });
          wsUpdate.managerEmail = mgr?.email || null;
        } else {
          wsUpdate.managerEmail = null;
        }
      }
      await updateWorkspaceUser(user.email, wsUpdate);
    } catch (err) {
      console.error(`Workspace profile sync failed for ${user.email}:`, err.message);
      // Non-blocking — don't fail the profile save
    }
  }

  res.json(user);
}));

// GET /api/users/:id/documents — List employee documents (self or admin)
router.get('/:id/documents', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'sub_admin';
  if (!isSelf && !isAdmin) throw forbidden();

  const documents = await req.prisma.employeeDocument.findMany({
    where: { userId: targetId }, orderBy: { uploadedAt: 'desc' },
  });
  res.json(documents);
}));

// POST /api/users/:id/documents — Upload employee document (admin only)
router.post('/:id/documents', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  requireFields(req.body, 'name', 'type', 'fileUrl');
  const { name, type, fileUrl } = req.body;

  const validTypes = ['id_proof', 'address_proof', 'education', 'other'];
  if (!validTypes.includes(type)) throw badRequest(`Type must be one of: ${validTypes.join(', ')}`);

  const user = await req.prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound('User');

  const doc = await req.prisma.employeeDocument.create({
    data: { userId: targetId, name: name.trim(), type, fileUrl },
  });
  res.status(201).json(doc);
}));

// DELETE /api/users/:id/documents/:docId — Delete employee document (admin only)
router.delete('/:id/documents/:docId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const docId = parseId(req.params.docId);
  await req.prisma.employeeDocument.delete({ where: { id: docId } });
  res.json({ message: 'Document deleted.' });
}));

// ═══════════════════════════════════════════════
// Existing User Management (Admin)
// ═══════════════════════════════════════════════

// GET /api/users - List users (admins see all, team_leads see own department)
router.get('/', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role === 'team_lead') where.department = req.user.department;

  const users = await req.prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, department: true,
      employeeId: true, designation: true, sectionPermissions: true,
      isActive: true, isHibernated: true, lastActivityAt: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

// POST /api/users - Create user
router.post('/', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name');
  const { name, password, role, department, companyId } = req.body;
  const employeeType = req.body.employeeType || 'internal';
  const personalEmail = req.body.personalEmail ? normalizeEmail(req.body.personalEmail) : null;
  const phone = req.body.phone || null;

  // ── Determine email: auto-generate for internal/intern, require for external ──
  let normalizedEmail;
  let emailAutoGenerated = false;
  if (req.body.email) {
    normalizedEmail = normalizeEmail(req.body.email);
  } else if (employeeType === 'internal' || employeeType === 'intern') {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
    if (!domain) throw badRequest('GOOGLE_WORKSPACE_DOMAIN not set — cannot auto-generate email.');
    normalizedEmail = await generateWorkspaceEmail(normalizeName(name), domain, req.prisma);
    emailAutoGenerated = true;
  } else {
    throw badRequest('Email is required for external employees.');
  }

  const existing = await req.prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw conflict('Email already exists.');

  const hashedPassword = await bcrypt.hash(password || 'google-auth-only', 10);

  const createData = {
    name: normalizeName(name), email: normalizedEmail, password: hashedPassword,
    role: role || 'member', department: department || '',
    companyId: companyId ? parseInt(companyId) : null,
    employeeType,
  };
  if (personalEmail) createData.personalEmail = personalEmail;
  if (phone) createData.phone = phone;

  // Auto-set confirmation + probation dates (DOJ + 6 months)
  const doj = req.body.dateOfJoining;
  if (doj) {
    createData.dateOfJoining = doj;
    const dojDate = new Date(doj);
    dojDate.setMonth(dojDate.getMonth() + 6);
    const sixMonthDate = dojDate.toISOString().slice(0, 10);
    if (!req.body.confirmationDate) createData.confirmationDate = sixMonthDate;
    if (!req.body.probationEndDate) createData.probationEndDate = sixMonthDate;
    if (!req.body.confirmationStatus) createData.confirmationStatus = 'pending';
  }

  const user = await req.prisma.user.create({ data: createData });

  // ── Google Workspace: auto-create account for @domain emails ──
  const workspaceResult = { attempted: false, email: normalizedEmail };
  if (isWorkspaceEmail(normalizedEmail)) {
    workspaceResult.attempted = true;
    try {
      const tempPassword = await createWorkspaceUser(user.name, normalizedEmail, {
        recoveryEmail: personalEmail || undefined,
        recoveryPhone: phone || undefined,
      });
      workspaceResult.success = true;
      workspaceResult.tempPassword = tempPassword;

      // Send welcome email to personal email (if provided)
      const notifyEmail = personalEmail || null;
      if (notifyEmail) {
        const onboardedBy = req.user.name || req.user.email;
        const appUrl = process.env.APP_URL || 'https://eod.colorpapers.in';
        try {
          await sendEmail(notifyEmail, 'Welcome to Color Papers — Your Work Account is Ready',
            `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
              <div style="background:#1d4ed8;padding:24px 32px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;font-size:20px;">Welcome to Color Papers India! 🎉</h1>
              </div>
              <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p>Hi <strong>${user.name}</strong>,</p>
                <p>Your work account has been created. Here are your login details:</p>
                <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:16px 20px;margin:16px 0;">
                  <p style="margin:4px 0;"><strong>Work Email:</strong> ${normalizedEmail}</p>
                  <p style="margin:4px 0;"><strong>Temporary Password:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
                  <p style="margin:4px 0;"><strong>Login URL:</strong> <a href="${appUrl}">${appUrl}</a></p>
                </div>
                <p style="color:#64748b;font-size:13px;">Please log in and change your password immediately. This temporary password will expire on first use.</p>
                <p style="color:#64748b;font-size:13px;">Onboarded by: <strong>${onboardedBy}</strong></p>
              </div>
            </div>`
          );
          workspaceResult.welcomeEmailSent = true;
          workspaceResult.welcomeEmailTo = notifyEmail;
        } catch (emailErr) {
          console.error('Welcome email send failed:', emailErr.message);
          workspaceResult.welcomeEmailSent = false;
        }
      }
    } catch (err) {
      workspaceResult.success = false;
      workspaceResult.error = err.message;
      console.error(`Google Workspace account creation failed for ${normalizedEmail}:`, err.message);
    }
  }

  res.status(201).json({
    id: user.id, name: user.name, email: user.email, role: user.role, department: user.department,
    emailAutoGenerated,
    workspaceAccount: workspaceResult,
  });
}));

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { name, email, role, department, isActive, password, companyId } = req.body;
  const data = {};
  if (name) data.name = normalizeName(name);
  if (email) data.email = normalizeEmail(email);
  if (role) data.role = role;
  if (department) data.department = department;
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (password) data.password = await bcrypt.hash(password, 10);
  if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;

  const user = await req.prisma.user.update({
    where: { id: parseId(req.params.id) }, data,
    select: { id: true, name: true, email: true, role: true, department: true, isActive: true },
  });
  res.json(user);
}));

// DELETE /api/users/:id - Deactivate user (soft delete)
router.delete('/:id', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const employee = await req.prisma.user.findUnique({
    where: { id },
    select: { employeeType: true, email: true },
  });

  const updateData = { isActive: false };
  // Intern and external employees have their official email disabled on deactivation
  if (employee && (employee.employeeType === 'intern' || employee.employeeType === 'external')) {
    updateData.officialEmailDisabled = true;
  }
  // Flag Workspace account for manual suspension by HR
  if (employee && isWorkspaceEmail(employee.email)) {
    updateData.workspaceSuspendPending = true;
  }

  await req.prisma.user.update({ where: { id }, data: updateData });

  res.json({ message: 'User deactivated.' });
}));

// ─────────────────────────────────────────────
// Google Workspace pending-suspension helpers
// ─────────────────────────────────────────────

// GET /api/users/workspace-pending — employees whose Workspace account still needs HR action
router.get('/workspace-pending', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const pending = await req.prisma.user.findMany({
    where: { workspaceSuspendPending: true },
    select: { id: true, name: true, email: true, employeeId: true, department: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!pending.length) return res.json([]);

  // Enrich with last working date from separation records
  const userIds = pending.map((u) => u.id);
  const separations = await req.prisma.separation.findMany({
    where: { userId: { in: userIds }, status: { not: 'cancelled' } },
    select: { userId: true, lastWorkingDate: true, status: true, type: true },
    orderBy: { id: 'desc' },
  });

  const sepMap = new Map();
  for (const s of separations) {
    if (!sepMap.has(s.userId)) sepMap.set(s.userId, s); // keep latest only
  }

  const result = pending.map((u) => {
    const sep = sepMap.get(u.id);
    const lastWorkingDate = sep?.lastWorkingDate || null;
    const daysOverdue = lastWorkingDate
      ? Math.max(0, Math.floor((new Date(today) - new Date(lastWorkingDate)) / (1000 * 60 * 60 * 24)))
      : null;
    return { ...u, lastWorkingDate, daysOverdue, separationType: sep?.type || null };
  });

  res.json(result);
}));

// PUT /api/users/:id/workspace-done — HR confirms Workspace account has been suspended/deleted
router.put('/:id/workspace-done', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const today = new Date().toISOString().slice(0, 10);
  await req.prisma.user.update({
    where: { id },
    data: { workspaceSuspendPending: false, workspaceSuspendDoneAt: today },
  });
  res.json({ message: 'Workspace account marked as suspended.' });
}));

// POST /api/users/:id/workspace-suspend-now — Auto-suspend Workspace account immediately
router.post('/:id/workspace-suspend-now', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const user = await req.prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  if (!user) throw notFound('User');
  if (!isWorkspaceEmail(user.email)) throw badRequest('User does not have a Workspace email.');

  await suspendWorkspaceUser(user.email);

  const today = new Date().toISOString().slice(0, 10);
  await req.prisma.user.update({
    where: { id },
    data: { workspaceSuspendPending: false, workspaceSuspendDoneAt: today },
  });
  res.json({ message: `Workspace account ${user.email} suspended successfully.` });
}));

// ═══════════════════════════════════════════════
// Section Permissions (per-user sidebar visibility)
// ═══════════════════════════════════════════════

// GET /api/users/:id/section-permissions — get denied sections for a user (admin only)
// null = never configured → default all denied; [] = explicitly all allowed
router.get('/:id/section-permissions', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const user = await req.prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, sectionPermissions: true },
  });
  if (!user) throw notFound('User');
  // null means permissions were never set — treat as "all denied" (configured=false)
  const configured = user.sectionPermissions !== null;
  const deniedSections = configured ? user.sectionPermissions : [];
  res.json({ userId: user.id, name: user.name, deniedSections, configured });
}));

// PUT /api/users/:id/section-permissions — update denied sections for a user (admin only)
// Body: { deniedSections: ["/admin/payroll", "/payslips", ...] }
router.put('/:id/section-permissions', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  // Prevent admins from restricting themselves (the user making the request)
  if (id === req.user.id) throw badRequest('You cannot modify your own section permissions.');

  const { deniedSections } = req.body;
  if (!Array.isArray(deniedSections)) throw badRequest('deniedSections must be an array of route paths.');

  // Basic validation: each entry must be a string path
  const invalid = deniedSections.filter((s) => typeof s !== 'string' || !s.startsWith('/'));
  if (invalid.length > 0) throw badRequest(`Invalid section paths: ${invalid.join(', ')}`);

  const targetUser = await req.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!targetUser) throw notFound('User');

  // Only root admin can modify permissions of other admin-level users (admin or sub_admin)
  if ((targetUser.role === 'admin' || targetUser.role === 'sub_admin') && req.user.role !== 'admin') {
    throw forbidden('Only root admin can modify permissions for admin-level users.');
  }

  await req.prisma.user.update({
    where: { id },
    data: { sectionPermissions: deniedSections },
  });

  res.json({ message: 'Section permissions updated.', deniedSections });
}));

// ═══════════════════════════════════════════════
// Education CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/education — Add education record (admin or self)
router.post('/:id/education', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  requireFields(req.body, 'degree', 'institution');
  const { degree, institution, university, specialization, yearOfPassing, percentage } = req.body;

  const record = await req.prisma.education.create({
    data: { userId: targetId, degree, institution, university, specialization, yearOfPassing, percentage },
  });

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'education',
    changes: [{ field: `${degree} at ${institution}`, oldValue: null, newValue: `Added: ${degree}, ${institution}` }],
    action: 'add',
  });
  res.status(201).json(record);
}));

// PUT /api/users/:id/education/:eduId — Edit education record (admin or self)
router.put('/:id/education/:eduId', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  const eduId = parseId(req.params.eduId);
  const old = await req.prisma.education.findUnique({ where: { id: eduId } });
  if (!old || old.userId !== targetId) throw notFound('Record');

  const { degree, institution, university, specialization, yearOfPassing, percentage } = req.body;
  const data = {};
  if (degree !== undefined) data.degree = degree;
  if (institution !== undefined) data.institution = institution;
  if (university !== undefined) data.university = university;
  if (specialization !== undefined) data.specialization = specialization;
  if (yearOfPassing !== undefined) data.yearOfPassing = yearOfPassing;
  if (percentage !== undefined) data.percentage = percentage;

  const record = await req.prisma.education.update({ where: { id: eduId }, data });

  const changes = Object.keys(data).map((f) => ({ field: `education.${f}`, oldValue: old[f], newValue: data[f] }));
  await logChanges(req.prisma, { userId: targetId, changedBy: req.user.id, section: 'education', changes });

  res.json(record);
}));

// ═══════════════════════════════════════════════
// Family Members CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/family — Add family member (admin or self)
router.post('/:id/family', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  requireFields(req.body, 'name', 'relationship');
  const { name, relationship, dateOfBirth, occupation, phone, isDependent, isNominee, nomineeShare } = req.body;

  const record = await req.prisma.familyMember.create({
    data: { userId: targetId, name, relationship, dateOfBirth, occupation, phone, isDependent, isNominee, nomineeShare },
  });

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'family',
    changes: [{ field: `${relationship}: ${name}`, oldValue: null, newValue: `Added: ${name} (${relationship})` }],
    action: 'add',
  });
  res.status(201).json(record);
}));

// PUT /api/users/:id/family/:fmId — Edit family member (admin or self)
router.put('/:id/family/:fmId', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  const fmId = parseId(req.params.fmId);
  const old = await req.prisma.familyMember.findUnique({ where: { id: fmId } });
  if (!old || old.userId !== targetId) throw notFound('Record');

  const { name, relationship, dateOfBirth, occupation, phone, isDependent, isNominee, nomineeShare } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (relationship !== undefined) data.relationship = relationship;
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;
  if (occupation !== undefined) data.occupation = occupation;
  if (phone !== undefined) data.phone = phone;
  if (isDependent !== undefined) data.isDependent = isDependent;
  if (isNominee !== undefined) data.isNominee = isNominee;
  if (nomineeShare !== undefined) data.nomineeShare = nomineeShare;

  const record = await req.prisma.familyMember.update({ where: { id: fmId }, data });

  const changes = Object.keys(data).map((f) => ({ field: `family.${f}`, oldValue: String(old[f] ?? ''), newValue: String(data[f] ?? '') }));
  await logChanges(req.prisma, { userId: targetId, changedBy: req.user.id, section: 'family', changes });

  res.json(record);
}));

// ═══════════════════════════════════════════════
// Previous Employment CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/employment-history — Add previous employment (admin or self)
router.post('/:id/employment-history', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  requireFields(req.body, 'company');
  const { company, designation, fromDate, toDate, ctc, reasonForLeaving } = req.body;

  const record = await req.prisma.previousEmployment.create({
    data: { userId: targetId, company, designation, fromDate, toDate, ctc, reasonForLeaving },
  });

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'employment',
    changes: [{ field: `${company}`, oldValue: null, newValue: `Added: ${company}${designation ? ' (' + designation + ')' : ''}` }],
    action: 'add',
  });
  res.status(201).json(record);
}));

// PUT /api/users/:id/employment-history/:empId — Edit previous employment (admin or self)
router.put('/:id/employment-history/:empId', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

  const empId = parseId(req.params.empId);
  const old = await req.prisma.previousEmployment.findUnique({ where: { id: empId } });
  if (!old || old.userId !== targetId) throw notFound('Record');

  const { company, designation, fromDate, toDate, ctc, reasonForLeaving } = req.body;
  const data = {};
  if (company !== undefined) data.company = company;
  if (designation !== undefined) data.designation = designation;
  if (fromDate !== undefined) data.fromDate = fromDate;
  if (toDate !== undefined) data.toDate = toDate;
  if (ctc !== undefined) data.ctc = ctc;
  if (reasonForLeaving !== undefined) data.reasonForLeaving = reasonForLeaving;

  const record = await req.prisma.previousEmployment.update({ where: { id: empId }, data });

  const changes = Object.keys(data).map((f) => ({ field: `employment.${f}`, oldValue: String(old[f] ?? ''), newValue: String(data[f] ?? '') }));
  await logChanges(req.prisma, { userId: targetId, changedBy: req.user.id, section: 'employment', changes });

  res.json(record);
}));

// ═══════════════════════════════════════════════
// Profile Change History (audit trail)
// ═══════════════════════════════════════════════

// GET /api/users/:id/change-history — Profile change log (self or admin)
router.get('/:id/change-history', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'sub_admin' || req.user.role === 'team_lead';
  if (!isSelf && !isAdminOrLead) throw forbidden();

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    req.prisma.profileChangeLog.findMany({
      where: { userId: targetId }, orderBy: { createdAt: 'desc' }, skip: offset, take: limit,
      include: { changedByUser: { select: { id: true, name: true, employeeId: true } } },
    }),
    req.prisma.profileChangeLog.count({ where: { userId: targetId } }),
  ]);

  res.json({ logs, total, page, pages: Math.ceil(total / limit) });
}));

// ═══════════════════════════════════════════════
// Profile Completion Score
// ═══════════════════════════════════════════════

// GET /api/users/completion-summary  — admin: scores for all active users
router.get('/completion-summary', requireAdmin, asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold || '98', 10);

  const users = await req.prisma.user.findMany({
    where: { isActive: true, employmentStatus: 'active' },
    select: {
      id: true, name: true, department: true, designation: true,
      email: true, phone: true, dateOfBirth: true, gender: true,
      bloodGroup: true, nationality: true, address: true, permanentAddress: true,
      profilePhotoUrl: true, driveProfilePhotoUrl: true,
      employeeId: true, dateOfJoining: true, reportingManagerId: true,
      aadhaarNumber: true, panNumber: true, personalEmail: true,
      bankAccountNumber: true, bankIfsc: true, emergencyContact: true,
      _count: { select: { educations: true, familyMembers: true } },
    },
  });

  const { computeProfileCompletion } = require('../utils/profileCompletion');

  const results = users.map(u => {
    const { score, missing } = computeProfileCompletion(u, {
      education: u._count.educations,
      family:    u._count.familyMembers,
    });
    return { id: u.id, name: u.name, department: u.department, designation: u.designation, score, missing };
  });

  const belowThreshold = results.filter(r => r.score < threshold).sort((a, b) => a.score - b.score);
  const avgScore       = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;

  res.json({ avgScore, threshold, total: results.length, belowThreshold, all: results });
}));

// GET /api/users/:id/completion-score
router.get('/:id/completion-score', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'sub_admin' || req.user.role === 'team_lead';
  if (!isSelf && !isAdminOrLead) throw forbidden();

  const user = await req.prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound('User');

  const fields = [
    { key: 'name', label: 'Full Name', weight: 5, section: 'basic' },
    { key: 'middleName', label: 'Middle Name', weight: 3, section: 'basic' },
    { key: 'lastName', label: 'Last Name', weight: 5, section: 'basic' },
    { key: 'email', label: 'Email', weight: 3, section: 'basic' },
    { key: 'phone', label: 'Phone Number', weight: 4, section: 'basic' },
    { key: 'dateOfBirth', label: 'Date of Birth', weight: 3, section: 'basic' },
    { key: 'gender', label: 'Gender', weight: 2, section: 'basic' },
    { key: 'photo', label: 'Profile Photo', weight: 5, section: 'basic' },
    { key: 'employeeId', label: 'Employee ID', weight: 3, section: 'work' },
    { key: 'department', label: 'Department', weight: 3, section: 'work' },
    { key: 'designation', label: 'Designation', weight: 3, section: 'work' },
    { key: 'dateOfJoining', label: 'Date of Joining', weight: 3, section: 'work' },
    { key: 'reportingManagerId', label: 'Reporting Manager', weight: 3, section: 'work' },
    { key: 'location', label: 'Office Location', weight: 2, section: 'work' },
    { key: 'shift', label: 'Shift', weight: 1, section: 'work' },
    { key: 'aadharNumber', label: 'Aadhar Number', weight: 4, section: 'identity' },
    { key: 'panNumber', label: 'PAN Number', weight: 4, section: 'identity' },
    { key: 'personalEmail', label: 'Personal Email', weight: 2, section: 'identity' },
    { key: 'bloodGroup', label: 'Blood Group', weight: 2, section: 'identity' },
    { key: 'maritalStatus', label: 'Marital Status', weight: 1, section: 'identity' },
    { key: 'address', label: 'Address', weight: 3, section: 'identity' },
    { key: 'city', label: 'City', weight: 2, section: 'identity' },
    { key: 'state', label: 'State', weight: 2, section: 'identity' },
    { key: 'pincode', label: 'Pincode', weight: 2, section: 'identity' },
    { key: 'bankName', label: 'Bank Name', weight: 3, section: 'finance' },
    { key: 'bankAccountNumber', label: 'Bank Account', weight: 3, section: 'finance' },
    { key: 'bankIfscCode', label: 'IFSC Code', weight: 3, section: 'finance' },
    { key: 'uanNumber', label: 'UAN Number', weight: 2, section: 'finance' },
    { key: 'pfNumber', label: 'PF Number', weight: 2, section: 'finance' },
    { key: 'emergencyContactName', label: 'Emergency Contact Name', weight: 2, section: 'emergency' },
    { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', weight: 2, section: 'emergency' },
    { key: 'emergencyContactRelation', label: 'Emergency Contact Relation', weight: 1, section: 'emergency' },
    { key: 'reference1Name', label: 'Reference 1 Name', weight: 1, section: 'emergency' },
    { key: 'reference1Phone', label: 'Reference 1 Phone', weight: 1, section: 'emergency' },
    { key: 'reference2Name', label: 'Reference 2 Name', weight: 1, section: 'emergency' },
    { key: 'reference2Phone', label: 'Reference 2 Phone', weight: 1, section: 'emergency' },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  let completedWeight = 0;
  const missing = [];
  const completed = [];

  for (const field of fields) {
    const val = user[field.key];
    const isFilled = val !== null && val !== undefined && val !== '';
    if (isFilled) {
      completedWeight += field.weight;
      completed.push({ key: field.key, label: field.label, section: field.section });
    } else {
      missing.push({ key: field.key, label: field.label, section: field.section, weight: field.weight });
    }
  }

  const score = Math.round((completedWeight / totalWeight) * 100);

  const sections = {};
  for (const field of fields) {
    if (!sections[field.section]) sections[field.section] = { total: 0, completed: 0 };
    sections[field.section].total += field.weight;
    const val = user[field.key];
    if (val !== null && val !== undefined && val !== '') sections[field.section].completed += field.weight;
  }
  for (const key of Object.keys(sections)) {
    sections[key].percent = Math.round((sections[key].completed / sections[key].total) * 100);
  }

  res.json({ score, totalFields: fields.length, completedFields: completed.length, missing: missing.sort((a, b) => b.weight - a.weight), sections });
}));

// ═══════════════════════════════════════════════
// Hibernation — Admin reactivation
// ═══════════════════════════════════════════════

// POST /api/users/:id/reactivate — Reactivate a hibernated account (admin only)
router.post('/:id/reactivate', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const user = await req.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, isHibernated: true } });
  if (!user) throw notFound('User');
  if (!user.isHibernated) throw badRequest('User is not hibernated.');

  await req.prisma.user.update({
    where: { id: targetId },
    data: { isHibernated: false, lastActivityAt: new Date() },
  });

  // Notify the reactivated user
  try {
    const { notifyUsers } = require('../utils/notify');
    await notifyUsers(req.prisma, {
      userIds: [targetId],
      type: 'info',
      title: 'Account Reactivated',
      message: 'Your account has been reactivated by HR. You can now log in and use the system normally.',
      link: '/dashboard',
    });
  } catch (notifyErr) {
    console.error('Failed to notify reactivated user:', notifyErr.message);
  }

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'account',
    changes: [{ field: 'isHibernated', oldValue: 'true', newValue: 'false' }],
    action: 'update',
  });

  res.json({ message: `${user.name}'s account has been reactivated.` });
}));

// ── GET /users/documents-expiring — Admin: docs expiring within N days ────────
router.get('/documents-expiring', requireAdmin, asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + days);

  const todayStr  = today.toISOString().slice(0, 10);
  const futureStr = future.toISOString().slice(0, 10);

  const docs = await req.prisma.employeeDocument.findMany({
    where: {
      expiryDate: { not: null, lte: futureStr },
    },
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });

  res.json(docs);
}));

module.exports = router;
