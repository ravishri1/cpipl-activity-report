const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { notifyUsers } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

const VALID_CATEGORIES = ['travel', 'food', 'medical', 'office', 'other'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'paid'];
function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

async function logExpenseAction(prisma, { expenseId, action, actionBy, notes }) {
  await prisma.expenseApprovalLog.create({
    data: { expenseId, action, actionBy, notes: notes || null },
  });
}

// POST / — Submit new expense claim
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'category', 'amount', 'date');
  const { title, category, amount, description, receiptUrl, date } = req.body;
  requireEnum(category, VALID_CATEGORIES, 'category');
  if (amount <= 0) throw badRequest('Amount must be positive');

  const expense = await req.prisma.expenseClaim.create({
    data: {
      userId: req.user.id, title, category, amount: parseFloat(amount),
      description: description || null, receiptUrl: receiptUrl || null, date, status: 'pending',
    },
  });
  await logExpenseAction(req.prisma, {
    expenseId: expense.id, action: 'submitted', actionBy: req.user.id,
    notes: `Submitted: ${title} - ₹${amount}`,
  });

  // Notify admins about new expense claim
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'expense',
    title: 'New Expense Claim',
    message: `${req.user.name || 'An employee'} submitted ₹${amount} for ${title}`,
    link: '/expenses',
  });

  res.status(201).json(expense);
}));

// GET /my — Own expense claims
router.get('/my', asyncHandler(async (req, res) => {
  const expenses = await req.prisma.expenseClaim.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(expenses);
}));

// GET /pending — Pending claims for review (admin/team_lead or reporting manager)
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
  const expenses = await req.prisma.expenseClaim.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, reportingManagerId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(expenses);
}));

// GET /all — All expense claims (admin, with optional filters)
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const { status, category, month, userId } = req.query;
  const where = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;
  if (month) where.date = { startsWith: month };
  if (userId) where.userId = parseInt(userId);

  const expenses = await req.prisma.expenseClaim.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, department: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(expenses);
}));

// GET /history/:expenseId — Approval history
router.get('/history/:expenseId', asyncHandler(async (req, res) => {
  const expenseId = parseId(req.params.expenseId);
  const expense = await req.prisma.expenseClaim.findUnique({ where: { id: expenseId } });
  if (!expense) throw notFound('Expense');
  if (!isAdminRole(req.user) && expense.userId !== req.user.id) throw forbidden('Access denied');

  const logs = await req.prisma.expenseApprovalLog.findMany({
    where: { expenseId }, orderBy: { createdAt: 'asc' },
  });
  const userIds = [...new Set(logs.map(l => l.actionBy))];
  const users = await req.prisma.user.findMany({
    where: { id: { in: userIds } }, select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));
  res.json(logs.map(l => ({ ...l, actionByName: userMap[l.actionBy] || 'Unknown' })));
}));

// GET /:id — Single expense detail (admin, self, or reporting manager)
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const expense = await req.prisma.expenseClaim.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, reportingManagerId: true } },
      reviewer: { select: { name: true } },
    },
  });
  if (!expense) throw notFound('Expense');
  const isReportingManager = expense.user.reportingManagerId === req.user.id;
  if (!isAdminRole(req.user) && expense.userId !== req.user.id && !isReportingManager) {
    throw forbidden('Access denied');
  }
  const history = await req.prisma.expenseApprovalLog.findMany({
    where: { expenseId: id }, orderBy: { createdAt: 'asc' },
  });
  res.json({ ...expense, approvalHistory: history });
}));

// PUT /:id/review — Approve or reject expense
router.put('/:id/review', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  requireEnum(status, ['approved', 'rejected'], 'status');

  const expense = await req.prisma.expenseClaim.findUnique({
    where: { id },
    include: { user: { select: { id: true, reportingManagerId: true, role: true } } },
  });
  if (!expense) throw notFound('Expense');
  if (expense.status !== 'pending') throw badRequest(`Cannot review expense with status "${expense.status}"`);

  const isReportingManager = expense.user.reportingManagerId === req.user.id;
  const isLeadershipExpense = expense.user.role === 'team_lead' || expense.user.role === 'admin' || expense.user.role === 'sub_admin';
  if (!isAdminRole(req.user) && !isReportingManager) {
    throw forbidden('You can only review expenses of your direct reports');
  }
  if (isLeadershipExpense && req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
    throw forbidden('Leadership expenses can only be approved by admin');
  }

  const updated = await req.prisma.expenseClaim.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await logExpenseAction(req.prisma, {
    expenseId: id, action: status, actionBy: req.user.id,
    notes: reviewNote || `${status === 'approved' ? 'Approved' : 'Rejected'} by ${req.user.name || 'manager'}`,
  });

  // Notify the requestor about the review decision
  if (expense.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [expense.userId], type: 'expense',
      title: `Expense ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your expense claim has been ${status} by ${req.user.name || 'a reviewer'}`,
      link: '/expenses',
    });
  }

  res.json(updated);
}));

// PUT /:id/paid — Mark expense as paid (admin)
router.put('/:id/paid', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const expense = await req.prisma.expenseClaim.findUnique({ where: { id } });
  if (!expense) throw notFound('Expense');
  if (expense.status !== 'approved') throw badRequest('Only approved expenses can be marked as paid');

  const updated = await req.prisma.expenseClaim.update({
    where: { id },
    data: { status: 'paid', paidOn: new Date().toISOString().slice(0, 10) },
  });
  await logExpenseAction(req.prisma, {
    expenseId: id, action: 'paid', actionBy: req.user.id,
    notes: `Paid on ${updated.paidOn}`,
  });

  // Notify the employee that their expense has been paid
  if (expense.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [expense.userId], type: 'expense',
      title: 'Expense Paid 💰',
      message: `Your expense claim has been paid`,
      link: '/expenses',
    });
  }

  res.json(updated);
}));

// GET /reports/summary — Expense summary for a month (admin)
router.get('/reports/summary', requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('Month is required (format: YYYY-MM)');

  const expenses = await req.prisma.expenseClaim.findMany({
    where: { date: { startsWith: month } },
    include: { user: { select: { name: true, department: true } } },
  });

  const byCategory = {};
  const byStatus = { pending: 0, approved: 0, rejected: 0, paid: 0 };
  const byDepartment = {};
  let totalAmount = 0;

  for (const exp of expenses) {
    if (!byCategory[exp.category]) byCategory[exp.category] = { count: 0, amount: 0 };
    byCategory[exp.category].count++;
    byCategory[exp.category].amount += exp.amount;
    byStatus[exp.status] = (byStatus[exp.status] || 0) + exp.amount;
    const dept = exp.user.department || 'Unassigned';
    if (!byDepartment[dept]) byDepartment[dept] = { count: 0, amount: 0 };
    byDepartment[dept].count++;
    byDepartment[dept].amount += exp.amount;
    totalAmount += exp.amount;
  }

  res.json({
    month, totalClaims: expenses.length, totalAmount: Math.round(totalAmount),
    byCategory, byStatus, byDepartment,
  });
}));

module.exports = router;
