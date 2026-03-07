const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── JOB OPENINGS ────────────────────────────────────────────────────────────

router.get('/openings', asyncHandler(async (req, res) => {
  const { status, department } = req.query;
  const where = {};
  if (status) where.status = status;
  if (department) where.department = department;
  const openings = await req.prisma.jobOpening.findMany({
    where,
    include: {
      poster: { select: { id: true, name: true } },
      _count: { select: { candidates: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(openings);
}));

router.get('/openings/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const opening = await req.prisma.jobOpening.findUnique({
    where: { id },
    include: {
      poster: { select: { id: true, name: true } },
      candidates: {
        include: { interviews: true, offer: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!opening) throw notFound('Job Opening');
  res.json(opening);
}));

router.post('/openings', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'title', 'department');
  const opening = await req.prisma.jobOpening.create({
    data: { ...req.body, postedBy: req.user.id }
  });
  res.status(201).json(opening);
}));

router.put('/openings/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const opening = await req.prisma.jobOpening.update({ where: { id }, data: req.body });
  res.json(opening);
}));

router.delete('/openings/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.jobOpening.update({ where: { id }, data: { status: 'closed', closedAt: new Date() } });
  res.json({ message: 'Job opening closed' });
}));

// ─── CANDIDATES ───────────────────────────────────────────────────────────────

router.get('/candidates', requireAdmin, asyncHandler(async (req, res) => {
  const { jobOpeningId, stage } = req.query;
  const where = {};
  if (jobOpeningId) where.jobOpeningId = parseId(jobOpeningId);
  if (stage) where.stage = stage;
  const candidates = await req.prisma.candidate.findMany({
    where,
    include: {
      jobOpening: { select: { id: true, title: true, department: true } },
      interviews: { orderBy: { scheduledAt: 'desc' } },
      offer: true,
      referredBy: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(candidates);
}));

router.get('/candidates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const candidate = await req.prisma.candidate.findUnique({
    where: { id },
    include: {
      jobOpening: true,
      interviews: { include: { conductor: { select: { id: true, name: true } } }, orderBy: { scheduledAt: 'asc' } },
      offer: true,
      referredBy: { select: { id: true, name: true } }
    }
  });
  if (!candidate) throw notFound('Candidate');
  res.json(candidate);
}));

router.post('/candidates', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'jobOpeningId', 'name', 'email');
  const candidate = await req.prisma.candidate.create({ data: req.body });
  res.status(201).json(candidate);
}));

router.put('/candidates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const candidate = await req.prisma.candidate.update({ where: { id }, data: req.body });
  res.json(candidate);
}));

router.put('/candidates/:id/stage', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'stage');
  requireEnum(req.body.stage, ['applied', 'shortlisted', 'interview', 'offered', 'joined', 'rejected', 'withdrawn'], 'stage');
  const candidate = await req.prisma.candidate.update({
    where: { id },
    data: { stage: req.body.stage, notes: req.body.notes }
  });
  res.json(candidate);
}));

// ─── INTERVIEWS ───────────────────────────────────────────────────────────────

router.get('/interviews', requireAdmin, asyncHandler(async (req, res) => {
  const interviews = await req.prisma.interview.findMany({
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      conductor: { select: { id: true, name: true } }
    },
    orderBy: { scheduledAt: 'desc' }
  });
  res.json(interviews);
}));

router.post('/interviews', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'candidateId', 'round', 'scheduledAt');
  const interview = await req.prisma.interview.create({ data: req.body });
  res.status(201).json(interview);
}));

router.put('/interviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const interview = await req.prisma.interview.update({ where: { id }, data: req.body });
  res.json(interview);
}));

router.delete('/interviews/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.interview.delete({ where: { id } });
  res.json({ message: 'Interview deleted' });
}));

// ─── OFFERS ───────────────────────────────────────────────────────────────────

router.get('/offers', requireAdmin, asyncHandler(async (req, res) => {
  const offers = await req.prisma.jobOffer.findMany({
    include: {
      candidate: { select: { id: true, name: true, email: true } },
      generator: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(offers);
}));

router.post('/offers', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'candidateId', 'ctcOffered', 'joiningDate');
  const existing = await req.prisma.jobOffer.findFirst({ where: { candidateId: req.body.candidateId } });
  if (existing) throw badRequest('Offer already exists for this candidate');
  const offer = await req.prisma.jobOffer.create({ data: { ...req.body, generatedBy: req.user.id } });
  await req.prisma.candidate.update({ where: { id: req.body.candidateId }, data: { stage: 'offered' } });
  res.status(201).json(offer);
}));

router.put('/offers/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const offer = await req.prisma.jobOffer.update({ where: { id }, data: req.body });
  if (req.body.status === 'accepted') {
    await req.prisma.candidate.update({ where: { id: offer.candidateId }, data: { stage: 'joined' } });
  } else if (['declined', 'withdrawn'].includes(req.body.status)) {
    await req.prisma.candidate.update({ where: { id: offer.candidateId }, data: { stage: 'rejected' } });
  }
  res.json(offer);
}));

module.exports = router;
