const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireManagerOrAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { normalizeEmail, normalizeName } = require('../utils/normalize');
const { maskUserName, maskUserNames, canSeeFullNames } = require('../utils/namePrivacy');
const { processProfilePhoto } = require('../services/photoProcessor');

const router = express.Router();

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
// Photo Upload (base64 — no external storage needed)
// ═══════════════════════════════════════════════

// POST /api/users/:id/photo — Upload profile photo as base64 (self or admin)
// Photo is automatically processed: background whitened, cropped to headshot,
// enhanced; male profiles also get glasses/cap removed via AI.
router.post('/:id/photo', authenticate, express.json({ limit: '5mb' }), asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) throw forbidden('You can only upload your own photo.');

  const { photo } = req.body;
  if (!photo || !photo.startsWith('data:image/')) throw badRequest('Invalid image data.');
  // No manual size check — sharp compresses the output to well under 500 KB

  // Look up existing photo + gender for conditional AI processing
  const existing = await req.prisma.user.findUnique({
    where:  { id: targetId },
    select: { profilePhotoUrl: true, gender: true },
  });

  // Decode base64 data URL → buffer
  const commaIdx = photo.indexOf(',');
  const inputMime = photo.slice(5, photo.indexOf(';'));          // "data:image/jpeg;base64,…"
  const inputBuf  = Buffer.from(photo.slice(commaIdx + 1), 'base64');

  // Run through AI + sharp pipeline
  const { buffer: processed, mimeType: outMime } = await processProfilePhoto(
    inputBuf, inputMime, { gender: existing?.gender ?? null }
  );

  // Re-encode to base64 data URL for storage
  const processedPhoto = `data:${outMime};base64,${processed.toString('base64')}`;

  const user = await req.prisma.user.update({
    where: { id: targetId },
    data:  { profilePhotoUrl: processedPhoto },
    select: { id: true, profilePhotoUrl: true },
  });

  await logChanges(req.prisma, {
    userId: targetId, changedBy: req.user.id, section: 'photo',
    changes: [{ field: 'profilePhotoUrl', oldValue: existing?.profilePhotoUrl ? '(had photo)' : null, newValue: '(photo updated)' }],
    action: existing?.profilePhotoUrl ? 'update' : 'add',
  });

  res.json({ profilePhotoUrl: user.profilePhotoUrl });
}));

// ═══════════════════════════════════════════════
// Employee Directory & Profile (HR)
// ═══════════════════════════════════════════════

// GET /api/users/directory — Employee directory (all active users, public fields)
router.get('/directory', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.department && req.query.department !== 'all') where.department = req.query.department;
  if (req.query.company && req.query.company !== 'all') where.companyId = parseInt(req.query.company);
  if (req.query.search) {
    where.OR = [
      { name: { contains: req.query.search, mode: 'insensitive' } },
      { email: { contains: req.query.search, mode: 'insensitive' } },
      { designation: { contains: req.query.search, mode: 'insensitive' } },
      { employeeId: { contains: req.query.search, mode: 'insensitive' } },
    ];
  }

  const employees = await req.prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, department: true, designation: true, employeeId: true,
      profilePhotoUrl: true, driveProfilePhotoUrl: true, phone: true, dateOfJoining: true, role: true, location: true,
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

// GET /api/users/departments — List unique departments
router.get('/departments', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const departments = await req.prisma.user.findMany({
    where: { isActive: true }, select: { department: true }, distinct: ['department'], orderBy: { department: 'asc' },
  });
  res.json(departments.map((d) => d.department));
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
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'team_lead';
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
      company: { select: { id: true, name: true, shortName: true } },
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
  const isAdmin = req.user.role === 'admin';
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
    ];
    adminFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.body.reportingManagerId !== undefined) data.reportingManagerId = req.body.reportingManagerId || null;
    if (req.body.companyId !== undefined) data.companyId = req.body.companyId ? parseInt(req.body.companyId) : null;
  }

  if (data.name) data.name = normalizeName(data.name);
  if (data.email) data.email = normalizeEmail(data.email);
  if (data.personalEmail) data.personalEmail = normalizeEmail(data.personalEmail);
  if (data.fatherName) data.fatherName = normalizeName(data.fatherName);
  if (data.spouseName) data.spouseName = normalizeName(data.spouseName);

  if (Object.keys(data).length === 0) throw badRequest('No fields to update.');

  const oldUser = await req.prisma.user.findUnique({ where: { id: targetId } });

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
      company: { select: { id: true, name: true, shortName: true } },
    },
  });

  const changes = Object.keys(data).map((field) => ({ field, oldValue: oldUser[field], newValue: data[field] }));
  await logChanges(req.prisma, { userId: targetId, changedBy: req.user.id, section: 'profile', changes });

  res.json(user);
}));

// GET /api/users/:id/documents — List employee documents (self or admin)
router.get('/:id/documents', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin';
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
      isActive: true, isHibernated: true, lastActivityAt: true, createdAt: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

// POST /api/users - Create user
router.post('/', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'email', 'password');
  const { name, email, password, role, department, companyId } = req.body;

  const normalizedEmail = normalizeEmail(email);
  const existing = await req.prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw conflict('Email already exists.');

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await req.prisma.user.create({
    data: {
      name: normalizeName(name), email: normalizedEmail, password: hashedPassword,
      role: role || 'member', department: department || 'General',
      companyId: companyId ? parseInt(companyId) : null,
    },
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department });
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
  await req.prisma.user.update({ where: { id: parseId(req.params.id) }, data: { isActive: false } });
  res.json({ message: 'User deactivated.' });
}));

// ═══════════════════════════════════════════════
// Education CRUD
// ═══════════════════════════════════════════════

// POST /api/users/:id/education — Add education record (admin or self)
router.post('/:id/education', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  if (req.user.id !== targetId && req.user.role !== 'admin') throw forbidden();

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
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'team_lead';
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

// GET /api/users/:id/completion-score
router.get('/:id/completion-score', authenticate, asyncHandler(async (req, res) => {
  const targetId = parseId(req.params.id);
  const isSelf = req.user.id === targetId;
  const isAdminOrLead = req.user.role === 'admin' || req.user.role === 'team_lead';
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

module.exports = router;
