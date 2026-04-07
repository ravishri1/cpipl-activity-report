// ═══════════════════════════════════════════════
// Attendance Service — Check-in/out, monthly summary, team view
// ═══════════════════════════════════════════════

const { getUserWeeklyOffDays, getWeeklyOffMap, DEFAULT_OFF_DAYS } = require('./weeklyOffHelper');

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check-in for a user — creates an Attendance record for today
 */
async function checkIn(userId, ipAddress, notes, workType, workLocation, source, prisma) {
  const today = getTodayDate();

  // Check if already checked in today
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing && existing.checkIn) {
    throw new Error('Already checked in today.');
  }

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    update: {
      checkIn: new Date(),
      status: 'present',
      ipAddress: ipAddress || null,
      notes: notes || null,
      checkInSource: source || null,
      workType: workType || null,
      workLocation: workLocation || null,
    },
    create: {
      userId,
      date: today,
      checkIn: new Date(),
      status: 'present',
      ipAddress: ipAddress || null,
      notes: notes || null,
      checkInSource: source || null,
      workType: workType || null,
      workLocation: workLocation || null,
    },
  });

  return record;
}

/**
 * Check-out for a user — update today's record with checkOut time and compute workHours
 */
async function checkOut(userId, prisma) {
  const today = getTodayDate();

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (!existing || !existing.checkIn) {
    throw new Error('You must check in first before checking out.');
  }

  if (existing.checkOut) {
    throw new Error('Already checked out today.');
  }

  const checkOutTime = new Date();
  const workHours = (checkOutTime.getTime() - existing.checkIn.getTime()) / 3600000; // ms to hours

  const record = await prisma.attendance.update({
    where: { userId_date: { userId, date: today } },
    data: {
      checkOut: checkOutTime,
      workHours: Math.round(workHours * 100) / 100, // 2 decimal places
    },
  });

  return record;
}

/**
 * Get today's attendance record for a user
 */
async function getTodayAttendance(userId, prisma) {
  const today = getTodayDate();
  return prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });
}

/**
 * Get monthly attendance summary for a user
 * @param {string} month - "YYYY-MM" format
 */
async function getMonthlyAttendance(userId, month, prisma) {
  const startDate = `${month}-01`;
  // Calculate last day of month
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const records = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });

  // Calculate summary stats
  const summary = {
    present: 0,
    absent: 0,
    halfDay: 0,
    onLeave: 0,
    holiday: 0,
    weekend: 0,
    totalWorkHours: 0,
    avgWorkHours: 0,           // avg office time per day (checkIn→checkOut, includes breaks)
    avgActualWorkHours: 0,     // avg actual work per day (minus breaks)
  };

  let totalOfficeHrs = 0;
  let totalActualHrs = 0;
  const BREAK_HRS = 1;

  for (const r of records) {
    if (r.status === 'present') summary.present++;
    else if (r.status === 'absent') summary.absent++;
    else if (r.status === 'half_day') summary.halfDay++;
    else if (r.status === 'on_leave') summary.onLeave++;
    else if (r.status === 'holiday') summary.holiday++;
    else if (r.status === 'weekend') summary.weekend++;
    if (r.workHours) summary.totalWorkHours += r.workHours;
    if (r.checkIn && r.checkOut) {
      const officeHrs = (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 3600000;
      totalOfficeHrs += officeHrs;
      totalActualHrs += r.workHours > 0 ? r.workHours : Math.max(0, officeHrs - BREAK_HRS);
    }
  }

  const workedDays = records.filter((r) => r.workHours > 0 || (r.checkIn && r.checkOut)).length;
  summary.avgWorkHours = workedDays > 0 ? Math.round((totalOfficeHrs / workedDays) * 100) / 100 : 0;
  summary.avgActualWorkHours = workedDays > 0 ? Math.round((totalActualHrs / workedDays) * 100) / 100 : 0;

  return { records, summary };
}

/**
 * Get team attendance for a specific date (admin/team_lead)
 * @param {string} date - "YYYY-MM-DD"
 * @param {string|null} department - filter by department (for team_leads)
 */
