const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { notifyUsers } = require('../utils/notify');

const router = express.Router();
router.use(authenticate);

// POST / — Request overtime
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'date', 'hours');
  const { date, hours, reason } = req.body;
  const parsedHours = parseFloat(hours);
  if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 12) {
    throw badRequest('hours must be greater than 0 and at most 12.');
  }

  const existing = await req.prisma.overtimeRequest.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
  });
  if (existing) throw conflict('You already have an overtime request for this date.');

  const request = await req.prisma.overtimeRequest.create({
    data: { userId: req.user.id, date, hours: parsedHours, reason: reason || null },
  });

  // Notify admins about new overtime request
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'overtime',
    title: 'New Overtime Request',
    message: `${req.user.name || 'An employee'} requested ${parsedHours}h overtime on ${date}`,
    link: '/overtime',
  });

  res.status(201).json(request);
}));

// GET /my — Own overtime requests
router.get('/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.overtimeRequest.findMany({
    where: { userId: req.user.id },
    orderBy: { date: 'desc' },
  });
  res.json(requests);
}));

// GET /pending — Pending OT requests (admin/team_lead)
router.get('/pending', requireAdmin, asyncHandler(async (req, res) => {
  const requests = await req.prisma.overtimeRequest.findMany({
    where: { status: 'pending' },
    include: { user: { select: { name: true, email: true, employeeId: true, department: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(requests);
}));

// GET /all — All OT requests with filters (admin/team_lead)
router.get('/all', requireAdmin, asyncHandler(async (req, res) => {
  const { status, month, userId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (month) where.date = { startsWith: month };
  if (userId) where.userId = parseInt(userId);

  const requests = await req.prisma.overtimeRequest.findMany({
    where,
    include: { user: { select: { name: true, email: true, employeeId: true, department: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(requests);
}));

// PUT /:id/review — Approve or reject (admin/team_lead)
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const { status, compOffEarned } = req.body;
  requireEnum(status, ['approved', 'rejected'], 'status');

  const existing = await req.prisma.overtimeRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw notFound('Overtime request');
  if (existing.status !== 'pending') throw badRequest('Only pending requests can be reviewed.');

  const updated = await req.prisma.overtimeRequest.update({
    where: { id: requestId },
    data: { status, compOffEarned: compOffEarned === true, reviewedBy: req.user.id, reviewedAt: new Date() },
    include: { user: { select: { name: true, email: true, employeeId: true, department: true } } },
  });

  // Notify the requestor about the review decision
  if (existing.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [existing.userId], type: 'overtime',
      title: `Overtime ${status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}`,
      message: `Your overtime request for ${existing.date} has been ${status}`,
      link: '/overtime',
    });
  }

  res.json(updated);
}));

// GET /summary — Monthly summary (admin/team_lead)
router.get('/summary', requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('month query parameter is required (YYYY-MM).');

  const requests = await req.prisma.overtimeRequest.findMany({
    where: { date: { startsWith: month } },
    include: { user: { select: { department: true } } },
  });

  const totalRequests = requests.length;
  const totalHours = requests.reduce((sum, r) => sum + r.hours, 0);
  const approved = requests.filter(r => r.status === 'approved').length;
  const pending = requests.filter(r => r.status === 'pending').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const compOffsEarned = requests.filter(r => r.compOffEarned === true).length;

  const deptMap = {};
  for (const r of requests) {
    const dept = r.user?.department || 'Unknown';
    if (!deptMap[dept]) {
      deptMap[dept] = { department: dept, totalRequests: 0, totalHours: 0, approved: 0, pending: 0, rejected: 0, compOffsEarned: 0 };
    }
    deptMap[dept].totalRequests++;
    deptMap[dept].totalHours += r.hours;
    if (r.status === 'approved') deptMap[dept].approved++;
    if (r.status === 'pending') deptMap[dept].pending++;
    if (r.status === 'rejected') deptMap[dept].rejected++;
    if (r.compOffEarned) deptMap[dept].compOffsEarned++;
  }

  res.json({
    month, totalRequests, totalHours, approved, pending, rejected,
    compOffsEarned, byDepartment: Object.values(deptMap),
  });
}));

module.exports = router;
