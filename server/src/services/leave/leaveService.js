// ═══════════════════════════════════════════════
// Leave Management Service — Financial Year, Monthly Accrual (Bucket System)
// FY: April 1 to March 31 | Privilege Leave: 12/year, 1/month bucket
// Probation: Leaves accrue monthly but are FROZEN until confirmation.
//   During probation, only `probationAllowance` (default 1) is usable.
//   After confirmation, all accrued past-month leaves become available instantly.
// ═══════════════════════════════════════════════

/**
 * Get the financial year start year for a given date
 * FY runs April 1 to March 31
 */
function getFinancialYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date(Date.now() + 330 * 60 * 1000);
  const month = d.getMonth(); // 0=Jan, 3=Apr
  const year = d.getFullYear();
  return month >= 3 ? year : year - 1;
}

function getFYRange(fyYear) {
  return {
    start: `${fyYear}-04-01`,
    end: `${fyYear + 1}-03-31`,
  };
}

function getFYLabel(fyYear) {
  return `${fyYear}-${String(fyYear + 1).slice(2)}`;
}

/**
 * Convert a calendar month (0-11) + year to FY month (1-12)
 * April = 1, May = 2, ..., March = 12
 */
function calendarToFYMonth(calMonth, calYear, fyYear) {
  if (calYear === fyYear && calMonth >= 3) {
    return calMonth - 3 + 1; // Apr=1, May=2, ..., Dec=9
  } else if (calYear === fyYear + 1 && calMonth < 3) {
    return 9 + calMonth + 1; // Jan=10, Feb=11, Mar=12
  }
  return calMonth >= 3 ? calMonth - 3 + 1 : 9 + calMonth + 1;
}

/**
 * Calculate months elapsed in a financial year (for monthly accrual)
 * April = month 1, March = month 12
 * If joiningMonth is provided, only count from joining month onwards
 */
function getMonthsElapsed(fyYear, joiningMonth) {
  const now = new Date(Date.now() + 330 * 60 * 1000); // IST
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  let months;
  if (currentYear === fyYear && currentMonth >= 3) {
    months = currentMonth - 3 + 1;
  } else if (currentYear === fyYear + 1 && currentMonth < 3) {
    months = 9 + currentMonth + 1;
  } else if (currentYear > fyYear + 1 || (currentYear === fyYear + 1 && currentMonth >= 3)) {
    months = 12;
  } else {
    months = 0;
  }

  months = Math.min(months, 12);

  // If employee joined mid-year, only credit from their joining month
  if (joiningMonth && joiningMonth > 1) {
    months = Math.max(months - (joiningMonth - 1), 0);
  }

  return months;
}

/**
 * Calculate credited leaves based on accrual type
 */
function calculateCredited(leaveType, fyYear, joiningMonth) {
  if (leaveType.accrualType === 'yearly' || leaveType.accrualType === 'none') {
    return leaveType.defaultBalance;
  }
  // Monthly bucket: 1 per month (pro-rated for mid-year joiners)
  const monthsElapsed = getMonthsElapsed(fyYear, joiningMonth || null);
  const maxBalance = joiningMonth
    ? Math.max(12 - (joiningMonth - 1), 0) * (leaveType.accrualAmount || 1)
    : leaveType.defaultBalance;
  return Math.min(monthsElapsed * (leaveType.accrualAmount || 1), maxBalance);
}

/**
 * Check if user is on probation
 */
function isOnProbation(user) {
  if (!user) return false;
  // Confirmed users are NOT on probation
  if (user.confirmationStatus === 'confirmed') return false;
  if (user.confirmationDate) return false; // has confirmation date = confirmed

  // If probation end date exists and is in the future → on probation
  if (user.probationEndDate) {
    const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
    return user.probationEndDate > today;
  }

  // If dateOfJoining exists, check if within 6 months
  if (user.dateOfJoining) {
    const today = new Date(Date.now() + 330 * 60 * 1000);
    const joinDate = new Date(user.dateOfJoining);
    const sixMonthsLater = new Date(joinDate);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    return today < sixMonthsLater;
  }

  return false;
}

/**
 * Get usable balance considering probation
 * During probation: min(probationAllowance, credited) - used
 * After confirmation: opening + credited - used (normal)
 */
function calculateAvailableWithProbation(balance, leaveType, fyYear, user) {
  const joiningMonth = balance.joiningMonth || null;
  const credited = calculateCredited(leaveType, fyYear, joiningMonth);
  const totalPool = (balance.opening || 0) + credited;
  const onProbation = isOnProbation(user);

  if (onProbation && balance.probationAllowance !== null && balance.probationAllowance !== undefined) {
    // During probation: can only use up to probationAllowance
    const usable = Math.min(balance.probationAllowance, totalPool);
    return Math.max(usable - balance.used, 0);
  }

  // Normal (confirmed or no restriction)
  return Math.max(totalPool - balance.used, 0);
}

