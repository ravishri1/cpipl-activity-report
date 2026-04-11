const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

const MONTH = '2025-04';
const YEAR = 2025, MONTH_NUM = 4, DAYS = 30;

async function main() {
  const user = await prisma.user.findFirst({
    where: { employeeId: 'COLOR006' },
    select: { id: true, name: true, isAttendanceExempt: true, branchId: true },
  });
  console.log('Employee:', user.name, '| Exempt:', user.isAttendanceExempt);

  const attendances = await prisma.attendance.findMany({
    where: { userId: user.id, date: { startsWith: MONTH } },
    orderBy: { date: 'asc' },
  });
  console.log('\nAttendance records in April 2025:', attendances.length);
  attendances.forEach(a => console.log(`  ${a.date} → ${a.status} ${a.adminOverride ? '[adminOverride]' : ''}`));

  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: user.id, status: 'approved', startDate: { lte: '2025-04-30' }, endDate: { gte: '2025-04-01' } },
    select: { startDate: true, endDate: true, days: true, leaveType: { select: { code: true } } },
  });
  console.log('\nApproved leaves touching April 2025:');
  leaves.forEach(l => console.log(`  ${l.startDate} → ${l.endDate} | ${l.leaveType?.code} | ${l.days} days`));

  const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: MONTH } } });
  const holidaySet = new Set(holidays.map(h => h.date));

  const attMap = {};
  attendances.forEach(a => { attMap[a.date] = a.status; });

  const leaveDatesSet = new Set();
  const lopDatesSet = new Set();
  for (const lr of leaves) {
    const isLop = lr.leaveType?.code === 'LOP';
    const cur = new Date(lr.startDate + 'T00:00:00');
    const end = new Date(lr.endDate + 'T00:00:00');
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (ds.startsWith(MONTH)) isLop ? lopDatesSet.add(ds) : leaveDatesSet.add(ds);
      cur.setDate(cur.getDate() + 1);
    }
  }

  console.log('\nDay-by-day breakdown:');
  console.log('Date        | Day | Att-Status   | Leave | Count-As   | Note');
  console.log('-'.repeat(80));

  let presentDays = 0, lopDays = 0;
  for (let d = 1; d <= DAYS; d++) {
    const ds = `${MONTH}-${String(d).padStart(2,'0')}`;
    const dow = new Date(YEAR, MONTH_NUM - 1, d).getDay();
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];

    if (dow === 0) { console.log(`${ds} | ${dayName} | —            | —     | WEEKEND    |`); continue; }
    if (holidaySet.has(ds)) { console.log(`${ds} | ${dayName} | —            | —     | HOLIDAY    |`); continue; }

    const status = attMap[ds];
    let countAs = '';
    let note = '';

    if (lopDatesSet.has(ds))                                  { countAs = 'LOP'; lopDays += 1; note = 'approved LOP leave'; }
    else if (leaveDatesSet.has(ds) || status === 'on_leave')  { countAs = 'PRESENT'; presentDays += 1; note = 'approved paid leave'; }
    else if (status === 'present')                            { countAs = 'PRESENT'; presentDays += 1; }
    else if (status === 'half_day')                           { countAs = 'HD'; presentDays += 0.5; lopDays += 0.5; }
    else if (status === 'absent')                             { countAs = 'LOP'; lopDays += 1; note = 'att=absent'; }
    else if (!status && attendances.length > 0)               { countAs = 'LOP ⚠'; lopDays += 1; note = 'NO ATT RECORD — counted as LOP'; }
    else                                                      { countAs = 'PRESENT'; presentDays += 1; note = 'no data → full att'; }

    console.log(`${ds} | ${dayName} | ${String(status||'—').padEnd(12)} | ${leaveDatesSet.has(ds)?'PAID':lopDatesSet.has(ds)?'LOP':'—'} | ${countAs.padEnd(10)} | ${note}`);
  }

  console.log('-'.repeat(80));
  console.log(`\nPresent: ${presentDays} | LOP days: ${lopDays}`);

  const sal = await prisma.salaryStructure.findUnique({ where: { userId: user.id }, select: { ctcMonthly: true } });
  const perDay = sal.ctcMonthly / 26;
  console.log(`CTC Monthly: ${sal.ctcMonthly} | Per day: ${perDay.toFixed(2)}`);
  console.log(`LOP Deduction: ₹${Math.round(perDay * lopDays)}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
