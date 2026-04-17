/**
 * Diagnose May 2025 LOP discrepancies — Prisma-based (no raw SQL)
 * Usage: node scripts/diagnoseMayLOP.js [COLOR_ID]
 * If COLOR_ID is given, shows detailed breakdown for that employee only.
 * Without args, shows summary for all mismatching employees.
 */

const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({
  path: path.join(__dirname, '../server/.env'),
});
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { getSaturdayPolicyForMonth, buildOffSaturdaySet } = require(
  path.join(__dirname, '../server/src/utils/saturdayPolicyHelper')
);

const prisma = new PrismaClient();

const MONTH = '2025-05';
const COMPANY_ID = 1;
const year = 2025, monthNum = 5;
const daysInMonth = 31;
const monthStart = '2025-05-01', monthEnd = '2025-05-31';

// Employees to investigate (from prior comparison)
// Extra LOP (EOD > Excel): COLOR128, COLOR137, COLOR145, COLOR153, COLOR156
// Missing LOP (EOD < Excel): COLOR013, COLOR085, COLOR090, COLOR154, COLOR157

async function computeLopFromLeaves(approvedLeaves, mergedHolidays) {
  let lopFromLeave = 0;
  const lopDatesSet = new Set();
  const halfLopDatesSet = new Set();

  const saturdayPolicy = await getSaturdayPolicyForMonth(COMPANY_ID, MONTH, prisma);
  const offSaturdaySet = saturdayPolicy
    ? buildOffSaturdaySet(MONTH, saturdayPolicy.saturdayType)
    : buildOffSaturdaySet(MONTH, 'all');

  const details = [];

  for (const lr of approvedLeaves) {
    const isLop = lr.leaveType?.code === 'LOP';
    if (!isLop) continue;

    const isHalfDay = lr.session === 'first_half' || lr.session === 'second_half';
    const increment = isHalfDay ? 0.5 : 1;
    const cur = new Date(lr.startDate + 'T00:00:00Z');
    const end = new Date(lr.endDate + 'T00:00:00Z');
    let daysCount = 0;
    let prevWorkingLopSeen = false;
    const daysDetail = [];

    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (ds.startsWith(MONTH)) {
        const isHol = mergedHolidays.has(ds);
        lopDatesSet.add(ds);
        if (isHalfDay) halfLopDatesSet.add(ds);

        const dayOfWeek = cur.getUTCDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isOffSat = isSaturday && offSaturdaySet.has(ds);

        if (!isHol && !isSunday) {
          daysCount += increment;
          prevWorkingLopSeen = true;
          daysDetail.push(`  ${ds} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}${isOffSat ? ' OFF-SAT' : ''}) +${increment}`);
        } else if (prevWorkingLopSeen) {
          // Sandwich check
          const peek = new Date(cur.getTime());
          peek.setDate(peek.getDate() + 1);
          let hasLopDayAfter = false;
          while (peek <= end) {
            const peekDow = peek.getUTCDay();
            const peekDs = peek.toISOString().slice(0, 10);
            if (peekDow !== 0 && !mergedHolidays.has(peekDs)) { hasLopDayAfter = true; break; }
            peek.setDate(peek.getDate() + 1);
          }
          if (hasLopDayAfter) {
            daysCount += 1;
            daysDetail.push(`  ${ds} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}${isHol ? ' HOL' : ''}) SANDWICH +1`);
          } else {
            daysDetail.push(`  ${ds} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}${isHol ? ' HOL' : ''}) SKIPPED`);
          }
        } else {
          daysDetail.push(`  ${ds} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}${isHol ? ' HOL' : ''}) SKIPPED (no prev working day)`);
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    lopFromLeave += daysCount;
    details.push({ lr, daysCount, isHalfDay, daysDetail });
  }

  return { lopFromLeave, lopDatesSet, halfLopDatesSet, details };
}

async function diagnoseEmployee(empId, verbose = true) {
  const user = await prisma.user.findFirst({
    where: { employeeId: empId, companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  if (!user) { console.log(`Not found: ${empId}`); return; }

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: user.id,
      status: 'approved',
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: { id: true, startDate: true, endDate: true, days: true, session: true, leaveType: { select: { code: true } } },
    orderBy: { startDate: 'asc' },
  });

  const attendances = await prisma.attendance.findMany({
    where: { userId: user.id, date: { startsWith: MONTH } },
    orderBy: { date: 'asc' },
  });

  const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: MONTH } } });
  const mergedHolidays = new Set(holidays.map(h => h.date));

  const payslip = await prisma.payslip.findFirst({
    where: { userId: user.id, month: MONTH },
    select: { grossEarnings: true, netPay: true, lopDays: true, presentDays: true, lopDeduction: true },
  });

  if (verbose) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${empId} — ${user.name} (id: ${user.id})`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\nPayslip: LOP=${payslip?.lopDays}, Present=${payslip?.presentDays}, Gross=${payslip?.grossEarnings}, Net=${payslip?.netPay}`);

    console.log(`\nLeave Requests (${approvedLeaves.length}):`);
    for (const lr of approvedLeaves) {
      console.log(`  LR#${lr.id}: ${lr.startDate}→${lr.endDate} [${lr.leaveType?.code}] session=${lr.session || 'full_day'} days=${lr.days}`);
    }

    const { lopFromLeave, lopDatesSet, details } = await computeLopFromLeaves(approvedLeaves, mergedHolidays);
    console.log(`\nLOP from leave requests: ${lopFromLeave}`);
    for (const d of details) {
      console.log(`  LR#${d.lr.id} (${d.lr.startDate}→${d.lr.endDate} ${d.lr.session || 'full_day'}): computed=${d.daysCount}`);
      for (const line of d.daysDetail) console.log(line);
    }

    // Count attendance-based LOP
    const attMap = {};
    for (const att of attendances) { attMap[att.date] = att.status; }

    let lopFromAtt = 0, presentFromAtt = 0;
    console.log(`\nAttendance records (${attendances.length}):`);

    const saturdayPolicy = await getSaturdayPolicyForMonth(COMPANY_ID, MONTH, prisma);
    const offSaturdaySet = saturdayPolicy
      ? buildOffSaturdaySet(MONTH, saturdayPolicy.saturdayType)
      : buildOffSaturdaySet(MONTH, 'all');

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${MONTH}-${String(d).padStart(2, '0')}`;
      const dow = new Date(year, monthNum - 1, d).getDay();
      const isOff = dow === 6 ? offSaturdaySet.has(ds) : dow === 0;
      if (isOff || mergedHolidays.has(ds)) continue;
      const status = attMap[ds];
      const inLop = lopDatesSet.has(ds);
      let contribution = '';
      if (inLop) {
        contribution = 'in-LOP-set (from leave request)';
      } else if (status === 'absent') {
        lopFromAtt += 1;
        contribution = 'ABSENT → +1 LOP';
      } else if (status === 'half_day') {
        lopFromAtt += 0.5; presentFromAtt += 0.5;
        contribution = 'half_day → +0.5 LOP +0.5 Present';
      } else if (status === 'present' || status === 'on_leave') {
        presentFromAtt += 1;
        contribution = `${status}`;
      } else if (!status && attendances.length > 0) {
        lopFromAtt += 1;
        contribution = 'NO RECORD → +1 LOP';
      }
      console.log(`  ${ds} ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}: ${contribution}`);
    }
    console.log(`\nAttendance LOP: ${lopFromAtt}, Attendance Present: ${presentFromAtt}`);
    console.log(`TOTAL LOP = lopFromLeave(${lopFromLeave}) + lopFromAtt(${lopFromAtt}) = ${lopFromLeave + lopFromAtt}`);
    console.log(`Payslip shows lopDays=${payslip?.lopDays}`);
  }

  return user.id;
}

async function listLopLeaveRequests(userId, label) {
  const lrs = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'approved',
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
      leaveType: { code: 'LOP' },
    },
    select: { id: true, startDate: true, endDate: true, days: true, session: true },
    orderBy: { startDate: 'asc' },
  });
  console.log(`\n${label}: ${lrs.length} LOP leave requests`);
  for (const lr of lrs) {
    console.log(`  LR#${lr.id}: ${lr.startDate}→${lr.endDate} session=${lr.session || 'full_day'} days=${lr.days}`);
  }
  return lrs;
}