async function getTeamAttendance(date, department, prisma) {
  const userWhere = { isActive: true };
  if (department) userWhere.department = department;

  // Use IST date for "today" — Vercel runs in UTC
  const nowIST = new Date(Date.now() + 330 * 60 * 1000);
  const today = nowIST.toISOString().split('T')[0];

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, department: true, employeeId: true, profilePhotoUrl: true,
      attendances: {
        where: { date },
        take: 1,
      },
      shiftAssignments: {
        where: {
          status: 'active',
          effectiveFrom: { lte: today },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: today } }
          ]
        },
        take: 1,
        select: {
          shift: {
            select: {
              id: true,
              name: true,
              startTime: true,
              endTime: true,
              breakDuration: true,
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' },
  });

  const result = users.map((u) => {
    const att = u.attendances[0] || null;
    const shiftAssignment = u.shiftAssignments[0];
    const shift = shiftAssignment?.shift || null;
    return {
      userId: u.id,
      name: u.name,
      department: u.department,
      employeeId: u.employeeId,
      profilePhotoUrl: u.profilePhotoUrl,
      checkIn: att?.checkIn || null,
      checkOut: att?.checkOut || null,
      workHours: att?.workHours || null,
      status: att?.status || 'absent',
      shift: shift ? {
        id: shift.id,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakDuration: shift.breakDuration,
      } : null,
    };
  });

  const summary = {
    total: result.length,
    present: result.filter((r) => r.status === 'present').length,
    absent: result.filter((r) => r.status === 'absent').length,
    onLeave: result.filter((r) => r.status === 'on_leave').length,
  };

  return { employees: result, summary };
}

/**
 * Get team attendance aggregated over a date range (admin/team_lead)
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {string} endDate - "YYYY-MM-DD"
 * @param {string|null} department
 */
async function getTeamAttendanceRange(startDate, endDate, department, prisma) {
  const userWhere = { isActive: true };
  if (department) userWhere.department = department;

  // Fetch holidays in range (location-based)
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  // Build per-location holiday sets for location-aware checking
  const allHolidaySet = new Set(holidays.filter(h => h.location === 'All').map(h => h.date));
  const locationHolidayMap = {};
  holidays.forEach(h => {
    if (h.location && h.location !== 'All') {
      if (!locationHolidayMap[h.location]) locationHolidayMap[h.location] = new Set();
      locationHolidayMap[h.location].add(h.date);
    }
  });
  // Helper: check if a date is a holiday for a user's location
  const isHolidayForUser = (date, userLocation) => {
    if (allHolidaySet.has(date)) return true;
    if (userLocation && locationHolidayMap[userLocation]?.has(date)) return true;
    return false;
  };
  // Legacy: flat set for backward compat (union of all locations)
  const holidaySet = new Set(holidays.map(h => h.date));

  const [users, attendances, leaves] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, department: true, employeeId: true, profilePhotoUrl: true },
      orderBy: { name: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { userId: true, date: true, status: true, workHours: true, checkIn: true, checkOut: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { userId: true, startDate: true, endDate: true, days: true },
    }),
  ]);

  // Batch-fetch weekly off patterns for all users
  const weeklyOffMap = await getWeeklyOffMap(users.map(u => u.id), prisma);

  // Build attendance map: userId → array of records
  const attByUser = {};
  for (const a of attendances) {
    if (!attByUser[a.userId]) attByUser[a.userId] = [];
    attByUser[a.userId].push(a);
  }

  // Build leave days per user (using per-user weekly off)
  const leaveByUser = {};
  for (const lr of leaves) {
    if (!leaveByUser[lr.userId]) leaveByUser[lr.userId] = 0;
    const offDays = weeklyOffMap.get(lr.userId) || DEFAULT_OFF_DAYS;
    let ld = new Date(Math.max(new Date(lr.startDate + 'T00:00:00'), new Date(startDate + 'T00:00:00')));
    const le = new Date(Math.min(new Date(lr.endDate + 'T00:00:00'), new Date(endDate + 'T00:00:00')));
    while (ld <= le) {
      const dow = ld.getDay();
      if (!offDays.includes(dow)) leaveByUser[lr.userId]++;
      ld.setDate(ld.getDate() + 1);
    }
  }

  const employees = users.map(u => {
    const offDays = weeklyOffMap.get(u.id) || DEFAULT_OFF_DAYS;
    const records = attByUser[u.id] || [];
    const presentDays = records.filter(r => r.status === 'present').length;
    const halfDays = records.filter(r => r.status === 'half_day').length;
    const totalHours = records.reduce((s, r) => s + (r.workHours || 0), 0);
    const leaveDays = leaveByUser[u.id] || 0;

    // Count working days for this user (based on their weekly off pattern)
    let userWorkingDays = 0;
    let d = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (d <= end) {
      const dow = d.getDay();
      if (!offDays.includes(dow)) userWorkingDays++;
      d.setDate(d.getDate() + 1);
    }

    // Holiday weekdays for this user
    const holidayWeekdays = holidays.filter(h => {
      const hd = new Date(h.date + 'T00:00:00').getDay();
      return !offDays.includes(hd);
    }).length;
    const effectiveWorkDays = userWorkingDays - holidayWeekdays;
    const absentDays = Math.max(0, effectiveWorkDays - presentDays - halfDays - leaveDays);
    const avgHours = presentDays + halfDays > 0 ? totalHours / (presentDays + halfDays) : 0;

    return {
      userId: u.id,
      name: u.name,
      department: u.department,
      employeeId: u.employeeId,
      profilePhotoUrl: u.profilePhotoUrl,
      presentDays,
      halfDays,
      absentDays,
      leaveDays,
      totalHours: Math.round(totalHours * 100) / 100,
      avgHours: Math.round(avgHours * 100) / 100,
    };
  });

  // Use default off days for summary (aggregate view)
  let defaultWorkingDays = 0;
  let d2 = new Date(startDate + 'T00:00:00');
  const end2 = new Date(endDate + 'T00:00:00');
  while (d2 <= end2) {
    if (!DEFAULT_OFF_DAYS.includes(d2.getDay())) defaultWorkingDays++;
    d2.setDate(d2.getDate() + 1);
  }

  const summary = {
    total: employees.length,
    workingDays: defaultWorkingDays - holidays.filter(h => { const hd = new Date(h.date + 'T00:00:00').getDay(); return !DEFAULT_OFF_DAYS.includes(hd); }).length,
    holidays: holidays.length,
    startDate,
    endDate,
  };

  return { employees, summary };
}

