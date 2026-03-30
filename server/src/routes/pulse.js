const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// Get ISO week string "YYYY-WNN" for a date
function getWeekStr(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── Submit this week's pulse ───────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { score, comment } = req.body;
  requireFields(req.body, 'score');
  const s = parseInt(score);
  if (isNaN(s) || s < 1 || s > 5) throw badRequest('Score must be 1-5.');

  const week = getWeekStr();
  const existing = await req.prisma.pulseResponse.findUnique({
    where: { userId_week: { userId: req.user.id, week } },
  });

  let result;
  if (existing) {
    result = await req.prisma.pulseResponse.update({
      where: { userId_week: { userId: req.user.id, week } },
      data: { score: s, comment: comment?.trim() || null },
    });
  } else {
    result = await req.prisma.pulseResponse.create({
      data: { userId: req.user.id, week, score: s, comment: comment?.trim() || null },
    });
  }
  res.status(201).json(result);
}));

// ── My pulse history ──────────────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const responses = await req.prisma.pulseResponse.findMany({
    where: { userId: req.user.id },
    orderBy: { week: 'desc' },
    take: 12, // last 12 weeks
  });
  const currentWeek = getWeekStr();
  const thisWeek = responses.find(r => r.week === currentWeek) || null;
  res.json({ responses, thisWeek, currentWeek });
}));

// ── Admin: Weekly aggregates ──────────────────────────────────────────────────
router.get('/trends', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const weeks = parseInt(req.query.weeks) || 12;

  // Get all responses for the last N weeks
  const allResponses = await req.prisma.pulseResponse.findMany({
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: { week: 'desc' },
    take: weeks * 50, // rough upper bound
  });

  // Group by week
  const byWeek = {};
  allResponses.forEach(r => {
    if (!byWeek[r.week]) byWeek[r.week] = { week: r.week, responses: [], avgScore: 0, count: 0 };
    byWeek[r.week].responses.push(r);
  });

  // Compute averages
  const trend = Object.values(byWeek)
    .map(w => ({
      week: w.week,
      avgScore: parseFloat((w.responses.reduce((s, r) => s + r.score, 0) / w.responses.length).toFixed(2)),
      count: w.responses.length,
      distribution: [1,2,3,4,5].map(n => ({ score: n, count: w.responses.filter(r => r.score === n).length })),
    }))
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, weeks);

  res.json({ trend, currentWeek: getWeekStr() });
}));

// ── Admin: Current week responses (with comments) ─────────────────────────────
router.get('/current', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const week = req.query.week || getWeekStr();

  const responses = await req.prisma.pulseResponse.findMany({
    where: { week },
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: { score: 'asc' },
  });

  // Who hasn't responded?
  const respondedIds = new Set(responses.map(r => r.userId));
  const allActive = await req.prisma.user.findMany({
    where: { isActive: true, isHibernated: false },
    select: { id: true, name: true, department: true },
  });
  const notResponded = allActive.filter(u => !respondedIds.has(u.id));

  res.json({ week, responses, notResponded, avgScore: responses.length ? parseFloat((responses.reduce((s, r) => s + r.score, 0) / responses.length).toFixed(2)) : null });
}));

module.exports = router;
