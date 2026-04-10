const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { notifyUsers } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(user) {
  return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead';
}

// Helper: build repayment schedule after release
async function createRepaymentSchedule(prisma, advanceId, amount, months, startMonth) {
  const perMonth = Math.round(amount / months);
  const [yr, mn] = startMonth.split('-').map(Number);

  for (let i = 0; i < months; i++) {
    const d = new Date(yr, mn - 1 + i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    // Last instalment absorbs rounding difference
    const instalment = i === months - 1 ? amount - perMonth * (months - 1) : perMonth;
    await prisma.salaryAdvanceRepayment.upsert({
      where: { advanceId_month: { advanceId, month: m } },
      create: { advanceId, month: m, amount: instalment, status: 'pending' },
      update: {},
    });
  }
}

// ─── Employee Routes ─────────────────────────────────────────────

// POST / — Submit advance request
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'amount', 'reason', 'repaymentMonths');
  const { amount, reason, repaymentMonths } = req.body;

  if (parseFloat(amount) <= 0) throw badRequest('Amount must be positive');
  const months = parseInt(repaymentMonths);
  if (months < 1 || months > 12) throw badRequest('Repayment months must be between 1 and 12');

  // Only one active/pending advance at a time
  const existing = await req.prisma.salaryAdvance.findFirst({
    where: { userId: req.user.id, status: { in: ['pending', 'approved', 'released', 'repaying'] } },
  });
  if (existing) throw badRequest('You already have an active salary advance. Complete repayment before requesting a new one.');

  const advance = await req.prisma.salaryAdvance.create({
    data: {
      userId: req.user.id,
      amount: parseFloat(amount),
      reason,
      repaymentMonths: months,
      status: 'pending',
    },
  });

  // Notify admins
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'salary_advance',
    title: 'Salary Advance Request',
    message: `${req.user.name || 'An employee'} requested ₹${amount} salary advance`,
    link: '/admin/salary-advances',
  });

  res.status(201).json(advance);
}));

// GET /my — Own advance history
router.get('/my', asyncHandler(async (req, res) => {
  const advances = await req.prisma.salaryAdvance.findMany({
    where: { userId: req.user.id },
    include: { repayments: { orderBy: { month: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(advances);
}));

// ─── Admin / Manager Routes ───────────────────────────────────────

// GET /pending — Pending approvals
router.get('/pending', asyncHandler(async (req, res) => {
  const where = { status: 'pending' };
  if (!isAdminRole(req.user)) {
    const directReports = await req.prisma.user.findMany({
      where: { reportingManagerId: req.user.id, isActive: true },
      select: { id: true },
    });
    if (directReports.length === 0) return res.json([]);
    where.userId = { in: directReports.map(u => u.id) };
  }
  const advances = await req.prisma.salaryAdvance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true, reportingManagerId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(advances);
}));

// GET /all — All advances with filters (admin)
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const { status, userId, month } = req.query;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = parseInt(userId);
  if (month) where.repaymentStart = { startsWith: month.slice(0, 7) };

  const advances = await req.prisma.salaryAdvance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } },
      repayments: { orderBy: { month: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(advances);
}));

// GET /:id — Single advance detail
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const advance = await req.prisma.salaryAdvance.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true, reportingManagerId: true } },
      approver: { select: { name: true } },
      releaser: { select: { name: true } },
      repayments: { orderBy: { month: 'asc' } },
    },
  });
  if (!advance) throw notFound('Salary Advance');
  const isManager = advance.user.reportingManagerId === req.user.id;
  if (!isAdminRole(req.user) && req.user.id !== advance.userId && !isManager) throw forbidden();
  res.json(advance);
}));

