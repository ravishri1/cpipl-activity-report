const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

const VALID_CATEGORIES = ['general', 'improvement', 'complaint', 'appreciation'];

function isAdminRole(user) {
  return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead';
}

// ─── 1. POST / ─── Submit suggestion (anonymous to peers, admin sees userId)
router.post('/', asyncHandler(async (req, res) => {
  const { content, category } = req.body;
  if (!content || content.trim().length < 10) throw badRequest('Suggestion must be at least 10 characters');
  if (category) requireEnum(category, VALID_CATEGORIES, 'category');

  const suggestion = await req.prisma.suggestion.create({
    data: { content: content.trim(), category: category || 'general', userId: req.user.id },
  });
  res.status(201).json({ id: suggestion.id, message: 'Suggestion submitted anonymously' });
}));

// ─── 2. GET /my ─── My own suggestions
router.get('/my', asyncHandler(async (req, res) => {
  const suggestions = await req.prisma.suggestion.findMany({
    where: { userId: req.user.id, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ suggestions: suggestions.map(({ userId, ...rest }) => rest) });
}));

// ─── 3. GET /stats ─── Summary stats (admin)
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const [total, byStatus, byCategory] = await Promise.all([
    req.prisma.suggestion.count({ where: { isActive: true } }),
    req.prisma.suggestion.groupBy({ by: ['status'], where: { isActive: true }, _count: true }),
    req.prisma.suggestion.groupBy({ by: ['category'], where: { isActive: true }, _count: true }),
  ]);

  res.json({
    total,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
    byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
  });
}));

// ─── 4. GET / ─── List suggestions (admin sees userId + name, others see anonymous)
router.get('/', asyncHandler(async (req, res) => {
  const { status, category } = req.query;
  const where = { isActive: true };
  if (status) where.status = status;
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;

  const suggestions = await req.prisma.suggestion.findMany({ where, orderBy: { createdAt: 'desc' } });

  if (isAdminRole(req.user)) {
    const userIds = [...new Set(suggestions.map(s => s.userId))];
    const users = await req.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, department: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    return res.json(suggestions.map(s => ({ ...s, submittedBy: userMap[s.userId] || { name: 'Unknown' } })));
  }

  res.json(suggestions.map(({ userId, ...rest }) => rest));
}));

// ─── 4. PUT /:id/reply ─── Admin reply + status update
router.put('/:id/reply', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { adminReply, status } = req.body;

  const data = {};
  if (adminReply !== undefined) data.adminReply = adminReply;
  if (status) {
    requireEnum(status, ['new', 'reviewed', 'acknowledged', 'implemented'], 'status');
    data.status = status;
  }
  if (Object.keys(data).length === 0) throw badRequest('Provide adminReply or status');

  const updated = await req.prisma.suggestion.update({ where: { id }, data });
  res.json(updated);
}));

// ─── 5. DELETE /:id ─── Soft delete (admin)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await req.prisma.suggestion.update({ where: { id: parseId(req.params.id) }, data: { isActive: false } });
  res.json({ message: 'Suggestion removed' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
// ─── AUTOMATION INSIGHTS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const { runAutomationAnalysis } = require('../services/automationAnalyzer');

const INSIGHT_STATUSES = ['new', 'reviewing', 'will_automate', 'automated', 'dismissed'];
const INSIGHT_PRIORITIES = ['high', 'medium', 'low'];
const INSIGHT_CATEGORIES = ['data_entry', 'communication', 'reporting', 'scheduling', 'procurement', 'approval', 'general'];

// ─── 6. POST /analyze-automation ─── Trigger automation analysis (admin)
router.post('/analyze-automation', requireAdmin, asyncHandler(async (req, res) => {
  const periodDays = req.body.periodDays ? parseInt(req.body.periodDays, 10) : 30;
  if (isNaN(periodDays) || periodDays < 7 || periodDays > 90) {
    throw badRequest('periodDays must be between 7 and 90');
  }

  const result = await runAutomationAnalysis(req.prisma, {
    triggeredBy: 'manual',
    userId: req.user.id,
    periodDays,
  });

  res.json({
    message: `Analysis complete: ${result.insightsCreated} insights from ${result.totalTasks} tasks`,
    ...result,
  });
}));

// ─── 7. GET /automation-insights ─── List insights (admin)
router.get('/automation-insights', requireAdmin, asyncHandler(async (req, res) => {
  const { status, priority, category } = req.query;
  const where = { isActive: true };
  if (status && INSIGHT_STATUSES.includes(status)) where.status = status;
  if (priority && INSIGHT_PRIORITIES.includes(priority)) where.priority = priority;
  if (category && INSIGHT_CATEGORIES.includes(category)) where.category = category;

  const insights = await req.prisma.automationInsight.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { estimatedSavingsPerWeek: 'desc' }],
  });

  res.json(insights);
}));

// ─── 8. GET /automation-stats ─── Summary stats (admin)
router.get('/automation-stats', requireAdmin, asyncHandler(async (req, res) => {
  const activeWhere = { isActive: true };

  const [total, byStatus, byPriority, byCategory, savingsAgg, lastLog] = await Promise.all([
    req.prisma.automationInsight.count({ where: activeWhere }),
    req.prisma.automationInsight.groupBy({ by: ['status'], where: activeWhere, _count: true }),
    req.prisma.automationInsight.groupBy({ by: ['priority'], where: activeWhere, _count: true }),
    req.prisma.automationInsight.groupBy({ by: ['category'], where: activeWhere, _count: true }),
    req.prisma.automationInsight.aggregate({ where: activeWhere, _sum: { estimatedSavingsPerWeek: true, totalHoursPerWeek: true } }),
    req.prisma.automationAnalysisLog.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  res.json({
    total,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
    byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p._count])),
    byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
    totalSaveableHoursPerWeek: savingsAgg._sum.estimatedSavingsPerWeek || 0,
    totalHoursPerWeek: savingsAgg._sum.totalHoursPerWeek || 0,
    lastAnalysis: lastLog ? {
      date: lastLog.analysisDate,
      status: lastLog.status,
      totalTasks: lastLog.totalTasks,
      insightsCreated: lastLog.insightsCreated,
      durationMs: lastLog.durationMs,
      triggeredBy: lastLog.triggeredBy,
    } : null,
  });
}));

// ─── 9. PUT /automation-insights/:id ─── Update insight status/priority/notes (admin)
router.put('/automation-insights/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, priority, adminNotes } = req.body;

  const data = {};
  if (status) {
    requireEnum(status, INSIGHT_STATUSES, 'status');
    data.status = status;
  }
  if (priority) {
    requireEnum(priority, INSIGHT_PRIORITIES, 'priority');
    data.priority = priority;
  }
  if (adminNotes !== undefined) data.adminNotes = adminNotes;
  if (Object.keys(data).length === 0) throw badRequest('Provide status, priority, or adminNotes');

  const updated = await req.prisma.automationInsight.update({ where: { id }, data });
  res.json(updated);
}));

// ─── 10. DELETE /automation-insights/:id ─── Soft delete insight (admin)
router.delete('/automation-insights/:id', requireAdmin, asyncHandler(async (req, res) => {
  await req.prisma.automationInsight.update({
    where: { id: parseId(req.params.id) },
    data: { isActive: false },
  });
  res.json({ message: 'Insight removed' });
}));

module.exports = router;
