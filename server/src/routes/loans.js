const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Employee: Request a loan/advance ─────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { amount, purpose, emiAmount, totalEmi, startMonth, notes } = req.body;
  requireFields(req.body, 'amount', 'emiAmount', 'totalEmi');
  if (amount <= 0) throw badRequest('Amount must be positive.');
  if (emiAmount <= 0 || totalEmi <= 0) throw badRequest('EMI amount and count must be positive.');

  // Check for existing active/pending loan
  const existing = await req.prisma.employeeLoan.findFirst({
    where: { userId: req.user.id, status: { in: ['pending', 'approved', 'active'] } },
  });
  if (existing) throw badRequest('You already have an active or pending loan. Repay it before requesting a new one.');

  const loan = await req.prisma.employeeLoan.create({
    data: {
      userId: req.user.id,
      amount: parseFloat(amount),
      purpose: purpose?.trim() || null,
      emiAmount: parseFloat(emiAmount),
      totalEmi: parseInt(totalEmi),
      remainingAmount: parseFloat(amount),
      startMonth: startMonth || null,
      notes: notes?.trim() || null,
    },
  });
  res.status(201).json(loan);
}));

// ── Employee: My loans ────────────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const loans = await req.prisma.employeeLoan.findMany({
    where: { userId: req.user.id },
    include: {
      repayments: { orderBy: { month: 'desc' } },
      approver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(loans);
}));

// ── Employee: Cancel pending loan ─────────────────────────────────────────────
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan not found.');
  if (loan.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (loan.status !== 'pending') throw badRequest('Only pending loans can be cancelled.');

  const updated = await req.prisma.employeeLoan.update({
    where: { id }, data: { status: 'rejected' },
  });
  res.json(updated);
}));

// ── Admin: List all loans ─────────────────────────────────────────────────────
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, userId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = parseInt(userId);

  const loans = await req.prisma.employeeLoan.findMany({
    where,
    include: {
      user:     { select: { id: true, name: true, employeeId: true, department: true } },
      approver: { select: { id: true, name: true } },
      repayments: { orderBy: { month: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(loans);
}));

// ── Admin: Approve/Reject loan ────────────────────────────────────────────────
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, startMonth, notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('Status must be approved or rejected.');

  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan not found.');
  if (loan.status !== 'pending') throw badRequest('Loan is not pending.');

  const data = {
    status: status === 'approved' ? 'active' : 'rejected',
    approvedBy: req.user.id,
    approvedAt: new Date(),
  };
  if (startMonth) data.startMonth = startMonth;
  if (notes) data.notes = notes;

  const updated = await req.prisma.employeeLoan.update({ where: { id }, data });
  res.json(updated);
}));

// ── Admin: Record a repayment (deduct EMI from payslip month) ─────────────────
router.post('/:id/repay', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { month, amount } = req.body;
  requireFields(req.body, 'month', 'amount');

  const loan = await req.prisma.employeeLoan.findUnique({ where: { id } });
  if (!loan) throw notFound('Loan not found.');
  if (!['active', 'approved'].includes(loan.status)) throw badRequest('Loan is not active.');

  // Check duplicate
  const existing = await req.prisma.loanRepayment.findUnique({
    where: { loanId_month: { loanId: id, month } },
  });
  if (existing) throw badRequest(`Repayment for ${month} already recorded.`);

  const repayAmount = parseFloat(amount);
  const newRemaining = Math.max(0, loan.remainingAmount - repayAmount);
  const newPaid = loan.paidEmi + 1;
  const completed = newPaid >= loan.totalEmi || newRemaining <= 0;

  const [repayment] = await req.prisma.$transaction([
    req.prisma.loanRepayment.create({ data: { loanId: id, month, amount: repayAmount } }),
    req.prisma.employeeLoan.update({
      where: { id },
      data: {
        paidEmi: newPaid,
        remainingAmount: newRemaining,
        status: completed ? 'completed' : 'active',
      },
    }),
  ]);
  res.json({ repayment, completed, remainingAmount: newRemaining });
}));

// ── Admin: Get loan summary for payroll month (who needs EMI deduction) ───────
router.get('/payroll-due/:month', requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.params;
  const loans = await req.prisma.employeeLoan.findMany({
    where: { status: 'active' },
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
      repayments: { where: { month } },
    },
  });

  // Filter: started on or before this month AND no repayment yet for this month
  const due = loans.filter(l => {
    if (l.startMonth && l.startMonth > month) return false;
    return l.repayments.length === 0;
  }).map(l => ({
    loanId: l.id,
    userId: l.userId,
    name: l.user?.name,
    employeeId: l.user?.employeeId,
    department: l.user?.department,
    emiAmount: l.emiAmount,
    remainingAmount: l.remainingAmount,
    paidEmi: l.paidEmi,
    totalEmi: l.totalEmi,
  }));

  res.json({ month, count: due.length, due });
}));

module.exports = router;
