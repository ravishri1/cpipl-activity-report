const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId, requireEnum } = require('../utils/validate');
const { notifyAllExcept } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);

const VALID_CATEGORIES = ['travel', 'contacts', 'food', 'emergency', 'office_info', 'general'];
const VALID_LOCATIONS = ['Miraroad', 'Lucknow'];

function isAdminRole(user) {
  return user.role === 'admin' || user.role === 'team_lead';
}

// ─── 1. GET / ─── List all active wiki articles
router.get('/', asyncHandler(async (req, res) => {
  const { category, location } = req.query;
  const where = { isActive: true };
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;
  if (location && VALID_LOCATIONS.includes(location)) where.location = location;

  const articles = await req.prisma.wikiArticle.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });

  // Attach author names
  const userIds = [...new Set([...articles.map(a => a.createdBy), ...articles.filter(a => a.lastEditedBy).map(a => a.lastEditedBy)])];
  const users = await req.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  const result = articles.map(a => ({
    ...a,
    createdByName: userMap[a.createdBy] || 'Unknown',
    lastEditedByName: a.lastEditedBy ? (userMap[a.lastEditedBy] || 'Unknown') : null,
  }));

  res.json(result);
}));

// ─── 2. GET /:id ─── Single article
router.get('/:id', asyncHandler(async (req, res) => {
  const article = await req.prisma.wikiArticle.findUnique({ where: { id: parseId(req.params.id) } });
  if (!article || !article.isActive) throw notFound('Article');
  res.json(article);
}));

// ─── 3. POST / ─── Create article (any employee)
router.post('/', asyncHandler(async (req, res) => {
  const { title, content, category, location, isPinned } = req.body;
  requireFields(req.body, 'title', 'content');
  requireEnum(category, VALID_CATEGORIES, 'category');
  requireEnum(location, VALID_LOCATIONS, 'location');

  const article = await req.prisma.wikiArticle.create({
    data: {
      title,
      content,
      category: category || 'general',
      location: location || null,
      isPinned: isAdminRole(req.user) ? (isPinned || false) : false,
      createdBy: req.user.id,
    },
  });

  // Notify all employees about new KB article
  notifyAllExcept(req.prisma, req.user.id, {
    type: 'wiki_update',
    title: 'New Knowledge Base Article',
    message: `"${title}" was added to Knowledge Base`,
    link: '/wiki',
  });

  res.status(201).json(article);
}));

// ─── 4. PUT /:id ─── Edit article (any employee)
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.wikiArticle.findUnique({ where: { id } });
  if (!existing || !existing.isActive) throw notFound('Article');

  const { title, content, category, location, isPinned } = req.body;
  const data = { lastEditedBy: req.user.id };
  if (title) data.title = title;
  if (content) data.content = content;
  if (category && VALID_CATEGORIES.includes(category)) data.category = category;
  if (location !== undefined) data.location = location && VALID_LOCATIONS.includes(location) ? location : null;
  if (isAdminRole(req.user) && isPinned !== undefined) data.isPinned = isPinned;

  const updated = await req.prisma.wikiArticle.update({ where: { id }, data });

  // Notify all employees about KB article update
  notifyAllExcept(req.prisma, req.user.id, {
    type: 'wiki_update',
    title: 'Knowledge Base Updated',
    message: `"${updated.title}" was updated`,
    link: '/wiki',
  });

  res.json(updated);
}));

// ─── 5. DELETE /:id ─── Soft delete (admin only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.wikiArticle.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Article deleted' });
}));

module.exports = router;
