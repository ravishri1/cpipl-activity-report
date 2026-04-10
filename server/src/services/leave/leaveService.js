// ═══════════════════════════════════════════════
// Leave Management Service — Financial Year, Monthly Accrual (Bucket System)
// FY: April 1 to March 31 | Privilege Leave: 12/year, 1/month bucket
// Probation: Leaves accrue monthly but are FROZEN until confirmation.
//   During probation, only `probationAllowance` (default 1) is usable.
//   After confirmation, all accrued past-month leaves become available instantly.
// ═══════════════════════════════════════════════

const { getUserWeeklyOffDays, DEFAULT_OFF_DAYS } = require('../attendance/weeklyOffHelper');

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
 * Get the calendar date when a grant becomes valid (joiningMonth start)
 * joiningMonth: 1=Apr, 7=Oct, 12=Mar
 */
function getGrantStartDate(fyYear, joiningMonth) {
  if (!joiningMonth || joiningMonth <= 1) return `${fyYear}-04-01`;
  const calMonth = joiningMonth <= 9 ? joiningMonth + 3 : joiningMonth - 9;
  const calYear = joiningMonth <= 9 ? fyYear : fyYear + 1;
  return `${calYear}-${String(calMonth).padStart(2, '0')}-01`;
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
 * Calculate actual used days from approved LeaveRequest records
 * This is the source of truth — not the stored `used` field in LeaveBalance
 */
async function calculateUsedFromRequests(userId, leaveTypeId, fyYear, prisma) {
  const { start, end } = getFYRange(fyYear);
  const result = await prisma.leaveRequest.aggregate({
    where: {
      userId,
      leaveTypeId,
      status: 'approved',
      startDate: { gte: start, lte: end },
    },
    _sum: { days: true },
  });
  return result._sum.days || 0;
}

/**
 * Sync the stored `used` field with actual approved requests (auto-reconciliation)
 * Returns the corrected used value
 */
async function reconcileUsed(balance, prisma) {
  const actualUsed = await calculateUsedFromRequests(
    balance.userId, balance.leaveTypeId, balance.year, prisma
  );
  // If stored value doesn't match actual, fix it
  if (Math.abs(balance.used - actualUsed) > 0.001) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { used: actualUsed },
    });
    return actualUsed;
  }
  return balance.used;
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
 * Calculate business days between two dates, excluding weekly offs and holidays
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} session - 'full_day', 'first_half', 'second_half'
 * @param {object} prisma
 * @param {number} [userId] - optional, to look up per-user weekly off pattern
 */
