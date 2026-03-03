const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const {
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveBalance,
  getMyLeaveRequests,
  getPendingRequests,
} = require('../services/leave/leaveService');
const { notifyUsers } = require('../utils/notify');

const router = express.Router();

// GET /api/leave/types — List active leave types
router.get('/types', authenticate, asyncHandler(async (req, res) => {
  const types = await req.prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(types);
}));

// GET /api/leave/balance?year=2026 — Own leave balances
router.get('/balance', authenticate, asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const balances = await getLeaveBalance(req.user.id, year, req.prisma);
  res.json(balances);
}));

// GET /api/leave/my?year=2026&status=all — Own leave requests
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const status = req.query.status || 'all';
  const requests = await getMyLeaveRequests(req.user.id, year, status, req.prisma);
  res.json(requests);
}));

// GET /api/leave/pending — Pending requests for approvers (admin/team_lead)
router.get('/pending', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const department = req.user.role === 'team_lead' ? req.user.department : null;
  const requests = await getPendingRequests(department, req.prisma);
  res.json(requests);
}));

// POST /api/leave/apply — Apply for leave
router.post('/apply', authenticate, asyncHandler(async (req, res) => {
  const request = await applyLeave(req.user.id, req.body, req.prisma);

  // Notify admins/team leads about new leave request
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'leave',
    title: 'New Leave Request',
    message: `${req.user.name || 'An employee'} applied for leave (${req.body.startDate} to ${req.body.endDate})`,
    link: '/leave',
  });

  res.status(201).json(request);
}));

// PUT /api/leave/:id/review — Approve or reject a leave request
router.put('/:id/review', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!status) throw badRequest('Status is required (approved or rejected).');
  const updated = await reviewLeave(requestId, req.user.id, status, reviewNote, req.prisma);

  // Notify the requestor about the review decision
  if (updated.userId && updated.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [updated.userId], type: 'leave',
      title: `Leave Request ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your leave request has been ${status} by ${req.user.name || 'an admin'}`,
      link: '/leave',
    });
  }

  res.json(updated);
}));

// GET /api/leave/team-calendar?month=2026-03 — Team leave visibility
router.get('/team-calendar', authenticate, asyncHandler(async (req, res) => {
  const { month, department } = req.query;
  if (!month) throw badRequest('Month is required (format: YYYY-MM)');

  const isAdminUser = req.user.role === 'admin' || req.user.role === 'team_lead';
  const targetDept = isAdminUser && department ? department : req.user.department;

  const [year, mon] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

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

  const byUser = {};
  for (const l of leaves) {
    if (!byUser[l.userId]) {
      byUser[l.userId] = { user: l.user, leaves: [] };
    }
    byUser[l.userId].leaves.push({
      id: l.id, startDate: l.startDate, endDate: l.endDate,
      totalDays: l.totalDays, status: l.status,
      leaveType: l.leaveType?.name || 'Leave', reason: l.reason,
    });
  }

  const myLeaves = leaves.filter(l => l.userId === req.user.id);
  const othersLeaves = leaves.filter(l => l.userId !== req.user.id);
  const overlaps = [];
  for (const my of myLeaves) {
    for (const other of othersLeaves) {
      if (my.startDate <= other.endDate && my.endDate >= other.startDate) {
        overlaps.push({
          myLeaveId: my.id, myDates: `${my.startDate} to ${my.endDate}`,
          overlapsWith: other.user.name, theirDates: `${other.startDate} to ${other.endDate}`,
        });
      }
    }
  }

  res.json({
    month, department: targetDept || 'All',
    teamLeaves: Object.values(byUser),
    totalOnLeave: Object.keys(byUser).length, overlaps,
  });
}));

// GET /api/leave/check-overlap?startDate=...&endDate=...
router.get('/check-overlap', authenticate, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) throw badRequest('startDate and endDate are required');

  const dept = req.user.department;
  const overlapping = await req.prisma.leaveRequest.findMany({
    where: {
      status: { in: ['approved', 'pending'] },
      startDate: { lte: endDate }, endDate: { gte: startDate },
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
      name: l.user.name, designation: l.user.designation,
      dates: `${l.startDate} to ${l.endDate}`, days: l.totalDays,
      leaveType: l.leaveType?.name || 'Leave', status: l.status,
    })),
  });
}));

// DELETE /api/leave/:id — Cancel own pending/approved request
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const result = await cancelLeave(requestId, req.user.id, req.prisma);
  res.json(result);
}));

module.exports = router;
