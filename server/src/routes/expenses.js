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

// Helper: validate fund request linking
async function validateFundLink(prisma, fundRequestId, targetUserId, amount) {
  if (!fundRequestId) return null;
  const fr = await prisma.fundRequest.findUnique({ where: { id: parseInt(fundRequestId) } });
  if (!fr) throw notFound('Fund Request');
  if (fr.requestedBy !== targetUserId) throw forbidden('Fund request belongs to different user');
  if (fr.status !== 'acknowledged') throw badRequest('Fund must be acknowledged before linking expenses');
  const agg = await prisma.expenseClaim.aggregate({
    where: { fundRequestId: fr.id, status: { not: 'rejected' } }, _sum: { amount: true },
  });
  const remaining = (fr.disbursedAmount || 0) - (agg._sum.amount || 0);
  if (parseFloat(amount) > remaining) throw badRequest(`Expense ₹${amount} exceeds remaining balance ₹${remaining.toFixed(2)}`);
  return fr.id;
}

// POST / — Submit new expense claim
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'category', 'amount', 'date');
  const { title, category, amount, description, receiptUrl, date, fundRequestId } = req.body;
  requireEnum(category, VALID_CATEGORIES, 'category');
  if (amount <= 0) throw badRequest('Amount must be positive');

  const frId = await validateFundLink(req.prisma, fundRequestId, req.user.id, amount);

  const expense = await req.prisma.expenseClaim.create({
    data: {
      userId: req.user.id, title, category, amount: parseFloat(amount),
      description: description || null, receiptUrl: receiptUrl || null, date, status: 'pending',
      fundRequestId: frId || null,
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

// POST /admin-create — Admin submits expense on behalf of an employee
router.post('/admin-create', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'title', 'category', 'amount', 'date');
  const { userId, title, category, amount, description, receiptUrl, date, fundRequestId } = req.body;
  requireEnum(category, VALID_CATEGORIES, 'category');
  if (amount <= 0) throw badRequest('Amount must be positive');

  const targetUser = await req.prisma.user.findUnique({ where: { id: parseInt(userId) }, select: { id: true, name: true, isActive: true } });
  if (!targetUser) throw notFound('Employee');
  if (!targetUser.isActive) throw badRequest('Cannot create expense for inactive employee');

  const frId = await validateFundLink(req.prisma, fundRequestId, targetUser.id, amount);

  const expense = await req.prisma.expenseClaim.create({
    data: {
      userId: targetUser.id, title, category, amount: parseFloat(amount),
      description: description || null, receiptUrl: receiptUrl || null, date, status: 'pending',
      fundRequestId: frId || null,
    },
    include: { user: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
  });
  await logExpenseAction(req.prisma, {
    expenseId: expense.id, action: 'submitted', actionBy: req.user.id,
    notes: `Submitted on behalf of ${targetUser.name} by admin ${req.user.name}: ${title} - ₹${amount}`,
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
// Skip if id is not numeric (let fund-request routes handle it)
router.get('/:id(\\d+)', asyncHandler(async (req, res) => {
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

// ═══════════════════════════════════════════════════════════════════════════════
// FUND REQUESTS / ADVANCES
// ═══════════════════════════════════════════════════════════════════════════════

const FUND_STATUSES = ['pending', 'approved', 'rejected', 'disbursed', 'acknowledged', 'settled', 'cancelled'];
const FUND_TYPES = ['advance', 'reimbursement'];
const FUND_CATEGORIES = ['travel', 'food', 'office', 'medical', 'other'];
const PAYMENT_MODES = ['bank_transfer', 'cash'];

async function logFundAction(prisma, { fundRequestId, action, actionBy, notes }) {
  await prisma.fundRequestLog.create({ data: { fundRequestId, action, actionBy, notes: notes || null } });
}

// Compute remaining balance for a fund request
async function getFundBalance(prisma, fundRequestId, disbursedAmount) {
  const agg = await prisma.expenseClaim.aggregate({
    where: { fundRequestId, status: { not: 'rejected' } }, _sum: { amount: true },
  });
  const spent = agg._sum.amount || 0;
  return { spent: Math.round(spent * 100) / 100, remaining: Math.round(((disbursedAmount || 0) - spent) * 100) / 100 };
}

// POST /fund-requests — Submit fund request
router.post('/fund-requests', asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'amount');
  const { title, purpose, amount, date, type, category, billUrl, billDriveId } = req.body;
  if (parseFloat(amount) <= 0) throw badRequest('Amount must be positive');
  const frType = type || 'advance';
  requireEnum(frType, FUND_TYPES, 'type');
  if (frType === 'reimbursement' && category) requireEnum(category, FUND_CATEGORIES, 'category');

  const fr = await req.prisma.fundRequest.create({
    data: {
      requestedBy: req.user.id, title, purpose: purpose || null,
      amount: parseFloat(amount), date: date || new Date().toISOString().slice(0, 10), status: 'pending',
      type: frType, category: category || null, billUrl: billUrl || null, billDriveId: billDriveId || null,
    },
  });
  await logFundAction(req.prisma, { fundRequestId: fr.id, action: 'submitted', actionBy: req.user.id, notes: `${frType === 'reimbursement' ? 'Reimbursement' : 'Advance'} requested ₹${amount} for ${title}` });

  // Notify admins
  const admins = await req.prisma.user.findMany({ where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } }, select: { id: true } });
  notifyUsers(req.prisma, { userIds: admins.map(a => a.id), type: 'fund_request', title: 'New Fund Request', message: `${req.user.name} requested ₹${amount} ${frType === 'reimbursement' ? '(Reimbursement)' : '(Advance)'} for ${title}`, link: '/expenses' });

  res.status(201).json(fr);
}));

// POST /fund-requests/admin-create — Admin creates on behalf
router.post('/fund-requests/admin-create', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'title', 'amount');
  const { userId, title, purpose, amount, date, type, category, billUrl, billDriveId } = req.body;
  const targetUser = await req.prisma.user.findUnique({ where: { id: parseInt(userId) }, select: { id: true, name: true, isActive: true } });
  if (!targetUser) throw notFound('Employee');
  const frType = type || 'advance';
  requireEnum(frType, FUND_TYPES, 'type');
  if (frType === 'reimbursement' && category) requireEnum(category, FUND_CATEGORIES, 'category');

  const fr = await req.prisma.fundRequest.create({
    data: {
      requestedBy: targetUser.id, title, purpose: purpose || null,
      amount: parseFloat(amount), date: date || new Date().toISOString().slice(0, 10), status: 'pending',
      type: frType, category: category || null, billUrl: billUrl || null, billDriveId: billDriveId || null,
    },
  });
  await logFundAction(req.prisma, { fundRequestId: fr.id, action: 'submitted', actionBy: req.user.id, notes: `Created by admin ${req.user.name} for ${targetUser.name}: ₹${amount} (${frType})` });
  res.status(201).json(fr);
}));

// GET /fund-requests/my — Own fund requests with balances
router.get('/fund-requests/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.fundRequest.findMany({
    where: { requestedBy: req.user.id },
    include: { expenses: { where: { status: { not: 'rejected' } }, select: { id: true, title: true, amount: true, date: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const result = requests.map(fr => {
    const spent = fr.expenses.reduce((s, e) => s + e.amount, 0);
    return { ...fr, spent: Math.round(spent * 100) / 100, remaining: Math.round(((fr.disbursedAmount || 0) - spent) * 100) / 100 };
  });
  res.json(result);
}));

// GET /fund-requests/pending — Pending for review (admin)
router.get('/fund-requests/pending', requireAdmin, asyncHandler(async (req, res) => {
  const requests = await req.prisma.fundRequest.findMany({
    where: { status: 'pending' },
    include: { requester: { select: { id: true, name: true, email: true, employeeId: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// GET /fund-requests/all — All with filters (admin)
router.get('/fund-requests/all', requireAdmin, asyncHandler(async (req, res) => {
  const { status, month, userId, type } = req.query;
  const where = {};
  if (status) where.status = status;
  if (month) where.date = { startsWith: month };
  if (userId) where.requestedBy = parseInt(userId);
  if (type && FUND_TYPES.includes(type)) where.type = type;

  const requests = await req.prisma.fundRequest.findMany({
    where,
    include: {
      requester: { select: { id: true, name: true, email: true, employeeId: true, department: true } },
      reviewer: { select: { id: true, name: true } },
      disburser: { select: { id: true, name: true } },
      expenses: { where: { status: { not: 'rejected' } }, select: { id: true, amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const result = requests.map(fr => {
    const spent = fr.expenses.reduce((s, e) => s + e.amount, 0);
    return { ...fr, spent: Math.round(spent * 100) / 100, remaining: Math.round(((fr.disbursedAmount || 0) - spent) * 100) / 100 };
  });
  res.json(result);
}));

// GET /fund-requests/:id — Detail with linked expenses and logs
router.get('/fund-requests/:id(\\d+)', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const fr = await req.prisma.fundRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true, employeeId: true } },
      reviewer: { select: { id: true, name: true } },
      disburser: { select: { id: true, name: true } },
      expenses: { orderBy: { date: 'desc' }, select: { id: true, title: true, category: true, amount: true, date: true, status: true } },
      logs: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!fr) throw notFound('Fund Request');
  if (!isAdminRole(req.user) && fr.requestedBy !== req.user.id) throw forbidden();

  const spent = fr.expenses.reduce((s, e) => e.status !== 'rejected' ? s + e.amount : s, 0);
  res.json({ ...fr, spent: Math.round(spent * 100) / 100, remaining: Math.round(((fr.disbursedAmount || 0) - spent) * 100) / 100 });
}));

// GET /fund-requests/:id/history — Audit trail
router.get('/fund-requests/:id(\\d+)/history', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const fr = await req.prisma.fundRequest.findUnique({ where: { id }, select: { requestedBy: true } });
  if (!fr) throw notFound('Fund Request');
  if (!isAdminRole(req.user) && fr.requestedBy !== req.user.id) throw forbidden();

  const logs = await req.prisma.fundRequestLog.findMany({ where: { fundRequestId: id }, orderBy: { createdAt: 'desc' } });
  // Resolve action by names
  const userIds = [...new Set(logs.map(l => l.actionBy))];
  const users = await req.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameMap = Object.fromEntries(users.map(u => [u.id, u.name]));
  res.json(logs.map(l => ({ ...l, actionByName: nameMap[l.actionBy] || 'Unknown' })));
}));

// PUT /fund-requests/:id/review — Approve or reject
router.put('/fund-requests/:id(\\d+)/review', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'status');
  const { status, reviewNote } = req.body;
  requireEnum(status, ['approved', 'rejected'], 'status');

  const fr = await req.prisma.fundRequest.findUnique({ where: { id } });
  if (!fr) throw notFound('Fund Request');
  if (fr.status !== 'pending') throw badRequest('Only pending requests can be reviewed');

  const updated = await req.prisma.fundRequest.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
  });
  await logFundAction(req.prisma, { fundRequestId: id, action: status, actionBy: req.user.id, notes: reviewNote || `${status} by ${req.user.name}` });

  // Notify requester
  notifyUsers(req.prisma, { userIds: [fr.requestedBy], type: 'fund_request', title: `Fund Request ${status === 'approved' ? 'Approved' : 'Rejected'}`, message: `Your fund request "${fr.title}" has been ${status}${reviewNote ? `: ${reviewNote}` : ''}`, link: '/expenses' });

  res.json(updated);
}));

// PUT /fund-requests/:id/disburse — Disburse funds
router.put('/fund-requests/:id(\\d+)/disburse', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'paymentMode', 'disbursedAmount');
  const { paymentMode, disbursedAmount, paymentRef, paymentReceiptUrl } = req.body;
  requireEnum(paymentMode, PAYMENT_MODES, 'paymentMode');
  if (parseFloat(disbursedAmount) <= 0) throw badRequest('Amount must be positive');
  if (paymentMode === 'bank_transfer' && !paymentRef) throw badRequest('Payment reference required for bank transfers');

  const fr = await req.prisma.fundRequest.findUnique({ where: { id } });
  if (!fr) throw notFound('Fund Request');
  if (fr.status !== 'approved') throw badRequest('Only approved requests can be disbursed');

  const today = new Date().toISOString().slice(0, 10);
  const updated = await req.prisma.fundRequest.update({
    where: { id },
    data: {
      status: 'disbursed', paymentMode, disbursedAmount: parseFloat(disbursedAmount),
      disbursedOn: today, disbursedBy: req.user.id,
      paymentRef: paymentRef || null, paymentReceiptUrl: paymentReceiptUrl || null,
    },
  });
  await logFundAction(req.prisma, { fundRequestId: id, action: 'disbursed', actionBy: req.user.id, notes: `₹${disbursedAmount} via ${paymentMode}${paymentRef ? ` (Ref: ${paymentRef})` : ''}` });

  notifyUsers(req.prisma, { userIds: [fr.requestedBy], type: 'fund_request', title: 'Funds Disbursed', message: `₹${disbursedAmount} has been ${paymentMode === 'bank_transfer' ? 'transferred to your account' : 'handed as cash'}. Please acknowledge receipt.`, link: '/expenses' });

  res.json(updated);
}));

