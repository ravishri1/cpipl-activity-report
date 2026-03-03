const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getTeamAttendance,
} = require('../services/attendance/attendanceService');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// POST /api/attendance/check-in — Record check-in
router.post('/check-in', authenticate, asyncHandler(async (req, res) => {
  const record = await checkIn(req.user.id, req.ip, req.body.notes, req.prisma);
  res.json(record);
}));

// POST /api/attendance/check-out — Record check-out
router.post('/check-out', authenticate, asyncHandler(async (req, res) => {
  const record = await checkOut(req.user.id, req.prisma);
  res.json(record);
}));

// GET /api/attendance/today — Get today's attendance for current user
router.get('/today', authenticate, asyncHandler(async (req, res) => {
  const record = await getTodayAttendance(req.user.id, req.prisma);
  res.json(record || { status: 'not_checked_in' });
}));

// GET /api/attendance/my?month=YYYY-MM — Monthly attendance for current user
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');
  const data = await getMonthlyAttendance(req.user.id, month, req.prisma);
  res.json(data);
}));

// GET /api/attendance/team?date=YYYY-MM-DD — Team attendance (admin/team_lead)
router.get('/team', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const department = req.user.role === 'team_lead' ? req.user.department : null;
  const data = await getTeamAttendance(date, department, req.prisma);
  res.json(data);
}));

module.exports = router;
