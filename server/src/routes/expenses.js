const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Helper: check if user is admin or team_lead
function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

// Valid categories and statuses
const VALID_CATEGORIES = ['travel', 'food', 'medical', 'office', 'other'];
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'paid'];

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

// ─── 3. GET /pending ─── Pending claims for admin review
router.get('/pending', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const expenses = await req.prisma.expenseClaim.findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { id: true, name: true, email: true, employeeId: true, department: true } },
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

// ─── 5. GET /:id ─── Single expense detail
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const expense = await req.prisma.expenseClaim.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true } },
        reviewer: { select: { name: true } },
      },
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (!isAdmin(req) && expense.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(expense);
  } catch (err) {
    console.error('GET /expenses/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// ─── 6. PUT /:id/review ─── Approve or reject expense (admin)
router.put('/:id/review', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
    const { status, reviewNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const expense = await req.prisma.expenseClaim.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: `Cannot review expense with status "${expense.status}"` });
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

    res.json(updated);
  } catch (err) {
    console.error('PUT /expenses/:id/review error:', err);
    res.status(500).json({ error: 'Failed to review expense' });
  }
});

// ─── 7. PUT /:id/paid ─── Mark expense as paid (admin)
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

    res.json(updated);
  } catch (err) {
    console.error('PUT /expenses/:id/paid error:', err);
    res.status(500).json({ error: 'Failed to mark expense as paid' });
  }
});

// ─── 8. GET /summary ─── Expense summary for a month (admin)
router.get('/reports/summary', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'Month is required (format: YYYY-MM)' });

    const expenses = await req.prisma.expenseClaim.findMany({
      where: { date: { startsWith: month } },
      include: {
        user: { select: { name: true, department: true } },
      },
    });

    // Aggregate by category
    const byCategory = {};
    const byStatus = { pending: 0, approved: 0, rejected: 0, paid: 0 };
    const byDepartment = {};
    let totalAmount = 0;

    for (const exp of expenses) {
      // By category
      if (!byCategory[exp.category]) byCategory[exp.category] = { count: 0, amount: 0 };
      byCategory[exp.category].count++;
      byCategory[exp.category].amount += exp.amount;

      // By status
      byStatus[exp.status] = (byStatus[exp.status] || 0) + exp.amount;

      // By department
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
