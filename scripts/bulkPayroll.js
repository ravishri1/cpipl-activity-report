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

const { DEFAULT_PAYROLL_RULES, calcStatutory, calcLWF } = require(
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

  // Get employees active during this month:
  //   a) isActive:true AND (no separation OR separation LWD >= monthStart)
  //   b) isActive:false AND separation LWD >= monthStart
  // This excludes employees whose isActive is still true but LWD fell before this month.
  const salaries = await prisma.salaryStructure.findMany({
    where: {
      user: {
        companyId,
        dateOfJoining: { lte: monthEnd },
        employeeId: { not: null },
        OR: [
          { isActive: true, OR: [{ separation: null }, { separation: { lastWorkingDate: { gte: monthStart } } }] },
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
    allOffDayEligibility,
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
    prisma.offDayAllowanceEligibility.findMany({
      where: {
        userId: { in: allUserIds },
        eligibleFrom: { lte: monthEnd },
        OR: [{ eligibleTo: null }, { eligibleTo: { gte: monthStart } }],
      },
      select: { userId: true, eligibleFrom: true, eligibleTo: true, saturdayType: true },
    }),
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

  // Build off-day eligibility map: userId → eligibility record
  const offDayEligibilityMap = new Map();
  for (const e of allOffDayEligibility) {
    offDayEligibilityMap.set(e.userId, e);
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

    const paidLeaveDates    = new Set();
    const lopLeaveDates     = new Set(); // LOP dates (including sandwiched Sundays/holidays within LOP ranges)
    const halfLopLeaveDates = new Set(); // Half-day LOP dates (first_half / second_half session)

    for (const lr of userLeaves) {
      const isLop     = lr.leaveType?.code === 'LOP';
      const isHalfDay = lr.session === 'first_half' || lr.session === 'second_half';

      // Collect calendar days in this leave range that fall within the month
      const rangeDays = [];
      const cur = new Date(lr.startDate + 'T00:00:00Z');
      const end = new Date(lr.endDate + 'T00:00:00Z');
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        if (ds >= monthStart && ds <= monthEnd) {
          rangeDays.push({ ds, dow: cur.getUTCDay(), isHol: holidayDates.has(ds) });
        }
        cur.setDate(cur.getDate() + 1);
      }

      if (!isLop) {
        for (const { ds } of rangeDays) paidLeaveDates.add(ds);
        continue;
      }

      // LOP range: replicate route logic — include off-Saturdays in LOP numerator
      // (denominator = calendar days so off-Saturdays must be in numerator too).
      // Sandwich rule: Sundays/holidays between LOP working days also count as LOP.
      let prevLopSeen = false;
      for (let i = 0; i < rangeDays.length; i++) {
        const { ds, dow, isHol } = rangeDays[i];
        const isSunday = dow === 0;
        if (!isSunday && !isHol) {
          // Regular/working day (weekday or off-Saturday) → LOP
          lopLeaveDates.add(ds);
          if (isHalfDay) halfLopLeaveDates.add(ds);
          prevLopSeen = true;
        } else if (prevLopSeen) {
          // Sunday or holiday: apply sandwich rule
          let hasLopAfter = false;
          for (let j = i + 1; j < rangeDays.length; j++) {
            if (!rangeDays[j].isHol && rangeDays[j].dow !== 0) { hasLopAfter = true; break; }
          }
          if (hasLopAfter) lopLeaveDates.add(ds); // sandwiched → LOP
        }
      }
    }

    // Cross-leave Sunday/holiday sandwich:
    // If a Sunday (or holiday) sits between full-day LOP-leave working days from two
    // adjacent but separate leave requests, it counts as LOP — same as within one leave.
    // Half-day LOP on the preceding working day disqualifies the sandwich: the employee
    // was partly present that day, so the gap is not a continuous absence.
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${month}-${String(d).padStart(2, '0')}`;
      if (lopLeaveDates.has(ds)) continue; // already counted
      const dow = new Date(ds).getDay();
      const isGap = dow === 0 || holidayDates.has(ds); // Sunday or holiday
      if (!isGap) continue;
      let prevLop = false, prevIsHalf = false, nextLop = false;
      for (let pd = d - 1; pd >= 1; pd--) {
        const pds = `${month}-${String(pd).padStart(2, '0')}`;
        const pdow = new Date(pds).getDay();
        if (pdow === 0 || holidayDates.has(pds)) continue;
        if (pdow === 6 && offSaturdaySet.has(pds) && !lopLeaveDates.has(pds)) continue;
        prevLop = lopLeaveDates.has(pds);
        prevIsHalf = halfLopLeaveDates.has(pds);
        break;
      }
      // Only sandwich if previous working day was a full-day LOP
      if (!prevLop || prevIsHalf) continue;
      for (let nd = d + 1; nd <= daysInMonth; nd++) {
        const nds = `${month}-${String(nd).padStart(2, '0')}`;
        const ndow = new Date(nds).getDay();
        if (ndow === 0 || holidayDates.has(nds)) continue;
        if (ndow === 6 && offSaturdaySet.has(nds) && !lopLeaveDates.has(nds)) continue;
        nextLop = lopLeaveDates.has(nds);
        break;
      }
      if (nextLop) lopLeaveDates.add(ds);
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
        const dayOfWeek = new Date(ds).getDay();
        // Sundays: skip normally; count as LOP if sandwiched within a LOP leave range
        // Sundays are always paid weekly offs — never apply attendance-based sandwich.
        // Only a LOP leave that explicitly spans the Sunday (via cross-leave sandwich above)
        // converts it to LOP. Absent days on both sides of a Sunday do NOT make it LOP.
        if (dayOfWeek === 0) {
          if (lopLeaveDates.has(ds)) {
            lopDays += 1; // Leave-sandwiched Sunday → LOP
          } else {
            // Paid weekly off: count as present only within the employment period
            // (matters for mid-month separation proration — invisible Sundays would
            // otherwise inflate the separation deduction and under-pay the employee).
            const joinDate2 = user.dateOfJoining ? user.dateOfJoining.slice(0, 10) : null;
            const withinEmployment = (!joinDate2 || ds >= joinDate2) && (!lwd || ds <= lwd);
            if (withinEmployment) presentDays += 1;
          }
          continue;
        }
        // Off-Saturdays: skip if not in a LOP leave range (it's their day off);
        // BUT count as LOP if sandwiched between absent working days
        if (dayOfWeek === 6 && offSaturdaySet.has(ds) && !lopLeaveDates.has(ds)) {
          if (sandwichEnabled) {
            let prevLop = false, nextLop = false;
            for (let pd = d - 1; pd >= 1; pd--) {
              const pds = `${month}-${String(pd).padStart(2, '0')}`;
              const pdow = new Date(pds).getDay();
              if (pdow === 0 || (pdow === 6 && offSaturdaySet.has(pds) && !lopLeaveDates.has(pds)) || holidayDates.has(pds)) continue;
              const joinDate2 = user.dateOfJoining ? user.dateOfJoining.slice(0, 10) : null;
              if (joinDate2 && pds < joinDate2) continue;
              prevLop = attMap.get(pds) === 'absent' || lopLeaveDates.has(pds);
              break;
            }
            if (prevLop) {
              for (let nd = d + 1; nd <= daysInMonth; nd++) {
                const nds = `${month}-${String(nd).padStart(2, '0')}`;
                const ndow = new Date(nds).getDay();
                if (ndow === 0 || (ndow === 6 && offSaturdaySet.has(nds) && !lopLeaveDates.has(nds)) || holidayDates.has(nds)) continue;
                if (lwd && nds > lwd) continue;
                nextLop = attMap.get(nds) === 'absent' || lopLeaveDates.has(nds);
                break;
              }
            }
            if (prevLop && nextLop) lopDays += 1;
          }
          continue;
        }

        // Skip days after LWD (pro-rata for mid-month separations)
        if (lwd && ds > lwd) continue;
        // Skip days before joining date
        const joinDate = user.dateOfJoining ? user.dateOfJoining.slice(0, 10) : null;
        if (joinDate && ds < joinDate) continue;

        // Weekly off days (Sunday, off-Saturday) are always paid — never count as LOP
        // unless explicitly marked as LOP leave. This matters for mid-month separations
        // where Sundays within the employment period must be counted as paid days.
        const dow = new Date(ds).getDay();
        const isWeeklyOffDay = dow === 0 || (dow === 6 && offSaturdaySet.has(ds));
        if (isWeeklyOffDay && !lopLeaveDates.has(ds)) {
          presentDays += 1;
          continue;
        }

        if (holidayDates.has(ds)) {
          // Holiday clubbing (sandwich): if prev AND next working day are both LOP/absent,
          // the holiday is also LOP (employee can't take a free holiday inside an absent block).
          // If surrounded by paid-leave days the holiday stays paid (balance question, not salary).
          if (sandwichEnabled) {
            let prevLop = false, nextLop = false;
            for (let pd = d - 1; pd >= 1; pd--) {
              const pds = `${month}-${String(pd).padStart(2, '0')}`;
              const pdow = new Date(pds).getDay();
              if (pdow === 0 || (pdow === 6 && offSaturdaySet.has(pds)) || holidayDates.has(pds)) continue;
              if (joinDate && pds < joinDate) continue;
              prevLop = attMap.get(pds) === 'absent' || lopLeaveDates.has(pds);
              break;
            }
            for (let nd = d + 1; nd <= daysInMonth; nd++) {
              const nds = `${month}-${String(nd).padStart(2, '0')}`;
              const ndow = new Date(nds).getDay();
              if (ndow === 0 || (ndow === 6 && offSaturdaySet.has(nds)) || holidayDates.has(nds)) continue;
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
          // Half-day LOP: employee worked the other half — credit 0.5 present, deduct 0.5 LOP
          if (halfLopLeaveDates.has(ds)) {
            presentDays += 0.5; lopDays += 0.5;
          } else {
            lopDays += 1;
          }
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
              if (pdow === 0 || (pdow === 6 && offSaturdaySet.has(pds)) || holidayDates.has(pds)) continue;
              const ps = attMap.get(pds);
              prevPresent = ps === 'present' || ps === 'on_leave' || paidLeaveDates.has(pds);
              break;
            }
            for (let nd = d + 1; nd <= daysInMonth; nd++) {
              const nds = `${month}-${String(nd).padStart(2, '0')}`;
              const ndow = new Date(nds).getDay();
              if (ndow === 0 || (ndow === 6 && offSaturdaySet.has(nds)) || holidayDates.has(nds)) continue;
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

    // Pro-rata: mid-month separation (employee left during this month)
    if (lwd && lwd >= monthStart && lwd <= monthEnd) {
      const separationDeductDays = Math.max(0, lopDivisor - presentDays - lopDays);
      lopDays += separationDeductDays;
    }

    // Pro-rata: mid-month joiner (employee joined during this month)
    // Use CALENDAR days before joining (matches Excel: salary = grossBase × calendarDaysInMonth/31)
    const joinDate = user.dateOfJoining ? user.dateOfJoining.slice(0, 10) : null;
    if (joinDate && joinDate > monthStart && joinDate <= monthEnd) {
      const joinDay = parseInt(joinDate.slice(8, 10));
      lopDays += joinDay - 1; // Calendar days before joining (day 1 to joinDay-1)
    }

    // Earnings
    const fieldSum = (sal.basic||0)+(sal.hra||0)+(sal.da||0)+(sal.specialAllowance||0)+(sal.medicalAllowance||0)+(sal.conveyanceAllowance||0)+(sal.otherAllowance||0);
    const earningComps = Array.isArray(sal.components) ? sal.components.filter(c => c.type === 'earning') : [];
    const componentSum = earningComps.reduce((s, c) => s + (c.amount||0), 0);
    const grossBase = sal.grossEarnings || Math.max(fieldSum, componentSum) || 0;

    // Off-day allowance: dynamically calculated ONLY for employees with an
    // offDayAllowanceEligibility record AND no fixed SUNDAY_ALLOWANCE salary component.
    //
    // Two distinct cases:
    //   1. Fixed component  — employee has a "SUNDAY_ALLOWANCE" (or "Sunday Allowance") entry
    //      in their salary structure components. It is already part of grossBase and is paid
    //      every month regardless of attendance. No additional dynamic calculation is done.
    //   2. Eligibility record — employee has an offDayAllowanceEligibility row. They receive
    //      extra pay (grossBase / daysInMonth × offDaysWorked) ONLY for the off-days they
    //      actually worked. This is a true variable earning on top of their fixed salary.
    //
    // If both exist the fixed component takes precedence — dynamic calc is skipped to
    // avoid double-counting the same allowance.
    const hasSundayAllowanceComponent = earningComps.some(
      c => (c.name || '').toUpperCase().replace(/[\s_\-]/g, '') === 'SUNDAYALLOWANCE'
    );

    let offDayAllowance = 0;
    let offDaysWorked = 0;
    const offDayElig = offDayEligibilityMap.get(userId);
    if (offDayElig && !hasSundayAllowanceComponent) {
      // Per-employee Saturday policy: use eligibility record's saturdayType if set, else company policy
      const empSatType = offDayElig.saturdayType || saturdayPolicy?.saturdayType || 'none';
      const empOffSatSet = buildOffSaturdaySet(month, empSatType);
      const attRecForOffDay = allAttendance.filter(a => a.userId === userId);
      const attMapOffDay = new Map(attRecForOffDay.map(a => [a.date, a.status]));
      const dailyReportDatesOffDay = dailyReportMap.get(userId) || new Set();
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${month}-${String(d).padStart(2, '0')}`;
        if (ds < offDayElig.eligibleFrom) continue;
        if (offDayElig.eligibleTo && ds > offDayElig.eligibleTo) continue;
        const dow = new Date(ds).getDay();
        const isWeeklyOff = dow === 6 ? empOffSatSet.has(ds) : dow === 0;
        const isHoliday = holidayDates.has(ds);
        if (!isWeeklyOff && !isHoliday) continue;
        // Count if employee was present on this off-day
        const status = attMapOffDay.get(ds);
        if (status === 'present') {
          offDaysWorked++;
        } else if (!status && dailyReportDatesOffDay.has(ds)) {
          offDaysWorked++;
        }
      }
      offDayAllowance = daysInMonth > 0 ? Math.round((grossBase / daysInMonth) * offDaysWorked) : 0;
    }

    const grossEarnings = grossBase + offDayAllowance;

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
    // ESI eligibility is determined by the employee's FIXED monthly gross (from salary structure),
    // NOT by the earned amount after LOP. An employee whose gross salary > ₹21,000 is never
    // ESI-covered — a month with heavy LOP does not make them eligible. This matches ESI Act:
    // eligibility is fixed at contribution period start based on regular wages, not month-to-month
    // fluctuations. We apply ESI deduction on earnedBase if eligible.
    const esiCeiling = (payrollRules.esi || {}).grossCeiling || 21000;
    const esicEligible = grossBase > 0 && grossBase <= esiCeiling;
    const statutory = calcStatutory(earnedBase, earnedBasic, ptExempt, isIntern, payrollRules, user.gender, mo, esicEligible);

    // LWF (Labour Welfare Fund) — deducted in June (6) and December (12).
    // Rules are stored in payroll_rules.lwf (employeeAmount, employerAmount, months).
    // Maharashtra standard: employee ₹25, employer ₹75 per half-year.
    // Only applies to ESI-covered employees.
    // Mid-month joiners (joined after month start) and mid-month leavers (left before month end)
    // are EXEMPT from LWF for that month — they don't complete the contribution period.
    const isMidMonthJoiner = joinDate && joinDate > monthStart;
    const isMidMonthLeaver = lwd && lwd < monthEnd;
    const lwfRules = payrollRules.lwf || DEFAULT_PAYROLL_RULES.lwf;
    const { lwfEmployee: lwfEmployeeAmt, lwfEmployer: lwfEmployerAmt } = calcLWF(esicEligible, mo, isIntern, lwfRules);
    const lwfEmployee = (isMidMonthJoiner || isMidMonthLeaver) ? 0 : lwfEmployeeAmt;
    const lwfEmployer = (isMidMonthJoiner || isMidMonthLeaver) ? 0 : lwfEmployerAmt;

    const totalDeductions = isIntern ? (sal.tds||0) : (statutory.employeePf + statutory.employeeEsi + statutory.professionalTax + (sal.tds||0) + lwfEmployee);

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
          lwfEmployee,
          lwfEmployer,
          totalDeductions: Math.round(totalDeductions + lopDeduction + advanceDeduction),
          netPay: Math.round(netPay),
          workingDays: lopDivisor,
          presentDays: Math.round(presentDays * 10) / 10,
          lopDays: Math.round(lopDays * 10) / 10,
          offDayAllowance,
          offDaysWorked,
          salaryAdvanceDeduction: advanceDeduction,
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
