// ═══════════════════════════════════════════════
// Leave Management Service — Financial Year, Monthly Accrual (Bucket System)
// FY: April 1 to March 31 | Privilege Leave: 12/year, 1/month bucket
// ═══════════════════════════════════════════════

/**
 * Get the financial year start year for a given date
 * FY runs April 1 to March 31
 * e.g., March 2026 → FY 2025 (Apr 2025 - Mar 2026)
 *       June 2026 → FY 2026 (Apr 2026 - Mar 2027)
 */
function getFinancialYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date(Date.now() + 330 * 60 * 1000);
  const month = d.getMonth(); // 0=Jan, 3=Apr
  const year = d.getFullYear();
  return month >= 3 ? year : year - 1;
}

/**
 * Get FY date range
 */
function getFYRange(fyYear) {
  return {
    start: `${fyYear}-04-01`,
    end: `${fyYear + 1}-03-31`,
  };
}

/**
 * Get FY label like "2025-26"
 */
function getFYLabel(fyYear) {
  return `${fyYear}-${String(fyYear + 1).slice(2)}`;
}

/**
 * Calculate months elapsed in a financial year (for monthly accrual)
 * April = month 1, March = month 12
 */
function getMonthsElapsed(fyYear) {
  const now = new Date(Date.now() + 330 * 60 * 1000); // IST
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  let months;
  if (currentYear === fyYear && currentMonth >= 3) {
    // Same year, April onwards: Apr(3)=1, May(4)=2, ..., Dec(11)=9
    months = currentMonth - 3 + 1;
  } else if (currentYear === fyYear + 1 && currentMonth < 3) {
    // Next year, Jan-Mar: Jan(0)=10, Feb(1)=11, Mar(2)=12
    months = 9 + currentMonth + 1;
  } else if (currentYear > fyYear + 1 || (currentYear === fyYear + 1 && currentMonth >= 3)) {
    months = 12; // FY fully elapsed
  } else {
    months = 0; // Future FY
  }

  return Math.min(months, 12);
}

/**
 * Calculate credited leaves based on accrual type
 */
function calculateCredited(leaveType, fyYear) {
  if (leaveType.accrualType === 'yearly' || leaveType.accrualType === 'none') {
    return leaveType.defaultBalance; // All at once
  }
  // Monthly bucket: 1 per month
  const monthsElapsed = getMonthsElapsed(fyYear);
  return Math.min(monthsElapsed * (leaveType.accrualAmount || 1), leaveType.defaultBalance);
}

/**
 * Calculate available balance = opening + credited - used
 */
function calculateAvailable(balance, leaveType, fyYear) {
  const credited = calculateCredited(leaveType, fyYear);
  return (balance.opening || 0) + credited - (balance.used || 0);
}

/**
 * Calculate business days between two dates, excluding weekends and holidays
 */
async function calculateLeaveDays(startDate, endDate, session, prisma) {
  // Single day with half-day session
  if (startDate === endDate && (session === 'first_half' || session === 'second_half')) {
    // Check if it's a weekend or holiday
    const d = new Date(startDate);
    if (d.getDay() === 0 || d.getDay() === 6) return 0;
    const isHoliday = await prisma.holiday.findFirst({
      where: { date: startDate },
    });
    if (isHoliday) return 0;
    return 0.5;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    select: { date: true },
  });
  const holidayDates = new Set(holidays.map((h) => h.date));

  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Ensure LeaveBalance record exists for user+type+FY, auto-initialize if missing
 */
async function ensureBalance(userId, leaveTypeId, fyYear, prisma) {
  let balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear } },
    include: { leaveType: true },
  });

  if (!balance) {
    // Auto-create balance for this FY
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) return null;

    // Check carry forward from previous FY
    let opening = 0;
    if (leaveType.carryForward) {
      const prevBalance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear - 1 } },
        include: { leaveType: true },
      });
      if (prevBalance) {
        const prevCredited = calculateCredited(leaveType, fyYear - 1);
        const prevAvailable = (prevBalance.opening || 0) + prevCredited - prevBalance.used;
        opening = Math.min(Math.max(prevAvailable, 0), leaveType.maxCarryForward || 0);
      }
    }

    balance = await prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId,
        year: fyYear,
        opening,
        total: leaveType.defaultBalance,
        used: 0,
        balance: opening, // Will be recalculated dynamically
      },
      include: { leaveType: true },
    });
  }

  return balance;
}

/**
 * Get leave balances for a user in a financial year
 * Returns balance cards with opening, credited, used, available
 */
async function getLeaveBalance(userId, fyYear, prisma) {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const balances = [];
  for (const lt of leaveTypes) {
    const bal = await ensureBalance(userId, lt.id, fyYear, prisma);
    if (!bal) continue;

    const credited = calculateCredited(lt, fyYear);
    const available = (bal.opening || 0) + credited - bal.used;

    balances.push({
      id: bal.id,
      userId: bal.userId,
      leaveTypeId: bal.leaveTypeId,
      year: bal.year,
      opening: bal.opening || 0,
      credited,
      total: bal.total,
      used: bal.used,
      available: Math.max(available, 0),
      leaveType: { id: lt.id, name: lt.name, code: lt.code, accrualType: lt.accrualType },
      fyLabel: getFYLabel(fyYear),
    });
  }

  return balances;
}

/**
 * Apply for leave
 */
