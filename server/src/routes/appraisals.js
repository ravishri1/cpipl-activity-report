const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// Default template sections used when a cycle is created without custom sections
const DEFAULT_SECTIONS = [
  { id: '1', name: 'Work Quality',  weight: 25, maxScore: 5 },
  { id: '2', name: 'Productivity',  weight: 25, maxScore: 5 },
  { id: '3', name: 'Teamwork',      weight: 20, maxScore: 5 },
  { id: '4', name: 'Initiative',    weight: 20, maxScore: 5 },
  { id: '5', name: 'Attitude',      weight: 10, maxScore: 5 },
];

function calcWeightedRating(scores, sections) {
  // scores: [{sectionId, score}], sections: [{id, weight, maxScore}]
  let weightedSum = 0;
  let totalWeight = 0;
  for (const sec of sections) {
    const entry = scores.find(s => String(s.sectionId) === String(sec.id));
    if (entry && entry.score != null) {
      const normalised = (entry.score / sec.maxScore) * 5; // normalise to 5-point scale
      weightedSum += normalised * sec.weight;
      totalWeight += sec.weight;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

function isAdminOrLead(user) {
  return ['admin', 'sub_admin', 'team_lead'].includes(user.role);
}

// ── Admin: Cycle Management ──────────────────────────────────────────────────

// POST /appraisals/cycles — Create a new appraisal cycle
router.post('/cycles', requireAdmin, asyncHandler(async (req, res) => {
  const { name, period, year, startDate, endDate, templateSections } = req.body;
  requireFields(req.body, 'name', 'period', 'year', 'startDate', 'endDate');
  if (!['annual', 'half_yearly', 'quarterly'].includes(period)) throw badRequest('Invalid period.');

  const sections = templateSections || DEFAULT_SECTIONS;

  const cycle = await req.prisma.appraisalCycle.create({
    data: {
      name: name.trim(),
      period,
      year: parseInt(year),
      startDate,
      endDate,
      templateSections: JSON.stringify(sections),
      createdBy: req.user.id,
    },
  });
  res.status(201).json(cycle);
}));

// GET /appraisals/cycles — List all cycles
router.get('/cycles', requireAdmin, asyncHandler(async (req, res) => {
  const cycles = await req.prisma.appraisalCycle.findMany({
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { reviews: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  // Attach review stats per cycle
  const result = await Promise.all(cycles.map(async (c) => {
    const stats = await req.prisma.appraisalReview.groupBy({
      by: ['status'],
      where: { cycleId: c.id },
      _count: true,
    });
    const statusMap = Object.fromEntries(stats.map(s => [s.status, s._count]));
    return { ...c, reviewStats: statusMap };
  }));

  res.json(result);
}));

// GET /appraisals/cycles/:id — Single cycle with all reviews
router.get('/cycles/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const cycle = await req.prisma.appraisalCycle.findUnique({
    where: { id },
    include: {
      reviews: {
        include: {
          employee: { select: { id: true, name: true, department: true, designation: true, employeeId: true } },
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  });
  if (!cycle) throw notFound('Cycle not found.');
  res.json(cycle);
}));

// PUT /appraisals/cycles/:id — Update cycle (name, dates, status, sections)
router.put('/cycles/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, period, year, startDate, endDate, status, templateSections } = req.body;

  const cycle = await req.prisma.appraisalCycle.findUnique({ where: { id } });
  if (!cycle) throw notFound('Cycle not found.');
  if (cycle.status === 'closed' && status !== 'closed') throw forbidden('Cannot reopen a closed cycle. Create a new one.');

  const data = {};
  if (name)             data.name             = name.trim();
  if (period)           data.period           = period;
  if (year)             data.year             = parseInt(year);
  if (startDate)        data.startDate        = startDate;
  if (endDate)          data.endDate          = endDate;
  if (status)           data.status           = status;
  if (templateSections) data.templateSections = JSON.stringify(templateSections);

  const updated = await req.prisma.appraisalCycle.update({ where: { id }, data });
  res.json(updated);
}));

// POST /appraisals/cycles/:id/generate — Auto-create reviews for all active employees
router.post('/cycles/:id/generate', requireAdmin, asyncHandler(async (req, res) => {
  const cycleId = parseId(req.params.id);
  const cycle = await req.prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw notFound('Cycle not found.');
  if (cycle.status === 'closed') throw badRequest('Cannot generate reviews for a closed cycle.');

  const employees = await req.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, reportingManagerId: true },
  });

  let created = 0;
  let skipped = 0;
  for (const emp of employees) {
    const exists = await req.prisma.appraisalReview.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
    });
    if (exists) { skipped++; continue; }
    await req.prisma.appraisalReview.create({
      data: { cycleId, employeeId: emp.id, reviewerId: emp.reportingManagerId || req.user.id },
    });
    created++;
  }

  res.json({ message: `${created} reviews created, ${skipped} already existed.`, created, skipped });
}));

// GET /appraisals/reviews — Admin: all reviews (filter by cycleId)
router.get('/reviews', asyncHandler(async (req, res) => {
  if (!isAdminOrLead(req.user)) throw forbidden('Admin or team lead access required.');
  const { cycleId, status, department } = req.query;
  const where = {};
  if (cycleId) where.cycleId = parseInt(cycleId);
  if (status)  where.status  = status;
  if (department) where.employee = { department };
  if (req.user.role === 'team_lead') where.employee = { ...where.employee, department: req.user.department };

  const reviews = await req.prisma.appraisalReview.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, department: true, designation: true, employeeId: true } },
      reviewer: { select: { id: true, name: true } },
      cycle:    { select: { id: true, name: true, period: true, templateSections: true } },
    },
    orderBy: [{ cycle: { year: 'desc' } }, { employee: { name: 'asc' } }],
  });
  res.json(reviews);
}));

