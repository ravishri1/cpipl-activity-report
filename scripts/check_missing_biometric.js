/**
 * Check for employees with missing biometric attendance data
 * Checks between joining date and leaving date (or today for active employees)
 * Skips weekends and holidays
 * Run: node scripts/check_missing_biometric.js
 */

require('dotenv').config({ path: './server/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getDatesInRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getDayOfWeek(dateStr) {
  const d = new Date(dateStr);
  return d.getDay(); // 0=Sun, 6=Sat
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all holidays
  const holidays = await prisma.holiday.findMany({ select: { date: true } });
  const holidaySet = new Set(holidays.map(h => h.date));

  // Fetch all employees with joining date
  const employees = await prisma.user.findMany({
    where: { dateOfJoining: { not: null } },
    select: {
      id: true,
      name: true,
      employeeId: true,
      department: true,
      dateOfJoining: true,
      employmentStatus: true,
      separation: {
        select: { lastWorkingDate: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`\nChecking ${employees.length} employees for missing biometric data...\n`);
  console.log('='.repeat(80));

  const results = [];

  for (const emp of employees) {
    const startDate = emp.dateOfJoining;
    // End date: lastWorkingDate if separated, else today
    let endDate = today;
    if (emp.separation?.lastWorkingDate) {
      endDate = emp.separation.lastWorkingDate;
    } else if (emp.employmentStatus === 'separated' || emp.employmentStatus === 'terminated' || emp.employmentStatus === 'absconding') {
      // No lastWorkingDate but separated — use today as fallback
      endDate = today;
    }

    // Skip if joining date is in the future
    if (startDate > today) continue;

    const allDates = getDatesInRange(startDate, endDate);

    // Filter to working days (Mon–Sat, skip Sun and holidays)
    const workingDays = allDates.filter(d => {
      const dow = getDayOfWeek(d);
      return dow !== 0 && !holidaySet.has(d); // skip Sunday and holidays
    });

    if (workingDays.length === 0) continue;

    // Fetch attendance records for this employee in range
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        userId: emp.id,
        date: { gte: startDate, lte: endDate }
      },
      select: { date: true, status: true, checkIn: true, checkOut: true }
    });

    const attendanceDates = new Set(attendanceRecords.map(a => a.date));

    // Find missing dates (no attendance record at all)
    const missingDates = workingDays.filter(d => !attendanceDates.has(d));

    if (missingDates.length > 0) {
      // Group consecutive missing dates into ranges
      const ranges = [];
      let rangeStart = missingDates[0];
      let prev = missingDates[0];

      for (let i = 1; i < missingDates.length; i++) {
        const curr = missingDates[i];
        const prevD = new Date(prev);
        const currD = new Date(curr);
        const diffDays = (currD - prevD) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) { // gap means new range (allowing for weekends)
          ranges.push({ from: rangeStart, to: prev, count: missingDates.slice(ranges.reduce((a,b)=>a+b.count,0), i).length });
          rangeStart = curr;
        }
        prev = curr;
      }
      ranges.push({ from: rangeStart, to: prev, count: missingDates.length - ranges.reduce((a,b)=>a+b.count,0) });

      results.push({
        emp,
        startDate,
        endDate,
        totalWorkingDays: workingDays.length,
        presentDays: attendanceRecords.length,
        missingCount: missingDates.length,
        missingDates,
      });
    }
  }

  if (results.length === 0) {
    console.log('✅ No missing biometric data found for any employee!');
  } else {
    console.log(`⚠️  Found ${results.length} employee(s) with missing attendance data:\n`);

    for (const r of results) {
      const status = r.emp.employmentStatus;
      const lwdLabel = r.emp.separation?.lastWorkingDate ? `→ LWD: ${r.emp.separation.lastWorkingDate}` : `→ Active (till ${r.endDate})`;
      console.log(`\n👤 ${r.emp.name} [${r.emp.employeeId || 'No ID'}] | ${r.emp.department || 'N/A'} | ${status}`);
      console.log(`   Joined: ${r.startDate} ${lwdLabel}`);
      console.log(`   Working Days: ${r.totalWorkingDays} | Records Found: ${r.presentDays} | Missing: ${r.missingCount} days`);
      console.log(`   Missing Dates:`);

      // Print missing dates grouped (show first 20 then summarize)
      const display = r.missingDates.slice(0, 30);
      const chunks = [];
      for (let i = 0; i < display.length; i += 7) {
        chunks.push(display.slice(i, i + 7).join('  '));
      }
      chunks.forEach(c => console.log(`     ${c}`));
      if (r.missingDates.length > 30) {
        console.log(`     ... and ${r.missingDates.length - 30} more dates`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\nSUMMARY:`);
    console.log(`Total employees checked : ${employees.length}`);
    console.log(`Employees with gaps     : ${results.length}`);
    console.log(`Total missing days      : ${results.reduce((a, b) => a + b.missingCount, 0)}`);

    // Top 10 worst
    const sorted = [...results].sort((a, b) => b.missingCount - a.missingCount);
    console.log(`\nTop employees by missing days:`);
    sorted.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.emp.name} [${r.emp.employeeId || '-'}] — ${r.missingCount} missing days`);
    });
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e.message);
  prisma.$disconnect();
  process.exit(1);
});
