const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { DEFAULT_PAYROLL_RULES } = require('../utils/payrollRules');

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

// GET /api/settings/payroll-rules — get payroll statutory rules
router.get('/payroll-rules', requireAdmin, asyncHandler(async (req, res) => {
  const row = await req.prisma.setting.findUnique({ where: { key: 'payroll_rules' } });
  const rules = row ? JSON.parse(row.value) : DEFAULT_PAYROLL_RULES;
  res.json(rules);
}));

// PUT /api/settings/payroll-rules — save payroll statutory rules
router.put('/payroll-rules', requireAdmin, asyncHandler(async (req, res) => {
  const rules = req.body;
  await req.prisma.setting.upsert({
    where: { key: 'payroll_rules' },
    update: { value: JSON.stringify(rules) },
    create: { key: 'payroll_rules', value: JSON.stringify(rules) },
  });
  res.json({ message: 'Payroll rules saved.' });
}));

module.exports = router;
