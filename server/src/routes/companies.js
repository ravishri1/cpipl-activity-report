const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();

// GET /api/companies — List all companies (any authenticated user)
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const companies = await req.prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true, gst: true, state: true, city: true, address: true },
  });
  res.json(companies);
}));

// POST /api/companies — Create company (admin only)
router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, shortName, gst, state, city, address } = req.body;
  requireFields(req.body, 'name');

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
}));

// PUT /api/companies/:id — Update company (admin only)
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
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
}));

module.exports = router;