/**
 * Get employee calendar view — monthly grid with attendance, holidays, leaves, biometric punches
 * Now includes late mark detection, short hours, and regularization status
 * @param {number} userId
 * @param {string} month - "YYYY-MM" format
 */
async function getEmployeeCalendar(userId, month, prisma) {
  const GRACE_MINUTES = 15;

  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  // Use IST date for "today" — Vercel runs in UTC, so toISOString() gives UTC date
  const nowIST = new Date(Date.now() + 330 * 60 * 1000); // UTC + 5:30
  const today = nowIST.toISOString().split('T')[0];

  // Fetch user's weekly off pattern
  const userOffDays = await getUserWeeklyOffDays(userId, prisma);

  const [user, attendances, holidays, leaves, punches, shiftAssignment, regularizations] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, employeeId: true, isAttendanceExempt: true } }),
    prisma.attendance.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'approved',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: { leaveType: { select: { name: true, code: true } } },
    }),
    prisma.biometricPunch.findMany({
      where: { userId, punchDate: { gte: startDate, lte: endDate }, matchStatus: 'matched' },
      orderBy: { punchTime: 'asc' },
      include: { device: { select: { name: true, location: true } } },
    }),
    prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      include: { shift: true },
    }),
    prisma.attendanceRegularization.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      include: { reviewer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Build lookup maps
  const attendanceMap = {};
  for (const a of attendances) attendanceMap[a.date] = a;

  const holidayMap = {};
  for (const h of holidays) holidayMap[h.date] = h;

  const punchesByDate = {};
  for (const p of punches) {
    if (!punchesByDate[p.punchDate]) punchesByDate[p.punchDate] = [];
    punchesByDate[p.punchDate].push({
      time: p.punchTime,
      direction: p.direction,
      device: p.device?.name || p.deviceSerial,
      location: p.device?.location || null,
    });
  }

  // Build regularization map (latest per date)
  const regularizationMap = {};
  for (const r of regularizations) {
    // regularizations are ordered by createdAt desc, so first one per date is the latest
    if (!regularizationMap[r.date]) regularizationMap[r.date] = r;
  }

  // Build leave date set from approved leave ranges
  const leaveDates = {};
  for (const lr of leaves) {
    let d = new Date(lr.startDate + 'T00:00:00');
    const end = new Date(lr.endDate + 'T00:00:00');
    while (d <= end) {
      const ds = d.toISOString().split('T')[0];
      if (ds >= startDate && ds <= endDate) {
        leaveDates[ds] = { type: lr.leaveType?.code || 'L', name: lr.leaveType?.name || 'Leave' };
      }
      d.setDate(d.getDate() + 1);
    }
  }

  const shift = shiftAssignment?.shift;
  const shiftStartMin = shift ? parseTimeToMinutes(shift.startTime) : null;
  const shiftEndMin = shift ? parseTimeToMinutes(shift.endTime) : null;
  // Required total hours = shift duration (e.g., 10:15-19:00 = 8.75h)
  const shiftDurationHrs = (shiftStartMin != null && shiftEndMin != null) ? (shiftEndMin - shiftStartMin) / 60 : 0;

  // Build calendar days array
  const days = [];
  let lateMarksCount = 0;
  let regularizedDaysCount = 0;
  let shortHoursDaysCount = 0;

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
    const isWeekend = userOffDays.includes(dayOfWeek);
    const att = attendanceMap[dateStr];
    const holiday = holidayMap[dateStr];
    const leave = leaveDates[dateStr];
    const dayPunches = punchesByDate[dateStr] || [];
    const reg = regularizationMap[dateStr] || null;

    let status = 'absent';
    let statusLabel = 'A';
    if (holiday) { status = 'holiday'; statusLabel = 'H'; }
    else if (isWeekend) { status = 'weekend'; statusLabel = 'W'; }
    else if (leave) { status = 'on_leave'; statusLabel = leave.type; }

    // Attendance record overrides
    if (att) {
      if (att.status === 'present') { status = 'present'; statusLabel = 'P'; }
      else if (att.status === 'half_day') { status = 'half_day'; statusLabel = 'HD'; }
      else if (att.status === 'on_leave') { status = 'on_leave'; statusLabel = leave?.type || 'L'; }
      else if (att.status === 'holiday') { status = 'holiday'; statusLabel = 'H'; }
      else if (att.status === 'weekend') { status = 'weekend'; statusLabel = 'W'; }
    }

    // Future dates — no status yet
    const isFuture = dateStr > today;
    if (isFuture && !holiday && !isWeekend && !leave) {
      status = 'future';
      statusLabel = '-';
    }

    // Calculate late-in / early-out based on shift timing
    let lateIn = null;
    let earlyOut = null;
    let lateInMinutes = 0;
    let earlyOutMinutes = 0;
    // Total work hours = simple diff between first in and last out (ignoring rules)
    // Skip for today — day is not yet complete, would show misleading hours
    let totalWorkHrsRaw = 0;
    if (att?.checkIn && att?.checkOut && dateStr !== today) {
      const ciMs = new Date(att.checkIn).getTime();
      const coMs = new Date(att.checkOut).getTime();
      totalWorkHrsRaw = Math.max(0, (coMs - ciMs) / (1000 * 60 * 60));
    }
    if (shift && att?.checkIn) {
      const ciMinutes = toISTMinutes(att.checkIn);
      // Subtract 15-min grace from Late In display (grace is company's internal allowance)
      lateInMinutes = Math.max(0, ciMinutes - shiftStartMin - GRACE_MINUTES);
      if (lateInMinutes > 0) {
        lateIn = `${String(Math.floor(lateInMinutes / 60)).padStart(2, '0')}:${String(lateInMinutes % 60).padStart(2, '0')}`;
      }
    }
    if (shift && att?.checkOut && dateStr !== today) {
      // Skip early-out calculation for today — day is not yet complete
      const shiftEndMin = parseTimeToMinutes(shift.endTime);
      const coMinutes = toISTMinutes(att.checkOut);
      earlyOutMinutes = Math.max(0, shiftEndMin - coMinutes);
      if (earlyOutMinutes > 0) {
        earlyOut = `${String(Math.floor(earlyOutMinutes / 60)).padStart(2, '0')}:${String(earlyOutMinutes % 60).padStart(2, '0')}`;
      }
    }

    // Policy enforcement: late mark detection (15-min grace)
    // Attendance-exempt users bypass ALL policy rules (always Present, no late marks, no regularization)
    const isExempt = user?.isAttendanceExempt === true;
    let isLate = false;
    let lateMinutes = 0;
    let shortHours = false;
    let needsRegularization = false;
    let regularizationStatus = reg?.status || null;

    // Only compute for non-future, non-weekend, non-holiday, non-leave working days
    const isWorkingDay = !isFuture && !isWeekend && !holiday && !leave;

    if (!isExempt && isWorkingDay && shift && att?.checkIn) {
      const ciMinutes = toISTMinutes(att.checkIn);
      isLate = ciMinutes > shiftStartMin + GRACE_MINUTES;
      // Late minutes = time beyond grace period (grace is company's internal allowance)
      lateMinutes = isLate ? Math.max(0, ciMinutes - shiftStartMin - GRACE_MINUTES) : 0;
    }

    if (!isExempt && isWorkingDay && (status === 'present' || status === 'half_day') && att?.checkIn && att?.checkOut && dateStr !== today && shiftDurationHrs > 0) {
      // Use total time at office (checkOut - checkIn), NOT stored workHours (which may be biometric actual work)
      // Compare against shift duration (e.g., 8.75h for 10:15-19:00)
      const totalTimeAtOffice = (new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60);
      shortHours = totalTimeAtOffice < shiftDurationHrs;
    }

    if (!isExempt && isWorkingDay && (isLate || shortHours) && dateStr !== today) {
      // Needs regularization if no approved regularization exists
      // Skip today — day is not yet complete
      needsRegularization = !reg || reg.status !== 'approved';
    }

    // Count summary metrics (skip today — day not yet complete)
    if (isLate && dateStr !== today) lateMarksCount++;
    if (reg?.status === 'approved') regularizedDaysCount++;
    if (shortHours && dateStr !== today) shortHoursDaysCount++;

    days.push({
      date: dateStr,
      day,
      dayOfWeek,
      status,
      statusLabel,
      holidayName: holiday?.name || null,
      leaveName: leave?.name || null,
      checkIn: att?.checkIn || null,
      checkOut: att?.checkOut || null,
      workHours: att?.workHours || null,
      totalWorkHrsRaw,          // First In to Last Out (simple diff, no rules)
      notes: att?.notes || null,
      checkInSource: att?.checkInSource || null,
      workType: att?.workType || null,
      workLocation: att?.workLocation || null,
      lateIn,
      lateInMinutes,            // raw minutes late from shift start
      earlyOut,
      earlyOutMinutes,          // raw minutes early from shift end
      punches: dayPunches,
      // Policy enforcement fields
      isLate,
      lateMinutes,
      shortHours,
      needsRegularization,
      regularizationStatus,
      regularization: reg ? {
        id: reg.id,
        status: reg.status,
        reason: reg.reason,
        requestedIn: reg.requestedIn,
        requestedOut: reg.requestedOut,
        reviewNote: reg.reviewNote,
        reviewerName: reg.reviewer?.name || null,
        reviewedAt: reg.reviewedAt,
        createdAt: reg.createdAt,
      } : null,
    });
  }

  // Count unregularized late marks (late AND no approved regularization)
  const unregularizedLateMarks = days.filter(d => d.isLate && (!d.regularizationStatus || d.regularizationStatus !== 'approved')).length;

  // Avg Work Hrs = avg office time per day (includes breaks)
  // Avg Actual Work Hrs = avg actual work per day (minus breaks)
  const BREAK_HRS = 1;
  const workedDays = days.filter(d => (d.workHours || 0) > 0 || (d.totalWorkHrsRaw || 0) > 0);
  const totalOfficeHrs = workedDays.reduce((sum, d) => sum + (d.totalWorkHrsRaw || 0), 0);
  const totalActualHrs = workedDays.reduce((sum, d) => {
    if ((d.workHours || 0) > 0) return sum + d.workHours;
    if ((d.totalWorkHrsRaw || 0) > 0) return sum + Math.max(0, d.totalWorkHrsRaw - BREAK_HRS);
    return sum;
  }, 0);

  const summary = {
    present: days.filter(d => d.status === 'present').length,
    absent: days.filter(d => d.status === 'absent').length,
    halfDay: days.filter(d => d.status === 'half_day').length,
    onLeave: days.filter(d => d.status === 'on_leave').length,
    holiday: days.filter(d => d.status === 'holiday').length,
    weekend: days.filter(d => d.status === 'weekend').length,
    totalWorkHours: Math.round(totalActualHrs * 100) / 100,
    avgWorkHours: workedDays.length > 0 ? Math.round((totalOfficeHrs / workedDays.length) * 100) / 100 : 0,
    avgActualWorkHours: workedDays.length > 0 ? Math.round((totalActualHrs / workedDays.length) * 100) / 100 : 0,
    // Policy enforcement summary
    lateMarks: lateMarksCount,
    regularizedDays: regularizedDaysCount,
    shortHoursDays: shortHoursDaysCount,
    halfDayDeductions: Math.floor(unregularizedLateMarks / 3),
  };

  return {
    employeeName: user?.name || null,
    employeeId: user?.employeeId || null,
    isAttendanceExempt: user?.isAttendanceExempt || false,
    days,
    summary,
    shift: shiftAssignment?.shift || null,
    month,
    year,
  };
}

