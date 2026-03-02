const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/companies — List all companies (any authenticated user)
router.get('/', authenticate, async (req, res) => {
  try {
    const companies = await req.prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, gst: true, state: true, city: true, address: true },
    });
    res.json(companies);
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/companies — Create company (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, shortName, gst, state, city, address } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Company name is required.' });

    const company = await req.prisma.company.create({
      data: {
        name: name.trim(),
        shortName: shortName?.trim() || null,
        gst: gst?.trim() || null,
        state: state?.trim() || null,
        city: city?.trim() || null,
        address: address?.trim() || null,
      },
    });
    res.status(201).json(company);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Company name already exists.' });
    console.error('Create company error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/companies/:id — Update company (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, shortName, gst, state, city, address, isActive } = req.body;

    const company = await req.prisma.company.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(shortName !== undefined && { shortName: shortName?.trim() || null }),
        ...(gst !== undefined && { gst: gst?.trim() || null }),
        ...(state !== undefined && { state: state?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(company);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Company name already exists.' });
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
