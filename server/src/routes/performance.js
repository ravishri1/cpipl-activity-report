const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── GOALS ────────────────────────────────────────────────────────────────────

// GET /goals — list goals (self or all for admin)
router.get('/goals', asyncHandler(async (req, res) => {
  const { userId, year, quarter, status } = req.query;
  const where = {};
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin) {
    where.userId = req.user.id;
  } else if (userId) {
    where.userId = parseId(userId);
  }
  if (year) where.year = parseInt(year);
  if (quarter) where.quarter = parseInt(quarter);
  if (status) where.status = status;
  const goals = await req.prisma.performanceGoal.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true } },
      setter: { select: { id: true, name: true } }
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
  });
  res.json(goals);
}));

// GET /goals/:id — single goal
router.get('/goals/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const goal = await req.prisma.performanceGoal.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      setter: { select: { id: true, name: true } }
    }
  });
  if (!goal) throw notFound('Goal');
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead' && req.user.id !== goal.userId) throw forbidden();
  res.json(goal);
}));

// POST /goals — create goal (admin sets for employee)
router.post('/goals', asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'title', 'year');
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin && req.body.userId !== req.user.id) throw forbidden();
  const goal = await req.prisma.performanceGoal.create({
    data: { ...req.body, setBy: req.user.id }
  });
  res.status(201).json(goal);
}));

// PUT /goals/:id — update goal
router.put('/goals/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const goal = await req.prisma.performanceGoal.findUnique({ where: { id } });
  if (!goal) throw notFound('Goal');
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin && req.user.id !== goal.userId) throw forbidden();
  // Employees can only update their self progress
  const data = isAdmin ? req.body : { selfProgress: req.body.selfProgress };
  const updated = await req.prisma.performanceGoal.update({ where: { id }, data });
  res.json(updated);
}));

// DELETE /goals/:id
router.delete('/goals/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.performanceGoal.delete({ where: { id } });
  res.json({ message: 'Goal deleted' });
}));

// ─── REVIEWS ──────────────────────────────────────────────────────────────────

// GET /reviews — list reviews
router.get('/reviews', asyncHandler(async (req, res) => {
  const { userId, year, quarter, status, cycleType } = req.query;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  const where = {};
  if (!isAdmin) {
    where.OR = [{ userId: req.user.id }, { reviewedBy: req.user.id }];
  } else if (userId) {
    where.userId = parseId(userId);
  }
  if (year) where.year = parseInt(year);
  if (quarter) where.quarter = parseInt(quarter);
  if (status) where.status = status;
  if (cycleType) where.cycleType = cycleType;
  const reviews = await req.prisma.performanceReview.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, designation: true } },
      reviewer: { select: { id: true, name: true } }
    },
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }]
  });
  res.json(reviews);
}));

// GET /reviews/:id
router.get('/reviews/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.performanceReview.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, employeeId: true } },
      reviewer: { select: { id: true, name: true } }
    }
  });
  if (!review) throw notFound('Review');
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin && req.user.id !== review.userId && req.user.id !== review.reviewedBy) throw forbidden();
  res.json(review);
}));

// POST /reviews — initiate review cycle (admin)
router.post('/reviews', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'reviewedBy', 'year', 'cycleType');
  const review = await req.prisma.performanceReview.create({ data: req.body });
  res.status(201).json(review);
}));

// PUT /reviews/:id/self — employee submits self review
router.put('/reviews/:id/self', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.performanceReview.findUnique({ where: { id } });
  if (!review) throw notFound('Review');
  if (review.userId !== req.user.id) throw forbidden();
  if (review.status !== 'pending') throw badRequest('Self review already submitted');
  const updated = await req.prisma.performanceReview.update({
    where: { id },
    data: { selfRating: req.body.selfRating, selfComments: req.body.selfComments, status: 'self_review' }
  });
  res.json(updated);
}));

// PUT /reviews/:id/manager — manager submits review
router.put('/reviews/:id/manager', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.performanceReview.findUnique({ where: { id } });
  if (!review) throw notFound('Review');
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin && review.reviewedBy !== req.user.id) throw forbidden();
  if (!['self_review', 'manager_review'].includes(review.status)) throw badRequest('Review not ready for manager review');
  const updated = await req.prisma.performanceReview.update({
    where: { id },
    data: {
      managerRating: req.body.managerRating,
      managerComments: req.body.managerComments,
      strengthNotes: req.body.strengthNotes,
      improvementNotes: req.body.improvementNotes,
      status: 'manager_review'
    }
  });
  res.json(updated);
}));

// PUT /reviews/:id/complete — HR finalizes
router.put('/reviews/:id/complete', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.performanceReview.findUnique({ where: { id } });
  if (!review) throw notFound('Review');
  const updated = await req.prisma.performanceReview.update({
    where: { id },
    data: {
      finalRating: req.body.finalRating,
      ratingLabel: req.body.ratingLabel,
      incrementPercent: req.body.incrementPercent,
      bonusAmount: req.body.bonusAmount,
      promotionRecommended: req.body.promotionRecommended || false,
      status: 'completed'
    }
  });
  res.json(updated);
}));

// DELETE /reviews/:id
router.delete('/reviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.performanceReview.delete({ where: { id } });
  res.json({ message: 'Review deleted' });
}));

// GET /summary/:userId — goals + reviews combined for one employee
router.get('/summary/:userId', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const isAdmin = req.user.role === 'admin' || req.user.role === 'team_lead';
  if (!isAdmin && req.user.id !== userId) throw forbidden();
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const [goals, reviews] = await Promise.all([
    req.prisma.performanceGoal.findMany({ where: { userId, year } }),
    req.prisma.performanceReview.findMany({
      where: { userId, year },
      include: { reviewer: { select: { id: true, name: true } } }
    })
  ]);
  const avgSelf = goals.filter(g => g.selfProgress !== null).reduce((sum, g) => sum + g.selfProgress, 0) /
    (goals.filter(g => g.selfProgress !== null).length || 1);
  res.json({ year, goals, reviews, avgSelfProgress: Math.round(avgSelf) });
}));

module.exports = router;
