const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getTodayDate, getYesterdayDate } = require('../utils/helpers');

const router = express.Router();

// GET /api/reports/yesterday-plan - Get yesterday's planTomorrow for pre-fill
router.get('/yesterday-plan', authenticate, async (req, res) => {
  try {
    const yesterday = getYesterdayDate();
    const report = await req.prisma.dailyReport.findUnique({
      where: { userId_reportDate: { userId: req.user.id, reportDate: yesterday } },
      select: { planTomorrow: true },
    });
    res.json({ planTomorrow: report?.planTomorrow || '' });
  } catch (err) {
    console.error('Yesterday plan fetch error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/recent-activities - Get last 5 activity entries for suggestions
router.get('/recent-activities', authenticate, async (req, res) => {
  try {
    const recent = await req.prisma.dailyReport.findMany({
      where: { userId: req.user.id },
      orderBy: { reportDate: 'desc' },
      take: 5,
      select: { activities: true, reportDate: true },
    });
    res.json(recent);
  } catch (err) {
    console.error('Recent activities fetch error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/reports - Submit daily report
router.post('/', authenticate, async (req, res) => {
  try {
    const { activities, challenges, planTomorrow, reportDate } = req.body;
    if (!activities || !activities.trim()) {
      return res.status(400).json({ error: 'Activities field is required.' });
    }

    const date = reportDate || getTodayDate();

    // Check if report already exists for this date
    const existing = await req.prisma.dailyReport.findUnique({
      where: { userId_reportDate: { userId: req.user.id, reportDate: date } },
    });

    if (existing) {
      // Update existing report
      const updated = await req.prisma.dailyReport.update({
        where: { id: existing.id },
        data: {
          activities: activities.trim(),
          challenges: (challenges || '').trim(),
          planTomorrow: (planTomorrow || '').trim(),
        },
      });
      return res.json({ message: 'Report updated.', report: updated });
    }

    // Create new report
    const report = await req.prisma.dailyReport.create({
      data: {
        userId: req.user.id,
        reportDate: date,
        activities: activities.trim(),
        challenges: (challenges || '').trim(),
        planTomorrow: (planTomorrow || '').trim(),
      },
    });

    res.status(201).json({ message: 'Report submitted.', report });
  } catch (err) {
    console.error('Report submit error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/my?date=YYYY-MM-DD - Get my report for a date
router.get('/my', authenticate, async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();
    const report = await req.prisma.dailyReport.findUnique({
      where: { userId_reportDate: { userId: req.user.id, reportDate: date } },
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports?date=YYYY-MM-DD - Get all reports for a date (admin/team_lead)
router.get('/', authenticate, async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();
    const reports = await req.prisma.dailyReport.findMany({
      where: { reportDate: date },
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/history?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=X
router.get('/history', authenticate, async (req, res) => {
  try {
    const { from, to, userId } = req.query;
    const where = {};

    if (from) where.reportDate = { ...where.reportDate, gte: from };
    if (to) where.reportDate = { ...where.reportDate, lte: to };
    if (userId) where.userId = parseInt(userId);

    // Non-admin can only see their own history
    if (req.user.role === 'member') {
      where.userId = req.user.id;
    }

    const reports = await req.prisma.dailyReport.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
      orderBy: [{ reportDate: 'desc' }, { submittedAt: 'desc' }],
      take: 100,
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
