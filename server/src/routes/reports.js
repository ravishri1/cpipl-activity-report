const express = require('express');
const { authenticate, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { requireFields } = require('../utils/validate');
const { getTodayDate, getYesterdayDate } = require('../utils/helpers');
const { calculateAndAwardPoints } = require('../services/points/pointsEngine');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// GET /api/reports/yesterday-plan — Get yesterday's planTomorrow for pre-fill
router.get('/yesterday-plan', authenticate, asyncHandler(async (req, res) => {
  const yesterday = getYesterdayDate();
  const report = await req.prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId: req.user.id, reportDate: yesterday } },
    select: { planTomorrow: true },
  });
  res.json({ planTomorrow: report?.planTomorrow || '' });
}));

// GET /api/reports/recent-activities — Get last 5 activity entries for suggestions
router.get('/recent-activities', authenticate, asyncHandler(async (req, res) => {
  const recent = await req.prisma.dailyReport.findMany({
    where: { userId: req.user.id },
    orderBy: { reportDate: 'desc' },
    take: 5,
    select: { activities: true, reportDate: true },
  });
  res.json(recent);
}));

// POST /api/reports — Submit daily report
router.post('/', authenticate, asyncHandler(async (req, res) => {
  requireFields(req.body, 'activities');
  const { activities, challenges, planTomorrow, reportDate, tasks } = req.body;
  const date = reportDate || getTodayDate();

  const totalHours = Array.isArray(tasks)
    ? tasks.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0)
    : 0;

  const existing = await req.prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId: req.user.id, reportDate: date } },
  });

  const taskData = Array.isArray(tasks) && tasks.length > 0
    ? { create: tasks.filter(t => t.description?.trim()).map(t => ({ description: t.description.trim(), hours: parseFloat(t.hours) || 0 })) }
    : undefined;

  if (existing) {
    await req.prisma.reportTask.deleteMany({ where: { reportId: existing.id } });
    const updated = await req.prisma.dailyReport.update({
      where: { id: existing.id },
      data: {
        activities: activities.trim(), challenges: (challenges || '').trim(),
        planTomorrow: (planTomorrow || '').trim(), totalHours, tasks: taskData,
      },
      include: { tasks: true },
    });
    calculateAndAwardPoints(req.user.id, date, req.prisma).catch(err => console.error('Points calc error:', err.message));
    return res.json({ message: 'Report updated.', report: updated });
  }

  const report = await req.prisma.dailyReport.create({
    data: {
      userId: req.user.id, reportDate: date,
      activities: activities.trim(), challenges: (challenges || '').trim(),
      planTomorrow: (planTomorrow || '').trim(), totalHours, tasks: taskData,
    },
    include: { tasks: true },
  });
  calculateAndAwardPoints(req.user.id, date, req.prisma).catch(err => console.error('Points calc error:', err.message));
  res.status(201).json({ message: 'Report submitted.', report });
}));

// GET /api/reports/my?date=YYYY-MM-DD — Get my report for a date
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const date = req.query.date || getTodayDate();
  const report = await req.prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId: req.user.id, reportDate: date } },
    include: { tasks: true },
  });
  res.json(report);
}));

// GET /api/reports?date=YYYY-MM-DD — Get reports for a date
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const date = req.query.date || getTodayDate();
  const where = { reportDate: date };

  if (req.user.role === 'member') where.userId = req.user.id;
  else if (req.user.role === 'team_lead') where.user = { department: req.user.department };

  const reports = await req.prisma.dailyReport.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      tasks: true,
      thumbsUps: { include: { givenBy: { select: { id: true, name: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(reports);
}));

// GET /api/reports/history?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=X
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const { from, to, userId } = req.query;
  const where = {};

  if (from) where.reportDate = { ...where.reportDate, gte: from };
  if (to) where.reportDate = { ...where.reportDate, lte: to };

  if (req.user.role === 'member') {
    where.userId = req.user.id;
  } else if (req.user.role === 'team_lead') {
    where.user = { department: req.user.department };
    if (userId) {
      const target = await req.prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { department: true },
      });
      if (!target || target.department !== req.user.department) return res.json([]);
      where.userId = parseInt(userId);
    }
  } else if (userId) {
    where.userId = parseInt(userId);
  }

  const reports = await req.prisma.dailyReport.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      tasks: true,
      thumbsUps: { include: { givenBy: { select: { id: true, name: true } } } },
    },
    orderBy: [{ reportDate: 'desc' }, { submittedAt: 'desc' }],
    take: 100,
  });
  res.json(reports);
}));

module.exports = router;
