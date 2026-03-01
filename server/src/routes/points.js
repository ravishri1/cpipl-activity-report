const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  getLeaderboard,
  getUserPoints,
  awardThumbsUp,
  removeThumbsUp,
} = require('../services/pointsEngine');

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

module.exports = router;
