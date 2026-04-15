const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, conflict, notFound } = require('../utils/httpErrors');
const { requireFields, parseId, parseIntOr } = require('../utils/validate');
const { DEFAULT_OFF_DAYS } = require('../services/attendance/weeklyOffHelper');
const { assertPayrollUnlocked } = require('../utils/payrollLock');

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
  await assertPayrollUnlocked(req.prisma, date.slice(0, 7));

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

// ═══════════════════════════════════════════════
// Weekly Off Patterns (MUST be before /:id routes)
// ═══════════════════════════════════════════════

// GET /api/holidays/weekly-off-patterns — List all patterns with user counts
router.get('/weekly-off-patterns', requireAdmin, asyncHandler(async (req, res) => {
  const patterns = await req.prisma.weeklyOffPattern.findMany({
    include: {
      users: {
        where: { isActive: true },
        select: { id: true, name: true, employeeId: true, department: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  res.json(patterns.map(p => ({
    ...p,
    days: JSON.parse(p.days || '[]'),
    userCount: p.users.length,
  })));
}));

// GET /api/holidays/weekly-off-unassigned — Employees not assigned to any pattern (use default)
router.get('/weekly-off-unassigned', requireAdmin, asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({
    where: { isActive: true, weeklyOffPatternId: null },
    select: { id: true, name: true, employeeId: true, department: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
}));

// POST /api/holidays/weekly-off-patterns — Create pattern
router.post('/weekly-off-patterns', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'days');
  const { name, days } = req.body;

  if (!Array.isArray(days) || days.length === 0) throw badRequest('Days must be a non-empty array');
  if (days.some(d => d < 0 || d > 6)) throw badRequest('Day values must be 0-6 (Sun=0, Sat=6)');

  const pattern = await req.prisma.weeklyOffPattern.create({
    data: { name, days: JSON.stringify(days) },
  });
  res.status(201).json({ ...pattern, days });
}));

// PUT /api/holidays/weekly-off-patterns/:id — Update pattern
router.put('/weekly-off-patterns/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, days } = req.body;

  const data = {};
  if (name) data.name = name;
  if (days) {
    if (!Array.isArray(days) || days.some(d => d < 0 || d > 6)) throw badRequest('Invalid days');
    data.days = JSON.stringify(days);
  }

  const updated = await req.prisma.weeklyOffPattern.update({ where: { id }, data });
  res.json({ ...updated, days: JSON.parse(updated.days) });
}));

// DELETE /api/holidays/weekly-off-patterns/:id — Delete pattern (only if no users assigned)
router.delete('/weekly-off-patterns/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const pattern = await req.prisma.weeklyOffPattern.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!pattern) throw notFound('Pattern');
  if (pattern.isDefault) throw badRequest('Cannot delete the default pattern');
  if (pattern._count.users > 0) throw badRequest('Cannot delete pattern with assigned employees. Reassign them first.');

  await req.prisma.weeklyOffPattern.delete({ where: { id } });
  res.json({ message: 'Pattern deleted' });
}));

// POST /api/holidays/weekly-off-patterns/:id/assign — Assign users to pattern (bulk)
router.post('/weekly-off-patterns/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) throw badRequest('userIds required');

  const pattern = await req.prisma.weeklyOffPattern.findUnique({ where: { id } });
  if (!pattern) throw notFound('Pattern');

  await req.prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { weeklyOffPatternId: id },
  });

  res.json({ message: `${userIds.length} employee(s) assigned to ${pattern.name}` });
}));

// DELETE /api/holidays/weekly-off-patterns/:id/users/:userId — Remove user from pattern
router.delete('/weekly-off-patterns/:id/users/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const userId = parseId(req.params.userId);

  await req.prisma.user.update({
    where: { id: userId },
    data: { weeklyOffPatternId: null },
  });

  res.json({ message: 'Employee removed from pattern (will use default Sat+Sun)' });
}));

// ── WeeklyOffAssignment routes ──────────────────────────────────────────

// GET /weekly-off-assignments?companyId=1&month=2025-04
router.get('/weekly-off-assignments', requireAdmin, asyncHandler(async (req, res) => {
  const { companyId, month } = req.query;
  if (!companyId) throw badRequest('companyId required');
  const where = { companyId: parseInt(companyId) };
  if (month) {
    where.effectiveFrom = { lte: `${month}-31` };
    where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: `${month}-01` } }];
  }
  const assignments = await req.prisma.weeklyOffAssignment.findMany({
    where,
    include: { pattern: true, user: { select: { id: true, name: true, employeeId: true, department: true } } },
    orderBy: { effectiveFrom: 'desc' },
  });
  res.json(assignments);
}));

