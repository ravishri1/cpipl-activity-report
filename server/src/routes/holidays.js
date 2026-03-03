const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, conflict, notFound } = require('../utils/httpErrors');
const { requireFields, parseId, parseIntOr } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// GET /api/holidays?year=2026 — List holidays for a year
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const year = parseIntOr(req.query.year, new Date().getFullYear());
  const holidays = await req.prisma.holiday.findMany({
    where: { year },
    orderBy: { date: 'asc' },
  });
  res.json(holidays);
}));

// POST /api/holidays — Create a holiday (admin only)
router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const { name, date, isOptional } = req.body;
  requireFields(req.body, 'name', 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be in YYYY-MM-DD format.');

  const year = parseInt(date.substring(0, 4));

  // Check for duplicate date
  const existing = await req.prisma.holiday.findUnique({ where: { date } });
  if (existing) throw conflict(`A holiday already exists on ${date}: ${existing.name}`);

  const holiday = await req.prisma.holiday.create({
    data: { name: name.trim(), date, year, isOptional: isOptional || false },
  });
  res.status(201).json(holiday);
}));

// PUT /api/holidays/:id — Update a holiday (admin only)
router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, date, isOptional } = req.body;

  const data = {};
  if (name) data.name = name.trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be in YYYY-MM-DD format.');
    data.date = date;
    data.year = parseInt(date.substring(0, 4));
  }
  if (typeof isOptional === 'boolean') data.isOptional = isOptional;

  const holiday = await req.prisma.holiday.update({ where: { id }, data });
  res.json(holiday);
}));

// DELETE /api/holidays/:id — Delete a holiday (admin only)
router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  await req.prisma.holiday.delete({ where: { id: parseId(req.params.id) } });
  res.json({ message: 'Holiday deleted.' });
}));

module.exports = router;
