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
  getTeamAttendanceRange,
  getEmployeeCalendar,
} = require('../services/attendance/attendanceService');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// POST /api/attendance/check-in — Record check-in (portal)
router.post('/check-in', authenticate, asyncHandler(async (req, res) => {
  const { workType, workLocation, notes } = req.body;

  const VALID_TYPES = ['office', 'wfh', 'field_work', 'client_visit', 'on_duty'];
  if (workType && !VALID_TYPES.includes(workType)) throw badRequest('Invalid work type.');

  // WFH requires approved WFH request for today
  if (workType === 'wfh') {
    const todayStr = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
    const wfhReq = await req.prisma.wFHRequest.findUnique({
      where: { userId_date: { userId: req.user.id, date: todayStr } },
    });
    if (!wfhReq || wfhReq.status !== 'approved') {
      throw badRequest('NO_WFH_APPROVAL');
    }
  }

  // Field work and client visits require a location
  if ((workType === 'field_work' || workType === 'client_visit') && !workLocation?.trim()) {
    throw badRequest('Location is required for field work and client visits.');
  }

  const record = await checkIn(req.user.id, req.ip, notes, workType, workLocation?.trim() || null, 'portal', req.prisma);
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

// GET /api/attendance/team-range?startDate=X&endDate=Y — Team attendance over a date range
router.get('/team-range', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) throw badRequest('startDate and endDate are required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw badRequest('Dates must be in YYYY-MM-DD format');
  }
  const department = req.user.role === 'team_lead' ? req.user.department : null;
  const data = await getTeamAttendanceRange(startDate, endDate, department, req.prisma);
  res.json(data);
}));

// GET /api/attendance/my-calendar?month=YYYY-MM — Employee's own calendar view with policy data
router.get('/my-calendar', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');
  const data = await getEmployeeCalendar(req.user.id, month, req.prisma);
  res.json(data);
}));

// GET /api/attendance/employee-calendar?userId=X&month=YYYY-MM — Admin calendar view for one employee
router.get('/employee-calendar', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseInt(req.query.userId);
  if (!userId || isNaN(userId)) throw badRequest('userId is required');
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');
  const data = await getEmployeeCalendar(userId, month, req.prisma);
  res.json(data);
}));

module.exports = router;