async function main() {
  const targetEmp = process.argv[2];

  if (targetEmp) {
    await diagnoseEmployee(targetEmp, true);
  } else {
    // Show all mismatching employees
    const empIds = ['COLOR145', 'COLOR128', 'COLOR137', 'COLOR153', 'COLOR156',
                    'COLOR013', 'COLOR085', 'COLOR090', 'COLOR154', 'COLOR157'];

    for (const empId of empIds) {
      const user = await prisma.user.findFirst({
        where: { employeeId: empId, companyId: COMPANY_ID },
        select: { id: true, name: true, employeeId: true },
      });
      if (!user) { console.log(`${empId}: NOT FOUND`); continue; }

      const payslip = await prisma.payslip.findFirst({
        where: { userId: user.id, month: MONTH },
        select: { lopDays: true, presentDays: true, grossEarnings: true, netPay: true },
      });

      const lrCount = await prisma.leaveRequest.count({
        where: {
          userId: user.id, status: 'approved',
          startDate: { lte: monthEnd }, endDate: { gte: monthStart },
        },
      });
      const attCount = await prisma.attendance.count({
        where: { userId: user.id, date: { startsWith: MONTH } },
      });

      console.log(`${empId} ${user.name}: LOP=${payslip?.lopDays} Present=${payslip?.presentDays} Gross=${payslip?.grossEarnings?.toFixed(0)} Net=${payslip?.netPay?.toFixed(0)} | LR=${lrCount} Att=${attCount}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
