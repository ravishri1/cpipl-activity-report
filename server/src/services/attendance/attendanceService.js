// ═══════════════════════════════════════════════
// Attendance Service — Check-in/out, monthly summary, team view
// ═══════════════════════════════════════════════

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check-in for a user — creates an Attendance record for today
 */
async function checkIn(userId, ipAddress, notes, prisma) {
  const today = getTodayDate();

  // Check if already checked in today
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (existing) {
    if (existing.checkIn) {
      throw new Error('Already checked in today.');
    }
  }

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date: today } },
    update: {
      checkIn: new Date(),
      status: 'present',
      ipAddress: ipAddress || null,
      notes: notes || null,
    },
    create: {
      userId,
      date: today,
      checkIn: new Date(),
      status: 'present',
      ipAddress: ipAddress || null,
      notes: notes || null,
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
    avgWorkHours: 0,
  };

  for (const r of records) {
    if (r.status === 'present') summary.present++;
    else if (r.status === 'absent') summary.absent++;
    else if (r.status === 'half_day') summary.halfDay++;
    else if (r.status === 'on_leave') summary.onLeave++;
    else if (r.status === 'holiday') summary.holiday++;
    else if (r.status === 'weekend') summary.weekend++;
    if (r.workHours) summary.totalWorkHours += r.workHours;
  }

  const workedDays = records.filter((r) => r.workHours > 0).length;
  summary.avgWorkHours = workedDays > 0 ? Math.round((summary.totalWorkHours / workedDays) * 100) / 100 : 0;

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

  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" string for String fields

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
 * Get employee calendar view — monthly grid with attendance, holidays, leaves, biometric punches
 * @param {number} userId
 * @param {string} month - "YYYY-MM" format
 */
async function getEmployeeCalendar(userId, month, prisma) {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  const today = new Date().toISOString().split('T')[0];

  const [attendances, holidays, leaves, punches, shiftAssignment] = await Promise.all([
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

  // Build calendar days array
  const days = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const att = attendanceMap[dateStr];
    const holiday = holidayMap[dateStr];
    const leave = leaveDates[dateStr];
    const dayPunches = punchesByDate[dateStr] || [];

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
      punches: dayPunches,
    });
  }

  const summary = {
    present: days.filter(d => d.status === 'present').length,
    absent: days.filter(d => d.status === 'absent').length,
    halfDay: days.filter(d => d.status === 'half_day').length,
    onLeave: days.filter(d => d.status === 'on_leave').length,
    holiday: days.filter(d => d.status === 'holiday').length,
    weekend: days.filter(d => d.status === 'weekend').length,
    totalWorkHours: Math.round(days.reduce((sum, d) => sum + (d.workHours || 0), 0) * 100) / 100,
  };

  return {
    days,
    summary,
    shift: shiftAssignment?.shift || null,
    month,
    year,
  };
}

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getTeamAttendance,
  getEmployeeCalendar,
};