/**
 * Calculate business days between two dates, excluding weekends and holidays
 */
async function calculateLeaveDays(startDate, endDate, session, prisma) {
  if (startDate === endDate && (session === 'first_half' || session === 'second_half')) {
    const d = new Date(startDate);
    if (d.getDay() === 0 || d.getDay() === 6) return 0;
    const isHoliday = await prisma.holiday.findFirst({ where: { date: startDate } });
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
 * Ensure LeaveBalance record exists for user+type+FY
 */
async function ensureBalance(userId, leaveTypeId, fyYear, prisma) {
  let balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear } },
    include: { leaveType: true },
  });

  if (!balance) {
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) return null;

    // Check if there's a grant for this user+type+FY
    const grant = await prisma.leaveGranter.findUnique({
      where: { userId_leaveTypeId_fyYear: { userId, leaveTypeId, fyYear } },
    });

    // Check carry forward from previous FY
    let opening = 0;
    if (leaveType.carryForward) {
      const prevBalance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear - 1 } },
        include: { leaveType: true },
      });
      if (prevBalance) {
        const prevCredited = calculateCredited(leaveType, fyYear - 1, prevBalance.joiningMonth);
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
        total: grant ? grant.totalGranted : leaveType.defaultBalance,
        used: 0,
        balance: opening,
        probationAllowance: grant ? grant.probationAllowance : null,
        joiningMonth: grant ? grant.joiningMonth : null,
      },
      include: { leaveType: true },
    });
  }

  return balance;
}

/**
 * Get leave balances for a user in a financial year
 */
