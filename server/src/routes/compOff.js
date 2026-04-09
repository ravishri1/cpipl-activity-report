const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { getUserWeeklyOffDays } = require('../services/attendance/weeklyOffHelper');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return u.role === 'admin' || u.role === 'sub_admin' || u.role === 'team_lead'; }

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Helper: check if a date is a non-working day (holiday or weekly off) for a user ──
async function checkNonWorkingDay(prisma, dateStr, userId) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat

  // Get user's weekly off pattern
  const offDays = userId ? await getUserWeeklyOffDays(userId, prisma) : [0, 6];
  const isWeekend = offDays.includes(dayOfWeek);

  const holiday = await prisma.holiday.findFirst({
    where: { date: dateStr, isOptional: false },
  });

  return {
    isWeekend,
    isHoliday: !!holiday,
    holidayName: holiday?.name || null,
    isNonWorkingDay: isWeekend || !!holiday,
    dayLabel: isWeekend ? DAY_LABELS[dayOfWeek] : (holiday ? `Holiday — ${holiday.name}` : 'Working Day'),
  };
}

// ── Helper: get the COF leave type ID ──
async function getCompOffLeaveTypeId(prisma) {
  const lt = await prisma.leaveType.findFirst({ where: { code: 'COF' } });
  if (!lt) return null;
  return lt.id;
}

// ── Helper: get financial year start year from a date ──
function getFYYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth(); // 0-indexed (0=Jan, 3=Apr)
  const year = d.getFullYear();
  return month >= 3 ? year : year - 1; // FY starts in April
}

// ── GET /api/comp-off/validate-date?date=YYYY-MM-DD ──
router.get('/validate-date', asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw badRequest('date query param required');

  const today = new Date().toISOString().slice(0, 10);
  if (date > today) {
    return res.json({ isValid: false, error: 'Cannot apply comp-off for future dates', maxDays: 0 });
  }

  const dayInfo = await checkNonWorkingDay(req.prisma, date, req.user.id);
  if (!dayInfo.isNonWorkingDay) {
    return res.json({ isValid: false, error: 'This is a regular working day — comp-off not applicable', ...dayInfo, maxDays: 0 });
  }

  const attendance = await req.prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    select: { status: true, workHours: true, checkIn: true, checkOut: true },
  });

  if (!attendance || !attendance.checkIn) {
    return res.json({ isValid: false, error: 'No attendance found for this date. You must have punched in to apply comp-off.', ...dayInfo, attendance: null, maxDays: 0 });
  }

  const hours = attendance.workHours || 0;

  if (hours < 5) {
    return res.json({
      isValid: false,
      error: `You worked only ${hours.toFixed(1)} hrs. Minimum 5 hrs required for half-day comp-off.`,
      ...dayInfo, attendance, maxDays: 0,
    });
  }

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
  // Get balance from LeaveBalance (COF leave type) instead of CompOffBalance
  const leaveTypeId = await getCompOffLeaveTypeId(req.prisma);
  if (!leaveTypeId) return res.json({ earned: 0, used: 0, balance: 0 });

  const fyYear = getFYYear(new Date().toISOString().slice(0, 10));
  const bal = await req.prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear } },
  });
  if (!bal) return res.json({ earned: 0, used: 0, balance: 0 });
  res.json({ earned: bal.total, used: bal.used, balance: bal.balance });
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

// ── POST /api/comp-off — employee submits earn request ──
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'workDate', 'days');
  const { workDate, days, reason } = req.body;
  const parsedDays = parseFloat(days);
  if (![0.5, 1].includes(parsedDays)) throw badRequest('days must be 0.5 or 1');

  // 1. Date must be in the past
  const today = new Date().toISOString().slice(0, 10);
  if (workDate > today) throw badRequest('Cannot apply comp-off for future dates');

  // 2. Must be a non-working day (holiday or weekly off)
  const dayInfo = await checkNonWorkingDay(req.prisma, workDate, req.user.id);
  if (!dayInfo.isNonWorkingDay) throw badRequest('Comp-off can only be applied for holidays or weekly off days');

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
  if (existing) throw badRequest(`You already have a ${existing.status} comp-off request for this date`);

  const request = await req.prisma.compOffRequest.create({
    data: { userId: req.user.id, type: 'earn', workDate, days: parsedDays, reason: reason || null },
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

  // On approval, add to LeaveBalance (COF leave type) so employee can use via normal leave flow
  if (status === 'approved') {
    const leaveTypeId = await getCompOffLeaveTypeId(req.prisma);
    if (leaveTypeId) {
      const fyYear = getFYYear(request.workDate);
      await req.prisma.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: request.userId, leaveTypeId, year: fyYear } },
        create: {
          userId: request.userId, leaveTypeId, year: fyYear,
          total: request.days, used: 0, balance: request.days,
        },
        update: {
          total: { increment: request.days },
          // balance is recalculated dynamically from opening+total-used; don't store stale value
        },
      });
    }
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
