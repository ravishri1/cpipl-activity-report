const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Employee: Submit request ──────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { assetType, quantity, reason, priority } = req.body;
  requireFields(req.body, 'assetType');
  const req2 = await req.prisma.assetRequest.create({
    data: {
      userId:    req.user.id,
      assetType: assetType.trim(),
      quantity:  parseInt(quantity) || 1,
      reason:    reason?.trim() || null,
      priority:  priority || 'normal',
    },
  });
  res.status(201).json(req2);
}));

// ── Employee: My requests ─────────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.assetRequest.findMany({
    where: { userId: req.user.id },
    include: { reviewer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// ── Employee: Cancel pending ──────────────────────────────────────────────────
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const r = await req.prisma.assetRequest.findUnique({ where: { id } });
  if (!r) throw notFound('Asset request not found.');
  if (r.userId !== req.user.id) throw forbidden();
  if (r.status !== 'pending') throw badRequest('Only pending requests can be cancelled.');
  const updated = await req.prisma.assetRequest.update({ where: { id }, data: { status: 'cancelled' } });
  res.json(updated);
}));

// ── Admin: List all ───────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const { status, priority } = req.query;
  const where = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;

  const requests = await req.prisma.assetRequest.findMany({
    where,
    include: {
      user:     { select: { id: true, name: true, employeeId: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(requests);
}));

// ── Admin: Approve / Reject ───────────────────────────────────────────────────
router.put('/:id/review', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('Status must be approved or rejected.');
  const r = await req.prisma.assetRequest.findUnique({ where: { id } });
  if (!r) throw notFound('Asset request not found.');
  if (!['pending'].includes(r.status)) throw badRequest('Request is not pending.');
  const updated = await req.prisma.assetRequest.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewNote: reviewNote?.trim() || null },
  });
  res.json(updated);
}));

// ── Admin: Mark as fulfilled ──────────────────────────────────────────────────
router.put('/:id/fulfill', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const id = parseId(req.params.id);
  const r = await req.prisma.assetRequest.findUnique({ where: { id } });
  if (!r) throw notFound('Asset request not found.');
  if (r.status !== 'approved') throw badRequest('Only approved requests can be marked as fulfilled.');
  const updated = await req.prisma.assetRequest.update({
    where: { id },
    data: { status: 'fulfilled', fulfilledAt: new Date() },
  });
  res.json(updated);
}));

module.exports = router;