/**
 * Convert a DateTime to IST minutes since midnight.
 * Vercel serverless runs in UTC, shift times are in IST — must convert.
 */
function toISTMinutes(dt) {
  const d = new Date(dt);
  // IST = UTC + 5:30
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utcMin + 330) % 1440; // 330 = 5h30m in minutes
}

/**
 * Parse "HH:MM" time string to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Get late marks summary for a user in a given month
 * Used for policy enforcement: 3 late marks = 1 half day deduction
 * @param {number} userId
 * @param {string} month - "YYYY-MM" format
 * @param {object} prisma
 */
async function getLateMarksSummary(userId, month, prisma) {
  const GRACE_MINUTES = 15;
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  // Use IST date for "today" — Vercel runs in UTC
  const nowIST = new Date(Date.now() + 330 * 60 * 1000);
  const today = nowIST.toISOString().split('T')[0];

  // Attendance-exempt users have zero late marks
  const exemptUser = await prisma.user.findUnique({ where: { id: userId }, select: { isAttendanceExempt: true } });
  if (exemptUser?.isAttendanceExempt) {
    return { lateMarks: [], totalLateMarks: 0, regularizedCount: 0, unregularizedCount: 0, halfDayDeductions: 0, month };
  }

  // Fetch user's weekly off pattern
  const lateUserOffDays = await getUserWeeklyOffDays(userId, prisma);

  const [attendances, holidays, shiftAssignment, regularizations, bioPunches] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    }),
    prisma.shiftAssignment.findFirst({
      where: {
        userId,
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      include: { shift: true },
    }),
    prisma.attendanceRegularization.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.biometricPunch.findMany({
      where: { userId, punchDate: { gte: startDate, lte: endDate }, matchStatus: 'matched' },
      orderBy: { punchTime: 'asc' },
    }),
  ]);

  // Group punches by date
  const punchesByDate = {};
  for (const p of bioPunches) {
    if (!punchesByDate[p.punchDate]) punchesByDate[p.punchDate] = [];
    punchesByDate[p.punchDate].push(p);
  }

  const shift = shiftAssignment?.shift;
  if (!shift) {
    return {
      lateMarks: [],
      totalLateMarks: 0,
      regularizedCount: 0,
      unregularizedCount: 0,
      halfDayDeductions: 0,
      month,
    };
  }

  const shiftStartMin = parseTimeToMinutes(shift.startTime);
  const holidaySet = new Set(holidays.map(h => h.date));

  // Build regularization map keyed by date+time range (multiple per date possible)
  const regMap = {};
  for (const r of regularizations) {
    const key = `${r.date}|${r.requestedIn || ''}|${r.requestedOut || ''}`;
    if (!regMap[key]) regMap[key] = r;
    // Also keep a date-only fallback for legacy entries (requestedIn = shift start)
    if (!regMap[r.date]) regMap[r.date] = r;
  }

  const lateMarks = [];
  let regularizedCount = 0;

  for (const att of attendances) {
    if (!att.checkIn) continue;
    if (att.date > today) continue; // skip future

    // Skip weekly off days
    const dateObj = new Date(att.date + 'T00:00:00');
    const dow = dateObj.getDay();
    if (lateUserOffDays.includes(dow)) continue;

    // Skip holidays
    if (holidaySet.has(att.date)) continue;

    const ciMinutes = toISTMinutes(att.checkIn);
    const rawLateMinutes = ciMinutes - shiftStartMin;

    if (rawLateMinutes > GRACE_MINUTES) {
      // Late minutes = time beyond grace period (grace is company's internal allowance)
      const lateMinutes = rawLateMinutes - GRACE_MINUTES;

      // Grace-end to check-in (late arrival period)
      const graceEndMin = shiftStartMin + GRACE_MINUTES;
      const graceEndStr = `${String(Math.floor(graceEndMin / 60)).padStart(2, '0')}:${String(graceEndMin % 60).padStart(2, '0')}`;
      const checkInStr = att.checkIn ? (() => { const d = new Date(att.checkIn); const h = d.getUTCHours() * 60 + d.getUTCMinutes() + 330; return `${String(Math.floor((h % 1440) / 60)).padStart(2, '0')}:${String((h % 1440) % 60).padStart(2, '0')}`; })() : null;

      // Build all missing periods as separate items (like greytHR)
      const periods = [];

      // Period 1: Late arrival
      if (checkInStr) {
        const lateKey = `${att.date}|${graceEndStr}|${checkInStr}`;
        const lateReg = regMap[lateKey] || regMap[att.date];
        const lateRegStatus = lateReg?.status || null;
        periods.push({
          type: 'late_arrival',
          from: graceEndStr,
          to: checkInStr,
          minutes: lateMinutes,
          regularizationStatus: lateRegStatus,
        });
        if (lateRegStatus === 'approved') regularizedCount++;
      }

      // Compute out-periods from biometric punches
      const dayPunches = punchesByDate[att.date] || [];
      let totalOutMinutes = 0;

      if (dayPunches.length >= 2) {
        for (let i = 1; i < dayPunches.length - 1; i += 2) {
          const outPunch = dayPunches[i]; // OUT
          const nextInPunch = dayPunches[i + 1]; // next IN
          if (outPunch && nextInPunch) {
            const outTime = new Date(outPunch.punchTime.replace(' ', 'T') + '+05:30');
            const inTime = new Date(nextInPunch.punchTime.replace(' ', 'T') + '+05:30');
            const gapMin = Math.round((inTime.getTime() - outTime.getTime()) / 60000);
            if (gapMin > 0) {
              const outStr = outPunch.punchTime.slice(11, 16);
              const inStr = nextInPunch.punchTime.slice(11, 16);
              const outKey = `${att.date}|${outStr}|${inStr}`;
              const outReg = regMap[outKey];
              const outRegStatus = outReg?.status || null;
              periods.push({
                type: 'out_period',
                from: outStr,
                to: inStr,
                minutes: gapMin,
                regularizationStatus: outRegStatus,
              });
              totalOutMinutes += gapMin;
              if (outRegStatus === 'approved') regularizedCount++;
            }
          }
        }
      }

      lateMarks.push({
        date: att.date,
        lateMinutes,
        checkIn: att.checkIn,
        checkOut: att.checkOut || null,
        shiftStart: shift.startTime,
        // All missing periods as separate items (each needs its own regularization)
        periods,
        totalMissingMinutes: lateMinutes + totalOutMinutes,
        punchCount: dayPunches.length,
      });
    }
  }

  const totalLateMarks = lateMarks.length;
  // A date is "regularized" only if ALL its periods are approved
  let dateRegularizedCount = 0;
  for (const lm of lateMarks) {
    const allApproved = lm.periods.length > 0 && lm.periods.every(p => p.regularizationStatus === 'approved');
    if (allApproved) dateRegularizedCount++;
  }
  const unregularizedCount = totalLateMarks - dateRegularizedCount;

  return {
    lateMarks,
    totalLateMarks,
    regularizedCount: dateRegularizedCount,
    unregularizedCount,
    halfDayDeductions: Math.floor(unregularizedCount / 3),
    month,
  };
}

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getTeamAttendance,
  getTeamAttendanceRange,
  getEmployeeCalendar,
  getLateMarksSummary,
};
