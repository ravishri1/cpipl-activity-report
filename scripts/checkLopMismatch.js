/**
 * Check detailed May 2025 attendance for 4 employees with LOP mismatch
 * Shows every working day's status and how LOP is computed
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { getSaturdayPolicyForMonth, buildOffSaturdaySet } = require(
  path.join(__dirname, '../server/src/utils/saturdayPolicyHelper')
);

const prisma = new PrismaClient();
const MONTH = '2025-05';
const COMPANY_ID = 1;
const year = 2025, monthNum = 5, daysInMonth = 31;

// EOD LOP vs Excel LOP
// COLOR090 Abhishek:  EOD=14, XL=17 → 3 short
// COLOR128 Sameer:    EOD=3,  XL=2  → 1 extra
// COLOR145 Shikha:    EOD=13.5, XL=15.5 → 2 short
// COLOR154 Aashutosh: EOD=4,  XL=5  → 1 short

const TARGETS = [
  { eid: 'COLOR090', xlLop: 17 },
  { eid: 'COLOR128', xlLop: 2 },
  { eid: 'COLOR145', xlLop: 15.5 },
  { eid: 'COLOR154', xlLop: 5 },
];

async function checkEmployee({ eid, xlLop }) {
  const user = await prisma.user.findFirst({
    where: { employeeId: eid, companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  if (!user) { console.log(`${eid}: NOT FOUND`); return; }

  const satPolicy = await getSaturdayPolicyForMonth(COMPANY_ID, MONTH, prisma);
  const offSaturdaySet = satPolicy
    ? buildOffSaturdaySet(MONTH, satPolicy.saturdayType)
    : buildOffSaturdaySet(MONTH, 'all');

  const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: MONTH } } });
  const holidaySet = new Set(holidays.map(h => h.date));

  const attendances = await prisma.attendance.findMany({
    where: { userId: user.id, date: { startsWith: MONTH } },
    orderBy: { date: 'asc' },
  });
  const attMap = {};
  for (const a of attendances) attMap[a.date] = a;

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: user.id, status: 'approved',
      startDate: { lte: '2025-05-31' }, endDate: { gte: '2025-05-01' },
    },
    select: { id: true, startDate: true, endDate: true, days: true, session: true, leaveType: { select: { code: true } } },
    orderBy: { startDate: 'asc' },
  });

  // Build LOP leave dates set (with sandwich logic)
  const lopLeaveDates = new Set();
  const halfLopLeaveDates = new Set();
  for (const lr of approvedLeaves) {
    if (lr.leaveType?.code !== 'LOP') continue;
    const isHalfDay = lr.session === 'first_half' || lr.session === 'second_half';
    const rangeDays = [];
    const cur = new Date(lr.startDate + 'T00:00:00Z');
    const end = new Date(lr.endDate + 'T00:00:00Z');
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (ds.startsWith(MONTH)) {
        rangeDays.push({ ds, dow: cur.getUTCDay(), isHol: holidaySet.has(ds) });
      }
      cur.setDate(cur.getDate() + 1);
    }

    let prevLopSeen = false;
    for (let i = 0; i < rangeDays.length; i++) {
      const { ds, dow, isHol } = rangeDays[i];
      if (dow !== 0 && !isHol) {
        lopLeaveDates.add(ds);
        if (isHalfDay) halfLopLeaveDates.add(ds);
        prevLopSeen = true;
      } else if (prevLopSeen && (dow === 0 || isHol)) {
        let hasLopAfter = false;
        for (let j = i + 1; j < rangeDays.length; j++) {
          if (!rangeDays[j].isHol && rangeDays[j].dow !== 0) { hasLopAfter = true; break; }
        }
        if (hasLopAfter) lopLeaveDates.add(ds);
      }
    }
  }

  const payslip = await prisma.payslip.findFirst({
    where: { userId: user.id, month: MONTH },
    select: { lopDays: true, presentDays: true, grossEarnings: true, netPay: true },
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log(`${eid} ${user.name} | EOD LOP=${payslip?.lopDays} | Excel LOP=${xlLop} | diff=${(payslip?.lopDays || 0) - xlLop}`);
  console.log(`${'='.repeat(70)}`);

  if (approvedLeaves.length > 0) {
    console.log('Leave requests:');
    for (const lr of approvedLeaves) {
      console.log(`  LR#${lr.id}: ${lr.startDate}→${lr.endDate} [${lr.leaveType?.code}] session=${lr.session || 'full'} days=${lr.days}`);
    }
  }

  console.log('\nWorking day breakdown:');
  let eodLop = 0, eodPresent = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${MONTH}-${String(d).padStart(2, '0')}`;
    const dow = new Date(year, monthNum - 1, d).getDay();
    const isSunday = dow === 0;
    const isOffSat = dow === 6 && offSaturdaySet.has(ds);
    const isHol = holidaySet.has(ds);

    if (isSunday) {
      if (lopLeaveDates.has(ds)) {
        eodLop += 1;
        console.log(`  ${ds} Sun: SANDWICH LOP +1`);
      }
      continue;
    }
    if (isHol) {
      console.log(`  ${ds} ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}: HOLIDAY`);
      continue;
    }
    if (isOffSat && !lopLeaveDates.has(ds)) {
      console.log(`  ${ds} Sat: OFF-SAT`);
      continue;
    }

    const inLop = lopLeaveDates.has(ds);
    const isHalf = halfLopLeaveDates.has(ds);
    const att = attMap[ds];

    let contribution = '';
    if (inLop) {
      if (isHalf) {
        eodLop += 0.5; eodPresent += 0.5;
        contribution = 'LOP-LEAVE-HALF +0.5 lop +0.5 present';
      } else {
        eodLop += 1;
        contribution = 'LOP-LEAVE +1';
      }
    } else if (att?.status === 'absent') {
      eodLop += 1;
      contribution = 'ABSENT +1 lop';
    } else if (att?.status === 'half_day') {
      eodLop += 0.5; eodPresent += 0.5;
      contribution = 'HALF_DAY +0.5 lop +0.5 present';
    } else if (att?.status === 'present' || att?.status === 'on_leave') {
      eodPresent += 1;
      contribution = att.status;
    } else if (!att && attendances.length > 0) {
      eodLop += 1;
      contribution = 'NO-RECORD +1 lop';
    } else {
      contribution = '(no attendance records at all)';
    }
    const dayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
    const isOffSatLabel = isOffSat ? ' OFF-SAT' : '';
    console.log(`  ${ds} ${dayLabel}${isOffSatLabel}: ${contribution}`);
  }
  console.log(`\nComputed: LOP=${eodLop} Present=${eodPresent} (payslip shows LOP=${payslip?.lopDays})`);
  console.log(`Excel expects LOP=${xlLop} → need to change ${xlLop - eodLop > 0 ? '+' : ''}${xlLop - eodLop} days`);
}

async function main() {
  for (const t of TARGETS) {
    await checkEmployee(t);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
