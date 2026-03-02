const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');

const router = express.Router();

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

// ══════════════════════════════════════════
// PUBLIC (any authenticated user)
// ══════════════════════════════════════════

// GET / — List active policies (for employees)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const where = { isActive: true };
  if (req.query.company) {
    where.OR = [{ companyId: null }, { companyId: parseInt(req.query.company) }];
  }

  const policies = await req.prisma.policy.findMany({
    where,
    select: {
      id: true, title: true, slug: true, category: true, summary: true,
      version: true, effectiveDate: true, isMandatory: true, companyId: true, createdAt: true,
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

// GET /:slug — Get full policy content
router.get('/:slug', authenticate, asyncHandler(async (req, res) => {
  const policy = await req.prisma.policy.findUnique({
    where: { slug: req.params.slug },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
      company: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!policy) throw notFound('Policy');

  const acceptance = await req.prisma.policyAcceptance.findUnique({
    where: { policyId_userId_version: { policyId: policy.id, userId: req.user.id, version: policy.version } },
  });

  res.json({ ...policy, acceptance });
}));

// POST /:id/accept — Employee accepts a policy
router.post('/:id/accept', authenticate, asyncHandler(async (req, res) => {
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
router.get('/:id/my-acceptance', authenticate, asyncHandler(async (req, res) => {
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
router.get('/admin/all', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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

// POST /admin/create — Create new policy
router.post('/admin/create', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { title, category, content, summary, effectiveDate, isMandatory, companyId, sections } = req.body;
  if (!title || !content) throw badRequest('Title and content required.');

  const slug = slugify(title);
  const existing = await req.prisma.policy.findUnique({ where: { slug } });
  if (existing) throw badRequest('A policy with this title already exists.');

  const policy = await req.prisma.policy.create({
    data: {
      title: title.trim(), slug, category: category || 'general', content,
      summary: summary || null, effectiveDate: effectiveDate || null,
      isMandatory: isMandatory !== false, companyId: companyId ? parseInt(companyId) : null,
      createdBy: req.user.id, version: 1,
    },
  });

  if (sections && Array.isArray(sections)) {
    for (let i = 0; i < sections.length; i++) {
      await req.prisma.policySection.create({
        data: { policyId: policy.id, title: sections[i].title, content: sections[i].content, sortOrder: i, isEditable: sections[i].isEditable || false },
      });
    }
  }

  await req.prisma.policyVersion.create({
    data: { policyId: policy.id, version: 1, content, changedBy: req.user.id, changeLog: 'Initial version' },
  });

  res.json(policy);
}));

// PUT /admin/:id — Update policy
router.put('/admin/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const policy = await req.prisma.policy.findUnique({ where: { id } });
  if (!policy) throw notFound('Policy');

  const { title, category, content, summary, effectiveDate, isMandatory, companyId, isActive, bumpVersion } = req.body;
  const data = {};
  if (title !== undefined) { data.title = title.trim(); data.slug = slugify(title); }
  if (category !== undefined) data.category = category;
  if (content !== undefined) data.content = content;
  if (summary !== undefined) data.summary = summary;
  if (effectiveDate !== undefined) data.effectiveDate = effectiveDate;
  if (isMandatory !== undefined) data.isMandatory = isMandatory;
  if (companyId !== undefined) data.companyId = companyId ? parseInt(companyId) : null;
  if (isActive !== undefined) data.isActive = isActive;

  if (bumpVersion && content) {
    data.version = policy.version + 1;
    await req.prisma.policyVersion.create({
      data: { policyId: id, version: data.version, content, changedBy: req.user.id, changeLog: req.body.changeLog || 'Updated policy' },
    });
  }

  const updated = await req.prisma.policy.update({ where: { id }, data });
  res.json(updated);
}));

// PUT /admin/:id/sections — Update policy sections
router.put('/admin/:id/sections', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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
router.put('/admin/:id/score', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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
router.get('/admin/:id/acceptances', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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
router.get('/admin/scorecard', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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
router.get('/admin/pending', authenticate, requireAdmin, asyncHandler(async (req, res) => {
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

module.exports = router;
