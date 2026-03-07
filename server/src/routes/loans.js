const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return u.role === 'admin' || u.role === 'sub_admin' || u.role === 'team_lead'; }

function generateRepaymentSchedule(loanId, tenureMonths, emiAmount, startMonth) {
  const schedule = [];
  const [startYear, startMon] = startMonth.split('-').map(Number);
  for (let i = 0; i < tenureMonths; i++) {
    const d = new Date(startYear, startMon - 1 + i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    schedule.push({ loanId, month, amount: emiAmount, status: 'pending' });
  }
  return schedule;
}

// GET /api/loans/my
router.get('/my', asyncHandler(async (req, res) => {
  const loans = await req.prisma.employeeLoan.findMany({
    where: { userId: req.user.id },
    include: { repayments: { orderBy: { month: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(loans);
}));

// GET /api/loans — admin: all loans
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, userId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = parseInt(userId);

  const loans = await req.prisma.employeeLoan.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
      approver: { select: { name: true } },
      repayments: { orderBy: { month: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(loans);
}));

// GET /api/loans/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const loan = await req.prisma.employeeLoan.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, employeeId: true } },
      approver: { select: { name: true } },
      repayments: { orderBy: { month: 'asc' } },
    },
  });
  if (!loan) throw notFound('Loan');
  if (loan.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  res.json(loan);
}));

// POST /api/loans — employee requests loan
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'principalAmount', 'tenureMonths', 'purpose');
  const { loanType = 'salary_advance', principalAmount, tenureMonths, purpose, notes } = req.body;
  const principal = parseFloat(principalAmount);
  const tenure = parseInt(tenureMonths);
  const emiAmount = Math.ceil(principal / tenure);

  const loan = await req.prisma.employeeLoan.create({
    data: {
      userId: req.user.id, loanType, principalAmount: principal,
      interestRate: 0, tenureMonths: tenure, emiAmount,
      balanceAmount: principal, purpose, notes: notes || null,
    },
  });
  res.status(201).json(loan);
}));

// PUT /api/loans/:id/approve — admin approves and optionally disburses
router.put('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { disbursedOn, notes } = req.body;

  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan');
  if (loan.status !== 'pending') throw badRequest('Loan is not in pending state');

  const startMonth = disbursedOn
    ? disbursedOn.slice(0, 7)
    : new Date().toISOString().slice(0, 7);

  const updated = await req.prisma.employeeLoan.update({
    where: { id },
    data: {
      status: disbursedOn ? 'disbursed' : 'approved',
      approvedBy: req.user.id, approvedAt: new Date(),
      disbursedOn: disbursedOn || null,
      notes: notes || loan.notes,
    },
  });

  // Generate repayment schedule when disbursed
  if (disbursedOn) {
    const schedule = generateRepaymentSchedule(id, loan.tenureMonths, loan.emiAmount, startMonth);
    await req.prisma.loanRepayment.createMany({ data: schedule });
  }

  res.json(updated);
}));

// PUT /api/loans/:id/disburse — mark as disbursed (if approved first)
router.put('/:id/disburse', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'disbursedOn');
  const { disbursedOn } = req.body;

  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan');
  if (!['approved', 'pending'].includes(loan.status)) throw badRequest('Loan cannot be disbursed in current state');

  const startMonth = disbursedOn.slice(0, 7);
  const updated = await req.prisma.employeeLoan.update({
    where: { id },
    data: { status: 'disbursed', disbursedOn, approvedBy: req.user.id, approvedAt: new Date() },
  });

  const schedule = generateRepaymentSchedule(id, loan.tenureMonths, loan.emiAmount, startMonth);
  await req.prisma.loanRepayment.createMany({ data: schedule, skipDuplicates: true });

  res.json(updated);
}));

// PUT /api/loans/:id/reject — admin rejects
router.put('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan');
  const updated = await req.prisma.employeeLoan.update({
    where: { id },
    data: { status: 'rejected', approvedBy: req.user.id, approvedAt: new Date(), notes: req.body.notes || null },
  });
  res.json(updated);
}));

// PUT /api/loans/repayments/:repaymentId/mark-paid — mark EMI as paid
router.put('/repayments/:repaymentId/mark-paid', requireAdmin, asyncHandler(async (req, res) => {
  const repaymentId = parseId(req.params.repaymentId);
  const repayment = await req.prisma.loanRepayment.findUnique({ where: { id: repaymentId } });
  if (!repayment) throw notFound('Repayment');

  const updated = await req.prisma.loanRepayment.update({
    where: { id: repaymentId },
    data: { status: 'paid', paidOn: req.body.paidOn || new Date().toISOString().slice(0, 10) },
  });

  // Update loan balance
  const remaining = await req.prisma.loanRepayment.aggregate({
    where: { loanId: repayment.loanId, status: { in: ['pending', 'deducted'] } },
    _sum: { amount: true },
  });
  const totalRepaid = await req.prisma.loanRepayment.aggregate({
    where: { loanId: repayment.loanId, status: { in: ['paid', 'deducted'] } },
    _sum: { amount: true },
  });
  await req.prisma.employeeLoan.update({
    where: { id: repayment.loanId },
    data: {
      balanceAmount: remaining._sum.amount || 0,
      totalRepaid: totalRepaid._sum.amount || 0,
      status: (remaining._sum.amount || 0) <= 0 ? 'closed' : 'disbursed',
    },
  });

  res.json(updated);
}));

module.exports = router;
