const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

const VALID_CATEGORIES = ['email', 'tax', 'banking', 'erp', 'cloud', 'social', 'government', 'other'];
const VALID_STATUSES   = ['active', 'revoked', 'expired'];
const VALID_TYPES      = ['individual', 'shared'];

// ─── PORTALS ────────────────────────────────────────────────────────────────

// GET /api/credentials/portals
router.get('/portals', requireAdmin, asyncHandler(async (req, res) => {
  const { companyRegistrationId, companyRegistrationIds, legalEntityId, category } = req.query;
  const where = {};
  if (companyRegistrationIds) {
    where.companyRegistrationId = { in: companyRegistrationIds.split(',').map(id => parseInt(id)).filter(Boolean) };
  } else if (companyRegistrationId) {
    where.companyRegistrationId = parseId(companyRegistrationId);
  }
  if (legalEntityId) where.legalEntityId = parseId(legalEntityId);
  if (category) where.category = category;

  const portals = await req.prisma.companyPortal.findMany({
    where,
    include: {
      legalEntity: { select: { id: true, legalName: true, shortName: true } },
      companyRegistration: {
        select: { id: true, abbr: true, gstin: true, officeCity: true, legalEntityId: true },
      },
      _count: { select: { credentials: true } },
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  res.json(portals);
}));

// POST /api/credentials/portals
router.post('/portals', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name');
  if (req.body.category) requireEnum(req.body.category, VALID_CATEGORIES, 'category');

  const portal = await req.prisma.companyPortal.create({
    data: {
      name: req.body.name,
      url: req.body.url || null,
      description: req.body.description || null,
      category: req.body.category || 'other',
      legalEntityId: req.body.legalEntityId ? parseInt(req.body.legalEntityId) : null,
      companyRegistrationId: req.body.companyRegistrationId ? parseInt(req.body.companyRegistrationId) : null,
    },
    include: {
      legalEntity: { select: { id: true, legalName: true, shortName: true } },
      companyRegistration: { select: { id: true, abbr: true, gstin: true, officeCity: true, legalEntityId: true } },
      _count: { select: { credentials: true } },
    },
  });
  res.status(201).json(portal);
}));

// PUT /api/credentials/portals/:id
router.put('/portals/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.category) requireEnum(req.body.category, VALID_CATEGORIES, 'category');

  const portal = await req.prisma.companyPortal.update({
    where: { id },
    data: {
      ...(req.body.name !== undefined && { name: req.body.name }),
      ...(req.body.url !== undefined && { url: req.body.url || null }),
      ...(req.body.description !== undefined && { description: req.body.description || null }),
      ...(req.body.category !== undefined && { category: req.body.category }),
      ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
      ...(req.body.legalEntityId !== undefined && {
        legalEntityId: req.body.legalEntityId ? parseInt(req.body.legalEntityId) : null,
      }),
      ...(req.body.companyRegistrationId !== undefined && {
        companyRegistrationId: req.body.companyRegistrationId ? parseInt(req.body.companyRegistrationId) : null,
      }),
    },
    include: {
      legalEntity: { select: { id: true, legalName: true, shortName: true } },
      companyRegistration: { select: { id: true, abbr: true, gstin: true, officeCity: true, legalEntityId: true } },
      _count: { select: { credentials: true } },
    },
  });
  res.json(portal);
}));

// DELETE /api/credentials/portals/:id  (hard delete — cascades to credentials)
router.delete('/portals/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.companyPortal.delete({ where: { id } });
  res.json({ message: 'Portal deleted' });
}));

// POST /api/credentials/portals/bulk  — bulk enable/disable/delete
router.post('/portals/bulk', requireAdmin, asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  requireFields(req.body, 'ids', 'action');
  requireEnum(action, ['enable', 'disable', 'delete'], 'action');
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');
  const portalIds = ids.map(id => parseInt(id)).filter(Boolean);
  if (action === 'delete') {
    await req.prisma.companyPortal.deleteMany({ where: { id: { in: portalIds } } });
    return res.json({ message: `${portalIds.length} portal(s) deleted` });
  }
  await req.prisma.companyPortal.updateMany({
    where: { id: { in: portalIds } },
    data: { isActive: action === 'enable' },
  });
  res.json({ message: `${portalIds.length} portal(s) ${action}d` });
}));

// ─── CREDENTIALS ────────────────────────────────────────────────────────────

// GET /api/credentials/portals/:id/credentials
router.get('/portals/:id/credentials', requireAdmin, asyncHandler(async (req, res) => {
  const portalId = parseId(req.params.id);
  const portal = await req.prisma.companyPortal.findUnique({ where: { id: portalId } });
  if (!portal) throw notFound('Portal');

  const credentials = await req.prisma.portalCredential.findMany({
    where: { portalId },
    include: {
      assignee: { select: { id: true, name: true, email: true, employeeId: true } },
    },
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });
  res.json(credentials);
}));

