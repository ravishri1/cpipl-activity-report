const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getLeaderboard,
  getUserPoints,
  awardThumbsUp,
  removeThumbsUp,
} = require('../services/points/pointsEngine');
const {
  giveAppreciation,
  getAppreciationBudget,
  getAppreciationHistory,
  getAppreciationFeed,
} = require('../services/points/appreciationEngine');

const router = express.Router();

// GET /api/points/leaderboard?period=weekly|monthly|alltime
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const period = req.query.period || 'weekly';
    if (!['weekly', 'monthly', 'alltime'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use weekly, monthly, or alltime.' });
    }
    const leaderboard = await getLeaderboard(period, req.prisma);
    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/points/my?period=weekly|monthly|alltime
router.get('/my', authenticate, async (req, res) => {
  try {
    const period = req.query.period || 'weekly';
    const data = await getUserPoints(req.user.id, period, req.prisma);
    res.json(data);
  } catch (err) {
    console.error('My points error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/points/thumbsup - Give thumbs up (team_lead/admin only)
router.post('/thumbsup', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId is required.' });

    const thumbsUp = await awardThumbsUp(reportId, req.user.id, req.prisma);
    res.json({ message: 'Thumbs up given!', thumbsUp });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'You already gave a thumbs up for this report.' });
    }
    console.error('Thumbs up error:', err);
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

// DELETE /api/points/thumbsup - Remove thumbs up
router.delete('/thumbsup', authenticate, requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId is required.' });

    await removeThumbsUp(reportId, req.user.id, req.prisma);
    res.json({ message: 'Thumbs up removed.' });
  } catch (err) {
    console.error('Remove thumbs up error:', err);
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

// ─── Peer Appreciation ───

// POST /api/points/appreciate - Give peer appreciation (any authenticated user)
router.post('/appreciate', authenticate, async (req, res) => {
  try {
    const { receiverId, reason } = req.body;
    if (!receiverId) return res.status(400).json({ error: 'receiverId is required.' });
    if (!reason) return res.status(400).json({ error: 'reason is required.' });

    const result = await giveAppreciation(req.user.id, receiverId, reason, req.prisma);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (err) {
    console.error('Appreciate error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/points/appreciation-budget - Check remaining weekly budget
router.get('/appreciation-budget', authenticate, async (req, res) => {
  try {
    const budget = await getAppreciationBudget(req.user.id, req.prisma);
    res.json(budget);
  } catch (err) {
    console.error('Budget error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/points/appreciations?type=given|received&page=1
router.get('/appreciations', authenticate, async (req, res) => {
  try {
    const type = req.query.type || 'received';
    const page = parseInt(req.query.page) || 1;
    if (!['given', 'received'].includes(type)) {
      return res.status(400).json({ error: 'type must be given or received.' });
    }
    const data = await getAppreciationHistory(req.user.id, type, page, req.prisma);
    res.json(data);
  } catch (err) {
    console.error('Appreciations error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/points/appreciation-feed?limit=10
router.get('/appreciation-feed', authenticate, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const feed = await getAppreciationFeed(limit, req.prisma);
    res.json(feed);
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
