const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const settings = await req.prisma.setting.findMany();
    const obj = {};
    settings.forEach((s) => (obj[s.key] = s.value));
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/settings
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const updates = req.body; // { key: value, key: value }
    for (const [key, value] of Object.entries(updates)) {
      await req.prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ message: 'Settings updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
