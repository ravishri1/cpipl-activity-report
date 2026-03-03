const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'team_lead'; }

// ============================================================
//  ONBOARDING
// ============================================================

const ONBOARDING_TEMPLATE = [
  { task: 'Submit Aadhaar copy', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit PAN card', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit bank passbook', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit educational certificates', category: 'documents', assignedTo: 'HR' },
  { task: 'Submit passport photos', category: 'documents', assignedTo: 'HR' },
  { task: 'Laptop assignment', category: 'it_setup', assignedTo: 'IT' },
  { task: 'Email account setup', category: 'it_setup', assignedTo: 'IT' },
  { task: 'Software access setup', category: 'it_setup', assignedTo: 'IT' },
  { task: 'Sign offer letter', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Sign NDA', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Fill emergency contact form', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Add bank details', category: 'hr_formalities', assignedTo: 'HR' },
  { task: 'Company orientation', category: 'training', assignedTo: 'Manager' },
  { task: 'Department introduction', category: 'training', assignedTo: 'Manager' },
  { task: 'Tool training', category: 'training', assignedTo: 'Manager' },
];

const VALID_ONBOARDING_CATEGORIES = ['documents', 'it_setup', 'hr_formalities', 'training'];

// 1. GET /onboarding/:userId — Get onboarding checklist (admin or self)
router.get('/onboarding/:userId', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden();

  const user = await req.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, department: true, dateOfJoining: true },
  });
  if (!user) throw notFound('User');

  const checklist = await req.prisma.onboardingChecklist.findMany({
    where: { userId },
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
  });

  res.json({ user, checklist });
}));

// 2. POST /onboarding/:userId — Create checklist items in bulk (admin only)
router.post('/onboarding/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const user = await req.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  const { tasks } = req.body;
  if (!Array.isArray(tasks) || tasks.length === 0) throw badRequest('tasks array is required and must not be empty.');

  const data = tasks.map((t) => {
    if (!t.task) throw badRequest('Each task must have a "task" field.');
    const category = t.category || 'hr_formalities';
    requireEnum(category, VALID_ONBOARDING_CATEGORIES, 'category');
    return { userId, task: t.task, category, dueDate: t.dueDate || null, assignedTo: t.assignedTo || null };
  });

  const created = await req.prisma.onboardingChecklist.createMany({ data });
  res.status(201).json({ message: `${created.count} checklist items created.`, count: created.count });
}));

// 3. POST /onboarding/:userId/from-template — Create default checklist (admin only)
router.post('/onboarding/:userId/from-template', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const user = await req.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  const existing = await req.prisma.onboardingChecklist.count({ where: { userId } });
  if (existing > 0) throw conflict('Onboarding checklist already exists for this user. Delete existing items first or add tasks individually.');

  const data = ONBOARDING_TEMPLATE.map((t) => ({ userId, task: t.task, category: t.category, assignedTo: t.assignedTo }));
  const created = await req.prisma.onboardingChecklist.createMany({ data });

  res.status(201).json({ message: `${created.count} template tasks created for ${user.name}.`, count: created.count });
}));

// 4. PUT /onboarding/task/:id — Toggle task complete/incomplete (admin or self)
router.put('/onboarding/task/:id', asyncHandler(async (req, res) => {
  const taskId = parseId(req.params.id);
  const task = await req.prisma.onboardingChecklist.findUnique({ where: { id: taskId } });
  if (!task) throw notFound('Task');
  if (!isAdminRole(req.user) && req.user.id !== task.userId) throw forbidden();

  const updated = await req.prisma.onboardingChecklist.update({
    where: { id: taskId },
    data: { isCompleted: !task.isCompleted, completedAt: !task.isCompleted ? new Date() : null },
  });
  res.json(updated);
}));

// ============================================================
//  SEPARATION
// ============================================================

const VALID_SEP_TYPES = ['resignation', 'termination', 'absconding', 'retirement'];
const VALID_SEP_STATUSES = ['initiated', 'notice_period', 'fnf_pending', 'completed', 'cancelled'];

// 5. POST /separation — Initiate separation (admin only)
router.post('/separation', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, type, requestDate, lastWorkingDate, reason, noticePeriodDays } = req.body;
  requireFields(req.body, 'userId', 'type', 'requestDate');
  requireEnum(type, VALID_SEP_TYPES, 'type');

  const user = await req.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  const existing = await req.prisma.separation.findUnique({ where: { userId } });
  if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
    throw conflict('An active separation already exists for this user.');
  }
  if (existing) await req.prisma.separation.delete({ where: { userId } });

  const pendingAssets = await req.prisma.asset.count({
    where: { assignedTo: userId, status: 'assigned', isMandatoryReturn: true },
  });

  const separation = await req.prisma.separation.create({
    data: {
      userId, type, requestDate,
      lastWorkingDate: lastWorkingDate || null,
      reason: reason || null,
      noticePeriodDays: noticePeriodDays || 30,
      processedBy: req.user.id,
      allAssetsReturned: pendingAssets === 0,
      fnfHoldReason: pendingAssets > 0 ? `${pendingAssets} mandatory asset(s) pending return` : null,
    },
  });

  // Auto-sync employmentStatus on creation (absconding → immediate block)
  if (type === 'absconding') {
    await req.prisma.user.update({ where: { id: userId }, data: { employmentStatus: 'absconding', isActive: false } });
  }

  res.status(201).json({
    ...separation, pendingAssets,
    assetWarning: pendingAssets > 0
      ? `⚠️ Employee has ${pendingAssets} mandatory asset(s) to return. FnF will be held until all assets are returned.`
      : null,
  });
}));

