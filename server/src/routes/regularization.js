const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(u) { return u.role === 'admin' || u.role === 'sub_admin' || u.role === 'team_lead'; }

// GET /api/regularization/my
router.get('/my', asyncHandler(async (req, res) => {
  const requests = await req.prisma.attendanceRegularization.findMany({
    where: { userId: req.user.id },
    include: { reviewer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// GET /api/regularization — admin: all requests
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status, userId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = parseInt(userId);
  if (!status) where.status = 'pending';

  const requests = await req.prisma.attendanceRegularization.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true } },
      reviewer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// POST /api/regularization — employee submits request
router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, 'date', 'reason');
  const { date, requestedIn, requestedOut, reason } = req.body;
  if (!requestedIn && !requestedOut) throw badRequest('At least one of requestedIn or requestedOut is required');

  // Check if attendance record exists for that date
  const attendance = await req.prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
  });

  // Prevent duplicate pending requests for same date
  const existing = await req.prisma.attendanceRegularization.findFirst({
    where: { userId: req.user.id, date, status: 'pending' },
  });
  if (existing) throw badRequest('A pending regularization request already exists for this date');

  const request = await req.prisma.attendanceRegularization.create({
    data: {
      userId: req.user.id, date,
      requestedIn: requestedIn || null,
      requestedOut: requestedOut || null,
      reason,
    },
  });
  res.status(201).json(request);
}));

// PUT /api/regularization/:id/review — admin approves/rejects
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw badRequest('status must be approved or rejected');

  const request = await req.prisma.attendanceRegularization.findUnique({ where: { id } });
  if (!request) throw notFound('Regularization request');
  if (request.status !== 'pending') throw badRequest('Request already reviewed');

  const updated = await req.prisma.attendanceRegularization.update({
    where: { id },
    data: { status, reviewedBy: req.user.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
  });

  if (status === 'approved') {
    // Update or create attendance record
    const checkInTime = request.requestedIn
      ? new Date(`${request.date}T${request.requestedIn}:00`)
      : undefined;
    const checkOutTime = request.requestedOut
      ? new Date(`${request.date}T${request.requestedOut}:00`)
      : undefined;

    await req.prisma.attendance.upsert({
      where: { userId_date: { userId: request.userId, date: request.date } },
      create: {
        userId: request.userId, date: request.date,
        checkIn: checkInTime, checkOut: checkOutTime,
        status: 'present', notes: `Regularized by admin`,
      },
      update: {
        ...(checkInTime && { checkIn: checkInTime }),
        ...(checkOutTime && { checkOut: checkOutTime }),
        status: 'present', notes: `Regularized by admin`,
      },
    });
  }

  res.json(updated);
}));

// DELETE /api/regularization/:id — cancel pending
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const request = await req.prisma.attendanceRegularization.findUnique({ where: { id } });
  if (!request) throw notFound('Regularization request');
  if (request.userId !== req.user.id && !isAdminRole(req.user)) throw forbidden();
  if (request.status !== 'pending') throw badRequest('Only pending requests can be cancelled');
  await req.prisma.attendanceRegularization.delete({ where: { id } });
  res.json({ message: 'Request cancelled' });
}));

module.exports = router;
