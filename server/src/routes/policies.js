const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ── Helper: generate slug from title ──
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

// ══════════════════════════════════════════
// PUBLIC (any authenticated user)
// ══════════════════════════════════════════

// GET /api/policies — List active policies (for employees)
router.get('/', authenticate, async (req, res) => {
  try {
    const where = { isActive: true };
    // Filter by company if employee has one
    if (req.query.company) {
      where.OR = [{ companyId: null }, { companyId: parseInt(req.query.company) }];
    }

    const policies = await req.prisma.policy.findMany({
      where,
      select: {
        id: true, title: true, slug: true, category: true, summary: true,
        version: true, effectiveDate: true, isMandatory: true, companyId: true,
        createdAt: true,
        _count: { select: { acceptances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get user's acceptances
    const acceptances = await req.prisma.policyAcceptance.findMany({
      where: { userId: req.user.id },
      select: { policyId: true, version: true, acceptedAt: true },
    });
    const acceptMap = {};
    acceptances.forEach(a => { acceptMap[`${a.policyId}-${a.version}`] = a.acceptedAt; });

    const result = policies.map(p => ({
      ...p,
      acceptedAt: acceptMap[`${p.id}-${p.version}`] || null,
      isAccepted: !!acceptMap[`${p.id}-${p.version}`],
      totalAcceptances: p._count.acceptances,
    }));

    res.json(result);
  } catch (err) {
    console.error('Policy list error:', err);
    res.status(500).json({ error: 'Failed to fetch policies.' });
  }
});

// GET /api/policies/:slug — Get full policy content
router.get('/:slug', authenticate, async (req, res) => {
  try {
    const policy = await req.prisma.policy.findUnique({
      where: { slug: req.params.slug },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        company: { select: { id: true, name: true, shortName: true } },
      },
    });
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });

    // Check if user has accepted this version
    const acceptance = await req.prisma.policyAcceptance.findUnique({
      where: {
        policyId_userId_version: {
          policyId: policy.id,
          userId: req.user.id,
          version: policy.version,
        },
      },
    });

    res.json({ ...policy, acceptance });
  } catch (err) {
    console.error('Policy detail error:', err);
    res.status(500).json({ error: 'Failed to fetch policy.' });
  }
});

// POST /api/policies/:id/accept — Employee accepts a policy
router.post('/:id/accept', authenticate, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });

    const acceptance = await req.prisma.policyAcceptance.upsert({
      where: {
        policyId_userId_version: {
          policyId,
          userId: req.user.id,
          version: policy.version,
        },
      },
      update: { acceptedAt: new Date(), remarks: req.body.remarks || null },
      create: {
        policyId,
        userId: req.user.id,
        version: policy.version,
        ipAddress: req.ip,
        remarks: req.body.remarks || null,
      },
    });

    res.json(acceptance);
  } catch (err) {
    console.error('Policy accept error:', err);
    res.status(500).json({ error: 'Failed to accept policy.' });
  }
});

// GET /api/policies/:id/my-acceptance — Check if current user accepted
router.get('/:id/my-acceptance', authenticate, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });

    const acceptance = await req.prisma.policyAcceptance.findUnique({
      where: {
        policyId_userId_version: { policyId, userId: req.user.id, version: policy.version },
      },
    });
    res.json({ accepted: !!acceptance, acceptance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check acceptance.' });
  }
});

// ══════════════════════════════════════════
// ADMIN ONLY
// ══════════════════════════════════════════

