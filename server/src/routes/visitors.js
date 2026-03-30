const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Log visitor check-in ──────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden('Admin or receptionist access required.');
  const { name, hostUserId, phone, company, purpose, badgeNumber, notes } = req.body;
  requireFields(req.body, 'name', 'hostUserId');
  const hostId = parseInt(hostUserId);
  const host = await req.prisma.user.findUnique({ where: { id: hostId }, select: { id: true } });
  if (!host) throw badRequest('Host employee not found.');

  const visitor = await req.prisma.visitor.create({
    data: {
      name:        name.trim(),
      hostUserId:  hostId,
      phone:       phone?.trim()   || null,
      company:     company?.trim() || null,
      purpose:     purpose?.trim() || null,
      badgeNumber: badgeNumber?.trim() || null,
      notes:       notes?.trim()   || null,
    },
    include: { host: { select: { id: true, name: true, department: true } } },
  });
  res.status(201).json(visitor);
}));

// ── List visitors (admin) ─────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const { date, hostUserId } = req.query;
  const where = {};
  if (hostUserId) where.hostUserId = parseInt(hostUserId);
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.checkIn = { gte: start, lte: end };
  }

  const visitors = await req.prisma.visitor.findMany({
    where,
    include: { host: { select: { id: true, name: true, department: true } } },
    orderBy: { checkIn: 'desc' },
  });
  res.json(visitors);
}));

// ── Currently inside (not yet checked out) ───────────────────────────────────
router.get('/active', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const visitors = await req.prisma.visitor.findMany({
    where: { checkOut: null },
    include: { host: { select: { id: true, name: true, department: true } } },
    orderBy: { checkIn: 'asc' },
  });
  res.json(visitors);
}));

// ── Check-out visitor ─────────────────────────────────────────────────────────
router.put('/:id/checkout', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const id = parseId(req.params.id);
  const visitor = await req.prisma.visitor.findUnique({ where: { id } });
  if (!visitor) throw notFound('Visitor record not found.');
  if (visitor.checkOut) throw badRequest('Visitor already checked out.');

  const updated = await req.prisma.visitor.update({
    where: { id }, data: { checkOut: new Date() },
    include: { host: { select: { id: true, name: true } } },
  });
  res.json(updated);
}));

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalToday, currentlyIn, totalAllTime] = await Promise.all([
    req.prisma.visitor.count({ where: { checkIn: { gte: today } } }),
    req.prisma.visitor.count({ where: { checkOut: null } }),
    req.prisma.visitor.count(),
  ]);
  res.json({ totalToday, currentlyIn, totalAllTime });
}));

module.exports = router;
