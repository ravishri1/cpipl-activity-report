/**
 * Attendance Muster Service
 * Builds greytHR-style monthly attendance grid with session-based tracking
 */

/**
 * Get attendance muster for a month (greytHR-style grid)
 * Returns all employees with their daily statuses for the entire month
 */
async function getAttendanceMuster(month, department, prisma) {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
  const today = new Date().toISOString().split('T')[0];

  // Build day info array (date, day number, day-of-week)
  const dayInfo = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(dateStr + 'T00:00:00');
    dayInfo.push({
      date: dateStr,
      day: d,
      dow: dateObj.getDay(),
      dayName: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dateObj.getDay()],
    });
  }

  // Parallel data fetch
  const userWhere = { isActive: true };
  if (department) userWhere.department = department;

  const [users, attendances, holidays, leaves, shiftAssignments] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, employeeId: true, department: true, location: true },
      orderBy: { name: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { userId: true, date: true, status: true, checkIn: true, checkOut: true, workHours: true, session1: true, session2: true, adminOverride: true, adminRemark: true, notes: true },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'approved', startDate: { lte: endDate }, endDate: { gte: startDate } },
      select: { userId: true, startDate: true, endDate: true, leaveType: { select: { code: true } } },
    }),
    prisma.shiftAssignment.findMany({
      where: {
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      select: { userId: true, shift: { select: { name: true, startTime: true, endTime: true } } },
    }),
  ]);

  // Build lookup maps
  const holidayMap = {};
  for (const h of holidays) holidayMap[h.date] = h.name;

  // Attendance map: userId -> date -> record
  const attMap = {};
  for (const a of attendances) {
    if (!attMap[a.userId]) attMap[a.userId] = {};
    attMap[a.userId][a.date] = a;
  }

  // Leave map: userId -> date -> leave code
  const leaveMap = {};
  for (const lr of leaves) {
    if (!leaveMap[lr.userId]) leaveMap[lr.userId] = {};
    let d = new Date(Math.max(new Date(lr.startDate + 'T00:00:00'), new Date(startDate + 'T00:00:00')));
    const end = new Date(Math.min(new Date(lr.endDate + 'T00:00:00'), new Date(endDate + 'T00:00:00')));
    while (d <= end) {
      const ds = d.toISOString().split('T')[0];
      leaveMap[lr.userId][ds] = lr.leaveType?.code || 'L';
      d.setDate(d.getDate() + 1);
    }
  }

  // Shift map: userId -> shift
  const shiftMap = {};
  for (const sa of shiftAssignments) {
    shiftMap[sa.userId] = sa.shift;
  }

  // Build employee rows
  const employees = users.map(user => {
    const days = {};
    const summary = { P: 0, L: 0, H: 0, A: 0, OFF: 0, HD: 0, LOP: 0, OD: 0 };
    const shift = shiftMap[user.id] || null;

    for (const di of dayInfo) {
      const att = attMap[user.id]?.[di.date];
      const isHoliday = !!holidayMap[di.date];
      const isWeekend = di.dow === 0 || di.dow === 6;
      const leaveCode = leaveMap[user.id]?.[di.date] || null;
      const isFuture = di.date > today;

      let display = '-';
      let color = 'future';
      let session1 = null;
      let session2 = null;
      let adminOverride = false;
      let adminRemark = null;

      if (isFuture && !isHoliday && !isWeekend) {
        display = '-';
        color = 'future';
      } else if (isWeekend) {
        display = 'OFF';
        color = 'off';
        summary.OFF++;
      } else if (isHoliday) {
        display = 'H';
        color = 'holiday';
        summary.H++;
      } else if (att) {
        adminOverride = att.adminOverride || false;
        adminRemark = att.adminRemark || null;
        session1 = att.session1 || null;
        session2 = att.session2 || null;

        if (session1 && session2) {
          // Admin has set sessions explicitly
          if (session1 === 'P' && session2 === 'P') {
            display = 'P'; color = 'present'; summary.P++;
          } else if (session1 === 'P' && session2 === 'A') {
            display = 'P:A'; color = 'halfday'; summary.HD++;
          } else if (session1 === 'A' && session2 === 'P') {
            display = 'A:P'; color = 'halfday'; summary.HD++;
          } else if (session1 === 'A' && session2 === 'A') {
            display = 'A'; color = 'absent'; summary.A++;
          } else if (session1 === 'L' || session2 === 'L') {
            display = `${session1}:${session2}`; color = 'leave'; summary.L++;
          } else {
            display = `${session1}:${session2}`; color = 'other';
          }
        } else {
          // Derive from status
          if (att.status === 'present') {
            display = 'P'; color = 'present'; summary.P++;
          } else if (att.status === 'half_day') {
            display = 'HD'; color = 'halfday'; summary.HD++;
          } else if (att.status === 'on_leave') {
            display = leaveCode || 'L'; color = 'leave'; summary.L++;
          } else if (att.status === 'absent') {
            display = 'A'; color = 'absent'; summary.A++;
          } else {
            display = att.status?.charAt(0)?.toUpperCase() || '?'; color = 'other';
          }
        }
      } else if (leaveCode) {
        display = leaveCode; color = 'leave'; summary.L++;
      } else if (!isFuture) {
        display = 'A'; color = 'absent'; summary.A++;
      }

      days[di.date] = { display, color, session1, session2, adminOverride, adminRemark, checkIn: att?.checkIn || null, checkOut: att?.checkOut || null, workHours: att?.workHours || null };
    }

    return {
      userId: user.id,
      name: user.name,
      employeeId: user.employeeId,
      department: user.department,
      location: user.location,
      shift: shift ? { name: shift.name, startTime: shift.startTime, endTime: shift.endTime } : null,
      days,
      summary,
    };
  });

  return {
    month,
    lastDay,
    dayInfo,
    holidays: holidayMap,
    employees,
    totalEmployees: employees.length,
  };
}

/**
 * Admin updates a cell in the muster
 */
async function updateMusterCell(userId, date, session1, session2, remark, adminId, prisma) {
  // Derive overall status from sessions
  let status = 'absent';

  if (session1 === 'P' && session2 === 'P') status = 'present';
  else if ((session1 === 'P' && session2 === 'A') || (session1 === 'A' && session2 === 'P')) status = 'half_day';
  else if (session1 === 'A' && session2 === 'A') status = 'absent';
  else if (session1 === 'L' || session2 === 'L') status = 'on_leave';

  const record = await prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId, date,
      status,
      session1,
      session2,
      adminOverride: true,
      adminRemark: remark || null,
      overriddenBy: adminId,
      overriddenAt: new Date(),
    },
    update: {
      status,
      session1,
      session2,
      adminOverride: true,
      adminRemark: remark || null,
      overriddenBy: adminId,
      overriddenAt: new Date(),
    },
  });

  return record;
}

module.exports = { getAttendanceMuster, updateMusterCell };
