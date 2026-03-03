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

module.exports = router;
