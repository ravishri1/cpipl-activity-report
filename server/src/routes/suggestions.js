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

module.exports = router;