// GET /appraisals/reviews/:id — Single review (employee sees own, manager sees assigned, admin sees all)
router.get('/reviews/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.appraisalReview.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, department: true, designation: true, employeeId: true, dateOfJoining: true } },
      reviewer: { select: { id: true, name: true } },
      cycle:    true,
    },
  });
  if (!review) throw notFound('Review not found.');

  const isOwn     = review.employeeId === req.user.id;
  const isReviewer = review.reviewerId === req.user.id;
  const isAdmin   = isAdminOrLead(req.user);
  if (!isOwn && !isReviewer && !isAdmin) throw forbidden('Access denied.');

  res.json(review);
}));

// PUT /appraisals/reviews/:id/self — Employee submits self-assessment
router.put('/reviews/:id/self', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.appraisalReview.findUnique({
    where: { id },
    include: { cycle: true },
  });
  if (!review) throw notFound('Review not found.');
  if (review.employeeId !== req.user.id) throw forbidden('This is not your review.');
  if (!['pending', 'self_submitted'].includes(review.status)) throw badRequest('Self-assessment already locked for manager review.');
  if (review.cycle.status !== 'active') throw badRequest('This appraisal cycle is not active.');

  const { scores, comment } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) throw badRequest('Scores are required.');

  const sections = JSON.parse(review.cycle.templateSections || JSON.stringify(DEFAULT_SECTIONS));
  const selfRating = calcWeightedRating(scores, sections);

  const updated = await req.prisma.appraisalReview.update({
    where: { id },
    data: {
      selfScores: JSON.stringify(scores),
      selfRating,
      employeeComment: (comment || '').trim(),
      status: 'self_submitted',
      selfSubmittedAt: new Date(),
    },
  });
  res.json(updated);
}));

// PUT /appraisals/reviews/:id/manager — Manager submits review
router.put('/reviews/:id/manager', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.appraisalReview.findUnique({
    where: { id },
    include: { cycle: true },
  });
  if (!review) throw notFound('Review not found.');

  const isReviewer = review.reviewerId === req.user.id;
  const isAdmin   = isAdminOrLead(req.user);
  if (!isReviewer && !isAdmin) throw forbidden('Only the assigned reviewer or admin can submit manager review.');
  if (review.status === 'completed') throw badRequest('Review is already completed.');
  if (review.cycle.status !== 'active') throw badRequest('This appraisal cycle is not active.');

  const { scores, comment, finalRating: hrFinalRating } = req.body;
  if (!Array.isArray(scores) || scores.length === 0) throw badRequest('Manager scores are required.');

  const sections = JSON.parse(review.cycle.templateSections || JSON.stringify(DEFAULT_SECTIONS));
  const managerRating = calcWeightedRating(scores, sections);
  const finalRating = hrFinalRating != null ? parseFloat(hrFinalRating) : managerRating;

  const updated = await req.prisma.appraisalReview.update({
    where: { id },
    data: {
      managerScores: JSON.stringify(scores),
      managerRating,
      finalRating,
      managerComment: (comment || '').trim(),
      status: 'manager_reviewed',
      reviewedAt: new Date(),
    },
  });
  res.json(updated);
}));

// PUT /appraisals/reviews/:id/complete — HR finalizes a review
router.put('/reviews/:id/complete', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const review = await req.prisma.appraisalReview.findUnique({ where: { id } });
  if (!review) throw notFound('Review not found.');

  const { finalRating, hrNotes } = req.body;

  const updated = await req.prisma.appraisalReview.update({
    where: { id },
    data: {
      finalRating: finalRating != null ? parseFloat(finalRating) : review.managerRating,
      hrNotes: (hrNotes || '').trim() || null,
      status: 'completed',
      completedAt: new Date(),
    },
  });
  res.json(updated);
}));

// PUT /appraisals/reviews/:id/assign — Reassign reviewer
router.put('/reviews/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { reviewerId } = req.body;
  if (!reviewerId) throw badRequest('reviewerId is required.');

  const review = await req.prisma.appraisalReview.findUnique({ where: { id } });
  if (!review) throw notFound('Review not found.');

  const updated = await req.prisma.appraisalReview.update({
    where: { id },
    data: { reviewerId: parseInt(reviewerId) },
  });
  res.json(updated);
}));

// ── Employee: My Appraisals ──────────────────────────────────────────────────

// GET /appraisals/my — All my reviews
router.get('/my', asyncHandler(async (req, res) => {
  const reviews = await req.prisma.appraisalReview.findMany({
    where: { employeeId: req.user.id },
    include: {
      cycle:    { select: { id: true, name: true, period: true, year: true, status: true, templateSections: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews);
}));

// GET /appraisals/pending-manager — Reviews pending my manager action
router.get('/pending-manager', asyncHandler(async (req, res) => {
  if (!isAdminOrLead(req.user)) return res.json([]);
  const reviews = await req.prisma.appraisalReview.findMany({
    where: {
      reviewerId: req.user.id,
      status: { in: ['self_submitted', 'pending'] },
    },
    include: {
      employee: { select: { id: true, name: true, department: true, designation: true } },
      cycle:    { select: { id: true, name: true, period: true, year: true, status: true, templateSections: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(reviews);
}));

module.exports = router;