// POST /weekly-off-assignments
router.post('/weekly-off-assignments', requireAdmin, asyncHandler(async (req, res) => {
  const { patternId, effectiveFrom, effectiveTo, userId, department, companyId } = req.body;
  if (!patternId || !effectiveFrom || !companyId) throw badRequest('patternId, effectiveFrom, companyId required');
  if (!userId && !department) throw badRequest('Either userId or department required');
  const assignment = await req.prisma.weeklyOffAssignment.create({
    data: {
      patternId: parseInt(patternId),
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      userId: userId ? parseInt(userId) : null,
      department: department || null,
      companyId: parseInt(companyId),
    },
    include: { pattern: true, user: { select: { id: true, name: true, employeeId: true, department: true } } },
  });
  res.status(201).json(assignment);
}));

// PUT /weekly-off-assignments/:id
router.put('/weekly-off-assignments/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { effectiveFrom, effectiveTo, patternId } = req.body;
  const assignment = await req.prisma.weeklyOffAssignment.update({
    where: { id },
    data: {
      ...(effectiveFrom && { effectiveFrom }),
      effectiveTo: effectiveTo || null,
      ...(patternId && { patternId: parseInt(patternId) }),
    },
    include: { pattern: true },
  });
  res.json(assignment);
}));

// DELETE /weekly-off-assignments/:id
router.delete('/weekly-off-assignments/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await req.prisma.weeklyOffAssignment.delete({ where: { id } });
  res.json({ success: true });
}));

// ── DepartmentHolidayBlock routes ────────────────────────────────────────

// GET /dept-holiday-blocks?companyId=1
router.get('/dept-holiday-blocks', requireAdmin, asyncHandler(async (req, res) => {
  const { companyId } = req.query;
  if (!companyId) throw badRequest('companyId required');
  const blocks = await req.prisma.departmentHolidayBlock.findMany({
    where: { companyId: parseInt(companyId) },
    orderBy: [{ department: 'asc' }, { dateFrom: 'desc' }],
  });
  res.json(blocks);
}));

// POST /dept-holiday-blocks
router.post('/dept-holiday-blocks', requireAdmin, asyncHandler(async (req, res) => {
  const { department, companyId, dateFrom, dateTo, blockLeave, reason } = req.body;
  if (!department || !companyId || !dateFrom || !dateTo) throw badRequest('department, companyId, dateFrom, dateTo required');
  const block = await req.prisma.departmentHolidayBlock.create({
    data: { department, companyId: parseInt(companyId), dateFrom, dateTo, blockLeave: !!blockLeave, reason: reason || null },
  });
  res.status(201).json(block);
}));

// PUT /dept-holiday-blocks/:id
router.put('/dept-holiday-blocks/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { dateFrom, dateTo, blockLeave, reason } = req.body;
  const block = await req.prisma.departmentHolidayBlock.update({
    where: { id },
    data: { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }), ...(blockLeave !== undefined && { blockLeave: !!blockLeave }), reason: reason || null },
  });
  res.json(block);
}));

// DELETE /dept-holiday-blocks/:id
router.delete('/dept-holiday-blocks/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await req.prisma.departmentHolidayBlock.delete({ where: { id } });
  res.json({ success: true });
}));

// ═══════════════════════════════════════════════
// Holiday CRUD — Param-based routes (/:id) MUST be LAST
// ═══════════════════════════════════════════════

// PUT /api/holidays/:id — Update a holiday (admin only)
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, date, isOptional, location } = req.body;

  // Check lock on the existing holiday's month (and new date if changing)
  const existing = await req.prisma.holiday.findUnique({ where: { id }, select: { date: true } });
  if (existing) await assertPayrollUnlocked(req.prisma, existing.date.slice(0, 7));
  if (date && date !== existing?.date) await assertPayrollUnlocked(req.prisma, date.slice(0, 7));

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
  const id = parseId(req.params.id);
  const existing = await req.prisma.holiday.findUnique({ where: { id }, select: { date: true } });
  if (existing) await assertPayrollUnlocked(req.prisma, existing.date.slice(0, 7));
  await req.prisma.holiday.delete({ where: { id } });
  res.json({ message: 'Holiday deleted.' });
}));

module.exports = router;