async function calculateLeaveDays(startDate, endDate, session, prisma, userId, { sandwichLeave = false } = {}) {
  // Resolve user's location for location-based holidays
  let userLocation = null;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { location: true } });
    userLocation = u?.location || null;
  }
  const holidayLocationFilter = userLocation
    ? { OR: [{ location: userLocation }, { location: 'All' }] }
    : {};

  // Resolve user's weekly off days (or default Sat+Sun)
  const baseOffDays = userId ? await getUserWeeklyOffDays(userId, prisma) : DEFAULT_OFF_DAYS;

  // Policy: Before 2026-02-01, Saturday was a working day (only Sunday off)
  // After 2026-02-01, Saturday is also off. Apply per-date logic.
  const SAT_OFF_CUTOFF = '2026-02-01';
  const getOffDaysForDate = (dateStr) => {
    if (dateStr < SAT_OFF_CUTOFF) {
      return baseOffDays.filter(d => d !== 6); // Remove Saturday before cutoff
    }
    return baseOffDays;
  };

  if (startDate === endDate && (session === 'first_half' || session === 'second_half')) {
    const d = new Date(startDate);
    const offDays = getOffDaysForDate(startDate);
    if (offDays.includes(d.getDay())) return 0;
    const isHoliday = await prisma.holiday.findFirst({ where: { date: startDate, ...holidayLocationFilter } });
    if (isHoliday) return 0;
    return 0.5;
  }

  // Sandwich leave: count ALL calendar days (weekends/holidays included)
  if (sandwichLeave) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return totalDays;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDate, lte: endDate }, ...holidayLocationFilter },
    select: { date: true },
  });
  const holidayDates = new Set(holidays.map((h) => h.date));

  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const dateStr = current.toISOString().split('T')[0];
    const offDays = getOffDaysForDate(dateStr);
    if (!offDays.includes(dayOfWeek) && !holidayDates.has(dateStr)) {
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

    // Reconcile used with actual approved leave requests (source of truth)
    const used = await reconcileUsed(bal, prisma);

    const joiningMonth = bal.joiningMonth || null;
    // For comp-off (accrualType 'none' with defaultBalance 0), credits come from
    // approved CompOffRequests which directly update LeaveBalance.total.
    // So use the stored total instead of recalculating from accrual formula.
    const isLOP = lt.code === 'LOP';
    const isCompOffType = lt.accrualType === 'none' && lt.defaultBalance === 0;
    const credited = isCompOffType ? (bal.total || 0) : calculateCredited(lt, fyYear, joiningMonth);
    const totalPool = (bal.opening || 0) + credited;

    // Calculate available based on probation status
    let available;
    let frozenBalance = 0;
    if (isLOP) {
      // LOP is unlimited — salary deduction, not balance-based
      available = -1; // -1 signals "unlimited" to frontend
    } else if (onProbation && bal.probationAllowance !== null && bal.probationAllowance !== undefined) {
      const usable = Math.min(bal.probationAllowance, totalPool);
      available = Math.max(usable - used, 0);
      frozenBalance = Math.max(totalPool - bal.probationAllowance - used, 0);
    } else {
      available = Math.max(totalPool - used, 0);
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
      used,
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

  // "Opening First" rule:
  // PL-type leaves consume CF.opening first, then PL credited (monthly bucket).
  // COF-type leaves consume COF.opening first, then COF credited (grants).
  // This ensures carry-forward is always drawn before current-year credits.
  const plBal  = balances.find(b => b.leaveType.code === 'PL');
  const cfBal  = balances.find(b => b.leaveType.code === 'CF');
  const cofBal = balances.find(b => b.leaveType.code === 'COF');
  const lopBal = balances.find(b => b.leaveType.code === 'LOP');

  if (plBal && cfBal) {
    const totalPLUsed  = plBal.used; // all PL-type leave requests
    const cfAbsorb     = +Math.min(totalPLUsed, cfBal.opening).toFixed(2);
    cfBal.used         = cfAbsorb;
    cfBal.available    = +(cfBal.opening - cfAbsorb).toFixed(2);

    const plNetUsed    = +(totalPLUsed - cfAbsorb).toFixed(2);
    plBal.used         = plNetUsed;
    plBal.available    = +Math.max(plBal.credited - plNetUsed, 0).toFixed(2);

    // If PL still overflows after CF is exhausted → effective LOP
    const plOverflow = +Math.max(plNetUsed - plBal.credited, 0).toFixed(2);
    if (plOverflow > 0 && lopBal) {
      lopBal.effectiveLOP = plOverflow;
    }
  }

  if (cofBal) {
    // COF: opening consumed first, then granted credits
    const totalCOFUsed = cofBal.used;
    const cofOpenAbsorb = +Math.min(totalCOFUsed, cofBal.opening).toFixed(2);
    const cofNetUsed    = +(totalCOFUsed - cofOpenAbsorb).toFixed(2);
    cofBal.available    = +Math.max(cofBal.opening - cofOpenAbsorb + cofBal.credited - cofNetUsed, 0).toFixed(2);
  }

  return balances;
}

/**
 * Apply for leave
 */
async function applyLeave(userId, data, prisma) {
  const { leaveTypeId, startDate, endDate, session, reason } = data;

  if (endDate < startDate) {
    throw new Error('End date must be on or after start date.');
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) {
    throw new Error('Invalid leave type.');
  }

  // Comp-Off future-date restriction — TEMPORARILY DISABLED for backdate leaves
  // if (leaveType.code === 'COF') {
  //   const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
  //   if (startDate < today) {
  //     throw new Error('Comp-Off balance can only be used for today or future dates.');
  //   }
  // }

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

  // Check sandwich leave setting
  const sandwichSetting = await prisma.setting.findUnique({ where: { key: 'sandwich_leave_enabled' } });
  const sandwichLeave = sandwichSetting?.value === 'true';

  const days = await calculateLeaveDays(startDate, endDate, effectiveSession, prisma, userId, { sandwichLeave });
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

  // Reconcile used from actual approved requests (source of truth)
  const actualUsed = await reconcileUsed(balance, prisma);

  const joiningMonth = balance.joiningMonth || null;

  // Bucket validation: monthly-accrual leaves can only be used from the grant start month
  // e.g. an October joiner cannot apply PL for July–September of the same FY
  if (joiningMonth && joiningMonth > 1 && leaveType.accrualType === 'monthly') {
    const grantStart = getGrantStartDate(fyYear, joiningMonth);
    if (startDate < grantStart) {
      const monthName = new Date(grantStart).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      throw new Error(
        `${leaveType.name} leave can only be applied from ${monthName} onwards (your grant start date). ` +
        `Retroactive applications before the joining month are not allowed.`
      );
    }
  }

  // For comp-off (accrualType 'none' with defaultBalance 0), credits come from
  // approved CompOffRequests which directly update LeaveBalance.total.
  // Use stored total instead of recalculating from accrual formula.
  const isCompOffType = leaveType.accrualType === 'none' && leaveType.defaultBalance === 0;
  const credited = isCompOffType ? (balance.total || 0) : calculateCredited(leaveType, fyYear, joiningMonth);
  const totalPool = (balance.opening || 0) + credited;
  const onProbation = isOnProbation(user);

  // LOP (Loss of Pay) has unlimited balance — it's a salary deduction, not balance-based
  const isLOP = leaveType.code === 'LOP';

  let available;
  if (!isLOP) {
    if (onProbation && balance.probationAllowance !== null && balance.probationAllowance !== undefined) {
      // During probation: only probationAllowance is usable
      const usable = Math.min(balance.probationAllowance, totalPool);
      available = Math.max(usable - actualUsed, 0);

      if (available < days) {
        const probEndStr = user.probationEndDate || 'confirmation';
        throw new Error(
          `You are on probation. Only ${balance.probationAllowance} ${leaveType.name} leave(s) can be used during probation. ` +
          `Available: ${available.toFixed(1)}, Requested: ${days}. ` +
          `Remaining leaves will be unlocked after ${probEndStr}.`
        );
      }
    } else {
      available = Math.max(totalPool - actualUsed, 0);
      if (available < days) {
        throw new Error(
          `Insufficient ${leaveType.name} balance. Available: ${available.toFixed(1)}, Requested: ${days}`
        );
      }
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
      user: {
        select: {
          id: true, name: true, department: true, employeeId: true,
          profilePhotoUrl: true, driveProfilePhotoUrl: true,
          reportingManager: {
            select: { id: true, name: true, designation: true, profilePhotoUrl: true, driveProfilePhotoUrl: true },
          },
        },
      },
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

  // Reconcile used values from actual approved leave requests
  const reconciled = [];
  for (const b of balances) {
    const used = await reconcileUsed(b, prisma);
    const joiningMonth = b.joiningMonth || null;
    const isCompOffType = b.leaveType.accrualType === 'none' && b.leaveType.defaultBalance === 0;
    const credited = isCompOffType ? (b.total || 0) : calculateCredited(b.leaveType, fyYear, joiningMonth);
    const onProbation = isOnProbation(b.user);
    const totalPool = (b.opening || 0) + credited;
    let available;
    if (onProbation && b.probationAllowance !== null && b.probationAllowance !== undefined) {
      available = Math.max(Math.min(b.probationAllowance, totalPool) - used, 0);
    } else {
      available = Math.max(totalPool - used, 0);
    }
    reconciled.push({
      ...b,
      used,
      credited,
      available,
      onProbation,
      fyLabel: getFYLabel(fyYear),
    });
  }

  // "Opening First" rule per user (admin view)
  const userIds = [...new Set(reconciled.map(b => b.userId))];
  for (const uid of userIds) {
    const userBals = reconciled.filter(b => b.userId === uid);
    const plBal  = userBals.find(b => b.leaveType.code === 'PL');
    const cfBal  = userBals.find(b => b.leaveType.code === 'CF');
    const cofBal = userBals.find(b => b.leaveType.code === 'COF');
    const lopBal = userBals.find(b => b.leaveType.code === 'LOP');

    if (plBal && cfBal) {
      const totalPLUsed = plBal.used;
      const cfAbsorb    = +Math.min(totalPLUsed, cfBal.opening).toFixed(2);
      cfBal.used        = cfAbsorb;
      cfBal.available   = +(cfBal.opening - cfAbsorb).toFixed(2);
      const plNetUsed   = +(totalPLUsed - cfAbsorb).toFixed(2);
      plBal.used        = plNetUsed;
      plBal.available   = +Math.max(plBal.credited - plNetUsed, 0).toFixed(2);
      const plOverflow  = +Math.max(plNetUsed - plBal.credited, 0).toFixed(2);
      if (plOverflow > 0 && lopBal) lopBal.effectiveLOP = plOverflow;
    }

    if (cofBal) {
      const totalCOFUsed  = cofBal.used;
      const cofOpenAbsorb = +Math.min(totalCOFUsed, cofBal.opening).toFixed(2);
      const cofNetUsed    = +(totalCOFUsed - cofOpenAbsorb).toFixed(2);
      cofBal.available    = +Math.max(cofBal.opening - cofOpenAbsorb + cofBal.credited - cofNetUsed, 0).toFixed(2);
    }
  }

  return reconciled;
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
  // Always recalculate used from actual approved requests (source of truth)
  const actualUsed = await calculateUsedFromRequests(userId, leaveTypeId, fyYear, prisma);
  if (balance) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        total: totalGranted,
        used: actualUsed,
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
        used: actualUsed,
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
 * Admin: Update a leave grant (edit)
 */
async function updateLeaveGrant(adminId, grantId, data, prisma) {
  const grant = await prisma.leaveGranter.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error('Grant not found.');
  if (grant.isLocked) throw new Error('This grant is locked for payroll. Unlock it first to make changes.');

  const { totalGranted, probationAllowance, joiningMonth, notes } = data;
  const effectiveProbation = probationAllowance !== null && probationAllowance !== undefined ? probationAllowance : 0;

  const updated = await prisma.leaveGranter.update({
    where: { id: grantId },
    data: {
      totalGranted,
      probationAllowance: effectiveProbation,
      joiningMonth: joiningMonth || null,
      notes: notes || null,
      grantedBy: adminId,
      grantedAt: new Date(),
    },
    include: {
      user: { select: { name: true, employeeId: true } },
      leaveType: { select: { name: true, code: true } },
      granter: { select: { name: true } },
    },
  });

  // Update the corresponding LeaveBalance
  const balanceProbation = probationAllowance !== null && probationAllowance !== undefined ? probationAllowance : null;
  const balance = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId: grant.userId, leaveTypeId: grant.leaveTypeId, year: grant.fyYear } },
  });
  if (balance) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: {
        total: totalGranted,
        probationAllowance: balanceProbation,
        joiningMonth: joiningMonth || null,
      },
    });
  }

  return updated;
}

