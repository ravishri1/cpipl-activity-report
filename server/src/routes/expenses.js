const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

const VALID_CATEGORIES = ['travel', 'food', 'medical', 'office', 'other'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

// Helper: log expense action
async function logExpenseAction(prisma, { expenseId, action, actionBy, notes }) {
  await prisma.expenseApprovalLog.create({
    data: { expenseId, action, actionBy, notes: notes || null },
  });
}

// ─── 1. POST / ─── Submit new expense claim
router.post('/', async (req, res) => {
  try {
    const { title, category, amount, description, receiptUrl, date } = req.body;

    if (!title || !category || !amount || !date) {
      return res.status(400).json({ error: 'Title, category, amount, and date are required' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const expense = await req.prisma.expenseClaim.create({
      data: {
        userId: req.user.id,
        title,
        category,
        amount: parseFloat(amount),
        description: description || null,
        receiptUrl: receiptUrl || null,
        date,
        status: 'pending',
      },
    });

    // Log submission
    await logExpenseAction(req.prisma, {
      expenseId: expense.id, action: 'submitted', actionBy: req.user.id,
      notes: `Submitted: ${title} - ₹${amount}`,
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error('POST /expenses error:', err);
    res.status(500).json({ error: 'Failed to submit expense claim' });
  }
});

// ─── 2. GET /my ─── Own expense claims
router.get('/my', async (req, res) => {
  try {
    const expenses = await req.prisma.expenseClaim.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(expenses);
  } catch (err) {
    console.error('GET /expenses/my error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// ─── 3. GET /pending ─── Pending claims for review
// Admin/team_lead sees all pending. Reporting managers see their direct reports' expenses.
router.get('/pending', async (req, res) => {
  try {
    const where = { status: 'pending' };

    // If not admin, only show expenses from direct reports
    if (!isAdmin(req)) {
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
  } catch (err) {
    console.error('GET /expenses/pending error:', err);
    res.status(500).json({ error: 'Failed to fetch pending expenses' });
  }
});

// ─── 4. GET /all ─── All expense claims (admin, with optional filters)
router.get('/all', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

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
  } catch (err) {
    console.error('GET /expenses/all error:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// ─── 5. GET /history/:expenseId ─── Approval history for an expense
router.get('/history/:expenseId', async (req, res) => {
  try {
    const expenseId = parseInt(req.params.expenseId);
    const expense = await req.prisma.expenseClaim.findUnique({ where: { id: expenseId } });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (!isAdmin(req) && expense.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await req.prisma.expenseApprovalLog.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });

    // Attach actor names
    const userIds = [...new Set(logs.map(l => l.actionBy))];
    const users = await req.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    const result = logs.map(l => ({ ...l, actionByName: userMap[l.actionBy] || 'Unknown' }));
    res.json(result);
  } catch (err) {
    console.error('GET /expenses/history/:expenseId error:', err);
    res.status(500).json({ error: 'Failed to fetch expense history' });
  }
});

// ─── 6. GET /:id ─── Single expense detail
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await req.prisma.expenseClaim.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, reportingManagerId: true } },
        reviewer: { select: { name: true } },
      },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Access: admin, self, or reporting manager
    const isReportingManager = expense.user.reportingManagerId === req.user.id;
    if (!isAdmin(req) && expense.userId !== req.user.id && !isReportingManager) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Attach approval history
    const history = await req.prisma.expenseApprovalLog.findMany({
      where: { expenseId: id },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ ...expense, approvalHistory: history });
  } catch (err) {
    console.error('GET /expenses/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// ─── 7. PUT /:id/review ─── Approve or reject expense
// Hierarchy: Reporting manager approves their reports. Admin/owner approves leadership.
router.put('/:id/review', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, reviewNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const expense = await req.prisma.expenseClaim.findUnique({
      where: { id },
      include: { user: { select: { id: true, reportingManagerId: true, role: true } } },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: `Cannot review expense with status "${expense.status}"` });
    }

    // Authorization check:
    // 1. Admin can approve anyone's expenses
    // 2. Reporting manager can approve their direct reports' expenses
    // 3. Leadership/team_lead expenses can only be approved by admin (owner)
    const isReportingManager = expense.user.reportingManagerId === req.user.id;
    const isLeadershipExpense = expense.user.role === 'team_lead' || expense.user.role === 'admin';

    if (!isAdmin(req) && !isReportingManager) {
      return res.status(403).json({ error: 'You can only review expenses of your direct reports' });
    }

    if (isLeadershipExpense && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Leadership expenses can only be approved by admin' });
    }

    const updated = await req.prisma.expenseClaim.update({
      where: { id },
      data: {
        status,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Log the action
    await logExpenseAction(req.prisma, {
      expenseId: id, action: status, actionBy: req.user.id,
      notes: reviewNote || `${status === 'approved' ? 'Approved' : 'Rejected'} by ${req.user.name || 'manager'}`,
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /expenses/:id/review error:', err);
    res.status(500).json({ error: 'Failed to review expense' });
  }
});

// ─── 8. PUT /:id/paid ─── Mark expense as paid (admin)
router.put('/:id/paid', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
    const expense = await req.prisma.expenseClaim.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved expenses can be marked as paid' });
    }

    const updated = await req.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: 'paid',
        paidOn: new Date().toISOString().slice(0, 10),
      },
    });

    await logExpenseAction(req.prisma, {
      expenseId: id, action: 'paid', actionBy: req.user.id,
      notes: `Paid on ${updated.paidOn}`,
    });

    res.json(updated);
  } catch (err) {
    console.error('PUT /expenses/:id/paid error:', err);
    res.status(500).json({ error: 'Failed to mark expense as paid' });
  }
});

// ─── 9. GET /reports/summary ─── Expense summary for a month (admin)
router.get('/reports/summary', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'Month is required (format: YYYY-MM)' });

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
      month,
      totalClaims: expenses.length,
      totalAmount: Math.round(totalAmount),
      byCategory,
      byStatus,
      byDepartment,
    });
  } catch (err) {
    console.error('GET /expenses/reports/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch expense summary' });
  }
});

module.exports = router;