async function applyLeave(userId, data, prisma) {
  const { leaveTypeId, startDate, endDate, session, reason } = data;

  // Validate dates
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0]; // IST
  if (startDate < today) {
    throw new Error('Cannot apply for leave on past dates.');
  }
  if (endDate < startDate) {
    throw new Error('End date must be on or after start date.');
  }

  // Validate leave type
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) {
    throw new Error('Invalid leave type.');
  }

  // Check for overlapping requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ['pending', 'approved'] },
      OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
    },
  });
  if (overlapping) {
    throw new Error('You already have a leave request overlapping with these dates.');
  }

  // Calculate days
  const effectiveSession = session || 'full_day';
  const days = await calculateLeaveDays(startDate, endDate, effectiveSession, prisma);
  if (days <= 0) {
    throw new Error('Selected dates have no working days (all weekends/holidays).');
  }

  // Check balance using financial year
  const fyYear = getFinancialYear(startDate);
  const balance = await ensureBalance(userId, leaveTypeId, fyYear, prisma);
  if (!balance) {
    throw new Error('Leave balance not found.');
  }

  const credited = calculateCredited(leaveType, fyYear);
  const available = (balance.opening || 0) + credited - balance.used;

  if (available < days) {
    throw new Error(
      `Insufficient ${leaveType.name} balance. Available: ${available.toFixed(1)}, Requested: ${days}`
    );
  }

  // Validate reason
  if (!reason || reason.trim().length < 5) {
    throw new Error('Please provide a reason (minimum 5 characters).');
  }

  // Create request
  const request = await prisma.leaveRequest.create({
    data: {
      userId,
      leaveTypeId,
      startDate,
      endDate,
      days,
      session: effectiveSession,
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

  if (!request) throw new Error('Leave request not found.');
  if (request.status !== 'pending') {
    throw new Error(`Cannot review a request that is already ${request.status}.`);
  }

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
    const fyYear = getFinancialYear(request.startDate);
    const balance = await ensureBalance(request.userId, request.leaveTypeId, fyYear, prisma);
    if (balance) {
      const credited = calculateCredited(request.leaveType, fyYear);
      const newUsed = balance.used + request.days;
      const newAvailable = (balance.opening || 0) + credited - newUsed;
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: { increment: request.days },
          balance: Math.max(newAvailable, 0),
        },
      });
    }
  }

  return updated;
}

/**
 * Cancel a leave request
 */
async function cancelLeave(requestId, userId, prisma) {
  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true },
  });

  if (!request) throw new Error('Leave request not found.');
  if (request.userId !== userId) throw new Error('You can only cancel your own leave requests.');

  const wasApproved = request.status === 'approved';
  if (request.status !== 'pending' && request.status !== 'approved') {
    throw new Error(`Cannot cancel a request that is ${request.status}.`);
  }

  await prisma.leaveRequest.update({
    where: { id: requestId },
    data: { status: 'cancelled' },
  });

  // Restore balance if was approved
  if (wasApproved) {
    const fyYear = getFinancialYear(request.startDate);
    const balance = await ensureBalance(request.userId, request.leaveTypeId, fyYear, prisma);
    if (balance) {
      const credited = calculateCredited(request.leaveType, fyYear);
      const newUsed = balance.used - request.days;
      const newAvailable = (balance.opening || 0) + credited - newUsed;
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          used: { decrement: request.days },
          balance: Math.max(newAvailable, 0),
        },
      });
    }
  }

  return { message: 'Leave request cancelled.', balanceRestored: wasApproved };
}

/**
 * Get leave requests for a user with FY filter
 */
async function getMyLeaveRequests(userId, fyYear, status, prisma) {
  const { start, end } = getFYRange(fyYear);
  const where = {
    userId,
    startDate: { gte: start, lte: end },
  };
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
 * Get pending leave requests for approvers
 */
async function getPendingRequests(department, prisma) {
  const userWhere = department ? { department } : {};

  return prisma.leaveRequest.findMany({
    where: {
      status: 'pending',
      user: { ...userWhere, isActive: true },
    },
    include: {
      user: { select: { id: true, name: true, department: true, employeeId: true, profilePhotoUrl: true, driveProfilePhotoUrl: true } },
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Admin: Initialize FY balances for all active employees
 */
async function initializeFYBalances(fyYear, prisma) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  let created = 0;
  for (const user of users) {
    for (const lt of leaveTypes) {
      const existing = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: fyYear } },
      });
      if (!existing) {
        await ensureBalance(user.id, lt.id, fyYear, prisma);
        created++;
      }
    }
  }

  return { created, employees: users.length, leaveTypes: leaveTypes.length };
}

/**
 * Admin: Get all employee balances for a FY
 */
async function getAllBalances(fyYear, department, prisma) {
  const userWhere = { isActive: true };
  if (department) userWhere.department = department;

  const balances = await prisma.leaveBalance.findMany({
    where: {
      year: fyYear,
      user: userWhere,
    },
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } },
      leaveType: { select: { id: true, name: true, code: true, accrualType: true, accrualAmount: true, defaultBalance: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
  });

  // Enrich with credited/available calculations
  return balances.map((b) => {
    const credited = calculateCredited(b.leaveType, fyYear);
    const available = (b.opening || 0) + credited - b.used;
    return {
      ...b,
      credited,
      available: Math.max(available, 0),
      fyLabel: getFYLabel(fyYear),
    };
  });
}

module.exports = {
  getFinancialYear,
  getFYRange,
  getFYLabel,
  getMonthsElapsed,
  calculateCredited,
  calculateLeaveDays,
  ensureBalance,
  getLeaveBalance,
  applyLeave,
  reviewLeave,
  cancelLeave,
  getMyLeaveRequests,
  getPendingRequests,
  initializeFYBalances,
  getAllBalances,
};
