/**
 * Bulk Payroll Generation — FY 2025-26 (Apr 2025 – Mar 2026)
 * Generates payslips for all employees (active + separated) for every month.
 * Skips months where payslip already exists.
 * Skips separated employees for months after their LWD.
 *
 * Run from server/ directory:
 *   node ../scripts/bulkPayroll.js
 */

const path = require('path');
// Load env from server/.env
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));

// ─── inline the payroll generation logic ────────────────────────────────────
// We invoke the payroll engine directly via Prisma rather than HTTP
// to avoid auth complexity. Same logic as POST /api/payroll/generate.

const { DEFAULT_PAYROLL_RULES, calcStatutory } = require(
  path.join(__dirname, '../server/src/utils/payrollRules')
);
const { getSaturdayPolicyForMonth, buildOffSaturdaySet } = require(
  path.join(__dirname, '../server/src/utils/saturdayPolicyHelper')
);

const prisma = new PrismaClient();

// Months to generate: Apr 2025 – Mar 2026
const MONTHS = [];
for (let m = 4; m <= 12; m++) MONTHS.push(`2025-${String(m).padStart(2, '0')}`);
for (let m = 1; m <= 3; m++)  MONTHS.push(`2026-${String(m).padStart(2, '0')}`);

// Company IDs to process
const COMPANY_IDS = [1, 2];

// Override: run only specific month/company if passed as env vars
// PAYROLL_MONTH=2025-05 PAYROLL_COMPANY=1 node scripts/bulkPayroll.js

