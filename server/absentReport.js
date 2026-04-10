/**
 * Absent Report — FY 2025-26
 * Absent = working day (Mon-Sat, non-holiday) where employee has
 * NO attendance record AND NO approved leave.
 * Uses UTC noon to avoid timezone date-shift bugs.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const FY_START = '2025-04-01';
const FY_END   = '2026-03-31';

// Today in IST — don't flag future dates as absent
const todayIST = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

// Safe date string → Date using noon UTC to avoid timezone boundary issues
function toDate(str) { return new Date(str + 'T12:00:00Z'); }

async function main() {
  // ── 1. Holidays ───────────────────────────────────────────────────
  const holidays = await p.holiday.findMany({
    where: { date: { gte: FY_START, lte: FY_END } },
    select: { date: true, location: true }
  });
  const holAll     = new Set(holidays.filter(h => h.location === 'All').map(h => h.date));
  const holMumbai  = new Set([...holAll, ...holidays.filter(h => h.location === 'Mumbai').map(h => h.date)]);
  const holLucknow = new Set([...holAll, ...holidays.filter(h => h.location === 'Lucknow').map(h => h.date)]);
  function getHolSet(loc) {
    if (loc === 'Mumbai')  return holMumbai;
    if (loc === 'Lucknow') return holLucknow;
    return holAll;
  }

  // ── 2. Employees ──────────────────────────────────────────────────
  const users = await p.user.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, employeeId: true, location: true,
      dateOfJoining: true,
      separation: { select: { lastWorkingDate: true } }
    }
  });

  // ── 3. Attendance records in FY ───────────────────────────────────
  const attRecords = await p.attendance.findMany({
    where: { date: { gte: FY_START, lte: FY_END } },
    select: { userId: true, date: true }
  });
  const attSet = new Set(attRecords.map(r => `${r.userId}|${r.date}`));

  // ── 4. Approved leaves in FY ──────────────────────────────────────
  const leaves = await p.leaveRequest.findMany({
    where: { status: 'approved', startDate: { lte: FY_END }, endDate: { gte: FY_START } },
    select: { userId: true, startDate: true, endDate: true }
  });
  const leaveSet = new Set();
  for (const lr of leaves) {
    const end = toDate(lr.endDate);
    for (let d = toDate(lr.startDate); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      leaveSet.add(`${lr.userId}|${d.toISOString().slice(0, 10)}`);
    }
  }

  // ── 5. Working days in FY (Mon=1 – Sat=6, no Sunday, up to today) ─
  const fyDays = [];
  const fyEnd  = toDate(FY_END);
  const today  = toDate(todayIST);
  const limit  = fyEnd < today ? fyEnd : today;
  for (let d = toDate(FY_START); d <= limit; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0) fyDays.push(d.toISOString().slice(0, 10));
  }

  // ── 6. Calculate absences per employee ────────────────────────────
  const report = [];
  for (const user of users) {
    const joinDate = user.dateOfJoining || FY_START;
    const lastDate = user.separation?.lastWorkingDate || FY_END;
    const holSet   = getHolSet(user.location || 'All');
    const absDates = [];

    for (const day of fyDays) {
      if (day < FY_START || day > FY_END)     continue; // safety
      if (day < joinDate || day > lastDate)   continue; // not in service
      if (holSet.has(day))                    continue; // holiday
      if (attSet.has(`${user.id}|${day}`))   continue; // has attendance
      if (leaveSet.has(`${user.id}|${day}`)) continue; // on leave
      absDates.push(day);
    }

    if (absDates.length > 0) {
      report.push({
        empId: user.employeeId || '-',
        name: user.name,
        location: user.location || '-',
        days: absDates.length,
        dates: absDates
      });
    }
  }

  report.sort((a, b) => b.days - a.days); // sort by most absent first

  // ── 7. Summary table ──────────────────────────────────────────────
  console.log('\nAbsent Report — FY 2025-26 (1 Apr 2025 – 31 Mar 2026)');
  console.log(`Working days checked up to: ${todayIST}  |  Holidays & approved leaves excluded`);
  console.log('='.repeat(75));
  console.log(`${'EMP ID'.padEnd(12)} ${'Name'.padEnd(35)} ${'Loc'.padEnd(8)} Days`);
  console.log('-'.repeat(75));

  let totalDays = 0;
  for (const emp of report) {
    console.log(`${emp.empId.padEnd(12)} ${emp.name.padEnd(35)} ${(emp.location||'-').padEnd(8)} ${emp.days}`);
    totalDays += emp.days;
  }

  console.log('='.repeat(75));
  console.log(`Total employees with absences: ${report.length}`);
  console.log(`Total absent days            : ${totalDays}`);

  // ── 8. Detail per employee — grouped by month ────────────────────
  const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  console.log('\n\n--- DETAIL (per employee, grouped by month) ---');
  for (const emp of report) {
    console.log(`\n${emp.empId}  ${emp.name}  [${emp.days} day(s)]`);

    // Group dates by YYYY-MM
    const byMonth = {};
    for (const d of emp.dates) {
      const ym = d.slice(0, 7); // "2025-04"
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(d.slice(8)); // day only "01"
    }

    for (const [ym, days] of Object.entries(byMonth)) {
      const [yr, mo] = ym.split('-');
      const label = `  ${MONTH_NAMES[+mo]} ${yr} (${days.length}d):`;
      console.log(`${label.padEnd(20)} ${days.join(', ')}`);
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
