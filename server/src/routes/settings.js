const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// GET /api/settings
router.get('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const settings = await req.prisma.setting.findMany();
  const obj = {};
  settings.forEach((s) => (obj[s.key] = s.value));
  res.json(obj);
}));

// PUT /api/settings
router.put('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await req.prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  res.json({ message: 'Settings updated.' });
}));

// GET /api/settings/payroll-rules — returns parsed payroll_rules JSON
router.get('/payroll-rules', requireAdmin, asyncHandler(async (req, res) => {
  const row = await req.prisma.setting.findUnique({ where: { key: 'payroll_rules' } });
  if (!row) return res.json(null);
  try { res.json(JSON.parse(row.value)); } catch { res.json(null); }
}));

// PUT /api/settings/payroll-rules — saves payroll_rules JSON
router.put('/payroll-rules', requireAdmin, asyncHandler(async (req, res) => {
  const value = JSON.stringify(req.body);
  await req.prisma.setting.upsert({
    where: { key: 'payroll_rules' },
    update: { value },
    create: { key: 'payroll_rules', value },
  });
  res.json({ message: 'Payroll rules saved.' });
}));

// ── Saturday Policy CRUD ──

// GET /api/settings/saturday-policies?companyId=1
router.get('/saturday-policies', requireAdmin, asyncHandler(async (req, res) => {
  const companyId = req.query.companyId ? parseInt(req.query.companyId) : undefined;
  const where = companyId ? { companyId } : {};
  const policies = await req.prisma.saturdayPolicy.findMany({
    where,
    orderBy: [{ companyId: 'asc' }, { fromDate: 'asc' }],
    include: { company: { select: { id: true, name: true } } },
  });
  res.json(policies);
}));

// POST /api/settings/saturday-policies
router.post('/saturday-policies', requireAdmin, asyncHandler(async (req, res) => {
  const { companyId, effectiveFrom, effectiveTo, saturdayType, description } = req.body;
  if (!companyId || !effectiveFrom || !saturdayType) {
    return res.status(400).json({ error: 'companyId, effectiveFrom, saturdayType are required' });
  }
  const VALID_TYPES = ['all', 'none', '2nd', '2nd_4th', '1st_3rd'];
  if (!VALID_TYPES.includes(saturdayType)) {
    return res.status(400).json({ error: `saturdayType must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const policy = await req.prisma.saturdayPolicy.create({
    data: { companyId: parseInt(companyId), effectiveFrom, effectiveTo: effectiveTo || null, saturdayType, description: description || null },
  });
  res.status(201).json(policy);
}));

// PUT /api/settings/saturday-policies/:id
router.put('/saturday-policies/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { effectiveFrom, effectiveTo, saturdayType, description } = req.body;
  const policy = await req.prisma.saturdayPolicy.update({
    where: { id },
    data: { effectiveFrom, effectiveTo: effectiveTo || null, saturdayType, description: description || null },
  });
  res.json(policy);
}));

// DELETE /api/settings/saturday-policies/:id
router.delete('/saturday-policies/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await req.prisma.saturdayPolicy.delete({ where: { id } });
  res.json({ message: 'Deleted' });
}));

module.exports = router;
