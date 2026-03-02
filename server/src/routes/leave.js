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
