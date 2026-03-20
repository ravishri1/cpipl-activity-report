const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return u.role === 'admin' || u.role === 'sub_admin' || u.role === 'team_lead'; }

// ── Helper: check if a date is a non-working day (holiday or weekend) ──
async function checkNonWorkingDay(prisma, dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const holiday = await prisma.holiday.findFirst({
    where: { date: dateStr, isOptional: false },
  });

  return {
    isWeekend,
    isHoliday: !!holiday,
    holidayName: holiday?.name || null,
    isNonWorkingDay: isWeekend || !!holiday,
    dayLabel: isWeekend ? (dayOfWeek === 0 ? 'Sunday' : 'Saturday') : (holiday ? `Holiday — ${holiday.name}` : 'Working Day'),
  };
}

// ── GET /api/comp-off/validate-date?date=YYYY-MM-DD ──
// Frontend calls this when user picks a date to earn comp-off
router.get('/validate-date', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw badRequest('date query param required');

  // 1. Check if date is in the future
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) {
    return res.json({ isValid: false, error: 'Cannot earn comp-off for future dates', maxDays: 0 });
  }

  // 2. Check if it's a non-working day
  const dayInfo = await checkNonWorkingDay(req.prisma, date);
  if (!dayInfo.isNonWorkingDay) {
    return res.json({ isValid: false, error: 'This is a regular working day — comp-off not applicable', ...dayInfo, maxDays: 0 });
  }

  // 3. Check attendance
  const attendance = await req.prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    select: { status: true, workHours: true, checkIn: true, checkOut: true },
  });

  if (!attendance || !attendance.checkIn) {
    return res.json({ isValid: false, error: 'No attendance found for this date. You must have punched in to earn comp-off.', ...dayInfo, attendance: null, maxDays: 0 });
  }

  const hours = attendance.workHours || 0;

  if (hours < 5) {
    return res.json({
      isValid: false,
      error: `You worked only ${hours.toFixed(1)} hrs. Minimum 5 hrs required for half-day comp-off.`,
      ...dayInfo, attendance, maxDays: 0,
    });
  }

  // 4. Check for duplicate
  const existing = await req.prisma.compOffRequest.findFirst({
    where: { userId: req.user.id, workDate: date, type: 'earn', status: { in: ['pending', 'approved'] } },
  });
  if (existing) {
    return res.json({
      isValid: false,
      error: `You already have a ${existing.status} comp-off request for this date.`,
      ...dayInfo, attendance, maxDays: 0,
    });
  }

  // 5. Determine max days
  const maxDays = hours >= 9 ? 1 : 0.5;

  res.json({
    isValid: true,
    error: null,
    ...dayInfo,
    attendance,
    maxDays,
    hoursWorked: parseFloat(hours.toFixed(1)),
    eligibility: maxDays === 1
      ? `Worked ${hours.toFixed(1)} hrs — eligible for full day comp-off`
      : `Worked ${hours.toFixed(1)} hrs — eligible for half day comp-off only`,
  });
}));

// ── GET /api/comp-off/balance/me ──
router.get('/balance/me', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  let bal = await req.prisma.compOffBalance.findUnique({ where: { userId_year: { userId, year } } });
  if (!bal) bal = { userId, year, earned: 0, used: 0, balance: 0 };
  res.json(bal);
}));

// ── GET /api/comp-off/balance/:userId ──
router.get('/balance/:userId', asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden();
  const year = parseInt(req.query.year) || new Date().getFullYear();
  let bal = await req.prisma.compOffBalance.findUnique({ where: { userId_year: { userId, year } } });
  if (!bal) bal = { userId, year, earned: 0, used: 0, balance: 0 };
  res.json(bal);
}));

