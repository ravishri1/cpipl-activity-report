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

// Tracked fields for history diff
const TRACKED_FIELDS = ['type', 'username', 'password', 'label', 'assignedTo', 'sharedWith',
  'notes', 'phoneNumber', 'department', 'purpose', 'status', 'lastRotated'];

async function resolveUserName(userId, prisma) {
  if (!userId) return null;
  const id = parseInt(userId);
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return user?.name || String(userId);
}

async function resolveSharedWith(jsonStr, prisma) {
  if (!jsonStr) return null;
  try {
    const ids = JSON.parse(jsonStr);
    if (!Array.isArray(ids) || ids.length === 0) return null;
    const users = await prisma.user.findMany({
      where: { id: { in: ids.map(id => parseInt(id)).filter(Boolean) } },
      select: { name: true },
    });
    return users.map(u => u.name).join(', ') || jsonStr;
  } catch {
    return jsonStr;
  }
}

async function buildDiff(before, body, prisma) {
  const changes = {};
  for (const field of TRACKED_FIELDS) {
    if (body[field] === undefined) continue;
    let oldVal = before[field] ?? null;
    let newVal = (field === 'assignedTo' && body[field]) ? parseInt(body[field]) : (body[field] || null);

    if (field === 'sharedWith') {
      const oldNames = await resolveSharedWith(oldVal, prisma);
      const newNames = await resolveSharedWith(newVal, prisma);
      if (String(oldNames) !== String(newNames)) {
        changes[field] = { old: oldNames, new: newNames };
      }
      continue;
    }
    if (field === 'assignedTo') {
      const oldName = await resolveUserName(oldVal, prisma);
      const newName = await resolveUserName(newVal, prisma);
      if (String(oldName) !== String(newName)) {
        changes[field] = { old: oldName, new: newName };
      }
      continue;
    }
    if (String(oldVal) !== String(newVal)) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  return changes;
}

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
    orderBy: [{ createdAt: 'desc' }],
  });
  res.json(portals);
}));

