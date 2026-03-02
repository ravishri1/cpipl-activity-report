const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveBalance,
  getMyLeaveRequests,
  getPendingRequests,
} = require('../services/leave/leaveService');

const router = express.Router();

// GET /api/leave/types — List active leave types
router.get('/types', authenticate, async (req, res) => {
  try {
    const types = await req.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave types.' });
  }
});

// GET /api/leave/balance?year=2026 — Own leave balances
router.get('/balance', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const balances = await getLeaveBalance(req.user.id, year, req.prisma);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave balance.' });
  }
});

// GET /api/leave/my?year=2026&status=all — Own leave requests
router.get('/my', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const status = req.query.status || 'all';
    const requests = await getMyLeaveRequests(req.user.id, year, status, req.prisma);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave requests.' });
  }
});

// GET /api/leave/pending — Pending requests for approvers (admin/team_lead)
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const department = req.user.role === 'team_lead' ? req.user.department : null;
    const requests = await getPendingRequests(department, req.prisma);
    res.json(requests);
  } catch (err) {
    console.error('Pending leave error:', err);
    res.status(500).json({ error: 'Failed to fetch pending requests.' });
  }
});

// POST /api/leave/apply — Apply for leave
router.post('/apply', authenticate, async (req, res) => {
  try {
    const request = await applyLeave(req.user.id, req.body, req.prisma);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/leave/:id/review — Approve or reject a leave request
router.put('/:id/review', authenticate, requireAdmin, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { status, reviewNote } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required (approved or rejected).' });
    }

    const updated = await reviewLeave(requestId, req.user.id, status, reviewNote, req.prisma);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/leave/team-calendar?month=2026-03 — Team leave visibility
// Shows approved/pending leaves of department colleagues to prevent overlaps
router.get('/team-calendar', authenticate, async (req, res) => {
  try {
    const { month, department } = req.query;
    if (!month) return res.status(400).json({ error: 'Month is required (format: YYYY-MM)' });

    // Determine which department to show
    const isAdminUser = req.user.role === 'admin' || req.user.role === 'team_lead';
    const targetDept = isAdminUser && department ? department : req.user.department;

    // Get month boundaries for overlap check
    const [year, mon] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Find all approved/pending leaves that overlap with this month
    const leaves = await req.prisma.leaveRequest.findMany({
      where: {
        status: { in: ['approved', 'pending'] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
        user: targetDept ? { department: targetDept, isActive: true } : { isActive: true },
      },
      include: {
        user: { select: { id: true, name: true, department: true, designation: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    // Group by user for easy rendering
    const byUser = {};
    for (const l of leaves) {
      if (!byUser[l.userId]) {
        byUser[l.userId] = {
          user: l.user,
          leaves: [],
        };
      }
      byUser[l.userId].leaves.push({
        id: l.id,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays,
        status: l.status,
        leaveType: l.leaveType?.name || 'Leave',
        reason: l.reason,
      });
    }

    // Also compute overlap warnings for the requesting user
    const myLeaves = leaves.filter(l => l.userId === req.user.id);
    const othersLeaves = leaves.filter(l => l.userId !== req.user.id);
    const overlaps = [];
    for (const my of myLeaves) {
      for (const other of othersLeaves) {
        // Check date overlap
        if (my.startDate <= other.endDate && my.endDate >= other.startDate) {
          overlaps.push({
            myLeaveId: my.id,
            myDates: `${my.startDate} to ${my.endDate}`,
            overlapsWith: other.user.name,
            theirDates: `${other.startDate} to ${other.endDate}`,
          });
        }
      }
    }

    res.json({
      month,
      department: targetDept || 'All',
      teamLeaves: Object.values(byUser),
      totalOnLeave: Object.keys(byUser).length,
      overlaps,
    });
  } catch (err) {
    console.error('GET /leave/team-calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch team leave calendar' });
  }
});

// GET /api/leave/check-overlap?startDate=2026-03-10&endDate=2026-03-12 — Check overlapping leaves before applying
router.get('/check-overlap', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const dept = req.user.department;
    const overlapping = await req.prisma.leaveRequest.findMany({
      where: {
        status: { in: ['approved', 'pending'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        userId: { not: req.user.id },
        user: dept ? { department: dept, isActive: true } : { isActive: true },
      },
      include: {
        user: { select: { name: true, designation: true } },
        leaveType: { select: { name: true } },
      },
    });

    res.json({
      hasOverlap: overlapping.length > 0,
      count: overlapping.length,
      colleagues: overlapping.map(l => ({
        name: l.user.name,
        designation: l.user.designation,
        dates: `${l.startDate} to ${l.endDate}`,
        days: l.totalDays,
        leaveType: l.leaveType?.name || 'Leave',
        status: l.status,
      })),
    });
  } catch (err) {
    console.error('GET /leave/check-overlap error:', err);
    res.status(500).json({ error: 'Failed to check overlaps' });
  }
});

// DELETE /api/leave/:id — Cancel own pending/approved request
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const result = await cancelLeave(requestId, req.user.id, req.prisma);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
