const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

const VALID_CATEGORIES = ['travel', 'contacts', 'food', 'emergency', 'office_info', 'general'];
const VALID_LOCATIONS = ['Miraroad', 'Lucknow'];

// ─── 1. GET / ─── List all active wiki articles
router.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('GET /wiki error:', err);
    res.status(500).json({ error: 'Failed to fetch wiki articles' });
  }
});

// ─── 2. GET /:id ─── Single article
router.get('/:id', async (req, res) => {
  try {
    const article = await req.prisma.wikiArticle.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!article || !article.isActive) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (err) {
    console.error('GET /wiki/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// ─── 3. POST / ─── Create article (any employee)
router.post('/', async (req, res) => {
  try {
    const { title, content, category, location, isPinned } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}` });
    }
    if (location && !VALID_LOCATIONS.includes(location)) {
      return res.status(400).json({ error: `Invalid location. Must be: ${VALID_LOCATIONS.join(', ')}` });
    }

    const article = await req.prisma.wikiArticle.create({
      data: {
        title,
        content,
        category: category || 'general',
        location: location || null,
        isPinned: isAdmin(req) ? (isPinned || false) : false,
        createdBy: req.user.id,
      },
    });
    res.status(201).json(article);
  } catch (err) {
    console.error('POST /wiki error:', err);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// ─── 4. PUT /:id ─── Edit article (any employee)
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await req.prisma.wikiArticle.findUnique({ where: { id } });
    if (!existing || !existing.isActive) return res.status(404).json({ error: 'Article not found' });

    const { title, content, category, location, isPinned } = req.body;
    const data = { lastEditedBy: req.user.id };
    if (title) data.title = title;
    if (content) data.content = content;
    if (category && VALID_CATEGORIES.includes(category)) data.category = category;
    if (location !== undefined) data.location = location && VALID_LOCATIONS.includes(location) ? location : null;
    if (isAdmin(req) && isPinned !== undefined) data.isPinned = isPinned;

    const updated = await req.prisma.wikiArticle.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /wiki/:id error:', err);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// ─── 5. DELETE /:id ─── Soft delete (admin only)
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const id = parseInt(req.params.id);
    await req.prisma.wikiArticle.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Article deleted' });
  } catch (err) {
    console.error('DELETE /wiki/:id error:', err);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

module.exports = router;