// PUT /fund-requests/:id/acknowledge — Receiver confirms receipt
router.put('/fund-requests/:id(\\d+)/acknowledge', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { acknowledgeNote } = req.body;

  const fr = await req.prisma.fundRequest.findUnique({ where: { id } });
  if (!fr) throw notFound('Fund Request');
  if (fr.requestedBy !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (fr.status !== 'disbursed') throw badRequest('Only disbursed requests can be acknowledged');

  const updated = await req.prisma.fundRequest.update({
    where: { id },
    data: { status: 'acknowledged', acknowledgedAt: new Date(), acknowledgeNote: acknowledgeNote || null },
  });
  await logFundAction(req.prisma, { fundRequestId: id, action: 'acknowledged', actionBy: req.user.id, notes: acknowledgeNote || 'Funds received' });

  res.json(updated);
}));

// PUT /fund-requests/:id/settle — Mark settled
router.put('/fund-requests/:id(\\d+)/settle', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { settledNote } = req.body;

  const fr = await req.prisma.fundRequest.findUnique({ where: { id } });
  if (!fr) throw notFound('Fund Request');
  if (fr.status !== 'acknowledged') throw badRequest('Only acknowledged requests can be settled');

  const today = new Date().toISOString().slice(0, 10);
  const updated = await req.prisma.fundRequest.update({
    where: { id },
    data: { status: 'settled', settledOn: today, settledNote: settledNote || null },
  });
  await logFundAction(req.prisma, { fundRequestId: id, action: 'settled', actionBy: req.user.id, notes: settledNote || 'Settled' });

  res.json(updated);
}));

