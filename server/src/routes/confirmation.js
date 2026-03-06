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

// ── POST /api/confirmation/:userId/extend — extend confirmation due date ──
// Caller must be admin OR the reporting manager of this employee
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

  // Only admin or direct reporting manager may extend
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  const isManager = employee.reportingManagerId === req.user.id;
  if (!isAdmin && !isManager) {
    throw forbidden('Only the reporting manager or an admin can extend confirmation');
  }

  // Validate new due date is in the future
  const today = new Date().toISOString().slice(0, 10);
  if (newDueDate <= today) {
    throw badRequest('New due date must be in the future');
  }

  const previousDueDate = employee.confirmationDate || today;

  // Create extension audit record + update employee
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

  // Confirm employee + create insurance placeholder in one transaction
  await req.prisma.$transaction([
    req.prisma.user.update({
      where: { id: userId },
      data: {
        confirmationStatus: 'confirmed',
        confirmedAt: today,
        benefitsUnlocked: true,
      },
    }),
    req.prisma.insuranceCard.create({
      data: {
        userId,
        uploadedById: req.user.id,
        status: 'pending_setup',
        cardNumber: `PENDING-${employee.employeeId || userId}`,
        provider: 'Pending',
        planName: 'Pending Setup',
        coverageAmount: 0,
        premium: 0,
        startDate: today,
        endDate: today,
        notes: 'Auto-created on employee confirmation. Admin must complete setup.',
      },
    }),
  ]);

  // Send emails (non-blocking — don't fail the confirmation if emails fail)
  try {
    if (employee.email) {
      await sendConfirmationLetter(employee.email, employee.name, today);
    }
  } catch (e) {
    console.error('Failed to send confirmation letter:', e.message);
  }

  // Notify all admins
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
    message: `${employee.name} has been confirmed. Insurance card placeholder created.`,
    confirmedAt: today,
    benefitsUnlocked: true,
  });
}));

// ── GET /api/confirmation/:userId/history — extension history for employee ──
router.get('/:userId/history', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);

  // Only self or admin may view
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead' && req.user.id !== userId) {
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
