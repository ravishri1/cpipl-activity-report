const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return u.role === 'admin' || u.role === 'sub_admin' || u.role === 'team_lead'; }

// GET /api/comp-off/balance/me — current user's own balance
router.get('/balance/me', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  let bal = await req.prisma.compOffBalance.findUnique({ where: { userId_year: { userId, year } } });
  if (!bal) bal = { userId, year, earned: 0, used: 0, balance: 0 };
  res.json(bal);
}));

// GET /api/comp-off/balance/:userId
router.get('/balance/:userId', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden();
  const year = parseInt(req.query.year) || new Date().getFullYear();
  let bal = await req.prisma.compOffBalance.findUnique({ where: { userId_year: { userId, year } } });
  if (!bal) bal = { userId, year, earned: 0, used: 0, balance: 0 };
  res.json(bal);
}));

// GET /api/comp-off/my
router.get('/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.compOffRequest.findMany({
    where: { userId: req.user.id },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// GET /api/comp-off (admin — all pending)
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : { status: 'pending' };
  const requests = await req.prisma.compOffRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// POST /api/comp-off — employee submits earn/redeem request
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'type', 'workDate', 'days');
  const { type, workDate, days, reason } = req.body;
  if (!['earn', 'redeem'].includes(type)) throw badRequest('type must be earn or redeem');
  if (![0.5, 1].includes(parseFloat(days))) throw badRequest('days must be 0.5 or 1');

  if (type === 'redeem') {
    const year = new Date().getFullYear();
    const bal = await req.prisma.compOffBalance.findUnique({
      where: { userId_year: { userId: req.user.id, year } },
    });
    if (!bal || bal.balance < parseFloat(days)) throw badRequest('Insufficient comp-off balance');
  }

  const request = await req.prisma.compOffRequest.create({
    data: { userId: req.user.id, type, workDate, days: parseFloat(days), reason: reason || null },
  });
  res.status(201).json(request);
}));

// PUT /api/comp-off/:id/review — admin approves/rejects
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('status must be approved or rejected');

  const request = await req.prisma.compOffRequest.findUnique({ where: { id } });
  if (!request) throw notFound('CompOff request');
  if (request.status !== 'pending') throw badRequest('Request already reviewed');

  const updated = await req.prisma.compOffRequest.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
  });

  if (status === 'approved') {
    const year = new Date(request.workDate).getFullYear();
    const isEarn = request.type === 'earn';
    await req.prisma.compOffBalance.upsert({
      where: { userId_year: { userId: request.userId, year } },
      create: {
        userId: request.userId, year,
        earned: isEarn ? request.days : 0,
        used: isEarn ? 0 : request.days,
        balance: isEarn ? request.days : -request.days,
      },
      update: {
        earned: isEarn ? { increment: request.days } : undefined,
        used: !isEarn ? { increment: request.days } : undefined,
        balance: isEarn ? { increment: request.days } : { decrement: request.days },
      },
    });
  }

  res.json(updated);
}));

// DELETE /api/comp-off/:id — employee cancels pending request
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const request = await req.prisma.compOffRequest.findUnique({ where: { id } });
  if (!request) throw notFound('CompOff request');
  if (request.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (request.status !== 'pending') throw badRequest('Only pending requests can be cancelled');
  await req.prisma.compOffRequest.delete({ where: { id } });
  res.json({ message: 'Request cancelled' });
}));

module.exports = router;
