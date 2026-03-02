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

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, department: true, employeeId: true, profilePhotoUrl: true,
      attendances: {
        where: { date },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });

  const result = users.map((u) => {
    const att = u.attendances[0] || null;
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

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMonthlyAttendance,
  getTeamAttendance,
};
