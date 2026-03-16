const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, conflict, notFound } = require('../utils/httpErrors');
const { requireFields, parseId, parseIntOr } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// Valid locations
const VALID_LOCATIONS = ['All', 'Mumbai', 'Lucknow'];

// GET /api/holidays?year=2026&location=Mumbai — List holidays for a year
router.get('/', asyncHandler(async (req, res) => {
  const year = parseIntOr(req.query.year, new Date().getFullYear());
  const where = { year };
  if (req.query.location && req.query.location !== 'All') {
    where.location = { in: [req.query.location, 'All'] };
  }
  const holidays = await req.prisma.holiday.findMany({
    where,
    orderBy: { date: 'asc' },
  });
  res.json(holidays);
}));

// GET /api/holidays/locations — Get valid location options
router.get('/locations', asyncHandler(async (req, res) => {
  const branches = await req.prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true, label: true },
    orderBy: { name: 'asc' },
  });
  res.json({ locations: VALID_LOCATIONS, branches });
}));

// GET /api/holidays/export?year=2026 — Export holidays as CSV (admin only)
router.get('/export', requireAdmin, asyncHandler(async (req, res) => {
  const year = parseIntOr(req.query.year, new Date().getFullYear());
  const holidays = await req.prisma.holiday.findMany({
    where: { year },
    orderBy: { date: 'asc' },
  });

  const csvHeader = 'Date,Occasion,Type,Location';
  const csvRows = holidays.map(h => {
    const escapedName = h.name.includes(',') ? `"${h.name}"` : h.name;
    return `${h.date},${escapedName},${h.isOptional ? 'Optional' : 'General'},${h.location}`;
  });
  const csv = [csvHeader, ...csvRows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="holidays-${year}.csv"`);
  res.send(csv);
}));

// POST /api/holidays — Create a holiday (admin only)
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, date, isOptional, location } = req.body;
  requireFields(req.body, 'name', 'date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be in YYYY-MM-DD format.');

  const loc = location || 'All';
  const year = parseInt(date.substring(0, 4));

  // Check for duplicate date+location
  const existing = await req.prisma.holiday.findUnique({
    where: { date_location: { date, location: loc } }
  });
  if (existing) throw conflict(`A holiday already exists on ${date} for ${loc}: ${existing.name}`);

  const holiday = await req.prisma.holiday.create({
    data: { name: name.trim(), date, year, isOptional: isOptional || false, location: loc },
  });
  res.status(201).json(holiday);
}));

// POST /api/holidays/import — Bulk import holidays from CSV data (admin only)
router.post('/import', requireAdmin, asyncHandler(async (req, res) => {
  const { holidays: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) throw badRequest('No holiday data provided.');

  const results = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const { date, name, type, location } = row;
      if (!date || !name) {
        results.errors.push(`Row missing date or name: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        results.errors.push(`Invalid date format "${date}" — expected YYYY-MM-DD`);
        results.skipped++;
        continue;
      }

      const year = parseInt(date.substring(0, 4));
      const isOptional = type?.toLowerCase() === 'optional' || type?.toLowerCase() === 'restricted';
      const loc = location?.trim() || 'All';

      const existing = await req.prisma.holiday.findUnique({
        where: { date_location: { date, location: loc } }
      });
      if (existing) {
        await req.prisma.holiday.update({
          where: { date_location: { date, location: loc } },
          data: { name: name.trim(), isOptional, year },
        });
        results.updated++;
      } else {
        await req.prisma.holiday.create({
          data: { name: name.trim(), date, year, isOptional, location: loc },
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Error on date ${row.date}: ${err.message}`);
      results.skipped++;
    }
  }

  res.json(results);
}));

// PUT /api/holidays/:id — Update a holiday (admin only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, date, isOptional, location } = req.body;

  const data = {};
  if (name) data.name = name.trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw badRequest('Date must be in YYYY-MM-DD format.');
    data.date = date;
    data.year = parseInt(date.substring(0, 4));
  }
  if (typeof isOptional === 'boolean') data.isOptional = isOptional;
  if (location) data.location = location;

  const holiday = await req.prisma.holiday.update({ where: { id }, data });
  res.json(holiday);
}));

// DELETE /api/holidays/:id — Delete a holiday (admin only)
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await req.prisma.holiday.delete({ where: { id: parseId(req.params.id) } });
  res.json({ message: 'Holiday deleted.' });
}));

module.exports = router;
