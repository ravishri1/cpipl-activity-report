// Recalculate April 2025 payslips using corrected attendance data
// Shows difference between stored LOP vs correct LOP, then updates

const { PrismaClient } = require('@prisma/client');
const { getWeeklyOffMap } = require('./src/services/attendance/weeklyOffHelper');
require('dotenv').config();
const prisma = new PrismaClient();

const MONTH = '2025-04';
const YEAR = 2025;
const MONTH_NUM = 4;
const DAYS_IN_MONTH = 30;
const TODAY = '2025-04-30'; // treat as end-of-month for full month calc

async function main() {
  // Holidays for April 2025
  const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: MONTH } } });
  const globalHolidayDates = new Set(holidays.map(h => h.date));

  const branchHolidayCache = {};
  const allSalaries = await prisma.salaryStructure.findMany({
    include: { user: { select: { id: true, name: true, employeeId: true, isActive: true, isAttendanceExempt: true, branchId: true } } },
  });
  const uniqueBranchIds = [...new Set(allSalaries.map(s => s.user.branchId).filter(Boolean))];
  for (const branchId of uniqueBranchIds) {
    const bh = await prisma.branchHoliday.findMany({ where: { branchId, date: { startsWith: MONTH } } });
    branchHolidayCache[branchId] = new Set(bh.map(h => h.date));
  }

  const calcWorkingDays = (holidaySet) => {
    let count = 0;
    for (let d = 1; d <= DAYS_IN_MONTH; d++) {
      const date = `${MONTH}-${String(d).padStart(2, '0')}`;
      if (new Date(YEAR, MONTH_NUM - 1, d).getDay() !== 0 && !holidaySet.has(date)) count++;
    }
    return count;
  };

  // Existing payslips
  const payslips = await prisma.payslip.findMany({
    where: { month: MONTH },
    select: { id: true, userId: true, lopDeduction: true, netPay: true, grossEarnings: true, totalDeductions: true },
  });
  const payslipMap = {};
  payslips.forEach(p => { payslipMap[p.userId] = p; });

  console.log('PAYROLL RECALCULATION — April 2025');
  console.log('Comparing STORED lopDeduction vs RECALCULATED lopDeduction');
  console.log('='.repeat(100));
  console.log('EmpId      | Name                           | WorkDays | OldLOP | NewLOP | Diff | OldNet | NewNet');
  console.log('-'.repeat(100));

  const toUpdate = [];

  for (const sal of allSalaries) {
    if (!sal.user.isActive) continue;
    const existing = payslipMap[sal.userId];
    if (!existing) continue; // no payslip generated — skip

    const mergedHolidays = new Set(globalHolidayDates);
    if (sal.user.branchId && branchHolidayCache[sal.user.branchId]) {
      branchHolidayCache[sal.user.branchId].forEach(d => mergedHolidays.add(d));
    }
    const workingDays = calcWorkingDays(mergedHolidays);

    let presentDays = 0, lopDays = 0;

    if (sal.user.isAttendanceExempt) {
      presentDays = workingDays;
      lopDays = 0;
    } else {
      const attendances = await prisma.attendance.findMany({
        where: { userId: sal.userId, date: { startsWith: MONTH } },
      });
      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: sal.userId, status: 'approved',
          startDate: { lte: `${MONTH}-30` }, endDate: { gte: `${MONTH}-01` },
        },
        select: { startDate: true, endDate: true, leaveType: { select: { code: true } } },
      });
      const leaveDatesSet = new Set();
      const lopDatesSet = new Set();
      for (const lr of approvedLeaves) {
        const isLop = lr.leaveType?.code === 'LOP';
        const cur = new Date(lr.startDate + 'T00:00:00');
        const end = new Date(lr.endDate + 'T00:00:00');
        while (cur <= end) {
          const ds = cur.toISOString().slice(0, 10);
          if (ds.startsWith(MONTH)) { isLop ? lopDatesSet.add(ds) : leaveDatesSet.add(ds); }
          cur.setDate(cur.getDate() + 1);
        }
      }

      if (attendances.length === 0 && leaveDatesSet.size === 0 && lopDatesSet.size === 0) {
        presentDays = workingDays; lopDays = 0;
      } else {
        const attMap = {};
        for (const att of attendances) attMap[att.date] = att.status;
        for (let d = 1; d <= DAYS_IN_MONTH; d++) {
          const dateStr = `${MONTH}-${String(d).padStart(2, '0')}`;
          const dow = new Date(YEAR, MONTH_NUM - 1, d).getDay();
          if (dow === 0 || mergedHolidays.has(dateStr) || dateStr > TODAY) continue;
          const status = attMap[dateStr];
          if (lopDatesSet.has(dateStr))                                lopDays += 1;
          else if (leaveDatesSet.has(dateStr) || status === 'on_leave') presentDays += 1;
          else if (status === 'present')                               presentDays += 1;
          else if (status === 'half_day')                              { presentDays += 0.5; lopDays += 0.5; }
          else if (status === 'absent')                                lopDays += 1;
          else if (!status && attendances.length > 0)                  lopDays += 1;
          else if (!status)                                            presentDays += 1;
        }
      }
    }

    const perDay = workingDays > 0 ? sal.ctcMonthly / workingDays : 0;
    const newLopDeduction = Math.round(perDay * lopDays);
    const oldLopDeduction = existing.lopDeduction || 0;
    const diff = newLopDeduction - oldLopDeduction;

    if (diff !== 0) {
      const newNetPay = (existing.netPay || 0) - diff;
      toUpdate.push({ id: existing.id, userId: sal.userId, newLopDeduction, newNetPay, diff });
      console.log(
        `${(sal.user.employeeId||'?').padEnd(10)} | ${sal.user.name.padEnd(30)} | ${String(workingDays).padEnd(8)} | ` +
        `${String(oldLopDeduction).padEnd(6)} | ${String(newLopDeduction).padEnd(6)} | ${diff > 0 ? '+' : ''}${diff} | ` +
        `${String(existing.netPay||0).padEnd(6)} | ${newNetPay}  ← ${diff < 0 ? '✅ LOP decreased (refund)' : '⚠ LOP increased'}`
      );
    }
  }

  if (toUpdate.length === 0) {
    console.log('No differences found — all payslips already correct!');
    return;
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log(`${toUpdate.length} payslips need correction.`);
  console.log('\nApplying corrections...');

  for (const u of toUpdate) {
    await prisma.payslip.update({
      where: { id: u.id },
      data: { lopDeduction: u.newLopDeduction, netPay: u.newNetPay },
    });
    console.log(`  UPDATED userId=${u.userId} lopDeduction=${u.newLopDeduction} netPay=${u.newNetPay}`);
  }

  console.log(`\nDone. ${toUpdate.length} payslips corrected.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
