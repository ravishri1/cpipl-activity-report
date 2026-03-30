const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── POST /exit-interviews — Create for a separation (admin initiates) ─────────
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { separationId } = req.body;
  if (!separationId) throw badRequest('separationId is required.');

  const separation = await req.prisma.separation.findUnique({
    where: { id: parseInt(separationId) },
    select: { id: true, userId: true },
  });
  if (!separation) throw notFound('Separation not found.');

  // Upsert (idempotent)
  const interview = await req.prisma.exitInterview.upsert({
    where: { separationId: parseInt(separationId) },
    create: { separationId: parseInt(separationId), userId: separation.userId },
    update: {},
  });
  res.status(201).json(interview);
}));

// ── GET /exit-interviews/my — Employee sees their own exit interview ───────────
router.get('/my', asyncHandler(async (req, res) => {
  const interview = await req.prisma.exitInterview.findFirst({
    where: { userId: req.user.id },
    include: { separation: { select: { type: true, requestDate: true, lastWorkingDate: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(interview || null);
}));

// ── PUT /exit-interviews/:id/submit — Employee submits responses ───────────────
router.put('/:id/submit', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const interview = await req.prisma.exitInterview.findUnique({ where: { id } });
  if (!interview) throw notFound('Exit interview not found.');
  if (interview.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (interview.status === 'completed') throw badRequest('Already submitted.');

  const {
    overallExperience, managementRating, workEnvironmentRating,
    compensationRating, growthRating,
    reasonForLeaving, bestAspect, improvementSuggestion,
    wouldRejoin, additionalComments,
  } = req.body;

  const toRating = (v) => {
    const n = parseInt(v);
    return (!isNaN(n) && n >= 1 && n <= 5) ? n : null;
  };

  const updated = await req.prisma.exitInterview.update({
    where: { id },
    data: {
      overallExperience:     toRating(overallExperience),
      managementRating:      toRating(managementRating),
      workEnvironmentRating: toRating(workEnvironmentRating),
      compensationRating:    toRating(compensationRating),
      growthRating:          toRating(growthRating),
      reasonForLeaving:      reasonForLeaving?.trim() || null,
      bestAspect:            bestAspect?.trim()        || null,
      improvementSuggestion: improvementSuggestion?.trim() || null,
      wouldRejoin:           wouldRejoin != null ? Boolean(wouldRejoin) : null,
      additionalComments:    additionalComments?.trim() || null,
      status: 'completed',
      submittedAt: new Date(),
      conductedBy: isAdminRole(req.user) ? req.user.id : interview.conductedBy,
    },
  });

  // Mark separation exitInterviewDone
  await req.prisma.separation.update({
    where: { id: interview.separationId },
    data: { exitInterviewDone: true },
  }).catch(() => {});

  res.json(updated);
}));

// ── GET /exit-interviews — Admin: list all ────────────────────────────────────
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const interviews = await req.prisma.exitInterview.findMany({
    where,
    include: {
      employee:  { select: { id: true, name: true, department: true, designation: true } },
      conductor: { select: { id: true, name: true } },
      separation: { select: { type: true, requestDate: true, lastWorkingDate: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(interviews);
}));

// ── GET /exit-interviews/:id — Get single interview ───────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const interview = await req.prisma.exitInterview.findUnique({
    where: { id },
    include: {
      employee:  { select: { id: true, name: true, department: true, designation: true, dateOfJoining: true } },
      conductor: { select: { id: true, name: true } },
      separation: { select: { type: true, requestDate: true, lastWorkingDate: true } },
    },
  });
  if (!interview) throw notFound('Exit interview not found.');
  if (!isAdminRole(req.user) && interview.userId !== req.user.id) throw forbidden();
  res.json(interview);
}));

// ── GET /exit-interviews/stats/summary — Aggregate ratings ────────────────────
router.get('/stats/summary', requireAdmin, asyncHandler(async (req, res) => {
  const interviews = await req.prisma.exitInterview.findMany({
    where: { status: 'completed' },
    select: {
      overallExperience: true, managementRating: true,
      workEnvironmentRating: true, compensationRating: true,
      growthRating: true, wouldRejoin: true, reasonForLeaving: true,
    },
  });

  const avg = (field) => {
    const vals = interviews.map(i => i[field]).filter(v => v != null);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };

  const wouldRejoinYes = interviews.filter(i => i.wouldRejoin === true).length;
  const wouldRejoinNo  = interviews.filter(i => i.wouldRejoin === false).length;

  res.json({
    total: interviews.length,
    averages: {
      overall:        avg('overallExperience'),
      management:     avg('managementRating'),
      workEnvironment:avg('workEnvironmentRating'),
      compensation:   avg('compensationRating'),
      growth:         avg('growthRating'),
    },
    wouldRejoin: { yes: wouldRejoinYes, no: wouldRejoinNo },
  });
}));

module.exports = router;