// GET /api/credentials/all  — admin view: all credentials with filters
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const { portalId, status, type, assignedTo } = req.query;
  const where = {};
  if (portalId) where.portalId = parseId(portalId);
  if (status) where.status = status;
  if (type) where.type = type;
  if (assignedTo) where.assignedTo = parseId(assignedTo);

  const credentials = await req.prisma.portalCredential.findMany({
    where,
    include: {
      portal: {
        select: { id: true, name: true, category: true, url: true },
      },
      assignee: { select: { id: true, name: true, email: true, employeeId: true } },
    },
    orderBy: [{ portal: { name: 'asc' } }, { type: 'asc' }],
  });
  res.json(credentials);
}));

// GET /api/credentials/user/:userId — admin views credentials assigned to any user
router.get('/user/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!userId) throw badRequest('Invalid user ID');
  const credentials = await req.prisma.portalCredential.findMany({
    where: { assignedTo: userId },
    include: {
      portal: {
        select: { id: true, name: true, category: true, url: true,
          legalEntity: { select: { id: true, legalName: true, shortName: true } } },
      },
    },
    orderBy: [{ portal: { name: 'asc' } }],
  });
  res.json(credentials);
}));

// GET /api/credentials/my-credentials  — employee sees own assigned credentials
router.get('/my-credentials', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get individually assigned credentials
  const individual = await req.prisma.portalCredential.findMany({
    where: { assignedTo: userId, status: 'active' },
    include: {
      portal: { select: { id: true, name: true, category: true, url: true } },
    },
    orderBy: [{ portal: { name: 'asc' } }],
  });

  // Get shared credentials where this user is in sharedWith array
  const shared = await req.prisma.portalCredential.findMany({
    where: {
      type: 'shared',
      status: 'active',
      sharedWith: { contains: `"${userId}"` },
    },
    include: {
      portal: { select: { id: true, name: true, category: true, url: true } },
    },
    orderBy: [{ portal: { name: 'asc' } }],
  });

  res.json({ individual, shared });
}));

// POST /api/credentials/credentials
router.post('/credentials', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'portalId', 'username');
  if (req.body.type) requireEnum(req.body.type, VALID_TYPES, 'type');
  if (req.body.status) requireEnum(req.body.status, VALID_STATUSES, 'status');

  const portalId = parseInt(req.body.portalId);
  const portal = await req.prisma.companyPortal.findUnique({ where: { id: portalId } });
  if (!portal) throw notFound('Portal');

  const credential = await req.prisma.portalCredential.create({
    data: {
      portalId,
      type: req.body.type || 'individual',
      username: req.body.username,
      password: req.body.password || null,
      label: req.body.label || null,
      assignedTo: req.body.assignedTo ? parseInt(req.body.assignedTo) : null,
      sharedWith: req.body.sharedWith || null,
      notes: req.body.notes || null,
      phoneNumber: req.body.phoneNumber || null,
      department: req.body.department || null,
      purpose: req.body.purpose || null,
      status: req.body.status || 'active',
      lastRotated: req.body.lastRotated || null,
    },
    include: {
      portal: { select: { id: true, name: true, category: true, url: true } },
      assignee: { select: { id: true, name: true, email: true, employeeId: true } },
    },
  });
  res.status(201).json(credential);
}));

// PUT /api/credentials/credentials/:id
router.put('/credentials/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.type) requireEnum(req.body.type, VALID_TYPES, 'type');
  if (req.body.status) requireEnum(req.body.status, VALID_STATUSES, 'status');

  const credential = await req.prisma.portalCredential.update({
    where: { id },
    data: {
      ...(req.body.type !== undefined && { type: req.body.type }),
      ...(req.body.username !== undefined && { username: req.body.username }),
      ...(req.body.password !== undefined && { password: req.body.password || null }),
      ...(req.body.label !== undefined && { label: req.body.label || null }),
      ...(req.body.assignedTo !== undefined && { assignedTo: req.body.assignedTo ? parseInt(req.body.assignedTo) : null }),
      ...(req.body.sharedWith !== undefined && { sharedWith: req.body.sharedWith || null }),
      ...(req.body.notes !== undefined && { notes: req.body.notes || null }),
      ...(req.body.phoneNumber !== undefined && { phoneNumber: req.body.phoneNumber || null }),
      ...(req.body.department !== undefined && { department: req.body.department || null }),
      ...(req.body.purpose !== undefined && { purpose: req.body.purpose || null }),
      ...(req.body.status !== undefined && { status: req.body.status }),
      ...(req.body.lastRotated !== undefined && { lastRotated: req.body.lastRotated || null }),
    },
    include: {
      portal: { select: { id: true, name: true, category: true, url: true } },
      assignee: { select: { id: true, name: true, email: true, employeeId: true } },
    },
  });
  res.json(credential);
}));

// DELETE /api/credentials/credentials/:id  (revoke — set status: revoked)
router.delete('/credentials/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.portalCredential.update({ where: { id }, data: { status: 'revoked' } });
  res.json({ message: 'Credential revoked' });
}));

module.exports = router;
