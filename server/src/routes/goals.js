const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminOrLead(user) { return ['admin', 'sub_admin', 'team_lead'].includes(user.role); }

// ── Helper: generate current quarter ─────────────────────────────────────────
function currentQuarter() {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

// ── GET /goals/quarters — List all quarters that have goals ──────────────────
router.get('/quarters', asyncHandler(async (req, res) => {
  const where = isAdminOrLead(req.user) ? {} : { userId: req.user.id };
  const goals = await req.prisma.goal.findMany({ where, select: { quarter: true }, distinct: ['quarter'] });
  const quarters = [...new Set(goals.map(g => g.quarter))].sort().reverse();
  if (!quarters.includes(currentQuarter())) quarters.unshift(currentQuarter());
  res.json(quarters);
}));

// ── GET /goals — List goals (admin sees all, employee sees own + team) ────────
router.get('/', asyncHandler(async (req, res) => {
  const { quarter, userId, category, status } = req.query;
  const where = {};
  if (quarter)  where.quarter  = quarter;
  if (category) where.category = category;
  if (status)   where.status   = status;

  if (isAdminOrLead(req.user)) {
    if (userId) where.userId = parseInt(userId);
  } else {
    where.OR = [
      { userId: req.user.id },
      { category: 'team' },
      { category: 'company' },
    ];
  }

  const goals = await req.prisma.goal.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, department: true } },
      checkIns: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { checkIns: true } },
    },
    orderBy: [{ status: 'asc' }, { progress: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(goals);
}));

// ── GET /goals/my — My goals ──────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const { quarter } = req.query;
  const where = { userId: req.user.id };
  if (quarter) where.quarter = quarter;
  const goals = await req.prisma.goal.findMany({
    where,
    include: {
      checkIns: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { checkIns: true } },
    },
    orderBy: [{ status: 'asc' }, { progress: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(goals);
}));

// ── POST /goals — Create goal ─────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { title, description, category, quarter, targetDate, keyResults } = req.body;
  requireFields(req.body, 'title', 'quarter');
  if (!['personal', 'team', 'company'].includes(category || 'personal')) throw badRequest('Invalid category.');
  if (category === 'company' && !isAdminOrLead(req.user)) throw forbidden('Only admins can create company goals.');

  const goal = await req.prisma.goal.create({
    data: {
      userId: req.user.id,
      title: title.trim(),
      description: description?.trim() || null,
      category: category || 'personal',
      quarter,
      targetDate: targetDate || null,
      keyResults: keyResults ? JSON.stringify(keyResults) : null,
      createdBy: req.user.id,
    },
    include: { owner: { select: { id: true, name: true } } },
  });
  res.status(201).json(goal);
}));

// ── GET /goals/:id — Single goal with all check-ins ──────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const goal = await req.prisma.goal.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, department: true } },
      checkIns: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!goal) throw notFound('Goal not found.');
  if (!isAdminOrLead(req.user) && goal.userId !== req.user.id && goal.category === 'personal') throw forbidden('Access denied.');
  res.json(goal);
}));

// ── PUT /goals/:id — Update goal ─────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const goal = await req.prisma.goal.findUnique({ where: { id } });
  if (!goal) throw notFound('Goal not found.');
  if (!isAdminOrLead(req.user) && goal.userId !== req.user.id) throw forbidden('Cannot edit another user\'s goal.');

  const { title, description, category, quarter, targetDate, status, progress, keyResults } = req.body;
  const data = {};
  if (title       != null) data.title       = title.trim();
  if (description != null) data.description = description.trim() || null;
  if (category    != null) data.category    = category;
  if (quarter     != null) data.quarter     = quarter;
  if (targetDate  != null) data.targetDate  = targetDate || null;
  if (status      != null) data.status      = status;
  if (progress    != null) data.progress    = Math.min(100, Math.max(0, parseInt(progress)));
  if (keyResults  != null) data.keyResults  = JSON.stringify(keyResults);

  const updated = await req.prisma.goal.update({ where: { id }, data });
  res.json(updated);
}));

// ── DELETE /goals/:id ─────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const goal = await req.prisma.goal.findUnique({ where: { id } });
  if (!goal) throw notFound('Goal not found.');
  if (!isAdminOrLead(req.user) && goal.userId !== req.user.id) throw forbidden('Cannot delete another user\'s goal.');
  await req.prisma.goal.delete({ where: { id } });
  res.json({ message: 'Goal deleted.' });
}));

// ── POST /goals/:id/check-in — Log progress check-in ─────────────────────────
router.post('/:id/check-in', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { progress, note } = req.body;
  if (progress == null) throw badRequest('Progress (0-100) is required.');

  const goal = await req.prisma.goal.findUnique({ where: { id } });
  if (!goal) throw notFound('Goal not found.');
  if (!isAdminOrLead(req.user) && goal.userId !== req.user.id) throw forbidden('Access denied.');

  const pct = Math.min(100, Math.max(0, parseInt(progress)));

  const [checkIn] = await req.prisma.$transaction([
    req.prisma.goalCheckIn.create({
      data: { goalId: id, userId: req.user.id, progress: pct, note: note?.trim() || null },
    }),
    req.prisma.goal.update({
      where: { id },
      data: {
        progress: pct,
        status: pct >= 100 ? 'completed' : goal.status,
      },
    }),
  ]);
  res.status(201).json(checkIn);
}));

// ── GET /goals/team/summary?quarter=2026-Q1 — Team goal summary (admin) ──────
router.get('/team/summary', asyncHandler(async (req, res) => {
  if (!isAdminOrLead(req.user)) throw forbidden('Admin access required.');
  const quarter = req.query.quarter || currentQuarter();

  const goals = await req.prisma.goal.findMany({
    where: { quarter },
    include: { owner: { select: { id: true, name: true, department: true } } },
  });

  const byStatus = { active: 0, completed: 0, on_hold: 0, cancelled: 0 };
  const byCategory = { personal: 0, team: 0, company: 0 };
  let totalProgress = 0;

  goals.forEach(g => {
    if (byStatus[g.status] != null) byStatus[g.status]++;
    if (byCategory[g.category] != null) byCategory[g.category]++;
    totalProgress += g.progress || 0;
  });

  const avgProgress = goals.length > 0 ? Math.round(totalProgress / goals.length) : 0;

  res.json({
    quarter, total: goals.length, avgProgress,
    byStatus, byCategory,
    completionRate: goals.length > 0 ? Math.round((byStatus.completed / goals.length) * 10000) / 100 : 0,
  });
}));

module.exports = router;