async function generateMonth(companyId, month) {
  const [yr, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(yr, mo, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd   = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  // Get employees: active + separated whose LWD >= month start
  const salaries = await prisma.salaryStructure.findMany({
    where: {
      user: {
        companyId,
        dateOfJoining: { lte: monthEnd },
        employeeId: { not: null },
        OR: [
          { isActive: true },
          { isActive: false, separation: { lastWorkingDate: { gte: monthStart } } },
        ],
      },
      stopSalaryProcessing: false,
    },
    include: {
      user: {
        select: {
          id: true, name: true, employeeId: true, isActive: true,
          isAttendanceExempt: true, department: true, designation: true,
          dateOfJoining: true, gender: true, employeeType: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  if (salaries.length === 0) return { month, companyId, generated: 0, skipped: 0 };

  const allUserIds = salaries.map(s => s.userId);

  // Pre-fetch everything needed
  const [
    holidays,
    separations,
    allAttendance,
    allLeaveRequests,
    allLeaveTypes,
    allBalances,
    allPayslips,
    rulesRow,
    sandwichRow,
    allDailyReports,
    allRepayments,
    saturdayPolicy,
  ] = await Promise.all([
    prisma.holiday.findMany({ where: { date: { startsWith: month } } }),
    prisma.separation.findMany({
      where: { userId: { in: allUserIds } },
      select: { userId: true, lastWorkingDate: true, adjustedLWD: true, type: true },
    }),
    prisma.attendance.findMany({
      where: { userId: { in: allUserIds }, date: { startsWith: month } },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: allUserIds },
        status: 'approved',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: { leaveType: { select: { code: true } } },
    }),
    prisma.leaveType.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
    prisma.leaveBalance.findMany({ where: { userId: { in: allUserIds } } }),
    prisma.payslip.findMany({
      where: { userId: { in: allUserIds }, month },
      select: { userId: true, id: true },
    }),
    prisma.setting.findUnique({ where: { key: 'payroll_rules' } }),
    prisma.setting.findUnique({ where: { key: 'sandwich_leave_enabled' } }),
    prisma.dailyReport.findMany({
      where: { userId: { in: allUserIds }, reportDate: { startsWith: month } },
      select: { userId: true, reportDate: true },
    }),
    prisma.salaryAdvanceRepayment.findMany({
      where: { month, status: 'pending', advance: { userId: { in: allUserIds }, status: { in: ['repaying', 'released'] } } },
      include: { advance: { select: { userId: true } } },
    }),
    getSaturdayPolicyForMonth(companyId, month, prisma),
  ]);

  const existingPayslipUserIds = new Set(allPayslips.map(p => p.userId));
  const sepMap = new Map(separations.map(s => [s.userId, s]));
  const holidayDates = new Set(holidays.map(h => h.date));
  const payrollRules = rulesRow ? (() => { try { return JSON.parse(rulesRow.value); } catch { return DEFAULT_PAYROLL_RULES; } })() : DEFAULT_PAYROLL_RULES;
  const lopDivisor = payrollRules.lop?.divisor > 0 ? payrollRules.lop.divisor : daysInMonth;
  const sandwichEnabled = sandwichRow?.value === 'true';
  const offSaturdaySet = buildOffSaturdaySet(month, saturdayPolicy?.saturdayType || 'all');

  // Build daily report map: userId → Set of reportDate strings (muster fallback)
  const dailyReportMap = new Map();
  for (const dr of allDailyReports) {
    if (!dailyReportMap.has(dr.userId)) dailyReportMap.set(dr.userId, new Set());
    dailyReportMap.get(dr.userId).add(dr.reportDate);
  }

  // Build advance repayment map: userId → total deduction this month
  const advanceRepayMap = new Map();
  for (const rep of allRepayments) {
    const uid = rep.advance.userId;
    advanceRepayMap.set(uid, (advanceRepayMap.get(uid) || 0) + rep.amount);
  }

  let generated = 0, skipped = 0;

  for (const sal of salaries) {
    const userId = sal.userId;
    const user = sal.user;

    // Skip if payslip already exists
    if (existingPayslipUserIds.has(userId)) { skipped++; continue; }

    const sep = sepMap.get(userId) || null;
    const lwd = sep ? (sep.adjustedLWD || sep.lastWorkingDate) : null;

    // Skip if employee left before this month
    if (lwd && lwd < monthStart) { skipped++; continue; }

    // Calculate attendance
    const attRecords = allAttendance.filter(a => a.userId === userId);
    const userLeaves = allLeaveRequests.filter(l => l.userId === userId);

    const paidLeaveDates = new Set();
    const lopLeaveDates  = new Set();
    for (const lr of userLeaves) {
      let d = new Date(lr.startDate);
      const end = new Date(lr.endDate);
      while (d <= end) {
        const ds = d.toISOString().slice(0, 10);
        if (ds >= monthStart && ds <= monthEnd) {
          if (lr.leaveType?.code === 'LOP') lopLeaveDates.add(ds);
          else paidLeaveDates.add(ds);
        }
        d.setDate(d.getDate() + 1);
      }
    }

    const attMap = new Map(attRecords.map(a => [a.date, a.status]));
    const dailyReportDates = dailyReportMap.get(userId) || new Set();
    let presentDays = 0, lopDays = 0;

    const isExempt = sal.isAttendanceExempt || user.isAttendanceExempt;

    if (isExempt) {
      presentDays = lopDivisor;
      lopDays = 0;
    } else {
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${month}-${String(d).padStart(2, '0')}`;
        // Skip weekends (Sunday only) and holidays
        const dayOfWeek = new Date(ds).getDay();
        if (dayOfWeek === 0) continue; // Sunday

        // Skip days after LWD (pro-rata for mid-month separations)
        if (lwd && ds > lwd) continue;
        // Skip days before joining date
        const joinDate = user.dateOfJoining ? user.dateOfJoining.slice(0, 10) : null;
        if (joinDate && ds < joinDate) continue;

        if (holidayDates.has(ds)) {
          // Holiday clubbing (sandwich): if prev AND next working day are both LOP/absent,
          // the holiday is also LOP (employee can't take a free holiday inside an absent block).
          // If surrounded by paid-leave days the holiday stays paid (balance question, not salary).
          if (sandwichEnabled) {
            let prevLop = false, nextLop = false;
            for (let pd = d - 1; pd >= 1; pd--) {
              const pds = `${month}-${String(pd).padStart(2, '0')}`;
              if (new Date(pds).getDay() === 0 || holidayDates.has(pds)) continue;
              if (joinDate && pds < joinDate) continue;
              prevLop = attMap.get(pds) === 'absent' || lopLeaveDates.has(pds);
              break;
            }
            for (let nd = d + 1; nd <= daysInMonth; nd++) {
              const nds = `${month}-${String(nd).padStart(2, '0')}`;
              if (new Date(nds).getDay() === 0 || holidayDates.has(nds)) continue;
              if (lwd && nds > lwd) continue;
              nextLop = attMap.get(nds) === 'absent' || lopLeaveDates.has(nds);
              break;
            }
            if (prevLop && nextLop) {
              lopDays += 1; // Holiday sandwiched between LOP days → LOP
            } else {
              presentDays += 1; // Normal holiday → paid
            }
          } else {
            presentDays += 1; // Holiday = paid (no sandwich policy)
          }
          continue;
        }

        const status = attMap.get(ds);
        if (lopLeaveDates.has(ds)) {
          lopDays += 1;
        } else if (paidLeaveDates.has(ds) || status === 'on_leave') {
          presentDays += 1;
        } else if (status === 'present') {
          presentDays += 1;
        } else if (status === 'half_day') {
          presentDays += 0.5; lopDays += 0.5;
        } else if (status === 'absent') {
          lopDays += 1;
        } else if (!status && attRecords.length > 0) {
          // No biometric for this day but employee has biometric records this month
          // Priority 1: muster check (EOD daily report submitted = was present)
          if (dailyReportDates.has(ds)) {
            presentDays += 1;
          } else if (sandwichEnabled) {
            // Priority 2: biometric sandwich — prev AND next working day both present/on_leave
            // (on_leave counts as "working" — approved leave is not a gap)
            let prevPresent = false, nextPresent = false;
            for (let pd = d - 1; pd >= 1; pd--) {
              const pds = `${month}-${String(pd).padStart(2, '0')}`;
              const pdow = new Date(pds).getDay();
              if (pdow === 0 || holidayDates.has(pds)) continue;
              const ps = attMap.get(pds);
              prevPresent = ps === 'present' || ps === 'on_leave' || paidLeaveDates.has(pds);
              break;
            }
            for (let nd = d + 1; nd <= daysInMonth; nd++) {
              const nds = `${month}-${String(nd).padStart(2, '0')}`;
              const ndow = new Date(nds).getDay();
              if (ndow === 0 || holidayDates.has(nds)) continue;
              const ns = attMap.get(nds);
              nextPresent = ns === 'present' || ns === 'on_leave' || paidLeaveDates.has(nds);
              break;
            }
            if (prevPresent && nextPresent) {
              presentDays += 1; // Sandwiched → present
            } else {
              lopDays += 1;
            }
          } else {
            lopDays += 1;
          }
        } else if (!status) {
          // No biometric records at all for this employee this month
          // Check muster fallback first
          if (dailyReportDates.has(ds)) {
            presentDays += 1;
          } else {
            presentDays += 1; // No data = assume present
          }
        }
      }
    }

    // Earnings
    const fieldSum = (sal.basic||0)+(sal.hra||0)+(sal.da||0)+(sal.specialAllowance||0)+(sal.medicalAllowance||0)+(sal.conveyanceAllowance||0)+(sal.otherAllowance||0);
    const earningComps = Array.isArray(sal.components) ? sal.components.filter(c => c.type === 'earning') : [];
    const componentSum = earningComps.reduce((s, c) => s + (c.amount||0), 0);
    const grossBase = sal.grossEarnings || Math.max(fieldSum, componentSum) || 0;
    const grossEarnings = grossBase;

    // LOP deduction
    let lopDeduction = 0;
    if (lopDays > 0 && lopDivisor > 0) {
      if (earningComps.length > 0) {
        const workDays = lopDivisor - lopDays;
        const proratedBase = earningComps.reduce((s, c) => s + Math.round(parseFloat(c.amount||0) * workDays / lopDivisor), 0);
        lopDeduction = grossBase - proratedBase;
      } else {
        lopDeduction = Math.round(grossBase / lopDivisor * lopDays);
      }
    }

    // Statutory
    const earnedBase = Math.max(0, grossEarnings - lopDeduction);
    const earnedBasic = lopDivisor > 0 ? (sal.basic||0) * (lopDivisor - lopDays) / lopDivisor : (sal.basic||0);
    const isIntern = user.employeeType === 'intern';
    const ptExempt = sal.ptExempt || false;
    const statutory = calcStatutory(earnedBase, earnedBasic, ptExempt, isIntern, payrollRules, user.gender, mo, undefined);

    const totalDeductions = isIntern ? (sal.tds||0) : (statutory.employeePf + statutory.employeeEsi + statutory.professionalTax + (sal.tds||0));

    // Salary advance repayment deduction for this month
    const advanceDeduction = Math.round(advanceRepayMap.get(userId) || 0);
    const netPay = grossEarnings - totalDeductions - lopDeduction - advanceDeduction;

    // Build earningsBreakdown from components
    const earningsBreakdown = earningComps.length > 0
      ? earningComps.map(c => ({ name: c.name || c.label, amount: c.amount || 0 }))
      : null;

    try {
      const payslipId = await prisma.payslip.upsert({
        where: { userId_month: { userId, month } },
        create: {
          userId, month, year: yr,
          companyName: user.company?.name || null,
          designation: user.designation,
          dateOfJoining: user.dateOfJoining,
          basic: sal.basic||0, hra: sal.hra||0, da: sal.da||0,
          specialAllowance: sal.specialAllowance||0,
          medicalAllowance: sal.medicalAllowance||0,
          conveyanceAllowance: sal.conveyanceAllowance||0,
          otherAllowance: sal.otherAllowance||0,
          grossEarnings,
          employeePf: statutory.employeePf,
          employerPf: statutory.employerPf,
          employeeEsi: statutory.employeeEsi,
          employerEsi: statutory.employerEsi,
          professionalTax: statutory.professionalTax,
          tds: sal.tds||0,
          lopDeduction: Math.round(lopDeduction),
          totalDeductions: Math.round(totalDeductions + lopDeduction + advanceDeduction),
          netPay: Math.round(netPay),
          workingDays: lopDivisor,
          presentDays: Math.round(presentDays * 10) / 10,
          lopDays: Math.round(lopDays * 10) / 10,
          status: 'published',
          generatedAt: new Date(),
          ...(earningsBreakdown ? { earningsBreakdown } : {}),
        },
        update: {}, // Don't overwrite existing
        select: { id: true },
      });

      // Mark advance repayments as deducted and link to payslip
      if (advanceDeduction > 0) {
        const repayIds = allRepayments
          .filter(r => r.advance.userId === userId)
          .map(r => r.id);
        if (repayIds.length > 0) {
          await prisma.salaryAdvanceRepayment.updateMany({
            where: { id: { in: repayIds } },
            data: { status: 'deducted', payslipId: payslipId.id, deductedAt: new Date() },
          });
          // If all repayments done, close the advance
          for (const rep of allRepayments.filter(r => r.advance.userId === userId)) {
            const remaining = await prisma.salaryAdvanceRepayment.count({
              where: { advanceId: rep.advanceId, status: 'pending' },
            });
            if (remaining === 0) {
              await prisma.salaryAdvance.update({ where: { id: rep.advanceId }, data: { status: 'closed', closedAt: new Date() } });
            }
          }
        }
      }

      generated++;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ERROR ${user.name} ${month}: ${err.message}`);
    }
  }

  return { month, companyId, generated, skipped };
}

async function main() {
  const filterMonth = process.env.PAYROLL_MONTH;
  const filterCompany = process.env.PAYROLL_COMPANY ? parseInt(process.env.PAYROLL_COMPANY) : null;
  const months = filterMonth ? [filterMonth] : MONTHS;
  const companies = filterCompany ? [filterCompany] : COMPANY_IDS;

  console.log(`Generating payroll for ${months.length} months × ${companies.length} companies\n`);
  let totalGen = 0, totalSkip = 0;

  for (const companyId of companies) {
    console.log(`\n── Company ${companyId} ──`);
    for (const month of months) {
      process.stdout.write(`  ${month}: `);
      const result = await generateMonth(companyId, month);
      console.log(` → ${result.generated} generated, ${result.skipped} skipped`);
      totalGen += result.generated;
      totalSkip += result.skipped;
    }
  }

  console.log(`\n✓ Done: ${totalGen} payslips generated, ${totalSkip} skipped`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