// PUT /fund-requests/:id/cancel — Cancel
router.put('/fund-requests/:id(\\d+)/cancel', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const fr = await req.prisma.fundRequest.findUnique({ where: { id } });
  if (!fr) throw notFound('Fund Request');

  if (fr.requestedBy === req.user.id && fr.status === 'pending') {
    // Self cancel if pending
  } else if (isAdminRole(req.user) && ['pending', 'approved'].includes(fr.status)) {
    // Admin cancel if not yet disbursed
  } else {
    throw badRequest('Cannot cancel — already disbursed or not authorized');
  }

  const updated = await req.prisma.fundRequest.update({ where: { id }, data: { status: 'cancelled' } });
  await logFundAction(req.prisma, { fundRequestId: id, action: 'cancelled', actionBy: req.user.id });
  res.json(updated);
}));

// DELETE /fund-requests/:id — Hard delete (admin only)
router.delete('/fund-requests/:id(\\d+)', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.fundRequestLog.deleteMany({ where: { fundRequestId: id } });
  await req.prisma.fundRequest.delete({ where: { id } });
  res.json({ message: 'Fund request deleted' });
}));

// GET /fund-balances/my — Get own opening + running balance
router.get('/fund-balances/my', asyncHandler(async (req, res) => {
  req.params.userId = String(req.user.id);
  // falls through to next handler via shared logic below
  const uid = req.user.id;

  const balance = await req.prisma.employeeFundBalance.findUnique({ where: { userId: uid } });
  const advances = await req.prisma.fundRequest.findMany({
    where: { requestedBy: uid, status: { in: ['disbursed', 'acknowledged', 'settled'] } },
    select: { disbursedAmount: true },
  });
  const reimbursements = await req.prisma.fundRequest.findMany({
    where: { requestedBy: uid, type: 'reimbursement', status: { in: ['approved', 'paid'] } },
    select: { amount: true },
  });
  const expenses = await req.prisma.expenseClaim.findMany({
    where: { userId: uid, fundRequestId: { not: null }, status: { not: 'rejected' } },
    select: { amount: true },
  });

  const openingBalance = balance?.openingBalance || 0;
  const totalDisbursed = advances.reduce((s, f) => s + (f.disbursedAmount || 0), 0);
  const totalReimbursed = reimbursements.reduce((s, f) => s + f.amount, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const currentBalance = openingBalance + totalDisbursed + totalReimbursed - totalSpent;

  res.json({
    openingBalance,
    notes: balance?.notes || null,
    setDate: balance?.setDate || null,
    totalDisbursed: Math.round(totalDisbursed * 100) / 100,
    totalReimbursed: Math.round(totalReimbursed * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
  });
}));

// GET /fund-balances/:userId — Get employee's opening balance (admin or self)
router.get('/fund-balances/:userId(\\d+)', asyncHandler(async (req, res) => {
  const uid = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== uid) throw forbidden();

  const balance = await req.prisma.employeeFundBalance.findUnique({ where: { userId: uid } });

  // Compute running balance from all advances/reimbursements
  const advances = await req.prisma.fundRequest.findMany({
    where: { requestedBy: uid, status: { in: ['disbursed', 'acknowledged', 'settled'] } },
    select: { disbursedAmount: true },
  });
  const reimbursements = await req.prisma.fundRequest.findMany({
    where: { requestedBy: uid, type: 'reimbursement', status: { in: ['approved', 'paid'] } },
    select: { amount: true },
  });
  const expenses = await req.prisma.expenseClaim.findMany({
    where: { userId: uid, fundRequestId: { not: null }, status: { not: 'rejected' } },
    select: { amount: true },
  });

  const openingBalance = balance?.openingBalance || 0;
  const totalDisbursed = advances.reduce((s, f) => s + (f.disbursedAmount || 0), 0);
  const totalReimbursed = reimbursements.reduce((s, f) => s + f.amount, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const currentBalance = openingBalance + totalDisbursed + totalReimbursed - totalSpent;

  res.json({
    openingBalance,
    notes: balance?.notes || null,
    setDate: balance?.setDate || null,
    totalDisbursed: Math.round(totalDisbursed * 100) / 100,
    totalReimbursed: Math.round(totalReimbursed * 100) / 100,
    totalSpent: Math.round(totalSpent * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
  });
}));

// PUT /fund-balances/:userId — Set/update opening balance (admin)
router.put('/fund-balances/:userId(\\d+)', requireAdmin, asyncHandler(async (req, res) => {
  const uid = parseId(req.params.userId);
  const { openingBalance, notes } = req.body;
  if (openingBalance === undefined || openingBalance === null) throw badRequest('openingBalance is required');

  const user = await req.prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
  if (!user) throw notFound('Employee');

  const today = new Date().toISOString().slice(0, 10);
  const balance = await req.prisma.employeeFundBalance.upsert({
    where: { userId: uid },
    create: { userId: uid, openingBalance: parseFloat(openingBalance), notes: notes || null, setBy: req.user.id, setDate: today },
    update: { openingBalance: parseFloat(openingBalance), notes: notes || null, setBy: req.user.id, setDate: today },
  });
  res.json(balance);
}));

// GET /fund-requests/ledger — Enhanced date-wise ledger per user (admin)
router.get('/fund-requests/ledger', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, fromDate, toDate } = req.query;
  if (!userId) throw badRequest('userId required');
  const uid = parseInt(userId);

  const dateFilter = {};
  if (fromDate) dateFilter.gte = fromDate;
  if (toDate) dateFilter.lte = toDate;

  // Get opening balance
  const balanceRecord = await req.prisma.employeeFundBalance.findUnique({ where: { userId: uid } });
  const openingBalance = balanceRecord?.openingBalance || 0;

  // Get advance disbursements (credits)
  const advWhere = { requestedBy: uid, type: 'advance', status: { in: ['disbursed', 'acknowledged', 'settled'] } };
  if (fromDate || toDate) advWhere.disbursedOn = dateFilter;
  const advances = await req.prisma.fundRequest.findMany({ where: advWhere, orderBy: { disbursedOn: 'asc' } });

  // Get reimbursements approved (credits)
  const reimWhere = { requestedBy: uid, type: 'reimbursement', status: { in: ['approved', 'disbursed', 'settled'] } };
  if (fromDate || toDate) reimWhere.date = dateFilter;
  const reimbursements = await req.prisma.fundRequest.findMany({ where: reimWhere, orderBy: { date: 'asc' } });

  // Get expenses linked to any fund request (debits)
  const expWhere = { userId: uid, fundRequestId: { not: null }, status: { not: 'rejected' } };
  if (fromDate || toDate) expWhere.date = dateFilter;
  const expenses = await req.prisma.expenseClaim.findMany({ where: expWhere, orderBy: { date: 'asc' } });

  // Build ledger entries
  const entries = [];

  // Opening balance entry (only if no date filter, or if no fromDate)
  if (!fromDate && openingBalance !== 0) {
    entries.push({
      date: balanceRecord?.setDate || '2000-01-01',
      entryType: 'opening',
      description: `Opening Balance${balanceRecord?.notes ? ` — ${balanceRecord.notes}` : ''}`,
      moneyIn: openingBalance > 0 ? openingBalance : 0,
      moneyOut: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      amount: openingBalance,
      ref: 'OPENING',
    });
  }

  advances.forEach(fr => entries.push({
    date: fr.disbursedOn || fr.date,
    entryType: 'advance',
    description: `Advance: ${fr.title}`,
    moneyIn: fr.disbursedAmount || 0,
    moneyOut: 0,
    amount: fr.disbursedAmount || 0,
    ref: `FR-${fr.id}`,
    paymentMode: fr.paymentMode,
  }));

  reimbursements.forEach(fr => entries.push({
    date: fr.disbursedOn || fr.date,
    entryType: 'reimbursement',
    description: `Reimbursement: ${fr.title}${fr.category ? ` (${fr.category})` : ''}`,
    moneyIn: fr.disbursedAmount || fr.amount || 0,
    moneyOut: 0,
    amount: fr.disbursedAmount || fr.amount || 0,
    ref: `FR-${fr.id}`,
  }));

  expenses.forEach(e => entries.push({
    date: e.date,
    entryType: 'expense',
    description: `Expense: ${e.title} (${e.category})`,
    moneyIn: 0,
    moneyOut: e.amount,
    amount: -e.amount,
    ref: `EXP-${e.id}`,
  }));

  entries.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    // Credits before debits on same day
    if (a.entryType === 'opening') return -1;
    if (b.entryType === 'opening') return 1;
    if (a.moneyIn > 0 && b.moneyOut > 0) return -1;
    if (a.moneyOut > 0 && b.moneyIn > 0) return 1;
    return 0;
  });

  // Running balance (start from opening if no fromDate)
  let balance = fromDate ? 0 : 0; // Balance computed fresh from entries
  entries.forEach(e => { balance += e.amount; e.balance = Math.round(balance * 100) / 100; });

  const totalIn = entries.reduce((s, e) => s + e.moneyIn, 0);
  const totalOut = entries.reduce((s, e) => s + e.moneyOut, 0);

  res.json({
    openingBalance,
    entries,
    summary: {
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      currentBalance: Math.round((totalIn - totalOut) * 100) / 100,
      // legacy compat
      totalReceived: Math.round(totalIn * 100) / 100,
      totalSpent: Math.round(totalOut * 100) / 100,
      outstanding: Math.round((totalIn - totalOut) * 100) / 100,
    },
  });
}));

