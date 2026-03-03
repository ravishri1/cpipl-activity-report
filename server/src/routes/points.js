const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');
const { requireFields, requireEnum } = require('../utils/validate');
const { maskName, maskUserNames, canSeeFullNames } = require('../utils/namePrivacy');
const { getLeaderboard, getUserPoints, awardThumbsUp, removeThumbsUp } = require('../services/points/pointsEngine');
const { giveAppreciation, getAppreciationBudget, getAppreciationHistory, getAppreciationFeed } = require('../services/points/appreciationEngine');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// GET /api/points/leaderboard?period=weekly|monthly|alltime
router.get('/leaderboard', authenticate, asyncHandler(async (req, res) => {
  const period = req.query.period || 'weekly';
  requireEnum(period, ['weekly', 'monthly', 'alltime'], 'period');
  const results = await getLeaderboard(period, req.prisma);
  // Name privacy: non-admin users see only first name + last initial
  res.json(canSeeFullNames(req.user) ? results : maskUserNames(results));
}));

// GET /api/points/my?period=weekly|monthly|alltime
router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const period = req.query.period || 'weekly';
  res.json(await getUserPoints(req.user.id, period, req.prisma));
}));

// POST /api/points/thumbsup — Give thumbs up (team_lead/admin only)
router.post('/thumbsup', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'reportId');
  const thumbsUp = await awardThumbsUp(req.body.reportId, req.user.id, req.prisma);
  res.json({ message: 'Thumbs up given!', thumbsUp });
}));

// DELETE /api/points/thumbsup — Remove thumbs up
router.delete('/thumbsup', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'reportId');
  await removeThumbsUp(req.body.reportId, req.user.id, req.prisma);
  res.json({ message: 'Thumbs up removed.' });
}));

// ─── Peer Appreciation ───

// POST /api/points/appreciate — Give peer appreciation
router.post('/appreciate', authenticate, asyncHandler(async (req, res) => {
  requireFields(req.body, 'receiverId', 'reason');
  const result = await giveAppreciation(req.user.id, req.body.receiverId, req.body.reason, req.prisma);
  if (!result.success) throw badRequest(result.error);
  res.json(result);
}));

// GET /api/points/appreciation-budget
router.get('/appreciation-budget', authenticate, asyncHandler(async (req, res) => {
  res.json(await getAppreciationBudget(req.user.id, req.prisma));
}));

// GET /api/points/appreciations?type=given|received&page=1
router.get('/appreciations', authenticate, asyncHandler(async (req, res) => {
  const type = req.query.type || 'received';
  requireEnum(type, ['given', 'received'], 'type');
  const page = parseInt(req.query.page) || 1;
  const result = await getAppreciationHistory(req.user.id, type, page, req.prisma);
  // Name privacy: mask giver/receiver names for non-admin users
  if (!canSeeFullNames(req.user) && result.appreciations) {
    result.appreciations = result.appreciations.map(item => ({
      ...item,
      ...(item.giver ? { giver: { ...item.giver, name: maskName(item.giver.name) } } : {}),
      ...(item.receiver ? { receiver: { ...item.receiver, name: maskName(item.receiver.name) } } : {}),
    }));
  }
  res.json(result);
}));

// GET /api/points/appreciation-feed?limit=10
router.get('/appreciation-feed', authenticate, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const feed = await getAppreciationFeed(limit, req.prisma);
  // Name privacy: mask giver/receiver names for non-admin users
  if (!canSeeFullNames(req.user)) {
    res.json(feed.map(item => ({
      ...item,
      ...(item.giver ? { giver: { ...item.giver, name: maskName(item.giver.name) } } : {}),
      ...(item.receiver ? { receiver: { ...item.receiver, name: maskName(item.receiver.name) } } : {}),
    })));
  } else {
    res.json(feed);
  }
}));

module.exports = router;