// PUT /:id/review — Approve or reject (manager or admin)
router.put('/:id/review', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, approveNote, approvedAmount } = req.body;
  requireEnum(status, ['approved', 'rejected'], 'status');

  const advance = await req.prisma.salaryAdvance.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, reportingManagerId: true } } },
  });
  if (!advance) throw notFound('Salary Advance');
  if (advance.status !== 'pending') throw badRequest(`Cannot review an advance that is already ${advance.status}`);

  const isManager = advance.user.reportingManagerId === req.user.id;
  if (!isAdminRole(req.user) && !isManager) throw forbidden('You can only review advances of your direct reports');

  const finalAmount = approvedAmount ? parseFloat(approvedAmount) : advance.amount;
  if (status === 'approved' && finalAmount <= 0) throw badRequest('Approved amount must be positive');

  const updated = await req.prisma.salaryAdvance.update({
    where: { id },
    data: {
      status,
      approvedBy: req.user.id,
      approvedAt: new Date(),
      approvedAmount: status === 'approved' ? finalAmount : null,
      approveNote: approveNote || null,
    },
  });

  // Notify employee
  notifyUsers(req.prisma, {
    userIds: [advance.userId], type: 'salary_advance',
    title: `Salary Advance ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
    message: status === 'approved'
      ? `Your advance of ₹${finalAmount} has been approved. Awaiting disbursement.`
      : `Your salary advance request was rejected. ${approveNote || ''}`,
    link: '/payroll/advance',
  });

  res.json(updated);
}));

// PUT /:id/release — Disburse the advance (admin only)
router.put('/:id/release', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'releaseMode', 'repaymentStart');
  const { releaseMode, repaymentStart, releaseNote } = req.body;
  requireEnum(releaseMode, ['bank_transfer', 'cash'], 'releaseMode');

  // Validate repaymentStart format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(repaymentStart)) throw badRequest('repaymentStart must be YYYY-MM format');

  const advance = await req.prisma.salaryAdvance.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!advance) throw notFound('Salary Advance');
  if (advance.status !== 'approved') throw badRequest('Only approved advances can be released');

  const disbursedAmount = advance.approvedAmount || advance.amount;

  const updated = await req.prisma.salaryAdvance.update({
    where: { id },
    data: {
      status: 'released',
      releasedBy: req.user.id,
      releasedAt: new Date(),
      releaseMode,
      releaseNote: releaseNote || null,
      repaymentStart,
    },
  });

  // Create repayment schedule
  await createRepaymentSchedule(req.prisma, id, disbursedAmount, advance.repaymentMonths, repaymentStart);

  // Notify employee
  notifyUsers(req.prisma, {
    userIds: [advance.userId], type: 'salary_advance',
    title: 'Salary Advance Disbursed 💰',
    message: `₹${disbursedAmount} has been released via ${releaseMode === 'bank_transfer' ? 'Bank Transfer' : 'Cash'}. Repayment starts ${repaymentStart}.`,
    link: '/payroll/advance',
  });

  res.json({ ...updated, disbursedAmount });
}));

// GET /:id/repayments — Repayment schedule
router.get('/:id/repayments', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const advance = await req.prisma.salaryAdvance.findUnique({
    where: { id },
    select: { userId: true, user: { select: { reportingManagerId: true } } },
  });
  if (!advance) throw notFound('Salary Advance');
  if (!isAdminRole(req.user) && req.user.id !== advance.userId && req.user.id !== advance.user.reportingManagerId) {
    throw forbidden();
  }
  const repayments = await req.prisma.salaryAdvanceRepayment.findMany({
    where: { advanceId: id },
    orderBy: { month: 'asc' },
  });
  res.json(repayments);
}));

// DELETE /:id — Cancel pending advance (self or admin)
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const advance = await req.prisma.salaryAdvance.findUnique({ where: { id } });
  if (!advance) throw notFound('Salary Advance');
  if (!isAdminRole(req.user) && req.user.id !== advance.userId) throw forbidden();
  if (!['pending', 'approved'].includes(advance.status)) {
    throw badRequest(`Cannot cancel an advance that is ${advance.status}`);
  }
  await req.prisma.salaryAdvance.update({ where: { id }, data: { status: 'rejected' } });
  res.json({ message: 'Advance request cancelled.' });
}));

module.exports = router;
