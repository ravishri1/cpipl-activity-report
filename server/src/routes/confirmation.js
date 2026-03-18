const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const {
  sendConfirmationDueAlert,
  sendConfirmationDueManagerAlert,
  sendConfirmationLetter,
  sendConfirmationAdminNotify,
} = require('../services/notifications/emailService');

const router = express.Router();
router.use(authenticate);

// ── GET /api/confirmation/due — list internal employees with pending/extended confirmations ──
router.get('/due', requireAdmin, asyncHandler(async (req, res) => {
  const employees = await req.prisma.user.findMany({
    where: {
      employeeType: 'internal',
      confirmationStatus: { in: ['pending', 'extended'] },
      isActive: true,
    },
    orderBy: { confirmationDate: 'asc' },
    select: {
      id: true,
      name: true,
      employeeId: true,
      designation: true,
      department: true,
      confirmationDate: true,
      confirmationStatus: true,
      dateOfJoining: true,
      reportingManagerId: true,
      reportingManager: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { confirmationExtensions: true },
      },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const result = employees.map(emp => ({
    ...emp,
    isOverdue: emp.confirmationDate && emp.confirmationDate < today,
    extensionCount: emp._count.confirmationExtensions,
  }));

  res.json(result);
}));

// ── GET /api/confirmation/all — list ALL internal employees (for bulk update) ──
// MUST be before /:userId routes to avoid matching "all" as userId
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const employees = await req.prisma.user.findMany({
    where: {
      employeeType: 'internal',
      isActive: true,
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      employeeId: true,
      designation: true,
      department: true,
      dateOfJoining: true,
      confirmationDate: true,
      probationEndDate: true,
      confirmationStatus: true,
      confirmedAt: true,
      benefitsUnlocked: true,
      reportingManager: {
        select: { id: true, name: true },
      },
    },
  });
  res.json(employees);
}));

// ── PUT /api/confirmation/bulk-update — bulk update confirmation dates / status ──
// MUST be before /:userId routes
router.put('/bulk-update', requireAdmin, asyncHandler(async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    throw badRequest('updates array is required and must not be empty');
  }
  if (updates.length > 200) {
    throw badRequest('Maximum 200 updates at a time');
  }

  // Build all update operations first, then run in a single transaction
  const operations = [];
  for (const u of updates) {
    const userId = parseId(u.userId);
    const data = {};
    if (u.confirmationDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(u.confirmationDate)) {
        throw badRequest(`Invalid date format for user ${userId}: ${u.confirmationDate}`);
      }
      data.confirmationDate = u.confirmationDate;
    }
    if (u.probationEndDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(u.probationEndDate)) {
        throw badRequest(`Invalid date format for user ${userId}: ${u.probationEndDate}`);
      }
      data.probationEndDate = u.probationEndDate;
    }
    if (u.confirmationStatus) {
      if (!['pending', 'extended', 'confirmed'].includes(u.confirmationStatus)) {
        throw badRequest(`Invalid status for user ${userId}: ${u.confirmationStatus}`);
      }
      data.confirmationStatus = u.confirmationStatus;
      if (u.confirmationStatus === 'confirmed') {
        data.confirmedAt = new Date().toISOString().slice(0, 10);
        data.benefitsUnlocked = true;
      }
    }

    if (Object.keys(data).length === 0) continue;

    operations.push(
      req.prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, confirmationDate: true, probationEndDate: true, confirmationStatus: true },
      })
    );
  }

  if (operations.length === 0) {
    return res.json({ message: '0 employee(s) updated', results: [] });
  }

  // Execute all updates in a single transaction (much faster than one-by-one)
  const results = await req.prisma.$transaction(operations);

  res.json({ message: `${results.length} employee(s) updated`, results });
}));

