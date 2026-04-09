const express = require('express');
const multer = require('multer');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const { notifyAllExcept } = require('../utils/notify');
const { getDriveClientOAuth, getOrCreateRootFolder, uploadFile, deleteFile } = require('../services/google/googleDrive');

const policyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Get or create "Company Policies" folder in Drive root
async function getPoliciesFolderId(drive) {
  const rootId = await getOrCreateRootFolder(drive);
  const res = await drive.files.list({
    q: `name='Company Policies' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name: 'Company Policies', mimeType: 'application/vnd.google-apps.folder', parents: [rootId] },
    fields: 'id',
  });
  return folder.data.id;
}

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

// ══════════════════════════════════════════
// PUBLIC (any authenticated user)
// ══════════════════════════════════════════

// GET / — List active policies (for employees)
router.get('/', asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.company) {
    where.OR = [{ companyId: null }, { companyId: parseInt(req.query.company) }];
  }

  const policies = await req.prisma.policy.findMany({
    where,
    select: {
      id: true, title: true, slug: true, category: true, summary: true,
      version: true, effectiveDate: true, isMandatory: true, companyId: true, createdAt: true,
      serialNo: true, fileUrl: true, fileName: true,
      _count: { select: { acceptances: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const acceptances = await req.prisma.policyAcceptance.findMany({
    where: { userId: req.user.id },
    select: { policyId: true, version: true, acceptedAt: true },
  });
  const acceptMap = {};
  acceptances.forEach(a => { acceptMap[`${a.policyId}-${a.version}`] = a.acceptedAt; });

  res.json(policies.map(p => ({
    ...p,
    acceptedAt: acceptMap[`${p.id}-${p.version}`] || null,
    isAccepted: !!acceptMap[`${p.id}-${p.version}`],
    totalAcceptances: p._count.acceptances,
  })));
}));

// GET /:slug — Get full policy content (with version change info for employee)
router.get('/:slug', asyncHandler(async (req, res) => {
  const policy = await req.prisma.policy.findUnique({
    where: { slug: req.params.slug },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
      company: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!policy) throw notFound('Policy');

  // Current version acceptance
  const acceptance = await req.prisma.policyAcceptance.findUnique({
    where: { policyId_userId_version: { policyId: policy.id, userId: req.user.id, version: policy.version } },
  });

  // Find the latest version the user has accepted (may be older than current)
  const latestAcceptance = await req.prisma.policyAcceptance.findFirst({
    where: { policyId: policy.id, userId: req.user.id },
    orderBy: { version: 'desc' },
    select: { version: true, acceptedAt: true },
  });

  // If the user accepted an older version, fetch changelogs between their version and current
  let versionChanges = [];
  if (latestAcceptance && latestAcceptance.version < policy.version) {
    versionChanges = await req.prisma.policyVersion.findMany({
      where: {
        policyId: policy.id,
        version: { gt: latestAcceptance.version, lte: policy.version },
      },
      orderBy: { version: 'desc' },
      select: { version: true, changeLog: true, createdAt: true },
    });
  } else if (!latestAcceptance && policy.version > 1) {
    // Never accepted — show all version changelogs
    versionChanges = await req.prisma.policyVersion.findMany({
      where: { policyId: policy.id },
      orderBy: { version: 'desc' },
      select: { version: true, changeLog: true, createdAt: true },
    });
  }

  // Get the last updated date from policyVersion
  const latestVersion = await req.prisma.policyVersion.findFirst({
    where: { policyId: policy.id, version: policy.version },
    select: { createdAt: true },
  });

  res.json({
    ...policy,
    acceptance,
    lastAcceptedVersion: latestAcceptance?.version || null,
    lastAcceptedAt: latestAcceptance?.acceptedAt || null,
    versionChanges,
    lastUpdatedAt: latestVersion?.createdAt || policy.updatedAt || policy.createdAt,
  });
}));

// POST /:id/accept — Employee accepts a policy
router.post('/:id/accept', asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) throw notFound('Policy');

  const acceptance = await req.prisma.policyAcceptance.upsert({
    where: { policyId_userId_version: { policyId, userId: req.user.id, version: policy.version } },
    update: { acceptedAt: new Date(), remarks: req.body.remarks || null },
    create: { policyId, userId: req.user.id, version: policy.version, ipAddress: req.ip, remarks: req.body.remarks || null },
  });

  res.json(acceptance);
}));

// GET /:id/my-acceptance — Check if current user accepted
router.get('/:id/my-acceptance', asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) throw notFound('Policy');

  const acceptance = await req.prisma.policyAcceptance.findUnique({
    where: { policyId_userId_version: { policyId, userId: req.user.id, version: policy.version } },
  });
  res.json({ accepted: !!acceptance, acceptance });
}));

// ══════════════════════════════════════════
// ADMIN ONLY
// ══════════════════════════════════════════

// GET /admin/all — List all policies (including inactive)
router.get('/admin/all', requireAdmin, asyncHandler(async (req, res) => {
  const policies = await req.prisma.policy.findMany({
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      _count: { select: { acceptances: true, sections: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalEmployees = await req.prisma.user.count({ where: { isActive: true } });

  res.json(policies.map(p => ({
    ...p,
    totalAcceptances: p._count.acceptances,
    totalSections: p._count.sections,
    acceptanceRate: totalEmployees > 0 ? Math.round((p._count.acceptances / totalEmployees) * 100) : 0,
  })));
}));

// POST /admin/create — Create new policy (with optional PDF upload)
router.post('/admin/create', requireAdmin, policyUpload.single('file'), asyncHandler(async (req, res) => {
  const { title, category, content, summary, effectiveDate, isMandatory, companyId, serialNo } = req.body;
  if (!title) throw badRequest('Title is required.');
  if (!req.file && !content) throw badRequest('Either a PDF file or policy content is required.');

  const slug = slugify(title);
  const existing = await req.prisma.policy.findUnique({ where: { slug } });
  if (existing) throw badRequest('A policy with this title already exists.');

  // Upload PDF to Drive if provided
  let fileUrl = null, fileName = null, driveFileId = null;
  if (req.file) {
    const drive = await getDriveClientOAuth(req.user.id, req.prisma);
    const folderId = await getPoliciesFolderId(drive);
    const uploaded = await uploadFile(drive, folderId, req.file.originalname, 'application/pdf', req.file.buffer);
    fileUrl = uploaded.webViewLink;
    fileName = req.file.originalname;
    driveFileId = uploaded.fileId;
  }

  const policyContent = content || '';

  const policy = await req.prisma.policy.create({
    data: {
      title: title.trim(), slug, category: category || 'general', content: policyContent,
      summary: summary || null, effectiveDate: effectiveDate || null,
      isMandatory: isMandatory !== undefined ? (isMandatory === true || isMandatory === 'true') : true,
      companyId: companyId ? parseInt(companyId) : null,
      createdBy: req.user.id, version: 1,
      serialNo: serialNo || null, fileUrl, fileName, driveFileId,
    },
  });

  await req.prisma.policyVersion.create({
    data: { policyId: policy.id, version: 1, content: policyContent, changedBy: req.user.id, changeLog: 'Initial version' },
  });

  // Notify all employees about new policy
  notifyAllExcept(req.prisma, req.user.id, {
    type: 'policy',
    title: `New Policy Published: ${title.trim()}`,
    message: isMandatory !== false ? 'A new mandatory policy requires your acceptance' : 'A new company policy has been published',
    link: `/policies/${policy.slug}`,
  });

  res.json(policy);
}));

// PUT /admin/:id — Update policy (with optional PDF upload)
router.put('/admin/:id', requireAdmin, policyUpload.single('file'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({ where: { id } });
  if (!policy) throw notFound('Policy');

  const { title, category, content, summary, effectiveDate, isMandatory, companyId, isActive, bumpVersion, serialNo } = req.body;
  const data = {};
  if (title !== undefined) { data.title = title.trim(); data.slug = slugify(title); }
  if (category !== undefined) data.category = category;
  if (content !== undefined) data.content = content;
  if (summary !== undefined) data.summary = summary;
  if (effectiveDate !== undefined) data.effectiveDate = effectiveDate;
  if (isMandatory !== undefined) data.isMandatory = isMandatory === true || isMandatory === 'true';
  if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;
  if (isActive !== undefined) data.isActive = isActive === true || isActive === 'true';
  if (serialNo !== undefined) data.serialNo = serialNo || null;

  // Handle PDF upload
  if (req.file) {
    const drive = await getDriveClientOAuth(req.user.id, req.prisma);
    // Delete old file from Drive if exists
    if (policy.driveFileId) {
      try { await deleteFile(drive, policy.driveFileId); } catch (e) { /* ignore if already deleted */ }
    }
    const folderId = await getPoliciesFolderId(drive);
    const uploaded = await uploadFile(drive, folderId, req.file.originalname, 'application/pdf', req.file.buffer);
    data.fileUrl = uploaded.webViewLink;
    data.fileName = req.file.originalname;
    data.driveFileId = uploaded.fileId;
  }

  const newContent = content || (req.file ? policy.content : undefined);
  if (bumpVersion && newContent) {
    data.version = policy.version + 1;
    await req.prisma.policyVersion.create({
      data: { policyId: id, version: data.version, content: newContent, changedBy: req.user.id, changeLog: req.body.changeLog || 'Updated policy' },
    });
  }

  const updated = await req.prisma.policy.update({ where: { id }, data });
  res.json(updated);
}));

// PUT /admin/:id/sections — Update policy sections
router.put('/admin/:id/sections', requireAdmin, asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const { sections } = req.body;
  if (!Array.isArray(sections)) throw badRequest('Sections array required.');

  await req.prisma.policySection.deleteMany({ where: { policyId } });
  for (let i = 0; i < sections.length; i++) {
    await req.prisma.policySection.create({
      data: { policyId, title: sections[i].title, content: sections[i].content, sortOrder: i, isEditable: sections[i].isEditable || false },
    });
  }

  const result = await req.prisma.policySection.findMany({ where: { policyId }, orderBy: { sortOrder: 'asc' } });
  res.json(result);
}));

// PUT /admin/:id/score — Set protection score
router.put('/admin/:id/score', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { protectionScore, scoreBreakdown } = req.body;

  const updated = await req.prisma.policy.update({
    where: { id },
    data: {
      protectionScore: protectionScore ? parseFloat(protectionScore) : 0,
      scoreBreakdown: scoreBreakdown ? JSON.stringify(scoreBreakdown) : null,
    },
  });
  res.json(updated);
}));

// GET /admin/:id/acceptances — Who accepted a policy
router.get('/admin/:id/acceptances', requireAdmin, asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) throw notFound('Policy');

  const acceptances = await req.prisma.policyAcceptance.findMany({
    where: { policyId },
    include: { user: { select: { id: true, name: true, email: true, department: true, employeeId: true } } },
    orderBy: { acceptedAt: 'desc' },
  });

  const acceptedUserIds = acceptances.map(a => a.userId);
  const notAccepted = await req.prisma.user.findMany({
    where: { isActive: true, id: { notIn: acceptedUserIds } },
    select: { id: true, name: true, email: true, department: true, employeeId: true },
  });

  res.json({ accepted: acceptances, notAccepted, total: acceptances.length + notAccepted.length });
}));

// GET /admin/scorecard — Policy scorecard overview
router.get('/admin/scorecard', requireAdmin, asyncHandler(async (req, res) => {
  const policies = await req.prisma.policy.findMany({
    where: { isActive: true },
    select: {
      id: true, title: true, category: true, protectionScore: true,
      scoreBreakdown: true, version: true, isMandatory: true,
      _count: { select: { acceptances: true } },
    },
    orderBy: { protectionScore: 'desc' },
  });

  const totalEmployees = await req.prisma.user.count({ where: { isActive: true } });

  const categoryGroups = {};
  policies.forEach(p => {
    if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
    categoryGroups[p.category].push(p.title);
  });

  const result = policies.map(p => ({
    ...p,
    scoreBreakdown: p.scoreBreakdown ? JSON.parse(p.scoreBreakdown) : null,
    acceptanceRate: totalEmployees > 0 ? Math.round((p._count.acceptances / totalEmployees) * 100) : 0,
    totalAcceptances: p._count.acceptances, totalEmployees,
  }));

  res.json({
    policies: result,
    summary: {
      totalPolicies: policies.length,
      avgProtectionScore: policies.length > 0 ? Math.round(policies.reduce((s, p) => s + (p.protectionScore || 0), 0) / policies.length) : 0,
      categoryGroups, totalEmployees,
    },
  });
}));

// GET /admin/pending — Employees with pending policy acceptances
router.get('/admin/pending', requireAdmin, asyncHandler(async (req, res) => {
  const mandatoryPolicies = await req.prisma.policy.findMany({
    where: { isActive: true, isMandatory: true },
    select: { id: true, title: true, version: true },
  });

  const employees = await req.prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, email: true, department: true, employeeId: true,
      policyAcceptances: { select: { policyId: true, version: true } },
    },
  });

  const pendingList = employees.map(emp => {
    const pendingPolicies = mandatoryPolicies.filter(p =>
      !emp.policyAcceptances.some(a => a.policyId === p.id && a.version === p.version)
    );
    return {
      id: emp.id, name: emp.name, email: emp.email,
      department: emp.department, employeeId: emp.employeeId,
      pendingCount: pendingPolicies.length,
      pendingPolicies: pendingPolicies.map(p => p.title),
    };
  }).filter(e => e.pendingCount > 0);

  res.json(pendingList);
}));

// ══════════════════════════════════════════
// VERSION HISTORY & COMPARISON
// ══════════════════════════════════════════

// GET /admin/:id/versions — Version history for a policy
router.get('/admin/:id/versions', requireAdmin, asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({
    where: { id: policyId },
    select: { id: true, title: true, version: true },
  });
  if (!policy) throw notFound('Policy');

  const versions = await req.prisma.policyVersion.findMany({
    where: { policyId },
    orderBy: { version: 'desc' },
  });

  const userIds = [...new Set(versions.map(v => v.changedBy).filter(Boolean))];
  const users = userIds.length > 0
    ? await req.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  res.json({
    policy: { id: policy.id, title: policy.title, currentVersion: policy.version },
    versions: versions.map(v => ({
      ...v,
      changedByName: userMap[v.changedBy] || 'Unknown',
    })),
  });
}));

// GET /admin/:id/compare — Compare two versions of a policy
router.get('/admin/:id/compare', requireAdmin, asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const v1 = parseInt(req.query.v1);
  const v2 = parseInt(req.query.v2);
  if (!v1 || !v2) throw badRequest('Both v1 and v2 query params required');

  const [version1, version2] = await Promise.all([
    req.prisma.policyVersion.findUnique({ where: { policyId_version: { policyId, version: v1 } } }),
    req.prisma.policyVersion.findUnique({ where: { policyId_version: { policyId, version: v2 } } }),
  ]);

  if (!version1) throw notFound(`Version ${v1}`);
  if (!version2) throw notFound(`Version ${v2}`);

  const userIds = [...new Set([version1.changedBy, version2.changedBy].filter(Boolean))];
  const users = userIds.length > 0
    ? await req.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  res.json({
    v1: { ...version1, changedByName: userMap[version1.changedBy] || 'Unknown' },
    v2: { ...version2, changedByName: userMap[version2.changedBy] || 'Unknown' },
  });
}));

// ══════════════════════════════════════════
// CONFLICT DETECTION & IMPACT ANALYSIS
// ══════════════════════════════════════════

// GET /admin/conflicts — Detect policy conflicts
router.get('/admin/conflicts', requireAdmin, asyncHandler(async (req, res) => {
  const policies = await req.prisma.policy.findMany({
    where: { isActive: true },
    select: { id: true, title: true, category: true, content: true, companyId: true, isMandatory: true, summary: true },
  });

  const conflicts = [];
  const byCategory = {};
  policies.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });

  for (const [, group] of Object.entries(byCategory)) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const reasons = [];

        if (a.companyId === b.companyId) {
          reasons.push('Same category and company scope');
        }
        if ((a.companyId && !b.companyId) || (!a.companyId && b.companyId)) {
          reasons.push('Global vs company-specific overlap');
        }
        if (a.isMandatory !== b.isMandatory) {
          reasons.push('Mandatory vs optional conflict');
        }

        const textA = (a.content + ' ' + (a.summary || '')).toLowerCase();
        const textB = (b.content + ' ' + (b.summary || '')).toLowerCase();
        const contradictions = [
          ['mandatory', 'optional'], ['prohibited', 'allowed'], ['required', 'voluntary'],
          ['must not', 'may'], ['unlimited', 'limited'], ['paid', 'unpaid'],
        ];
        for (const [t1, t2] of contradictions) {
          if ((textA.includes(t1) && textB.includes(t2)) || (textA.includes(t2) && textB.includes(t1))) {
            reasons.push(`Contradicting terms: "${t1}" vs "${t2}"`);
          }
        }

        if (reasons.length > 0) {
          conflicts.push({
            policyA: { id: a.id, title: a.title, category: a.category, companyId: a.companyId },
            policyB: { id: b.id, title: b.title, category: b.category, companyId: b.companyId },
            severity: reasons.length >= 3 ? 'high' : reasons.length >= 2 ? 'medium' : 'low',
            reasons,
          });
        }
      }
    }
  }

  res.json({ conflicts, totalConflicts: conflicts.length });
}));

// GET /admin/:id/impact — Impact analysis for a policy
router.get('/admin/:id/impact', requireAdmin, asyncHandler(async (req, res) => {
  const policyId = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({
    where: { id: policyId },
    select: { id: true, title: true, version: true, companyId: true, isMandatory: true },
  });
  if (!policy) throw notFound('Policy');

  const employeeWhere = { isActive: true };
  if (policy.companyId) employeeWhere.companyId = policy.companyId;

  const employees = await req.prisma.user.findMany({
    where: employeeWhere,
    select: { id: true, department: true },
  });

  const acceptances = await req.prisma.policyAcceptance.findMany({
    where: { policyId, version: policy.version },
    select: { userId: true },
  });
  const acceptedIds = new Set(acceptances.map(a => a.userId));

  const departments = {};
  let acceptedCount = 0;
  employees.forEach(emp => {
    const dept = emp.department || 'Unassigned';
    if (!departments[dept]) departments[dept] = { total: 0, accepted: 0 };
    departments[dept].total++;
    if (acceptedIds.has(emp.id)) {
      departments[dept].accepted++;
      acceptedCount++;
    }
  });

  res.json({
    policyId: policy.id, title: policy.title, version: policy.version,
    isMandatory: policy.isMandatory, totalAffected: employees.length,
    accepted: acceptedCount, pending: employees.length - acceptedCount,
    acceptanceRate: employees.length > 0 ? Math.round((acceptedCount / employees.length) * 100) : 0,
    departments: Object.entries(departments).map(([name, data]) => ({
      name, total: data.total, accepted: data.accepted,
      rate: data.total > 0 ? Math.round((data.accepted / data.total) * 100) : 0,
    })),
  });
}));

module.exports = router;
