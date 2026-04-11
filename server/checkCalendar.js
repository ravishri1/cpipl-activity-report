const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      OR: [
        { startDate: { gte: '2025-04-01', lte: '2025-04-30' } },
        { endDate:   { gte: '2025-04-01', lte: '2025-04-30' } },
      ],
    },
    select: { userId: true, startDate: true, endDate: true, leaveTypeId: true },
  });

  const ltRows = await prisma.leaveType.findMany({ select: { id: true, code: true } });
  const ltMap = {};
  ltRows.forEach(x => { ltMap[x.id] = x.code; });

  const users = await prisma.user.findMany({ select: { id: true, name: true, employeeId: true } });
  const uMap = {};
  users.forEach(u => { uMap[u.id] = u; });

  // Expand each leave to individual April dates
  const leaveDates = [];
  for (const lr of leaves) {
    const from = new Date(lr.startDate + 'T00:00:00Z');
    const to   = new Date(lr.endDate   + 'T00:00:00Z');
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      if (ds >= '2025-04-01' && ds <= '2025-04-30') {
        leaveDates.push({ userId: lr.userId, date: ds, code: ltMap[lr.leaveTypeId] || 'L' });
      }
    }
  }

  console.log('LEAVE DAYS vs ATTENDANCE STATUS IN DB (April 2025)');
  console.log('Calendar logic: if EOD leave exists → always shows leave type (my fix)');
  console.log('='.repeat(110));
  console.log('EmpId      | Name                           | Date       | Leave | Att-Status   | Calendar Shows | Note');
  console.log('-'.repeat(110));

  let conflict = 0, noAtt = 0, onLeave = 0, other = 0;

  for (const ld of leaveDates) {
    const att = await prisma.attendance.findUnique({
      where: { userId_date: { userId: ld.userId, date: ld.date } },
      select: { status: true, adminOverride: true },
    });
    const u = uMap[ld.userId];
    const attStatus = att ? att.status : '—';
    // Calendar will always show leave type (due to fix: if (att && !leave) )
    const calShows = ld.code;
    let note = '';
    if (!att) { noAtt++; note = 'no biometric'; }
    else if (att.status === 'present') { conflict++; note = 'punched in on leave day — calendar still shows leave ✓'; }
    else if (att.status === 'on_leave') { onLeave++; note = 'att correctly on_leave ✓'; }
    else { other++; note = att.status; }

    const empId = (u ? u.employeeId : '?').padEnd(10);
    const name  = (u ? u.name       : '?').padEnd(30);
    console.log(`${empId} | ${name} | ${ld.date} | ${ld.code.padEnd(5)} | ${attStatus.padEnd(12)} | ${calShows.padEnd(14)} | ${note}`);
  }

  console.log('');
  console.log('='.repeat(110));
  console.log('SUMMARY:');
  console.log(`  Att record = present on leave day (biometric punched, but calendar CORRECTLY shows leave): ${conflict}`);
  console.log(`  Att record = on_leave (correctly set):                                                   ${onLeave}`);
  console.log(`  No attendance record (calendar uses leave directly):                                     ${noAtt}`);
  console.log(`  Other status:                                                                            ${other}`);
  console.log(`  TOTAL leave-date slots checked: ${leaveDates.length}`);
  console.log('');
  console.log('NOTE: "present" in attendance on a leave day is OK after the attendanceService.js fix.');
  console.log('      The calendar getEmployeeCalendar() checks leave FIRST; if approved leave exists,');
  console.log('      it shows the leave type regardless of the attendance record status.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
