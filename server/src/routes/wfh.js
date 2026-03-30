const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Employee: Request WFH ─────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { date, reason } = req.body;
  requireFields(req.body, 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be YYYY-MM-DD.');

  // No duplicate
  const existing = await req.prisma.wFHRequest.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
  });
  if (existing) throw badRequest(`WFH already requested for ${date}.`);

  const wfh = await req.prisma.wFHRequest.create({
    data: { userId: req.user.id, date, reason: reason?.trim() || null },
  });
  res.status(201).json(wfh);
}));

// ── Employee: My WFH requests ─────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const { month } = req.query;
  const where = { userId: req.user.id };
  if (month) where.date = { startsWith: month };

  const requests = await req.prisma.wFHRequest.findMany({
    where,
    include: { reviewer: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(requests);
}));

// ── Employee: Cancel WFH request ─────────────────────────────────────────────
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const wfh = await req.prisma.wFHRequest.findUnique({ where: { id } });
  if (!wfh) throw notFound('WFH request not found.');
  if (wfh.userId !== req.user.id) throw forbidden();
  if (wfh.status !== 'pending') throw badRequest('Only pending requests can be cancelled.');

  const updated = await req.prisma.wFHRequest.update({
    where: { id }, data: { status: 'cancelled' },
  });
  res.json(updated);
}));

// ── Admin/Team Lead: List all WFH requests ────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden('Admin or team lead access required.');
  const { status, month, userId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (month)  where.date   = { startsWith: month };
  if (userId) where.userId = parseInt(userId);
  if (req.user.role === 'team_lead') {
    where.user = { department: req.user.department };
  }

  const requests = await req.prisma.wFHRequest.findMany({
    where,
    include: {
      user:     { select: { id: true, name: true, employeeId: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
  res.json(requests);
}));

// ── Admin: Approve/Reject WFH ─────────────────────────────────────────────────
router.put('/:id/review', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden('Admin or team lead access required.');
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('Status must be approved or rejected.');

  const wfh = await req.prisma.wFHRequest.findUnique({
    where: { id },
    include: { user: { select: { department: true } } },
  });
  if (!wfh) throw notFound('WFH request not found.');
  if (req.user.role === 'team_lead' && wfh.user?.department !== req.user.department) throw forbidden('Can only review your department.');
  if (!['pending'].includes(wfh.status)) throw badRequest('Request is not pending.');

  const updated = await req.prisma.wFHRequest.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote?.trim() || null },
  });
  res.json(updated);
}));

// ── Admin: WFH summary for a month ───────────────────────────────────────────
router.get('/summary/:month', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden('Admin access required.');
  const { month } = req.params;

  const requests = await req.prisma.wFHRequest.findMany({
    where: { date: { startsWith: month }, status: 'approved' },
    include: { user: { select: { id: true, name: true, department: true } } },
  });

  const byEmployee = {};
  requests.forEach(r => {
    const key = r.userId;
    if (!byEmployee[key]) byEmployee[key] = { userId: r.userId, name: r.user?.name, department: r.user?.department, count: 0, dates: [] };
    byEmployee[key].count++;
    byEmployee[key].dates.push(r.date);
  });

  res.json({
    month,
    totalDays: requests.length,
    employees: Object.values(byEmployee).sort((a, b) => b.count - a.count),
  });
}));

module.exports = router;