// 6. GET /separations — List all active separations (admin only)
router.get('/separations', requireAdmin, asyncHandler(async (req, res) => {
  const separations = await req.prisma.separation.findMany({
    where: { status: { notIn: ['completed', 'cancelled'] } },
    include: {
      user: { select: { id: true, name: true, email: true, department: true, designation: true, employeeId: true, dateOfJoining: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(separations);
}));

// 7. GET /separation/:id — Single separation detail (admin only)
router.get('/separation/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const separation = await req.prisma.separation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, department: true, designation: true, employeeId: true, dateOfJoining: true, phone: true, personalEmail: true, profilePhotoUrl: true } },
      processor: { select: { id: true, name: true, email: true } },
    },
  });
  if (!separation) throw notFound('Separation record');

  const pendingAssets = await req.prisma.asset.findMany({
    where: { assignedTo: separation.userId, status: 'assigned', isMandatoryReturn: true },
    select: { id: true, name: true, type: true, assetTag: true, serialNumber: true },
  });

  res.json({ ...separation, pendingAssets, pendingAssetCount: pendingAssets.length });
}));

// 8. PUT /separation/:id — Update separation (admin only)
router.put('/separation/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.separation.findUnique({ where: { id } });
  if (!existing) throw notFound('Separation record');

  const { status, lastWorkingDate, exitInterviewDone, exitInterviewNotes, fnfAmount, fnfPaidOn, allAssetsReturned, assetReturnNotes, fnfHoldReason } = req.body;

  if (status) requireEnum(status, VALID_SEP_STATUSES, 'status');

  if (status === 'completed') {
    const pendingAssets = await req.prisma.asset.count({
      where: { assignedTo: existing.userId, status: 'assigned', isMandatoryReturn: true },
    });
    if (pendingAssets > 0) {
      throw badRequest(`Cannot complete FnF: ${pendingAssets} mandatory asset(s) still not returned. Employee must handover all assets first.`);
    }
  }

  const updateData = {};
  if (status !== undefined) updateData.status = status;
  if (lastWorkingDate !== undefined) updateData.lastWorkingDate = lastWorkingDate;
  if (exitInterviewDone !== undefined) updateData.exitInterviewDone = exitInterviewDone;
  if (exitInterviewNotes !== undefined) updateData.exitInterviewNotes = exitInterviewNotes;
  if (allAssetsReturned !== undefined) updateData.allAssetsReturned = allAssetsReturned;
  if (assetReturnNotes !== undefined) updateData.assetReturnNotes = assetReturnNotes;
  if (fnfHoldReason !== undefined) updateData.fnfHoldReason = fnfHoldReason;
  if (fnfAmount !== undefined) updateData.fnfAmount = fnfAmount;
  if (fnfPaidOn !== undefined) updateData.fnfPaidOn = fnfPaidOn;

  const updated = await req.prisma.separation.update({ where: { id }, data: updateData });

  // ── Auto-sync User.employmentStatus based on separation status changes ──
  if (status) {
    const userUpdate = {};
    if (status === 'notice_period') {
      userUpdate.employmentStatus = 'notice_period';
    } else if (status === 'completed') {
      if (existing.type === 'termination') {
        userUpdate.employmentStatus = 'terminated';
        userUpdate.isActive = false;
      } else if (existing.type === 'absconding') {
        userUpdate.employmentStatus = 'absconding';
        userUpdate.isActive = false;
      } else {
        // resignation / retirement → limited access
        userUpdate.employmentStatus = 'separated';
      }
    } else if (status === 'cancelled') {
      userUpdate.employmentStatus = 'active';
    }

    if (Object.keys(userUpdate).length > 0) {
      await req.prisma.user.update({ where: { id: existing.userId }, data: userUpdate });
    }
  }

  res.json(updated);
}));

// ============================================================
//  ANALYTICS
// ============================================================

// 9. GET /confirmations-due — Employees pending confirmation (admin only)
router.get('/confirmations-due', requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date();
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const cutoffDate = thirtyDaysFromNow.toISOString().split('T')[0];

  const users = await req.prisma.user.findMany({
    where: { isActive: true, confirmationDate: null, probationEndDate: { not: null, lte: cutoffDate } },
    select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, dateOfJoining: true, probationEndDate: true, confirmationDate: true },
    orderBy: { probationEndDate: 'asc' },
  });
  res.json(users);
}));

// 10. GET /new-joinees — Employees who joined in last 30 days (admin only)
router.get('/new-joinees', requireAdmin, asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

  const users = await req.prisma.user.findMany({
    where: { isActive: true, dateOfJoining: { not: null, gte: cutoffDate } },
    select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, dateOfJoining: true, employmentType: true },
    orderBy: { dateOfJoining: 'desc' },
  });

  const usersWithProgress = await Promise.all(
    users.map(async (user) => {
      const totalTasks = await req.prisma.onboardingChecklist.count({ where: { userId: user.id } });
      const completedTasks = await req.prisma.onboardingChecklist.count({ where: { userId: user.id, isCompleted: true } });
      return { ...user, onboardingProgress: { completed: completedTasks, total: totalTasks } };
    })
  );

  res.json(usersWithProgress);
}));

module.exports = router;