/**
 * Admin: Toggle lock/unlock on a leave grant (for payroll)
 */
async function toggleGrantLock(grantId, prisma) {
  const grant = await prisma.leaveGranter.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error('Grant not found.');

  const updated = await prisma.leaveGranter.update({
    where: { id: grantId },
    data: { isLocked: !grant.isLocked },
  });
  return { id: updated.id, isLocked: updated.isLocked, message: updated.isLocked ? 'Grant locked for payroll.' : 'Grant unlocked.' };
}

/**
 * Admin: Delete a leave grant
 */
async function deleteLeaveGrant(grantId, prisma) {
  const grant = await prisma.leaveGranter.findUnique({ where: { id: grantId } });
  if (!grant) throw new Error('Grant not found.');
  if (grant.isLocked) throw new Error('This grant is locked for payroll. Unlock it first to delete.');

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

/**
 * Execute FY rollover: carry forward unused leaves to next FY
 * For each active user + each carry-forward-enabled leave type:
 *   - Calculate current FY available = opening + credited(full year 12 months) - used
 *   - Cap carry = min(available, maxCarryForward)
 *   - Upsert next FY's LeaveBalance with opening = carry amount
 * Returns summary array
 */
async function executeFYRollover(fyYear, prisma) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employeeId: true },
  });

  const nextFY = fyYear + 1;
  const summary = [];

  // Identify special leave types
  const cfLeaveType = leaveTypes.find(lt => lt.code === 'CF');
  const cofLeaveType = leaveTypes.find(lt => lt.code === 'COF');
  const plLeaveType = leaveTypes.find(lt => lt.code === 'PL');

  for (const user of users) {
    // ── Per-user: collect carry amounts before upserting ──
    let plCarry = 0;  // → goes to CF.opening
    let cofCarry = 0; // → goes to COF.opening

    for (const lt of leaveTypes) {
      // CF opening is derived from PL carry — skip it in main loop
      if (cfLeaveType && lt.id === cfLeaveType.id) continue;

      const balance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: fyYear } },
      });
      if (!balance) continue;

      const actualUsed = await calculateUsedFromRequests(user.id, lt.id, fyYear, prisma);
      const joiningMonth = balance.joiningMonth || null;
      const isCompOffType = lt.accrualType === 'none' && lt.defaultBalance === 0;
      const credited = isCompOffType ? (balance.total || 0) : calculateCredited(lt, fyYear, joiningMonth);
      const available = Math.max((balance.opening || 0) + credited - actualUsed, 0);

      let carryAmount = 0;
      let lapsed = 0;
      let nextOpening = 0;
      let nextTotal = lt.defaultBalance;

      if (lt.code === 'PL') {
        // PL raw available stored; combined carry with COF calculated after loop
        plCarry = available;
        carryAmount = 0; // actual carry assigned after COF is known
        lapsed = 0;      // assigned after loop
        nextOpening = 0; // PL opening is always 0 for next FY
        nextTotal = lt.defaultBalance;
      } else if (lt.code === 'COF') {
        // COF raw available stored; combined carry with PL calculated after loop
        // COF resets to 0 next FY — combined carry goes to CF.opening
        cofCarry = available;
        carryAmount = 0;
        lapsed = 0;      // assigned after loop
        nextOpening = 0; // COF resets to 0; new grants earned fresh via requests
        nextTotal = 0;
      } else if (lt.carryForward && lt.maxCarryForward > 0) {
        carryAmount = Math.min(available, lt.maxCarryForward);
        lapsed = Math.max(available - lt.maxCarryForward, 0);
        nextOpening = carryAmount;
        nextTotal = lt.defaultBalance;
      } else {
        lapsed = available;
        nextOpening = 0;
        nextTotal = lt.defaultBalance;
      }

      // Upsert next FY balance for this leave type
      const existing = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: nextFY } },
      });
      const grant = await prisma.leaveGranter.findUnique({
        where: { userId_leaveTypeId_fyYear: { userId: user.id, leaveTypeId: lt.id, fyYear: nextFY } },
      });
      const grantedTotal = grant ? grant.totalGranted : nextTotal;

      if (existing) {
        await prisma.leaveBalance.update({
          where: { id: existing.id },
          data: { opening: nextOpening, total: grantedTotal, used: 0 },
        });
      } else {
        await prisma.leaveBalance.create({
          data: {
            userId: user.id,
            leaveTypeId: lt.id,
            year: nextFY,
            opening: nextOpening,
            total: grantedTotal,
            used: 0,
            balance: nextOpening + grantedTotal,
            probationAllowance: grant ? grant.probationAllowance : null,
            joiningMonth: grant ? grant.joiningMonth : null,
          },
        });
      }

      if (carryAmount > 0 || lapsed > 0) {
        summary.push({
          userId: user.id,
          userName: user.name,
          employeeId: user.employeeId,
          leaveType: lt.name,
          leaveTypeCode: lt.code,
          prevBalance: available,
          carryForward: carryAmount,
          lapsed,
        });
      }
    }

    // ── Combined PL+COF carry forward — PL has priority ──
    // Policy: PL fills the cap first, COF takes whatever slots remain.
    // e.g. PL=4, COF=3, cap=6 → PL carries 4, COF carries 2 (1 lapsed)
    // e.g. PL=3, COF=3, cap=6 → PL carries 3, COF carries 3 (all carry)
    // e.g. PL=6, COF=3, cap=6 → PL carries 6, COF carries 0 (all lapsed)
    const maxCF = plLeaveType?.maxCarryForward || 6;
    const plForward  = Math.min(plCarry, maxCF);
    const remaining  = Math.max(maxCF - plForward, 0);
    const cofForward = Math.min(cofCarry, remaining);
    const combinedCarry  = plForward + cofForward;
    const combinedLapsed = Math.max((plCarry - plForward) + (cofCarry - cofForward), 0);
    const combinedAvailable = plCarry + cofCarry;

    // ── Now upsert CF balance with combined carry as opening ──
    if (cfLeaveType) {
      const existingCF = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: cfLeaveType.id, year: nextFY } },
      });
      if (existingCF) {
        await prisma.leaveBalance.update({
          where: { id: existingCF.id },
          data: { opening: combinedCarry, total: 0, used: 0 },
        });
      } else {
        await prisma.leaveBalance.create({
          data: {
            userId: user.id,
            leaveTypeId: cfLeaveType.id,
            year: nextFY,
            opening: combinedCarry,
            total: 0,
            used: 0,
            balance: combinedCarry,
          },
        });
      }
      if (combinedCarry > 0) {
        summary.push({
          userId: user.id,
          userName: user.name,
          employeeId: user.employeeId,
          leaveType: cfLeaveType.name,
          leaveTypeCode: 'CF',
          prevBalance: combinedAvailable,
          carryForward: combinedCarry,
          lapsed: combinedLapsed,
          note: `PL(${plCarry}) + COF(${cofCarry}) carry-forward, capped at ${maxCF}`,
        });
      }
    }
  }

  return summary;
}

