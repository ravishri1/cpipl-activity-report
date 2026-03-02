const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getTeamAttendance,
} = require('../services/attendance/attendanceService');

const router = express.Router();

// POST /api/attendance/check-in — Record check-in
router.post('/check-in', authenticate, async (req, res) => {
  try {
    const record = await checkIn(req.user.id, req.ip, req.body.notes, req.prisma);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/attendance/check-out — Record check-out
router.post('/check-out', authenticate, async (req, res) => {
  try {
    const record = await checkOut(req.user.id, req.prisma);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/attendance/today — Get today's attendance for current user
router.get('/today', authenticate, async (req, res) => {
  try {
    const record = await getTodayAttendance(req.user.id, req.prisma);
    res.json(record || { status: 'not_checked_in' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance.' });
  }
});

// GET /api/attendance/my?month=YYYY-MM — Monthly attendance for current user
router.get('/my', authenticate, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().substring(0, 7);
    // Validate format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
    }
    const data = await getMonthlyAttendance(req.user.id, month, req.prisma);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch monthly attendance.' });
  }
});

// GET /api/attendance/team?date=YYYY-MM-DD — Team attendance (admin/team_lead)
router.get('/team', authenticate, requireAdmin, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    // Department scoping for team_leads
    const department = req.user.role === 'team_lead' ? req.user.department : null;
    const data = await getTeamAttendance(date, department, req.prisma);
    res.json(data);
  } catch (err) {
    console.error('Team attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch team attendance.' });
  }
});

module.exports = router;
