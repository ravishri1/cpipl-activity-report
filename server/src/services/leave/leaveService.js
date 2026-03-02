// ═══════════════════════════════════════════════
// Leave Management Service — Apply, review, balance, calculations
// ═══════════════════════════════════════════════

/**
 * Calculate business days between two dates, excluding weekends and holidays
 */
async function calculateLeaveDays(startDate, endDate, prisma) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get holidays in the range
  const holidays = await prisma.holiday.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    select: { date: true },
  });
  const holidayDates = new Set(holidays.map((h) => h.date));

  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat
    const dateStr = current.toISOString().split('T')[0];

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Apply for leave
 */
async function applyLeave(userId, data, prisma) {
  const { leaveTypeId, startDate, endDate, reason } = data;

  // Validate dates
  const today = new Date().toISOString().split('T')[0];
  if (startDate < today) {
    throw new Error('Cannot apply for leave on past dates.');
  }
  if (endDate < startDate) {
    throw new Error('End date must be on or after start date.');
  }

  // Validate leave type exists
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) {
    throw new Error('Invalid leave type.');
  }

  // Check for overlapping requests (pending or approved)
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ['pending', 'approved'] },
      OR: [
        { startDate: { lte: endDate }, endDate: { gte: startDate } },
      ],
    },
  });
  if (overlapping) {
    throw new Error('You already have a leave request overlapping with these dates.');
  }

  // Calculate days
  const days = await calculateLeaveDays(startDate, endDate, prisma);
  if (days <= 0) {
    throw new Error('Selected dates have no working days (all weekends/holidays).');
  }

  // Check balance
  const year = parseInt(startDate.substring(0, 4));
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
  });

  if (!balance || balance.balance < days) {
    throw new Error(`Insufficient ${leaveType.name} balance. Available: ${balance?.balance || 0}, Requested: ${days}`);
  }

  // Validate reason
  if (!reason || reason.trim().length < 5) {
    throw new Error('Please provide a reason for your leave (minimum 5 characters).');
  }

  // Create request
  const request = await prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeId,
      startDate,
      endDate,
      days,
      reason: reason.trim(),
      status: 'pending',
    },
    include: {
      leaveType: { select: { name: true, code: true } },
    },
  });

  return request;
}

/**
 * Review (approve/reject) a leave request
 */
async function reviewLeave(requestId, reviewerId, status, reviewNote, prisma) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('Status must be "approved" or "rejected".');
  }

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true, user: { select: { name: true, department: true } } },
  });

  if (!request) {
    throw new Error('Leave request not found.');
  }
  if (request.status !== 'pending') {
    throw new Error(`Cannot review a request that is already ${request.status}.`);
  }

  // Update request
  const updated = await prisma.leaveRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
    },
    include: {
      leaveType: { select: { name: true, code: true } },
      user: { select: { name: true, email: true } },
    },
  });

  // If approved, deduct from balance
  if (status === 'approved') {
    const year = parseInt(request.startDate.substring(0, 4));
    await prisma.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
      },
      data: {
        used: { increment: request.days },
        balance: { decrement: request.days },
      },
    });
  }

  return updated;
}

/**
 * Cancel a leave request (by the employee)
 */
async function cancelLeave(requestId, userId, prisma) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw new Error('Leave request not found.');
  }
  if (request.userId !== userId) {
    throw new Error('You can only cancel your own leave requests.');
  }

  const wasApproved = request.status === 'approved';

  if (request.status !== 'pending' && request.status !== 'approved') {
    throw new Error(`Cannot cancel a request that is ${request.status}.`);
  }

  // Cancel the request
  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: 'cancelled' },
  });

  // If it was approved, restore the balance
  if (wasApproved) {
    const year = parseInt(request.startDate.substring(0, 4));
    await prisma.leaveBalance.update({
      where: {
        userId_leaveTypeId_year: { userId: request.userId, leaveTypeId: request.leaveTypeId, year },
      },
      data: {
        used: { decrement: request.days },
        balance: { increment: request.days },
      },
    });
  }

  return { message: 'Leave request cancelled.', balanceRestored: wasApproved };
}

/**
 * Get leave balances for a user
 */
async function getLeaveBalance(userId, year, prisma) {
  return prisma.leaveBalance.findMany({
    where: { userId, year },
    include: {
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { leaveType: { name: 'asc' } },
  });
}

/**
 * Get leave requests for a user with optional filters
 */
async function getMyLeaveRequests(userId, year, status, prisma) {
  const where = { userId };

  if (year) {
    where.startDate = { gte: `${year}-01-01`, lte: `${year}-12-31` };
  }
  if (status && status !== 'all') {
    where.status = status;
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get pending leave requests for approvers (admin/team_lead)
 */
async function getPendingRequests(department, prisma) {
  const userWhere = department ? { department } : {};

  return prisma.leaveRequest.findMany({
    where: {
      status: 'pending',
      user: userWhere,
    },
    include: {
      user: { select: { id: true, name: true, department: true, employeeId: true, profilePhotoUrl: true } },
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

module.exports = {
  calculateLeaveDays,
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveBalance,
  getMyLeaveRequests,
  getPendingRequests,
};