/**
 * Preview FY rollover without executing — shows what would happen
 */
async function previewFYRollover(fyYear, prisma) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employeeId: true },
  });

  const plLeaveType = leaveTypes.find(lt => lt.code === 'PL');
  const cfLeaveType  = leaveTypes.find(lt => lt.code === 'CF');
  const preview = [];

  for (const user of users) {
    let plAvail = 0;
    let cofAvail = 0;

    for (const lt of leaveTypes) {
      if (cfLeaveType && lt.id === cfLeaveType.id) continue; // CF handled separately

      const balance = await prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: lt.id, year: fyYear } },
      });
      if (!balance) continue;

      const actualUsed = await calculateUsedFromRequests(user.id, lt.id, fyYear, prisma);
      const joiningMonth = balance.joiningMonth || null;
      const isCompOffType = lt.accrualType === 'none' && lt.defaultBalance === 0;
      const credited = isCompOffType ? (balance.total || 0) : calculateCredited(lt, fyYear, joiningMonth);
      const available = Math.max((balance.opening || 0) + credited - actualUsed, 0);

      if (lt.code === 'PL') {
        plAvail = available;
      } else if (lt.code === 'COF') {
        cofAvail = available;
      } else if (available > 0) {
        const carryAmount = lt.carryForward && lt.maxCarryForward > 0 ? Math.min(available, lt.maxCarryForward) : 0;
        const lapsed = Math.max(available - carryAmount, 0);
        preview.push({
          userId: user.id, userName: user.name, employeeId: user.employeeId,
          leaveType: lt.name, leaveTypeCode: lt.code,
          carryForwardEnabled: lt.carryForward, maxCarryForward: lt.maxCarryForward || 0,
          currentAvailable: available, willCarry: carryAmount, willLapse: lapsed,
        });
      }
    }

    // Combined PL+COF carry forward — PL has priority
    const maxCF = plLeaveType?.maxCarryForward || 6;
    const plFwd   = Math.min(plAvail, maxCF);
    const rem     = Math.max(maxCF - plFwd, 0);
    const cofFwd  = Math.min(cofAvail, rem);
    const combinedCarry  = plFwd + cofFwd;
    const combinedLapsed = Math.max((plAvail - plFwd) + (cofAvail - cofFwd), 0);
    const combinedAvail  = plAvail + cofAvail;
    if (combinedAvail > 0) {
      preview.push({
        userId: user.id, userName: user.name, employeeId: user.employeeId,
        leaveType: 'PL + COF (Combined)', leaveTypeCode: 'CF',
        carryForwardEnabled: true, maxCarryForward: maxCF,
        currentAvailable: combinedAvail,
        willCarry: combinedCarry, willLapse: combinedLapsed,
        note: `PL(${plAvail})→${plFwd} + COF(${cofAvail})→${cofFwd}, cap=${maxCF}`,
      });
    }
  }

  return preview;
}

module.exports = {
  getFinancialYear,
  getFYRange,
  getFYLabel,
  getMonthsElapsed,
  calculateCredited,
  calculateLeaveDays,
  calculateUsedFromRequests,
  reconcileUsed,
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
  updateLeaveGrant,
  toggleGrantLock,
  getLeaveGrants,
  deleteLeaveGrant,
  isOnProbation,
  calendarToFYMonth,
  executeFYRollover,
  previewFYRollover,
};