// ── POST /api/confirmation/bulk-confirm — bulk confirm multiple employees ──
// MUST be before /:userId routes
router.post('/bulk-confirm', requireAdmin, asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw badRequest('userIds array is required');
  }
  if (userIds.length > 50) {
    throw badRequest('Maximum 50 confirmations at a time');
  }

  const today = new Date().toISOString().slice(0, 10);
  const confirmed = [];
  const errors = [];

  for (const uid of userIds) {
    const userId = parseId(uid);
    try {
      const employee = await req.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, employeeId: true, employeeType: true, confirmationStatus: true, email: true },
      });
      if (!employee) { errors.push({ userId, error: 'Not found' }); continue; }
      if (employee.employeeType !== 'internal') { errors.push({ userId, error: 'Not internal' }); continue; }
      if (employee.confirmationStatus === 'confirmed') { errors.push({ userId, error: 'Already confirmed' }); continue; }

      await req.prisma.user.update({
        where: { id: userId },
        data: { confirmationStatus: 'confirmed', confirmedAt: today, benefitsUnlocked: true },
      });

      confirmed.push({ userId, name: employee.name });

      // Send confirmation letter (non-blocking)
      if (employee.email) {
        sendConfirmationLetter(employee.email, employee.name, today).catch(() => {});
      }
    } catch (e) {
      errors.push({ userId, error: e.message });
    }
  }

  res.json({
    message: `${confirmed.length} employee(s) confirmed`,
    confirmed,
    errors: errors.length > 0 ? errors : undefined,
  });
}));

// ── POST /api/confirmation/:userId/extend — extend confirmation due date ──
router.post('/:userId/extend', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  requireFields(req.body, 'newDueDate', 'reason');

  const { newDueDate, reason } = req.body;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDueDate)) {
    throw badRequest('newDueDate must be in YYYY-MM-DD format');
  }

  const employee = await req.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      employeeType: true,
      confirmationDate: true,
      confirmationStatus: true,
      reportingManagerId: true,
    },
  });
  if (!employee) throw notFound('Employee');
  if (employee.employeeType !== 'internal') {
    throw badRequest('Confirmation extension only applies to internal employees');
  }
  if (!['pending', 'extended'].includes(employee.confirmationStatus)) {
    throw badRequest('Employee confirmation is not in a pending or extended state');
  }

  const isAdmin = req.user.role === 'admin' || req.user.role === 'sub_admin' || req.user.role === 'team_lead';
  const isManager = employee.reportingManagerId === req.user.id;
  if (!isAdmin && !isManager) {
    throw forbidden('Only the reporting manager or an admin can extend confirmation');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (newDueDate <= today) {
    throw badRequest('New due date must be in the future');
  }

  const previousDueDate = employee.confirmationDate || today;

  const [extension] = await req.prisma.$transaction([
    req.prisma.confirmationExtension.create({
      data: {
        userId,
        extendedBy: req.user.id,
        previousDueDate,
        newDueDate,
        reason,
      },
    }),
    req.prisma.user.update({
      where: { id: userId },
      data: {
        confirmationDate: newDueDate,
        confirmationStatus: 'extended',
      },
    }),
  ]);

  res.status(201).json({
    message: `Confirmation extended to ${newDueDate}`,
    extension,
  });
}));

// ── POST /api/confirmation/:userId/confirm — confirm employee (admin only) ──
router.post('/:userId/confirm', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);

  const employee = await req.prisma.user.findUnique({
    where: { id: userId },
    include: {
      reportingManager: { select: { name: true, email: true } },
    },
  });
  if (!employee) throw notFound('Employee');
  if (employee.employeeType !== 'internal') {
    throw badRequest('Confirmation only applies to internal employees');
  }
  if (employee.confirmationStatus === 'confirmed') {
    throw badRequest('Employee is already confirmed');
  }

  const today = new Date().toISOString().slice(0, 10);

  await req.prisma.user.update({
    where: { id: userId },
    data: {
      confirmationStatus: 'confirmed',
      confirmedAt: today,
      benefitsUnlocked: true,
    },
  });

  try {
    if (employee.email) {
      await sendConfirmationLetter(employee.email, employee.name, today);
    }
  } catch (e) {
    console.error('Failed to send confirmation letter:', e.message);
  }

  try {
    const admins = await req.prisma.user.findMany({
      where: { role: { in: ['admin', 'team_lead'] }, isActive: true },
      select: { email: true, name: true },
    });
    for (const admin of admins) {
      if (admin.email) {
        await sendConfirmationAdminNotify(admin.email, employee.name).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Failed to send admin confirmation notifications:', e.message);
  }

  res.json({
    message: `${employee.name} has been confirmed successfully.`,
    confirmedAt: today,
    benefitsUnlocked: true,
  });
}));

// ── GET /api/confirmation/:userId/history — extension history for employee ──
router.get('/:userId/history', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);

  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.role !== 'team_lead' && req.user.id !== userId) {
    throw forbidden();
  }

  const extensions = await req.prisma.confirmationExtension.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      extender: { select: { id: true, name: true, role: true } },
    },
  });

  res.json(extensions);
}));

module.exports = router;