// GET /api/policies/admin/all — List all policies (including inactive)
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  try {
    const policies = await req.prisma.policy.findMany({
      include: {
        company: { select: { id: true, name: true, shortName: true } },
        _count: { select: { acceptances: true, sections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get total active employees for acceptance rate
    const totalEmployees = await req.prisma.user.count({ where: { isActive: true } });

    const result = policies.map(p => ({
      ...p,
      totalAcceptances: p._count.acceptances,
      totalSections: p._count.sections,
      acceptanceRate: totalEmployees > 0
        ? Math.round((p._count.acceptances / totalEmployees) * 100)
        : 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Admin policy list error:', err);
    res.status(500).json({ error: 'Failed to fetch policies.' });
  }
});

// POST /api/policies/admin/create — Create new policy
router.post('/admin/create', authenticate, requireAdmin, async (req, res) => {
  try {
    const { title, category, content, summary, effectiveDate, isMandatory, companyId, sections } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required.' });

    const slug = slugify(title);

    // Check unique slug
    const existing = await req.prisma.policy.findUnique({ where: { slug } });
    if (existing) return res.status(400).json({ error: 'A policy with this title already exists.' });

    const policy = await req.prisma.policy.create({
      data: {
        title: title.trim(),
        slug,
        category: category || 'general',
        content,
        summary: summary || null,
        effectiveDate: effectiveDate || null,
        isMandatory: isMandatory !== false,
        companyId: companyId ? parseInt(companyId) : null,
        createdBy: req.user.id,
        version: 1,
      },
    });

    // Create sections if provided
    if (sections && Array.isArray(sections)) {
      for (let i = 0; i < sections.length; i++) {
        await req.prisma.policySection.create({
          data: {
            policyId: policy.id,
            title: sections[i].title,
            content: sections[i].content,
            sortOrder: i,
            isEditable: sections[i].isEditable || false,
          },
        });
      }
    }

    // Create initial version snapshot
    await req.prisma.policyVersion.create({
      data: {
        policyId: policy.id,
        version: 1,
        content,
        changedBy: req.user.id,
        changeLog: 'Initial version',
      },
    });

    res.json(policy);
  } catch (err) {
    console.error('Create policy error:', err);
    res.status(500).json({ error: 'Failed to create policy.' });
  }
});

// PUT /api/policies/admin/:id — Update policy
router.put('/admin/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const policy = await req.prisma.policy.findUnique({ where: { id } });
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });

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

    // Bump version if content changed significantly
    if (bumpVersion && content) {
      data.version = policy.version + 1;
      // Save version snapshot
      await req.prisma.policyVersion.create({
        data: {
          policyId: id,
          version: data.version,
          content,
          changedBy: req.user.id,
          changeLog: req.body.changeLog || 'Updated policy',
        },
      });
    }

    const updated = await req.prisma.policy.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('Update policy error:', err);
    res.status(500).json({ error: 'Failed to update policy.' });
  }
});

// PUT /api/policies/admin/:id/sections — Update policy sections
router.put('/admin/:id/sections', authenticate, requireAdmin, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const { sections } = req.body;
    if (!Array.isArray(sections)) return res.status(400).json({ error: 'Sections array required.' });

    // Delete existing and recreate
    await req.prisma.policySection.deleteMany({ where: { policyId } });
    for (let i = 0; i < sections.length; i++) {
      await req.prisma.policySection.create({
        data: {
          policyId,
          title: sections[i].title,
          content: sections[i].content,
          sortOrder: i,
          isEditable: sections[i].isEditable || false,
        },
      });
    }

    const result = await req.prisma.policySection.findMany({
      where: { policyId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(result);
  } catch (err) {
    console.error('Update sections error:', err);
    res.status(500).json({ error: 'Failed to update sections.' });
  }
});

// PUT /api/policies/admin/:id/score — Set protection score
router.put('/admin/:id/score', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { protectionScore, scoreBreakdown } = req.body;

    const updated = await req.prisma.policy.update({
      where: { id },
      data: {
        protectionScore: protectionScore ? parseFloat(protectionScore) : 0,
        scoreBreakdown: scoreBreakdown ? JSON.stringify(scoreBreakdown) : null,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update score.' });
  }
});

// GET /api/policies/admin/:id/acceptances — Who accepted a policy
router.get('/admin/:id/acceptances', authenticate, requireAdmin, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const policy = await req.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return res.status(404).json({ error: 'Policy not found.' });

    const acceptances = await req.prisma.policyAcceptance.findMany({
      where: { policyId },
      include: {
        user: { select: { id: true, name: true, email: true, department: true, employeeId: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });

    // Get employees who haven't accepted
    const acceptedUserIds = acceptances.map(a => a.userId);
    const notAccepted = await req.prisma.user.findMany({
      where: { isActive: true, id: { notIn: acceptedUserIds } },
      select: { id: true, name: true, email: true, department: true, employeeId: true },
    });

    res.json({ accepted: acceptances, notAccepted, total: acceptances.length + notAccepted.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch acceptances.' });
  }
});

// GET /api/policies/admin/scorecard — Policy scorecard overview
router.get('/admin/scorecard', authenticate, requireAdmin, async (req, res) => {
  try {
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

    // Find overlapping/repetitive content keywords
    const categoryGroups = {};
    policies.forEach(p => {
      if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
      categoryGroups[p.category].push(p.title);
    });

    const result = policies.map(p => ({
      ...p,
      scoreBreakdown: p.scoreBreakdown ? JSON.parse(p.scoreBreakdown) : null,
      acceptanceRate: totalEmployees > 0
        ? Math.round((p._count.acceptances / totalEmployees) * 100) : 0,
      totalAcceptances: p._count.acceptances,
      totalEmployees,
    }));

    res.json({
      policies: result,
      summary: {
        totalPolicies: policies.length,
        avgProtectionScore: policies.length > 0
          ? Math.round(policies.reduce((s, p) => s + (p.protectionScore || 0), 0) / policies.length)
          : 0,
        categoryGroups,
        totalEmployees,
      },
    });
  } catch (err) {
    console.error('Scorecard error:', err);
    res.status(500).json({ error: 'Failed to fetch scorecard.' });
  }
});

// GET /api/policies/admin/pending — Employees with pending policy acceptances
router.get('/admin/pending', authenticate, requireAdmin, async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending acceptances.' });
  }
});

module.exports = router;