// ── GET /api/comp-off/my ──
router.get('/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.compOffRequest.findMany({
    where: { userId: req.user.id },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// ── GET /api/comp-off (admin — all pending) ──
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : { status: 'pending' };
  const requests = await req.prisma.compOffRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// ── POST /api/comp-off — employee submits earn/redeem request ──
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'type', 'workDate', 'days');
  const { type, workDate, days, reason } = req.body;
  if (!['earn', 'redeem'].includes(type)) throw badRequest('type must be earn or redeem');
  const parsedDays = parseFloat(days);
  if (![0.5, 1].includes(parsedDays)) throw badRequest('days must be 0.5 or 1');

  if (type === 'earn') {
    // ── Server-side validation for earn requests ──

    // 1. Date must be in the past
    const today = new Date().toISOString().slice(0, 10);
    if (workDate > today) throw badRequest('Cannot earn comp-off for future dates');

    // 2. Must be a non-working day (holiday or weekend)
    const dayInfo = await checkNonWorkingDay(req.prisma, workDate);
    if (!dayInfo.isNonWorkingDay) throw badRequest('Comp-off can only be earned on holidays or weekends (Saturday/Sunday)');

    // 3. Must have attendance with sufficient hours
    const attendance = await req.prisma.attendance.findUnique({
      where: { userId_date: { userId: req.user.id, date: workDate } },
    });
    if (!attendance || !attendance.checkIn) throw badRequest('No attendance record found for this date. You must have punched in.');

    const hours = attendance.workHours || 0;
    if (hours < 5) throw badRequest(`Insufficient work hours (${hours.toFixed(1)} hrs). Minimum 5 hours required for half-day comp-off.`);
    if (parsedDays === 1 && hours < 9) throw badRequest(`Insufficient work hours (${hours.toFixed(1)} hrs). Minimum 9 hours required for full-day comp-off. You can apply for 0.5 day.`);

    // 4. No duplicate
    const existing = await req.prisma.compOffRequest.findFirst({
      where: { userId: req.user.id, workDate, type: 'earn', status: { in: ['pending', 'approved'] } },
    });
    if (existing) throw badRequest(`You already have a ${existing.status} comp-off earn request for this date`);
  }

  if (type === 'redeem') {
    const year = new Date().getFullYear();
    const bal = await req.prisma.compOffBalance.findUnique({
      where: { userId_year: { userId: req.user.id, year } },
    });
    if (!bal || bal.balance < parsedDays) throw badRequest('Insufficient comp-off balance');
  }

  const request = await req.prisma.compOffRequest.create({
    data: { userId: req.user.id, type, workDate, days: parsedDays, reason: reason || null },
  });
  res.status(201).json(request);
}));

// ── PUT /api/comp-off/:id/review — admin approves/rejects ──
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('status must be approved or rejected');

  const request = await req.prisma.compOffRequest.findUnique({ where: { id } });
  if (!request) throw notFound('CompOff request');
  if (request.status !== 'pending') throw badRequest('Request already reviewed');

  const updated = await req.prisma.compOffRequest.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
  });

  if (status === 'approved') {
    const year = new Date(request.workDate).getFullYear();
    const isEarn = request.type === 'earn';
    await req.prisma.compOffBalance.upsert({
      where: { userId_year: { userId: request.userId, year } },
      create: {
        userId: request.userId, year,
        earned: isEarn ? request.days : 0,
        used: isEarn ? 0 : request.days,
        balance: isEarn ? request.days : -request.days,
      },
      update: {
        earned: isEarn ? { increment: request.days } : undefined,
        used: !isEarn ? { increment: request.days } : undefined,
        balance: isEarn ? { increment: request.days } : { decrement: request.days },
      },
    });
  }

  res.json(updated);
}));

// ── DELETE /api/comp-off/:id — employee cancels pending request ──
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const request = await req.prisma.compOffRequest.findUnique({ where: { id } });
  if (!request) throw notFound('CompOff request');
  if (request.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (request.status !== 'pending') throw badRequest('Only pending requests can be cancelled');
  await req.prisma.compOffRequest.delete({ where: { id } });
  res.json({ message: 'Request cancelled' });
}));

module.exports = router;