// GET /fund-requests/summary — Aggregate stats (admin)
router.get('/fund-requests/summary', requireAdmin, asyncHandler(async (req, res) => {
  const all = await req.prisma.fundRequest.findMany({
    include: { requester: { select: { id: true, name: true } }, expenses: { where: { status: { not: 'rejected' } }, select: { amount: true } } },
  });

  const advances = all.filter(f => f.type === 'advance');
  const reimbs = all.filter(f => f.type === 'reimbursement');

  const totalRequested = all.reduce((s, f) => s + f.amount, 0);
  const totalDisbursed = all.filter(f => f.disbursedAmount).reduce((s, f) => s + f.disbursedAmount, 0);
  const totalSpent = all.reduce((s, f) => s + f.expenses.reduce((es, e) => es + e.amount, 0), 0);
  const byStatus = {};
  all.forEach(f => { byStatus[f.status] = (byStatus[f.status] || 0) + 1; });
  const byType = { advance: advances.length, reimbursement: reimbs.length };

  // Outstanding per user (advances only)
  const activeRequests = advances.filter(f => ['acknowledged'].includes(f.status));
  const byUser = {};
  activeRequests.forEach(f => {
    const spent = f.expenses.reduce((s, e) => s + e.amount, 0);
    const key = f.requester.name;
    if (!byUser[key]) byUser[key] = { name: key, userId: f.requester.id, disbursed: 0, spent: 0, outstanding: 0, count: 0 };
    byUser[key].disbursed += f.disbursedAmount || 0;
    byUser[key].spent += spent;
    byUser[key].outstanding += (f.disbursedAmount || 0) - spent;
    byUser[key].count++;
  });

  res.json({
    total: all.length, byStatus, byType,
    totalRequested: Math.round(totalRequested), totalDisbursed: Math.round(totalDisbursed),
    totalSpent: Math.round(totalSpent), totalOutstanding: Math.round(totalDisbursed - totalSpent),
    totalReimbursementsPending: reimbs.filter(f => f.status === 'pending').length,
    totalReimbursementsAmount: Math.round(reimbs.reduce((s, f) => s + f.amount, 0)),
    byUser: Object.values(byUser),
  });
}));

module.exports = router;