async function getLeaveBalance(userId, fyYear, prisma) {
  const leaveTypes = await prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  // Fetch user for probation check
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, dateOfJoining: true, confirmationDate: true,
      confirmationStatus: true, probationEndDate: true,
    },
  });

  const onProbation = isOnProbation(user);

  const balances = [];
  for (const lt of leaveTypes) {
    const bal = await ensureBalance(userId, lt.id, fyYear, prisma);
    if (!bal) continue;

    const joiningMonth = bal.joiningMonth || null;
    const credited = calculateCredited(lt, fyYear, joiningMonth);
    const totalPool = (bal.opening || 0) + credited;

    // Calculate available based on probation status
    let available;
    let frozenBalance = 0;
    if (onProbation && bal.probationAllowance !== null && bal.probationAllowance !== undefined) {
      const usable = Math.min(bal.probationAllowance, totalPool);
      available = Math.max(usable - bal.used, 0);
      frozenBalance = Math.max(totalPool - bal.probationAllowance - bal.used, 0);
    } else {
      available = Math.max(totalPool - bal.used, 0);
    }

    // Calculate max possible for this FY (for mid-year joiners)
    const maxEntitlement = joiningMonth
      ? Math.max(12 - (joiningMonth - 1), 0) * (lt.accrualAmount || 1)
      : lt.defaultBalance;

    balances.push({
      id: bal.id,
      userId: bal.userId,
      leaveTypeId: bal.leaveTypeId,
      year: bal.year,
      opening: bal.opening || 0,
      credited,
      total: bal.total,
      used: bal.used,
      available,
      frozenBalance,       // leaves accrued but locked during probation
      onProbation,
      probationAllowance: bal.probationAllowance,
      joiningMonth,
      maxEntitlement,
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

  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
  if (startDate < today) {
    throw new Error('Cannot apply for leave on past dates.');
  }
  if (endDate < startDate) {
    throw new Error('End date must be on or after start date.');
  }

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

  // Fetch user for probation check
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, dateOfJoining: true, confirmationDate: true,
      confirmationStatus: true, probationEndDate: true,
    },
  });

  const joiningMonth = balance.joiningMonth || null;
  const credited = calculateCredited(leaveType, fyYear, joiningMonth);
  const totalPool = (balance.opening || 0) + credited;
  const onProbation = isOnProbation(user);

  let available;
  if (onProbation && balance.probationAllowance !== null && balance.probationAllowance !== undefined) {
    // During probation: only probationAllowance is usable
    const usable = Math.min(balance.probationAllowance, totalPool);
    available = Math.max(usable - balance.used, 0);

    if (available < days) {
      const probEndStr = user.probationEndDate || 'confirmation';
      throw new Error(
        `You are on probation. Only ${balance.probationAllowance} ${leaveType.name} leave(s) can be used during probation. ` +
        `Available: ${available.toFixed(1)}, Requested: ${days}. ` +
        `Remaining leaves will be unlocked after ${probEndStr}.`
      );
    }
  } else {
    available = Math.max(totalPool - balance.used, 0);
    if (available < days) {
      throw new Error(
        `Insufficient ${leaveType.name} balance. Available: ${available.toFixed(1)}, Requested: ${days}`
      );
    }
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error('Please provide a reason (minimum 5 characters).');
  }

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
      const credited = calculateCredited(request.leaveType, fyYear, balance.joiningMonth);
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

  if (wasApproved) {
    const fyYear = getFinancialYear(request.startDate);
    const balance = await ensureBalance(request.userId, request.leaveTypeId, fyYear, prisma);
    if (balance) {
      const credited = calculateCredited(request.leaveType, fyYear, balance.joiningMonth);
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
      user: {
        select: {
          id: true, name: true, employeeId: true, department: true, designation: true,
          dateOfJoining: true, confirmationDate: true, confirmationStatus: true, probationEndDate: true,
        },
      },
      leaveType: { select: { id: true, name: true, code: true, accrualType: true, accrualAmount: true, defaultBalance: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
  });

  return balances.map((b) => {
    const joiningMonth = b.joiningMonth || null;
    const credited = calculateCredited(b.leaveType, fyYear, joiningMonth);
    const onProbation = isOnProbation(b.user);
    const totalPool = (b.opening || 0) + credited;
    let available;
    if (onProbation && b.probationAllowance !== null && b.probationAllowance !== undefined) {
      available = Math.max(Math.min(b.probationAllowance, totalPool) - b.used, 0);
    } else {
      available = Math.max(totalPool - b.used, 0);
    }
    return {
      ...b,
      credited,
      available,
      onProbation,
      fyLabel: getFYLabel(fyYear),
    };
  });
}

/**
 * Admin: Grant leave to an employee (Leave Granter)
 */
async function grantLeave(adminId, data, prisma) {
  const { userId, leaveTypeId, fyYear, totalGranted, probationAllowance, joiningMonth, notes } = data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) throw new Error('Employee not found.');

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) throw new Error('Invalid leave type.');

  // Upsert the grant record
  // probationAllowance: null = no restriction (confirmed employee), number = cap during probation
  const effectiveProbation = probationAllowance !== null && probationAllowance !== undefined ? probationAllowance : 0;
  const grant = await prisma.leaveGranter.upsert({
    where: { userId_leaveTypeId_fyYear: { userId, leaveTypeId, fyYear } },
    update: {
      totalGranted,
      probationAllowance: effectiveProbation,
      joiningMonth: joiningMonth || null,
      notes: notes || null,
      grantedBy: adminId,
      grantedAt: new Date(),
    },
    create: {
      userId,
      leaveTypeId,
      fyYear,
      totalGranted,
      probationAllowance: effectiveProbation,
      joiningMonth: joiningMonth || null,
      notes: notes || null,
      grantedBy: adminId,
    },
    include: {
      user: { select: { name: true, employeeId: true } },
      leaveType: { select: { name: true, code: true } },
      granter: { select: { name: true } },
    },
  });

  // Update the corresponding LeaveBalance
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year: fyYear } },
  });

  // For balance: null probationAllowance = no restriction (confirmed), number = cap during probation
  const balanceProbation = probationAllowance !== null && probationAllowance !== undefined ? probationAllowance : null;
  if (balance) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        total: totalGranted,
        probationAllowance: balanceProbation,
        joiningMonth: joiningMonth || null,
      },
    });
  } else {
    await prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId,
        year: fyYear,
        opening: 0,
        total: totalGranted,
        used: 0,
        balance: 0,
        probationAllowance: balanceProbation,
        joiningMonth: joiningMonth || null,
      },
    });
  }

  return grant;
}

/**
 * Admin: Get all leave grants for a FY
 */
async function getLeaveGrants(fyYear, prisma) {
  return prisma.leaveGranter.findMany({
    where: { fyYear },
    include: {
      user: {
        select: {
          id: true, name: true, employeeId: true, department: true,
          dateOfJoining: true, confirmationDate: true, confirmationStatus: true, probationEndDate: true,
        },
      },
      leaveType: { select: { id: true, name: true, code: true } },
      granter: { select: { name: true } },
    },
    orderBy: [{ user: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
  });
}

/**
 * Admin: Delete a leave grant
 */
async function deleteLeaveGrant(grantId, prisma) {
  const grant = await prisma.leaveGranter.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error('Grant not found.');

  // Reset balance to default
  const leaveType = await prisma.leaveType.findUnique({ where: { id: grant.leaveTypeId } });
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId: grant.userId, leaveTypeId: grant.leaveTypeId, year: grant.fyYear } },
  });
  if (balance) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        total: leaveType?.defaultBalance || 12,
        probationAllowance: null,
        joiningMonth: null,
      },
    });
  }

  await prisma.leaveGranter.delete({ where: { id: grantId } });
  return { message: 'Leave grant removed. Balance reset to default.' };
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
  grantLeave,
  getLeaveGrants,
  deleteLeaveGrant,
  isOnProbation,
  calendarToFYMonth,
};
