const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const { calcStatutory, DEFAULT_PAYROLL_RULES } = require('./src/utils/payrollRules');
const { getSaturdayPolicyForMonth, buildOffSaturdaySet } = require('./src/utils/saturdayPolicyHelper');

const prisma = new PrismaClient();
const MONTH = '2025-04';
const YEAR = 2025;
const MONTH_NUM = 4;
const DAYS_IN_MONTH = 30;
const LOP_DIVISOR = 30;
const COMPANY_ID = 1;
const today = new Date().toISOString().slice(0, 10);

async function main() {
  const rulesRow = await prisma.setting.findUnique({ where: { key: 'payroll_rules' } });
  const payrollRules = rulesRow ? JSON.parse(rulesRow.value) : DEFAULT_PAYROLL_RULES;

  const holidays = await prisma.holiday.findMany({ where: { date: { startsWith: MONTH } } });
  const holidaySet = new Set(holidays.map(h => h.date));
  const branchHolidayCache = {};

  const saturdayPolicy = await getSaturdayPolicyForMonth(COMPANY_ID, MONTH, prisma);
  const offSaturdaySet = saturdayPolicy
    ? buildOffSaturdaySet(MONTH, saturdayPolicy.saturdayType)
    : buildOffSaturdaySet(MONTH, 'all');

  const allAssignments = await prisma.shiftAssignment.findMany({
    where: { effectiveFrom: { lte: MONTH + '-30' } },
    include: { shift: true },
    orderBy: { effectiveFrom: 'asc' },
  });

  const assignmentsByUser = {};
  for (const sa of allAssignments) {
    if (!sa.userId) continue;
    if (!assignmentsByUser[sa.userId]) assignmentsByUser[sa.userId] = [];
    const offDays = (sa.shift && sa.shift.weeklyOffDays) ? sa.shift.weeklyOffDays : [0];
    assignmentsByUser[sa.userId].push({ from: sa.effectiveFrom, offDays });
  }

  function getOffDaysForDate(userId, dateStr) {
    const list = assignmentsByUser[userId] || [];
    let offDays = [0];
    for (const a of list) {
      if (a.from <= dateStr) offDays = a.offDays;
    }
    return offDays;
  }

  function getMergedHolidays(branchId) {
    const h = new Set(holidaySet);
    if (branchId && branchHolidayCache[branchId]) {
      for (const d of branchHolidayCache[branchId]) h.add(d);
    }
    return h;
  }

  const salaries = await prisma.salaryStructure.findMany({
    where: {
      user: {
        companyId: COMPANY_ID, isActive: true,
        employeeId: { not: null },
        dateOfJoining: { lte: MONTH + '-30' },
      },
    },
    include: {
      user: {
        select: {
          id: true, name: true, employeeId: true, isActive: true,
          isAttendanceExempt: true, department: true, dateOfJoining: true,
          branchId: true, employeeType: true,
        },
      },
    },
  });

  const uniqueBranches = [...new Set(salaries.map(s => s.user.branchId).filter(Boolean))];
  for (const bid of uniqueBranches) {
    const bh = await prisma.branchHoliday.findMany({
      where: { branchId: bid, date: { startsWith: MONTH } },
    }).catch(() => []);
    branchHolidayCache[bid] = new Set(bh.map(h => h.date));
  }

  console.log('Processing ' + salaries.length + ' employees for ' + MONTH);
  let generated = 0, skipped = 0;
  const results = [];

  for (const sal of salaries) {
    const empId = sal.user.employeeId;
    if (sal.stopSalaryProcessing) {
      console.log(empId + ': STOPPED');
      skipped++;
      continue;
    }

    const existing = await prisma.payslip.findFirst({ where: { userId: sal.userId, month: MONTH } });
    if (existing) {
      console.log(empId + ': SKIPPED (exists)');
      skipped++;
      continue;
    }

    const isIntern = sal.user.employeeType === 'intern';
    let presentDays = 0, lopDays = 0;
    const mergedHolidays = getMergedHolidays(sal.user.branchId);
    const joinDateStr = sal.user.dateOfJoining ? sal.user.dateOfJoining.slice(0, 10) : null;

    const separation = await prisma.separation.findFirst({
      where: { userId: sal.userId, lastWorkingDate: { startsWith: MONTH } },
      select: { lastWorkingDate: true },
    });

    if (sal.user.isAttendanceExempt) {
      for (let d = 1; d <= DAYS_IN_MONTH; d++) {
        const ds = MONTH + '-' + String(d).padStart(2, '0');
        const dow = new Date(YEAR, MONTH_NUM - 1, d).getDay();
        const offDays = getOffDaysForDate(sal.userId, ds);
        const isOff = dow === 6 ? offSaturdaySet.has(ds) : offDays.includes(dow);
        if (!isOff && !mergedHolidays.has(ds) && ds <= today) presentDays++;
      }
    } else {
      const attendances = await prisma.attendance.findMany({
        where: { userId: sal.userId, date: { startsWith: MONTH } },
      });

      const approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          userId: sal.userId, status: 'approved',
          startDate: { lte: MONTH + '-30' },
          endDate: { gte: MONTH + '-01' },
        },
        select: { startDate: true, endDate: true, days: true, leaveType: { select: { code: true } } },
      });

      const leaveDatesSet = new Set();
      const lopDatesSet = new Set();
      let lopFromLeave = 0;

      for (const lr of approvedLeaves) {
        const isLop = isIntern || (lr.leaveType && lr.leaveType.code === 'LOP');
        const c = new Date(lr.startDate + 'T00:00:00Z');
        const e = new Date(lr.endDate + 'T00:00:00Z');
        let daysInMonth_ = 0;
        while (c <= e) {
          const ds = c.toISOString().slice(0, 10);
          if (ds.startsWith(MONTH)) {
            if (isLop) { lopDatesSet.add(ds); daysInMonth_++; }
            else leaveDatesSet.add(ds);
          }
          c.setDate(c.getDate() + 1);
        }
        if (isLop && daysInMonth_ > 0) {
          const totalDays = parseFloat(lr.days) || 0;
          const totalRange = Math.max(1, Math.round((new Date(lr.endDate + 'T00:00:00Z') - new Date(lr.startDate + 'T00:00:00Z')) / 86400000) + 1);
          lopFromLeave += Math.round((daysInMonth_ / totalRange) * totalDays * 2) / 2;
        }
      }

      if (
        attendances.length === 0 &&
        leaveDatesSet.size === 0 &&
        lopDatesSet.size === 0 &&
        !separation
      ) {
        for (let d = 1; d <= DAYS_IN_MONTH; d++) {
          const ds = MONTH + '-' + String(d).padStart(2, '0');
          const dow = new Date(YEAR, MONTH_NUM - 1, d).getDay();
          const offDays = getOffDaysForDate(sal.userId, ds);
          const isOff = dow === 6 ? offSaturdaySet.has(ds) : offDays.includes(dow);
          if (isOff || mergedHolidays.has(ds) || ds > today) continue;
          if (joinDateStr && ds < joinDateStr) continue;
          presentDays++;
        }
        lopDays += lopFromLeave;
      } else {
        const attMap = {};
        for (const att of attendances) attMap[att.date] = att.status;

        for (let d = 1; d <= DAYS_IN_MONTH; d++) {
          const ds = MONTH + '-' + String(d).padStart(2, '0');
          const dow = new Date(YEAR, MONTH_NUM - 1, d).getDay();
          const offDays = getOffDaysForDate(sal.userId, ds);
          const isOff = dow === 6 ? offSaturdaySet.has(ds) : offDays.includes(dow);
          if (isOff || mergedHolidays.has(ds) || ds > today) continue;
          if (separation && separation.lastWorkingDate && ds > separation.lastWorkingDate) continue;
          if (joinDateStr && ds < joinDateStr) continue;
          const status = attMap[ds];
          if (lopDatesSet.has(ds)) {
            // skip: already counted via lopFromLeave
          } else if (leaveDatesSet.has(ds) || status === 'on_leave') {
            presentDays += 1;
          } else if (status === 'present') {
            presentDays += 1;
          } else if (status === 'half_day') {
            presentDays += 0.5;
            lopDays += 0.5;
          } else if (status === 'absent') {
            lopDays += 1;
          } else if (!status && attendances.length > 0) {
            lopDays += 1;
          } else {
            presentDays += 1;
          }
        }

        if (
          separation &&
          separation.lastWorkingDate &&
          separation.lastWorkingDate.startsWith(MONTH)
        ) {
          const sepDeductDays = Math.max(0, LOP_DIVISOR - presentDays - lopDays);
          lopDays += sepDeductDays;
        }
        lopDays += lopFromLeave; // add calendar LOP from leave requests
      }
    }

    const earningComps = Array.isArray(sal.components)
      ? sal.components.filter(c => c.type === 'earning')
      : [];

    const getComp = (codes) =>
      earningComps.filter(c => codes.includes(c.code)).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

    const KNOWN = [
      'BASIC', 'HRA', 'DA', 'SPECIAL_ALLOWANCE',
      'MEDICAL_ALLOWANCE', 'CONVEYANCE', 'CONVEYANCE_ALLOWANCE',
    ];
    const otherComps = earningComps.filter(c => !KNOWN.includes(c.code));

    const payBasic = earningComps.length > 0 ? getComp(['BASIC']) : (sal.basic || 0);
    const payHra   = earningComps.length > 0 ? getComp(['HRA'])   : (sal.hra || 0);
    const payDa    = earningComps.length > 0 ? getComp(['DA'])    : (sal.da || 0);
    const paySpec  = earningComps.length > 0 ? getComp(['SPECIAL_ALLOWANCE'])                  : (sal.specialAllowance || 0);
    const payMed   = earningComps.length > 0 ? getComp(['MEDICAL_ALLOWANCE'])                  : (sal.medicalAllowance || 0);
    const payConv  = earningComps.length > 0 ? getComp(['CONVEYANCE', 'CONVEYANCE_ALLOWANCE']) : (sal.conveyanceAllowance || 0);
    const payOther = earningComps.length > 0
      ? otherComps.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
      : (sal.otherAllowance || 0);
    const otherLabel = otherComps.length > 0
      ? otherComps.map(c => c.name || c.code).join(', ')
      : null;

    const grossBase = earningComps.length > 0
      ? earningComps.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
      : (payBasic + payHra + payDa + paySpec + payMed + payConv + payOther);
    const grossEarnings = grossBase;

    const perDaySalary = LOP_DIVISOR > 0 ? grossBase / LOP_DIVISOR : 0;
    const lopDeduction = Math.round(perDaySalary * lopDays);

    // Salary advance repayment deduction for this month
    const advanceRepayments = await prisma.salaryAdvanceRepayment.findMany({
      where: { month: MONTH, status: 'pending', advance: { userId: sal.userId, status: { in: ['released', 'repaying'] } } },
    });
    const salaryAdvanceDeduction = advanceRepayments.reduce((sum, r) => sum + r.amount, 0);

    const isMidMonthSep = !!(
      separation &&
      separation.lastWorkingDate &&
      separation.lastWorkingDate.startsWith(MONTH)
    );
    const statBase  = isMidMonthSep ? Math.round(grossBase * presentDays / LOP_DIVISOR) : grossBase;
    const statBasic = isMidMonthSep ? Math.round(payBasic  * presentDays / LOP_DIVISOR) : payBasic;
    const statutory = calcStatutory(statBase, statBasic, sal.ptExempt || false, isIntern, payrollRules);

    const tds = sal.tds || 0;
    const totalDeductions = isIntern
      ? tds
      : (statutory.employeePf + statutory.employeeEsi + statutory.professionalTax + tds);
    const netPay = Math.round(grossEarnings - totalDeductions - lopDeduction - salaryAdvanceDeduction);

    await prisma.payslip.create({
      data: {
        userId: sal.userId,
        month: MONTH,
        year: YEAR,
        basic: payBasic,
        hra: payHra,
        da: payDa,
        specialAllowance: paySpec,
        medicalAllowance: payMed,
        conveyanceAllowance: payConv,
        otherAllowance: payOther,
        otherAllowanceLabel: otherLabel,
        grossEarnings,
        employerPf: statutory.employerPf,
        employerEsi: statutory.employerEsi,
        employeePf: statutory.employeePf,
        employeeEsi: statutory.employeeEsi,
        professionalTax: statutory.professionalTax,
        tds,
        totalDeductions: totalDeductions + lopDeduction + salaryAdvanceDeduction,
        netPay,
        workingDays: presentDays + lopDays,
        presentDays,
        lopDays,
        lopDeduction,
        salaryAdvanceDeduction,
        status: 'generated',
      },
    });

    // Mark advance repayments as deducted and update advance status
    if (advanceRepayments.length > 0) {
      await prisma.salaryAdvanceRepayment.updateMany({
        where: { id: { in: advanceRepayments.map(r => r.id) } },
        data: { status: 'deducted', deductedAt: new Date() },
      });
      for (const repayment of advanceRepayments) {
        const remaining = await prisma.salaryAdvanceRepayment.count({
          where: { advanceId: repayment.advanceId, status: 'pending' },
        });
        const advStatus = remaining === 0 ? 'closed' : 'repaying';
        await prisma.salaryAdvance.update({
          where: { id: repayment.advanceId },
          data: { status: advStatus, ...(remaining === 0 ? { closedAt: new Date() } : {}) },
        });
      }
    }

    generated++;
    results.push({
      empId,
      gross: grossEarnings,
      lopDays,
      lopDed: lopDeduction,
      advDed: salaryAdvanceDeduction,
      pf: statutory.employeePf,
      esi: statutory.employeeEsi,
      pt: statutory.professionalTax,
      tds,
      net: netPay,
    });
  }

  console.log('\nGenerated: ' + generated + ', Skipped: ' + skipped);
  console.log('\nEmpID      Gross    LopD LopDed AdvDed   PF   ESI   PT   TDS     Net');
  console.log('-'.repeat(73));
  for (const r of results) {
    console.log(
      r.empId.padEnd(10) + ' ' +
      String(r.gross).padStart(6) + ' ' +
      String(r.lopDays).padStart(5) + ' ' +
      String(r.lopDed).padStart(6) + ' ' +
      String(r.advDed).padStart(6) + ' ' +
      String(r.pf).padStart(5) + ' ' +
      String(r.esi).padStart(5) + ' ' +
      String(r.pt).padStart(5) + ' ' +
      String(r.tds).padStart(5) + ' ' +
      String(r.net).padStart(8)
    );
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
