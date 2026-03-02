const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/holidays?year=2026 — List holidays for a year
router.get('/', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const holidays = await req.prisma.holiday.findMany({
      where: { year },
      orderBy: { date: 'asc' },
    });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch holidays.' });
  }
});

// POST /api/holidays — Create a holiday (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage holidays.' });
    }

    const { name, date, isOptional } = req.body;

    if (!name || !date) {
      return res.status(400).json({ error: 'Name and date are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    const year = parseInt(date.substring(0, 4));

    // Check for duplicate date
    const existing = await req.prisma.holiday.findUnique({ where: { date } });
    if (existing) {
      return res.status(409).json({ error: `A holiday already exists on ${date}: ${existing.name}` });
    }

    const holiday = await req.prisma.holiday.create({
      data: {
        name: name.trim(),
        date,
        year,
        isOptional: isOptional || false,
      },
    });

    res.status(201).json(holiday);
  } catch (err) {
    console.error('Create holiday error:', err);
    res.status(500).json({ error: 'Failed to create holiday.' });
  }
});

// PUT /api/holidays/:id — Update a holiday (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage holidays.' });
    }

    const id = parseInt(req.params.id);
    const { name, date, isOptional } = req.body;

    const data = {};
    if (name) data.name = name.trim();
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
      }
      data.date = date;
      data.year = parseInt(date.substring(0, 4));
    }
    if (typeof isOptional === 'boolean') data.isOptional = isOptional;

    const holiday = await req.prisma.holiday.update({
      where: { id },
      data,
    });

    res.json(holiday);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Holiday not found.' });
    res.status(500).json({ error: 'Failed to update holiday.' });
  }
});

// DELETE /api/holidays/:id — Delete a holiday (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can manage holidays.' });
    }

    await req.prisma.holiday.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Holiday deleted.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Holiday not found.' });
    res.status(500).json({ error: 'Failed to delete holiday.' });
  }
});

module.exports = router;
