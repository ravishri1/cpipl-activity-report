const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, conflict } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ── GET /api/branches — list all branches with employee count ──
router.get('/', asyncHandler(async (req, res) => {
  const branches = await req.prisma.branch.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true } },
    },
  });
  res.json(branches);
}));

// ── POST /api/branches — create branch (admin only) ──
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'state', 'city');
  const { name, state, city, address } = req.body;

  const branch = await req.prisma.branch.create({
    data: { name: name.trim(), state: state.trim(), city: city.trim(), address: address?.trim() },
  });
  res.status(201).json(branch);
}));

// ── PUT /api/branches/:id — update branch details (admin only) ──
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, state, city, address, isActive } = req.body;

  const branch = await req.prisma.branch.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(state !== undefined && { state: state.trim() }),
      ...(city !== undefined && { city: city.trim() }),
      ...(address !== undefined && { address: address?.trim() }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json(branch);
}));

// ── DELETE /api/branches/:id — soft-deactivate branch (admin only) ──
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const employeeCount = await req.prisma.user.count({ where: { branchId: id, isActive: true } });
  if (employeeCount > 0) {
    throw badRequest(`Cannot deactivate branch with ${employeeCount} active employee(s). Reassign them first.`);
  }

  const branch = await req.prisma.branch.update({
    where: { id },
    data: { isActive: false },
  });
  res.json(branch);
}));

// ── GET /api/branches/:id/holidays — list branch holidays, optional ?year= ──
router.get('/:id/holidays', asyncHandler(async (req, res) => {
  const branchId = parseId(req.params.id);
  const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

  if (isNaN(year)) throw badRequest('Invalid year parameter');

  const holidays = await req.prisma.branchHoliday.findMany({
    where: { branchId, year },
    orderBy: { date: 'asc' },
  });
  res.json(holidays);
}));

// ── POST /api/branches/:id/holidays — add branch holiday (admin only) ──
router.post('/:id/holidays', requireAdmin, asyncHandler(async (req, res) => {
  const branchId = parseId(req.params.id);
  requireFields(req.body, 'name', 'date');

  const { name, date, isOptional } = req.body;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw badRequest('Date must be in YYYY-MM-DD format');
  }

  const year = parseInt(date.split('-')[0], 10);

  // Verify branch exists
  const branch = await req.prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw notFound('Branch');

  const holiday = await req.prisma.branchHoliday.create({
    data: {
      branchId,
      name: name.trim(),
      date,
      year,
      isOptional: isOptional === true,
    },
  });
  res.status(201).json(holiday);
}));

// ── DELETE /api/branches/:id/holidays/:holidayId — remove branch holiday (admin only) ──
router.delete('/:id/holidays/:holidayId', requireAdmin, asyncHandler(async (req, res) => {
  const branchId = parseId(req.params.id);
  const holidayId = parseId(req.params.holidayId);

  const holiday = await req.prisma.branchHoliday.findFirst({
    where: { id: holidayId, branchId },
  });
  if (!holiday) throw notFound('Branch holiday');

  await req.prisma.branchHoliday.delete({ where: { id: holidayId } });
  res.json({ message: 'Branch holiday removed' });
}));

module.exports = router;
