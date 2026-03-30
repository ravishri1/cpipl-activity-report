const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

// ── Employee: Submit grievance ────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { subject, description, category, priority, isAnonymous } = req.body;
  requireFields(req.body, 'subject', 'description');
  const g = await req.prisma.grievance.create({
    data: {
      userId:      req.user.id,
      subject:     subject.trim(),
      description: description.trim(),
      category:    category || 'other',
      priority:    priority || 'normal',
      isAnonymous: Boolean(isAnonymous),
    },
  });
  res.status(201).json(g);
}));

// ── Employee: My grievances ───────────────────────────────────────────────────
router.get('/my', asyncHandler(async (req, res) => {
  const grievances = await req.prisma.grievance.findMany({
    where: { userId: req.user.id },
    include: {
      assignee: { select: { id: true, name: true } },
      comments: {
        where: { isInternal: false },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(grievances);
}));

// ── Admin: List all grievances ────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const { status, category, priority } = req.query;
  const where = {};
  if (status)   where.status   = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;

  const grievances = await req.prisma.grievance.findMany({
    where,
    include: {
      user:     { select: { id: true, name: true, employeeId: true, department: true } },
      assignee: { select: { id: true, name: true } },
      comments: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  // Hide identity for anonymous if not strict admin
  const result = grievances.map(g => {
    if (g.isAnonymous && req.user.role !== 'admin') {
      return { ...g, user: { id: 0, name: 'Anonymous', employeeId: '—', department: '—' } };
    }
    return g;
  });
  res.json(result);
}));

// ── Admin: Get single grievance ───────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const id = parseId(req.params.id);
  const g = await req.prisma.grievance.findUnique({
    where: { id },
    include: {
      user:     { select: { id: true, name: true, employeeId: true, department: true } },
      assignee: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!g) throw notFound('Grievance');
  if (g.isAnonymous && req.user.role !== 'admin') {
    return res.json({ ...g, user: { id: 0, name: 'Anonymous', employeeId: '—', department: '—' } });
  }
  res.json(g);
}));

// ── Admin: Update status / assign ─────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const id = parseId(req.params.id);
  const { status, assignedTo, resolution, priority } = req.body;

  const g = await req.prisma.grievance.findUnique({ where: { id } });
  if (!g) throw notFound('Grievance not found.');

  const data = {};
  if (status)     data.status     = status;
  if (priority)   data.priority   = priority;
  if (assignedTo !== undefined) data.assignedTo = assignedTo ? parseInt(assignedTo) : null;
  if (resolution) {
    data.resolution = resolution;
    if (status === 'resolved' || status === 'closed') data.resolvedAt = new Date();
  }

  const updated = await req.prisma.grievance.update({ where: { id }, data });
  res.json(updated);
}));

// ── Add comment (both employee and admin) ─────────────────────────────────────
router.post('/:id/comments', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { comment, isInternal } = req.body;
  requireFields(req.body, 'comment');

  const g = await req.prisma.grievance.findUnique({ where: { id } });
  if (!g) throw notFound('Grievance not found.');

  // Employee can only comment on their own; internal comments require admin
  if (!isAdminRole(req.user) && g.userId !== req.user.id) throw forbidden();
  if (isInternal && !isAdminRole(req.user)) throw forbidden('Only HR can add internal notes.');

  const c = await req.prisma.grievanceComment.create({
    data: {
      grievanceId: id,
      userId:      req.user.id,
      comment:     comment.trim(),
      isInternal:  Boolean(isInternal) && isAdminRole(req.user),
    },
    include: { user: { select: { id: true, name: true } } },
  });
  res.status(201).json(c);
}));

// ── Stats (admin) ─────────────────────────────────────────────────────────────
router.get('/stats/summary', asyncHandler(async (req, res) => {
  if (!isAdminRole(req.user)) throw forbidden();
  const [byStatus, byCategory, total] = await Promise.all([
    req.prisma.grievance.groupBy({ by: ['status'],   _count: true }),
    req.prisma.grievance.groupBy({ by: ['category'], _count: true }),
    req.prisma.grievance.count(),
  ]);
  res.json({ total, byStatus, byCategory });
}));

module.exports = router;
