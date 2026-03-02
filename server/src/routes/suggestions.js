const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

function isAdmin(req) {
  return req.user.role === 'admin' || req.user.role === 'team_lead';
}

const VALID_CATEGORIES = ['general', 'improvement', 'complaint', 'appreciation'];

// ─── 1. POST / ─── Submit suggestion (anonymous to peers, admin sees userId)
router.post('/', async (req, res) => {
  try {
    const { content, category } = req.body;
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Suggestion must be at least 10 characters' });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be: ${VALID_CATEGORIES.join(', ')}` });
    }

    const suggestion = await req.prisma.suggestion.create({
      data: {
        content: content.trim(),
        category: category || 'general',
        userId: req.user.id,
      },
    });

    // Return without userId for the submitter too
    res.status(201).json({ id: suggestion.id, message: 'Suggestion submitted anonymously' });
  } catch (err) {
    console.error('POST /suggestions error:', err);
    res.status(500).json({ error: 'Failed to submit suggestion' });
  }
});

// ─── 2. GET / ─── List suggestions (admin sees userId + name, others see anonymous)
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = { isActive: true };
    if (status) where.status = status;
    if (category && VALID_CATEGORIES.includes(category)) where.category = category;

    const suggestions = await req.prisma.suggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (isAdmin(req)) {
      // Admin gets full data with submitter identity
      const userIds = [...new Set(suggestions.map(s => s.userId))];
      const users = await req.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, department: true },
      });
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));

      const result = suggestions.map(s => ({
        ...s,
        submittedBy: userMap[s.userId] || { name: 'Unknown' },
      }));
      return res.json(result);
    }

    // Non-admin: strip userId
    const result = suggestions.map(({ userId, ...rest }) => rest);
    res.json(result);
  } catch (err) {
    console.error('GET /suggestions error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ─── 3. GET /my ─── My own suggestions
router.get('/my', async (req, res) => {
  try {
    const suggestions = await req.prisma.suggestion.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    // Return without userId
    const result = suggestions.map(({ userId, ...rest }) => rest);
    res.json(result);
  } catch (err) {
    console.error('GET /suggestions/my error:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ─── 4. PUT /:id/reply ─── Admin reply + status update
router.put('/:id/reply', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

    const id = parseInt(req.params.id);
    const { adminReply, status } = req.body;

    const data = {};
    if (adminReply !== undefined) data.adminReply = adminReply;
    if (status && ['new', 'reviewed', 'acknowledged', 'implemented'].includes(status)) data.status = status;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Provide adminReply or status' });
    }

    const updated = await req.prisma.suggestion.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PUT /suggestions/:id/reply error:', err);
    res.status(500).json({ error: 'Failed to update suggestion' });
  }
});

// ─── 5. DELETE /:id ─── Soft delete (admin)
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    await req.prisma.suggestion.update({ where: { id: parseInt(req.params.id) }, data: { isActive: false } });
    res.json({ message: 'Suggestion removed' });
  } catch (err) {
    console.error('DELETE /suggestions/:id error:', err);
    res.status(500).json({ error: 'Failed to delete suggestion' });
  }
});

// ─── 6. GET /stats ─── Summary stats (admin)
router.get('/stats', async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

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
  } catch (err) {
    console.error('GET /suggestions/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