// POST /api/credentials/portals
router.post('/portals', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name');
  if (req.body.category) requireEnum(req.body.category, VALID_CATEGORIES, 'category');

  const companyRegistrationId = req.body.companyRegistrationId ? parseInt(req.body.companyRegistrationId) : null;
  let legalEntityId = req.body.legalEntityId ? parseInt(req.body.legalEntityId) : null;
  // Auto-derive legalEntityId from registration so portal always appears in the tree
  if (companyRegistrationId && !legalEntityId) {
    const reg = await req.prisma.companyRegistration.findUnique({ where: { id: companyRegistrationId }, select: { legalEntityId: true } });
    if (reg) legalEntityId = reg.legalEntityId;
  }

  const portal = await req.prisma.companyPortal.create({
    data: {
      name: req.body.name,
      url: req.body.url || null,
      description: req.body.description || null,
      category: req.body.category || 'other',
      legalEntityId,
      companyRegistrationId,
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

  // Auto-derive legalEntityId from companyRegistrationId when only registration is changed
  let derivedLegalEntityId;
  if (req.body.companyRegistrationId !== undefined && req.body.legalEntityId === undefined) {
    const regId = req.body.companyRegistrationId ? parseInt(req.body.companyRegistrationId) : null;
    if (regId) {
      const reg = await req.prisma.companyRegistration.findUnique({ where: { id: regId }, select: { legalEntityId: true } });
      if (reg) derivedLegalEntityId = reg.legalEntityId;
    }
  }

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
      ...(derivedLegalEntityId !== undefined && { legalEntityId: derivedLegalEntityId }),
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

// ─── TREE ───────────────────────────────────────────────────────────────────

// GET /api/credentials/tree — full company → registration → portal → credential tree
router.get('/tree', requireAdmin, asyncHandler(async (req, res) => {
  // Heal orphaned portals: if companyRegistrationId is set but legalEntityId is null, derive it
  const orphans = await req.prisma.companyPortal.findMany({
    where: { legalEntityId: null, companyRegistrationId: { not: null } },
    select: { id: true, companyRegistrationId: true },
  });
  if (orphans.length > 0) {
    const regIds = [...new Set(orphans.map(p => p.companyRegistrationId))];
    const regs = await req.prisma.companyRegistration.findMany({
      where: { id: { in: regIds } },
      select: { id: true, legalEntityId: true },
    });
    const regMap = {};
    regs.forEach(r => { regMap[r.id] = r.legalEntityId; });
    await Promise.all(orphans.map(p => {
      const eid = regMap[p.companyRegistrationId];
      if (eid) return req.prisma.companyPortal.update({ where: { id: p.id }, data: { legalEntityId: eid } });
    }).filter(Boolean));
  }

  const credInclude = {
    credentials: {
      include: { assignee: { select: { id: true, name: true, employeeId: true } } },
      orderBy: [{ type: 'asc' }, { label: 'asc' }],
    },
  };
  const portalInclude = { where: { isActive: true }, include: credInclude, orderBy: [{ category: 'asc' }, { name: 'asc' }] };

  // Fetch all legal entities with entity-level portals + registrations → portals → credentials
  const entities = await req.prisma.legalEntity.findMany({
    include: {
      portals: { ...portalInclude, where: { isActive: true, companyRegistrationId: null } },
      registrations: {
        include: { portals: portalInclude },
        orderBy: [{ abbr: 'asc' }],
      },
    },
    orderBy: [{ legalName: 'asc' }],
  });

  // Collect all unique sharedWith user IDs across all credentials
  const allUserIds = new Set();
  const collectIds = (portals) => {
    for (const portal of portals) {
      for (const cred of portal.credentials) {
        if (cred.sharedWith) {
          try {
            const ids = JSON.parse(cred.sharedWith);
            if (Array.isArray(ids)) ids.forEach(id => allUserIds.add(parseInt(id)));
          } catch {}
        }
      }
    }
  };
  for (const entity of entities) {
    collectIds(entity.portals);
    for (const reg of entity.registrations) collectIds(reg.portals);
  }

  // Fetch all referenced users in one query
  const usersMap = {};
  if (allUserIds.size > 0) {
    const users = await req.prisma.user.findMany({
      where: { id: { in: [...allUserIds] } },
      select: { id: true, name: true, employeeId: true },
    });
    users.forEach(u => { usersMap[u.id] = u; });
  }

  // Build response — strip password, resolve sharedWith to user objects
  const mapPortal = (portal) => ({
    id: portal.id,
    name: portal.name,
    category: portal.category,
    url: portal.url,
    companyRegistrationId: portal.companyRegistrationId,
    credentials: portal.credentials.map(cred => {
      let sharedWithUsers = [];
      if (cred.sharedWith) {
        try {
          const ids = JSON.parse(cred.sharedWith);
          if (Array.isArray(ids)) sharedWithUsers = ids.map(id => usersMap[parseInt(id)]).filter(Boolean);
        } catch {}
      }
      return {
        id: cred.id, username: cred.username, label: cred.label, type: cred.type,
        status: cred.status, department: cred.department, purpose: cred.purpose,
        assignee: cred.assignee, sharedWithUsers,
      };
    }),
  });

  const tree = entities.map(entity => ({
    id: entity.id,
    legalName: entity.legalName,
    shortName: entity.shortName,
    pan: entity.pan,
    entityPortals: entity.portals.map(mapPortal),
    registrations: entity.registrations.map(reg => ({
      id: reg.id,
      abbr: reg.abbr,
      gstin: reg.gstin,
      officeCity: reg.officeCity,
      state: reg.state,
      portals: reg.portals.map(mapPortal),
    })),
  }));

  res.json(tree);
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

// GET /api/credentials/user/:userId — admin views credentials assigned to a user + dept-based
router.get('/user/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!userId) throw badRequest('Invalid user ID');

  const user = await req.prisma.user.findUnique({ where: { id: userId }, select: { id: true, department: true } });
  if (!user) throw notFound('User');

  const portalInclude = {
    portal: {
      select: { id: true, name: true, category: true, url: true,
        legalEntity: { select: { id: true, legalName: true, shortName: true } } },
    },
  };

  // Fetch individually assigned credentials
  const assigned = await req.prisma.portalCredential.findMany({
    where: { assignedTo: userId },
    include: portalInclude,
    orderBy: [{ portal: { name: 'asc' } }],
  });

  // Fetch department-based credentials (exclude already-assigned to avoid duplicates)
  const assignedIds = new Set(assigned.map(c => c.id));
  let departmentCreds = [];
  if (user.department) {
    const deptCreds = await req.prisma.portalCredential.findMany({
      where: {
        status: 'active',
        OR: [
          { department: user.department },
          { department: { contains: `"${user.department}"` } },
        ],
      },
      include: portalInclude,
      orderBy: [{ portal: { name: 'asc' } }],
    });
    departmentCreds = deptCreds.filter(c => !assignedIds.has(c.id));
  }

  res.json({ assigned, department: departmentCreds, userDepartment: user.department });
}));

// GET /api/credentials/my-credentials  — employee sees own assigned credentials
router.get('/my-credentials', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await req.prisma.user.findUnique({ where: { id: userId }, select: { id: true, department: true } });

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

  // Get department-based credentials (deduplicated)
  const assignedIds = new Set([...individual.map(c => c.id), ...shared.map(c => c.id)]);
  let department = [];
  if (user?.department) {
    const deptCreds = await req.prisma.portalCredential.findMany({
      where: {
        status: 'active',
        OR: [
          { department: user.department },
          { department: { contains: `"${user.department}"` } },
        ],
      },
      include: {
        portal: { select: { id: true, name: true, category: true, url: true } },
      },
      orderBy: [{ portal: { name: 'asc' } }],
    });
    department = deptCreds.filter(c => !assignedIds.has(c.id));
  }

  res.json({ individual, shared, department });
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

  // Log creation
  await req.prisma.portalCredentialHistory.create({
    data: {
      credentialId: credential.id,
      changedBy: req.user.id,
      action: 'create',
      changes: JSON.stringify({ username: { old: null, new: credential.username } }),
    },
  });

  res.status(201).json(credential);
}));

// PUT /api/credentials/credentials/:id
router.put('/credentials/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.type) requireEnum(req.body.type, VALID_TYPES, 'type');
  if (req.body.status) requireEnum(req.body.status, VALID_STATUSES, 'status');

  // Fetch before state for diff
  const before = await req.prisma.portalCredential.findUnique({ where: { id } });
  if (!before) throw notFound('Credential');

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

  // Log only if something changed
  const changes = await buildDiff(before, req.body, req.prisma);
  if (Object.keys(changes).length > 0) {
    await req.prisma.portalCredentialHistory.create({
      data: {
        credentialId: id,
        changedBy: req.user.id,
        action: 'update',
        changes: JSON.stringify(changes),
      },
    });
  }

  res.json(credential);
}));

// DELETE /api/credentials/credentials/:id  (revoke — set status: revoked)
router.delete('/credentials/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.portalCredential.update({ where: { id }, data: { status: 'revoked' } });

  await req.prisma.portalCredentialHistory.create({
    data: {
      credentialId: id,
      changedBy: req.user.id,
      action: 'revoke',
      changes: JSON.stringify({ status: { old: 'active', new: 'revoked' } }),
    },
  });

  res.json({ message: 'Credential revoked' });
}));

// GET /api/credentials/credentials/:id/history  — audit log for a credential
router.get('/credentials/:id/history', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const history = await req.prisma.portalCredentialHistory.findMany({
    where: { credentialId: id },
    include: {
      changedByUser: { select: { id: true, name: true, email: true, employeeId: true } },
    },
    orderBy: [{ changedAt: 'desc' }],
  });
  res.json(history);
}));

module.exports = router;
