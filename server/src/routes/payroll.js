const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { parseId, requireFields } = require('../utils/validate');
const { getWeeklyOffMap } = require('../services/attendance/weeklyOffHelper');
const { getSaturdayPolicyForMonth, buildOffSaturdaySet } = require('../utils/saturdayPolicyHelper');

const router = express.Router();
router.use(authenticate);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'sub_admin' || user.role === 'team_lead'; }

// GET /salary-list — All employees with their salary structures (admin)
router.get('/salary-list', requireAdmin, asyncHandler(async (req, res) => {
  const employees = await req.prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, employeeId: true, department: true, designation: true,
      salaryStructure: {
        select: {
          ctcAnnual: true, ctcMonthly: true, basic: true, hra: true, da: true,
          specialAllowance: true, medicalAllowance: true, conveyanceAllowance: true,
          otherAllowance: true, otherAllowanceLabel: true,
          employerPf: true, employerEsi: true, employeePf: true, employeeEsi: true,
          professionalTax: true, tds: true, netPayMonthly: true,
          effectiveFrom: true, stopSalaryProcessing: true, notes: true,
        },
      },
      salaryRevisions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, oldCtc: true, newCtc: true, revisionType: true },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(employees);
}));

// GET /salary/:userId — Get salary structure (admin or self)
router.get('/salary/:userId', requireActiveEmployee, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden('Access denied');

  const salary = await req.prisma.salaryStructure.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, email: true, employeeId: true, designation: true, department: true } } },
  });
  if (!salary) throw notFound('Salary structure');
  res.json(salary);
}));

// PUT /salary/:userId — Set/update salary (admin)
router.put('/salary/:userId', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const d = req.body;

  // Support both new flexible components array and legacy individual fields
  const earningComps = Array.isArray(d.components) ? d.components.filter(c => c.type === 'earning') : [];
  const getComp = (code) => parseFloat(earningComps.find(c => c.code === code)?.amount) || 0;
  const grossEarnings = earningComps.length > 0
    ? earningComps.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
    : (d.basic || 0) + (d.hra || 0) + (d.da || 0) + (d.specialAllowance || 0) +
      (d.medicalAllowance || 0) + (d.conveyanceAllowance || 0) + (d.otherAllowance || 0);
  const totalDeductions = (d.employeePf || 0) + (d.employeeEsi || 0) + (d.professionalTax || 0) + (d.tds || 0);
  const netPayMonthly = grossEarnings - totalDeductions;

  const data = {
    ctcAnnual: d.ctcAnnual || 0, ctcMonthly: d.ctcMonthly || (d.ctcAnnual ? d.ctcAnnual / 12 : 0),
    // Legacy fields — derived from components when available (backward compat with old payslip generation)
    basic: getComp('BASIC') || d.basic || 0,
    hra: getComp('HRA') || d.hra || 0,
    da: getComp('DA') || d.da || 0,
    specialAllowance: getComp('SPECIAL_ALLOWANCE') || d.specialAllowance || 0,
    medicalAllowance: getComp('MEDICAL_ALLOWANCE') || d.medicalAllowance || 0,
    conveyanceAllowance: getComp('CONVEYANCE_ALLOWANCE') || d.conveyanceAllowance || 0,
    otherAllowance: getComp('OTHER') || d.otherAllowance || 0,
    otherAllowanceLabel: d.otherAllowanceLabel || null,
    // CTC employer-side components
    variablePay: d.variablePay || 0,
    medicalPremium: d.medicalPremium || 0,
    // Deductions (pre-calculated by frontend)
    employerPf: d.employerPf || 0, employerEsi: d.employerEsi || 0,
    employeePf: d.employeePf || 0, employeeEsi: d.employeeEsi || 0,
    professionalTax: d.professionalTax || 0, tds: d.tds || 0,
    netPayMonthly,
    effectiveFrom: d.effectiveFrom || null,
    notes: d.notes || null,
    // Flexible components JSON — THIS is what the UI reads back
    components: d.components && d.components.length > 0 ? d.components : null,
  };

  const existing = await req.prisma.salaryStructure.findUnique({ where: { userId } });
  const salary = await req.prisma.salaryStructure.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  if (existing && existing.ctcAnnual !== data.ctcAnnual) {
    const diff = data.ctcAnnual - existing.ctcAnnual;
    await req.prisma.salaryRevision.create({
      data: {
        userId, effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
        oldCtc: existing.ctcAnnual, newCtc: data.ctcAnnual,
        reason: d.revisionReason || 'Salary structure updated', revisedBy: req.user.id,
        revisionType: diff > 0 ? 'increment' : 'decrement',
      },
    });
  } else if (!existing) {
    await req.prisma.salaryRevision.create({
      data: {
        userId, effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
        oldCtc: 0, newCtc: data.ctcAnnual,
        reason: 'Initial salary structure created', revisedBy: req.user.id,
        revisionType: 'initial',
      },
    });
  }
  res.json(salary);
}));

// GET /salary/:userId/revisions — Revision history (admin or self)
router.get('/salary/:userId/revisions', requireActiveEmployee, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden('Access denied');

  const revisions = await req.prisma.salaryRevision.findMany({
    where: { userId },
    include: { revisedByUser: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(revisions);
}));

// GET /overview?month=YYYY-MM&companyId=1 — Payroll overview for a month (greytHR-style)
router.get('/overview', requireAdmin, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  const companyId = req.query.companyId ? parseInt(req.query.companyId) : null;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const companyFilter = companyId ? { companyId } : {};

  // Payslip aggregates — filtered by company if provided
  const payslips = await req.prisma.payslip.findMany({
    where: { month, ...(companyId ? { user: { companyId } } : {}) },
  });
  const totalGross = payslips.reduce((s, p) => s + (p.grossEarnings || 0), 0);
  const totalDeductions = payslips.reduce((s, p) => s + (p.totalDeductions || 0), 0);
  const totalNetPay = payslips.reduce((s, p) => s + (p.netPay || 0), 0);
  const totalLop = payslips.reduce((s, p) => s + (p.lopDeduction || 0), 0);
  const totalBasic = payslips.reduce((s, p) => s + (p.basic || 0), 0);
  const totalHra = payslips.reduce((s, p) => s + (p.hra || 0), 0);
  const totalPf = payslips.reduce((s, p) => s + (p.employeePf || 0), 0);
  const totalEsi = payslips.reduce((s, p) => s + (p.employeeEsi || 0), 0);
  const totalPt = payslips.reduce((s, p) => s + (p.professionalTax || 0), 0);
  const totalTds = payslips.reduce((s, p) => s + (p.tds || 0), 0);
  const workingDays = payslips.length > 0 ? payslips[0].workingDays : daysInMonth;

  // Employee counts — filtered by company + joined by monthEnd
  const totalActiveEmployees = await req.prisma.user.count({
    where: { isActive: true, dateOfJoining: { lte: monthEnd }, ...companyFilter },
  });
  const additions = await req.prisma.user.count({
    where: { isActive: true, dateOfJoining: { gte: monthStart, lte: monthEnd }, ...companyFilter },
  });
  const separations = await req.prisma.separation.count({
    where: { lastWorkingDate: { gte: monthStart, lte: monthEnd }, ...(companyId ? { user: { companyId } } : {}) },
  });
  const exclusions = await req.prisma.user.count({
    where: { isActive: true, dateOfJoining: { lte: monthEnd }, salaryStructure: null, ...companyFilter },
  });
  const stoppedSalaryCount = await req.prisma.salaryStructure.count({
    where: { stopSalaryProcessing: true, user: { isActive: true, dateOfJoining: { lte: monthEnd }, ...companyFilter } },
  });

  // Payslip status counts
  const generated = payslips.filter(p => p.status === 'generated').length;
  const published = payslips.filter(p => p.status === 'published').length;
  const draft = payslips.filter(p => p.status === 'draft').length;

  // Settled employees (separated in this month with last working date)
  const settledEmployees = await req.prisma.separation.findMany({
    where: { lastWorkingDate: { gte: monthStart, lte: monthEnd } },
    include: { user: { select: { id: true, name: true, employeeId: true, driveProfilePhotoUrl: true } } },
    orderBy: { lastWorkingDate: 'desc' },
  });

  // Negative salary payslips (netPay < 0)
  const negativeSalary = payslips.filter(p => (p.netPay || 0) < 0).map(p => p.userId);
  const negativeSalaryUsers = negativeSalary.length > 0
    ? await req.prisma.user.findMany({
        where: { id: { in: negativeSalary } },
        select: { id: true, name: true, employeeId: true },
      })
    : [];

  // Payout pending (generated but not published)
  const payoutPending = payslips.filter(p => p.status === 'generated').length;

  // Lock/release settings
  const lockKeys = ['payroll_inputs_locked', 'employee_view_released', 'it_statement_released', 'payroll_locked'];
  const settings = await req.prisma.setting.findMany({ where: { key: { in: lockKeys } } });
  const lockMap = {};
  for (const s of settings) lockMap[s.key] = s.value === 'true';

  res.json({
    month, year, monthNum, daysInMonth, workingDays,
    cutoffFrom: monthStart, cutoffTo: monthEnd,
    totals: { totalGross, totalDeductions, totalNetPay, totalLop, totalBasic, totalHra, totalPf, totalEsi, totalPt, totalTds },
    employees: { total: totalActiveEmployees, additions, separations, exclusions, settlements: settledEmployees.length, stoppedSalary: stoppedSalaryCount },
    status: { payslipCount: payslips.length, generated, published, draft },
    locks: {
      payrollInputsLocked: lockMap.payroll_inputs_locked || false,
      employeeViewReleased: lockMap.employee_view_released || false,
      itStatementReleased: lockMap.it_statement_released || false,
      payrollLocked: lockMap.payroll_locked || false,
    },
    cards: {
      negativeSalary: negativeSalaryUsers,
      settledEmployees: settledEmployees.map(s => ({
        id: s.user?.id, name: s.user?.name, employeeId: s.user?.employeeId,
        photo: s.user?.driveProfilePhotoUrl, lastWorkingDay: s.lastWorkingDate,
      })),
      payoutPending,
    },
  });
}));

// PUT /overview/locks — Update lock/release controls
router.put('/overview/locks', requireAdmin, asyncHandler(async (req, res) => {
  const allowed = ['payroll_inputs_locked', 'employee_view_released', 'it_statement_released', 'payroll_locked'];
  const updates = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      await req.prisma.setting.upsert({
        where: { key },
        create: { key, value: String(req.body[key]) },
        update: { value: String(req.body[key]) },
      });
      updates.push(key);
    }
  }
  res.json({ message: `Updated: ${updates.join(', ')}` });
}));

// POST /generate — Generate payslips for a month (admin)
router.post('/generate', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month, companyId } = req.body;
  if (!month) throw badRequest('Month is required (format: YYYY-MM)');
  if (!companyId) throw badRequest('companyId is required — payroll must be processed per company');

  const year = parseInt(month.split('-')[0]);
  const monthNum = parseInt(month.split('-')[1]);
  const monthEnd = `${month}-${String(new Date(year, monthNum, 0).getDate()).padStart(2, '0')}`;

  const salaries = await req.prisma.salaryStructure.findMany({
    where: { user: { companyId: parseInt(companyId), isActive: true, dateOfJoining: { lte: monthEnd }, employeeId: { not: null } } },
    include: { user: { select: { id: true, name: true, isActive: true, isAttendanceExempt: true, department: true, designation: true, dateOfJoining: true, branchId: true, employeeType: true, company: { select: { name: true } } } } },
  });
  const activeSalaries = salaries.filter(s => s.user.isActive && !s.stopSalaryProcessing);
  const stoppedSalaries = salaries.filter(s => s.user.isActive && s.stopSalaryProcessing);
  if (activeSalaries.length === 0 && stoppedSalaries.length === 0) throw badRequest('No active employees with salary structures for this company');

  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // Global holidays for the month
  const holidays = await req.prisma.holiday.findMany({ where: { date: { startsWith: month } } });
  const globalHolidayDates = new Set(holidays.map(h => h.date));

  // Department holiday blocks overlapping this month — build per-dept set of blocked dates
  const monthStart = `${month}-01`;
  const monthEndStr = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const deptHolidayBlocks = await req.prisma.departmentHolidayBlock.findMany({
    where: { companyId: parseInt(companyId), dateFrom: { lte: monthEndStr }, dateTo: { gte: monthStart } },
  });
  const deptBlockMap = {};
  for (const b of deptHolidayBlocks) {
    if (!deptBlockMap[b.department]) deptBlockMap[b.department] = new Set();
    // Expand date range into individual dates within this month
    const cur = new Date(b.dateFrom + 'T00:00:00');
    const end = new Date(b.dateTo + 'T00:00:00');
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      if (ds.startsWith(month)) deptBlockMap[b.department].add(ds);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Pre-fetch branch holidays for the month — cache by branchId to avoid redundant DB calls
  const branchHolidayCache = {};
  const uniqueBranchIds = [...new Set(activeSalaries.map(s => s.user.branchId).filter(Boolean))];
  for (const branchId of uniqueBranchIds) {
    const bh = await req.prisma.branchHoliday.findMany({ where: { branchId, date: { startsWith: month } } });
    branchHolidayCache[branchId] = new Set(bh.map(h => h.date));
  }

  // Load Saturday policy for this company and month
  const saturdayPolicy = await getSaturdayPolicyForMonth(parseInt(companyId), month, req.prisma);
  const offSaturdaySet = saturdayPolicy ? buildOffSaturdaySet(month, saturdayPolicy.saturdayType) : buildOffSaturdaySet(month, 'all');

  // Helper: compute working days for a given employee's off-day set + holidays
  // offDays: number[] e.g. [0,6] = Sun+Sat; saturdayPolicy controls WHICH Saturdays
  const calcWorkingDays = (holidaySet, offDays) => {
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${month}-${String(d).padStart(2, '0')}`;
      const dow = new Date(year, monthNum - 1, d).getDay();
      const isWeeklyOff = offDays.includes(dow);
      // Saturday: only off if it's in the employee's weekly off AND in the SaturdayPolicy set
      const isOff = dow === 6 ? (offDays.includes(6) && offSaturdaySet.has(date)) : isWeeklyOff;
      if (!isOff && !holidaySet.has(date)) count++;
    }
    return count;
  };

  // Pre-fetch weekly off map for all employees
  const allUserIds = activeSalaries.map(s => s.userId);
  const weeklyOffMap = await getWeeklyOffMap(allUserIds, req.prisma, month);

  // Pre-fetch off-day allowance eligible employees for this month
  const eligibleOffDay = await req.prisma.offDayAllowanceEligibility.findMany({
    where: {
      eligibleFrom: { lte: `${month}-31` },
      OR: [{ eligibleTo: null }, { eligibleTo: { gte: `${month}-01` } }],
    },
    select: { userId: true, eligibleFrom: true, eligibleTo: true },
  });
  const offDayEligibleUserIds = new Set(eligibleOffDay.map(e => e.userId));

  const results = [];
  for (const sal of activeSalaries) {
    const existing = await req.prisma.payslip.findUnique({
      where: { userId_month: { userId: sal.userId, month } },
    });
    if (existing) { results.push({ userId: sal.userId, status: 'skipped', reason: 'already exists' }); continue; }

    // Get employee's weekly off days (from pattern/assignment, falls back to [0,6])
    const empOffDays = weeklyOffMap.get(sal.userId) || [0, 6];

    // Merge global + branch holidays for this employee
    const mergedHolidays = new Set(globalHolidayDates);
    if (sal.user.branchId && branchHolidayCache[sal.user.branchId]) {
      branchHolidayCache[sal.user.branchId].forEach(d => mergedHolidays.add(d));
    }
    // Remove department-blocked holidays for this employee
    const deptBlocks = deptBlockMap[sal.user.department] || new Set();
    deptBlocks.forEach(d => mergedHolidays.delete(d));
    const workingDays = calcWorkingDays(mergedHolidays, empOffDays);

    // ── Attendance-exempt employees: always full salary, skip all LOP/leave/attendance logic ──
    // These are employees added to the attendance exception list (isAttendanceExempt = true).
    // No biometric required, no LOP deduction, no leave impact on payroll.
    let presentDays = 0, lopDays = 0;
    const today = new Date().toISOString().slice(0, 10);
    const isIntern = sal.user.employeeType === 'intern';
    let attendances = [];

    if (sal.user.isAttendanceExempt) {
      presentDays = workingDays;
      lopDays = 0;
    } else {
    attendances = await req.prisma.attendance.findMany({
      where: { userId: sal.userId, date: { startsWith: month } },
    });

    // Fetch approved leaves for this month — separate LOP (deduction) from paid leaves
    const approvedLeaves = await req.prisma.leaveRequest.findMany({
      where: {
        userId: sal.userId, status: 'approved',
        startDate: { lte: `${month}-${String(daysInMonth).padStart(2, '0')}` },
        endDate: { gte: `${month}-01` },
      },
      select: { startDate: true, endDate: true, leaveType: { select: { code: true } } },
    });
    const leaveDatesSet = new Set();  // paid leave days (PL, COF, CF, etc.)
    const lopDatesSet = new Set();    // LOP leave days (deducted like absent)
    for (const lr of approvedLeaves) {
      const isLop = isIntern || lr.leaveType?.code === 'LOP'; // Interns: all leave = LOP
      const cur = new Date(lr.startDate + 'T00:00:00');
      const end = new Date(lr.endDate + 'T00:00:00');
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        if (ds.startsWith(month)) {
          if (isLop) lopDatesSet.add(ds);
          else leaveDatesSet.add(ds);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Check if employee was separated mid-month (pro-rata)
    const separation = await req.prisma.separation.findFirst({
      where: { userId: sal.userId, lastWorkingDate: { startsWith: month } },
      select: { lastWorkingDate: true },
    });

    if (attendances.length === 0 && leaveDatesSet.size === 0 && lopDatesSet.size === 0 && !separation) {
      // No data at all → assume full attendance (fallback for missing biometric)
      presentDays = workingDays;
      lopDays = 0;
    } else {
      const attMap = {};
      for (const att of attendances) { attMap[att.date] = att.status; }

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const dow = new Date(year, monthNum - 1, d).getDay();
        // Skip weekly off days (per employee pattern + SaturdayPolicy), holidays, future dates
        const isOff = dow === 6 ? (empOffDays.includes(6) && offSaturdaySet.has(dateStr)) : empOffDays.includes(dow);
        if (isOff || mergedHolidays.has(dateStr) || dateStr > today) continue;
        // Skip days after last working date (pro-rata separation)
        if (separation?.lastWorkingDate && dateStr > separation.lastWorkingDate) {
          lopDays++;
          continue;
        }
        const status = attMap[dateStr];
        if (lopDatesSet.has(dateStr)) {
          lopDays += 1; // LOP leave = deduction (same as absent)
        } else if (leaveDatesSet.has(dateStr) || status === 'on_leave') {
          presentDays += 1; // Approved paid leave = paid day
        } else if (status === 'present') {
          presentDays += 1;
        } else if (status === 'half_day') {
          presentDays += 0.5; lopDays += 0.5;
        } else if (status === 'absent') {
          lopDays += 1;
        } else if (!status && attendances.length > 0) {
          // Working day with no record (and biometric data exists) = LOP
          lopDays += 1;
        } else if (!status) {
          // No records at all for this employee yet = treat as present
          presentDays += 1;
        }
      }
    }
    } // end of attendance-exempt else block

    const perDaySalary = workingDays > 0 ? sal.ctcMonthly / workingDays : 0;
    const lopDeduction = Math.round(perDaySalary * lopDays);

    // Fetch approved expenses flagged for salary settlement (not yet settled)
    const pendingReimbursements = await req.prisma.expenseClaim.findMany({
      where: { userId: sal.userId, status: 'approved', settleOnSalary: true, settlementMonth: null },
      select: { id: true, amount: true, title: true },
    });
    const reimbursements = pendingReimbursements.reduce((sum, e) => sum + e.amount, 0);

    // Fetch pending salary advance repayments for this month
    const advanceRepayments = await req.prisma.salaryAdvanceRepayment.findMany({
      where: { month, status: 'pending', advance: { userId: sal.userId, status: { in: ['released', 'repaying'] } } },
    });
    const salaryAdvanceDeduction = advanceRepayments.reduce((sum, r) => sum + r.amount, 0);

    // ── Off-Day Allowance ──────────────────────────────────────────────────
    let offDayAllowance = 0;
    let offDaysWorked = 0;
    if (offDayEligibleUserIds.has(sal.userId)) {
      const eligibility = eligibleOffDay.find(e => e.userId === sal.userId);
      const weeklyOffs = weeklyOffMap.get(sal.userId) || [0, 6];

      // Identify off days in month: weekends (per shift) + holidays
      const offDatesInMonth = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const dow = new Date(year, monthNum - 1, d).getDay();
        const isWeeklyOff = weeklyOffs.includes(dow);
        const isHoliday = mergedHolidays.has(dateStr);

        if ((isWeeklyOff || isHoliday) && dateStr >= eligibility.eligibleFrom &&
            (!eligibility.eligibleTo || dateStr <= eligibility.eligibleTo)) {
          offDatesInMonth.push(dateStr);
        }
      }

      // Count off days where employee was present
      const attMap = {};
      for (const att of attendances) { attMap[att.date] = att.status; }
      for (const date of offDatesInMonth) {
        if (attMap[date] === 'present') offDaysWorked++;
      }

      // Formula: (Gross Salary / Total Days in Month) × Off Days Worked
      const grossBase = sal.basic + sal.hra + sal.da + sal.specialAllowance +
        sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowance;
      offDayAllowance = daysInMonth > 0 ? Math.round((grossBase / daysInMonth) * offDaysWorked) : 0;
    }

    const grossEarnings = sal.basic + sal.hra + sal.da + sal.specialAllowance +
      sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowance + reimbursements + offDayAllowance;
    // Interns: no PF, no ESI, no PT, no Mediclaim deductions
    const totalDeductions = isIntern ? sal.tds : (sal.employeePf + sal.employeeEsi + sal.professionalTax + sal.tds);
    const netPay = Math.round(grossEarnings - totalDeductions - lopDeduction - salaryAdvanceDeduction);

    const payslip = await req.prisma.payslip.create({
      data: {
        userId: sal.userId, month, year,
        basic: sal.basic, hra: sal.hra, da: sal.da,
        specialAllowance: sal.specialAllowance, medicalAllowance: sal.medicalAllowance,
        conveyanceAllowance: sal.conveyanceAllowance, otherAllowance: sal.otherAllowance,
        otherAllowanceLabel: sal.otherAllowanceLabel, grossEarnings,
        employerPf: sal.employerPf, employerEsi: sal.employerEsi,
        employeePf: isIntern ? 0 : sal.employeePf, employeeEsi: isIntern ? 0 : sal.employeeEsi,
        professionalTax: isIntern ? 0 : sal.professionalTax, tds: sal.tds,
        otherDeductions: 0, totalDeductions: totalDeductions + lopDeduction + salaryAdvanceDeduction,
        netPay, workingDays, presentDays, lopDays, lopDeduction,
        reimbursements, salaryAdvanceDeduction, offDayAllowance, offDaysWorked,
        companyName: sal.user.company?.name || null,
        designation: sal.user.designation || null,
        dateOfJoining: sal.user.dateOfJoining || null,
        status: 'generated', generatedAt: new Date(),
      },
    });

    // Mark those expenses as settled in this month
    if (pendingReimbursements.length > 0) {
      await req.prisma.expenseClaim.updateMany({
        where: { id: { in: pendingReimbursements.map(e => e.id) } },
        data: { settlementMonth: month, status: 'settled_in_salary' },
      });
    }

    // Mark advance repayments as deducted and update advance status
    if (advanceRepayments.length > 0) {
      await req.prisma.salaryAdvanceRepayment.updateMany({
        where: { id: { in: advanceRepayments.map(r => r.id) } },
        data: { status: 'deducted', deductedAt: new Date() },
      });
      // Check if all repayments done → close the advance
      for (const repayment of advanceRepayments) {
        const remaining = await req.prisma.salaryAdvanceRepayment.count({
          where: { advanceId: repayment.advanceId, status: 'pending' },
        });
        const advStatus = remaining === 0 ? 'closed' : 'repaying';
        await req.prisma.salaryAdvance.update({
          where: { id: repayment.advanceId },
          data: { status: advStatus, ...(remaining === 0 ? { closedAt: new Date() } : {}) },
        });
      }
    }

    results.push({ userId: sal.userId, status: 'generated', netPay, reimbursements, salaryAdvanceDeduction, offDayAllowance, offDaysWorked });
  }

  // Add stopped employees to results
  for (const s of stoppedSalaries) {
    results.push({ userId: s.userId, status: 'skipped', reason: `Salary processing stopped: ${s.stopSalaryReason || 'No reason'}` });
  }

  res.json({ message: `Payslips generated for ${month}`, results });
}));

// GET /payslips?month= — All payslips for a month (admin)
router.get('/payslips', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  const where = month ? { month } : {};
  const payslips = await req.prisma.payslip.findMany({
    where,
    include: { 
      user: { 
        select: { 
          id: true, name: true, email: true, employeeId: true, designation: true, department: true, dateOfJoining: true, companyId: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date().toISOString().slice(0, 10) },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date().toISOString().slice(0, 10) } }
              ]
            },
            take: 1,
            select: {
              shift: {
                select: {
                  id: true,
                  name: true,
                  startTime: true,
                  endTime: true,
                }
              }
            }
          }
        } 
      } 
    },
    orderBy: { user: { name: 'asc' } },
  });
  res.json(payslips);
}));

// GET /my-payslips — Own payslips
router.get('/my-payslips', asyncHandler(async (req, res) => {
  const payslips = await req.prisma.payslip.findMany({
    where: { userId: req.user.id, status: 'published' },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, employeeId: true, designation: true, department: true, dateOfJoining: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date().toISOString().slice(0, 10) },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date().toISOString().slice(0, 10) } },
              ],
            },
            take: 1,
            select: {
              shift: {
                select: { id: true, name: true, startTime: true, endTime: true },
              },
            },
          },
        },
      },
    },
    orderBy: { month: 'desc' },
  });
  res.json(payslips);
}));

// GET /payslip/:id — Single payslip detail (admin or self)
router.get('/payslip/:id', requireActiveEmployee, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const payslip = await req.prisma.payslip.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, employeeId: true, designation: true, department: true, dateOfJoining: true,
          bankName: true, bankAccountNumber: true, bankIfscCode: true,
          companyRegistrationId: true,
        }
      },
    },
  });
  if (!payslip) throw notFound('Payslip');
  if (!isAdminRole(req.user) && payslip.userId !== req.user.id) throw forbidden('Access denied');

  // Attach company primary bank account (for payslip display)
  // Look up registration-level first, then fall back to entity-level
  let companyBankAccount = null;
  if (payslip.user?.companyRegistrationId) {
    const regId = payslip.user.companyRegistrationId;
    const bankSelect = { bankName: true, accountHolderName: true, accountNumber: true, ifscCode: true, branchName: true };
    // Registration-specific primary account
    companyBankAccount = await req.prisma.companyBankAccount.findFirst({
      where: { companyRegistrationId: regId, isPrimary: true, isActive: true },
      select: bankSelect,
    });
    // Fall back to entity-level primary account
    if (!companyBankAccount) {
      const reg = await req.prisma.companyRegistration.findUnique({ where: { id: regId }, select: { legalEntityId: true } });
      if (reg?.legalEntityId) {
        companyBankAccount = await req.prisma.companyBankAccount.findFirst({
          where: { legalEntityId: reg.legalEntityId, companyRegistrationId: null, isPrimary: true, isActive: true },
          select: bankSelect,
        });
      }
    }
  }

  res.json({ ...payslip, companyBankAccount });
}));

// PUT /payslip/:id/publish — Publish single payslip (admin)
router.put('/payslip/:id/publish', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const payslip = await req.prisma.payslip.update({
    where: { id },
    data: { status: 'published', publishedAt: new Date() },
  });
  res.json(payslip);
}));

// POST /payslips/publish-all — Publish all payslips + auto-lock month
router.post('/payslips/publish-all', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month) throw badRequest('Month is required');
  const result = await req.prisma.payslip.updateMany({
    where: { month, status: 'generated' },
    data: { status: 'published', publishedAt: new Date() },
  });
  // Auto-lock the month after publishing all payslips
  await req.prisma.payrollMonthLock.upsert({
    where: { month },
    create: { month, lockedBy: req.user.id },
    update: { lockedAt: new Date(), lockedBy: req.user.id },
  });
  res.json({ message: `Published ${result.count} payslips for ${month} and month locked.`, count: result.count, locked: true });
}));

// GET /month-locks — List all locked months (admin)
router.get('/month-locks', requireAdmin, asyncHandler(async (req, res) => {
  const locks = await req.prisma.payrollMonthLock.findMany({
    orderBy: { month: 'desc' },
    include: { locker: { select: { name: true, employeeId: true } } },
  });
  res.json(locks);
}));

// GET /month-locks/:month — Check if a specific month is locked
router.get('/month-locks/:month', asyncHandler(async (req, res) => {
  const lock = await req.prisma.payrollMonthLock.findUnique({ where: { month: req.params.month } });
  res.json({ locked: !!lock, lock: lock || null });
}));

// DELETE /month-locks/:month — Unlock a month (admin only — emergency use)
router.delete('/month-locks/:month', requireAdmin, asyncHandler(async (req, res) => {
  await req.prisma.payrollMonthLock.deleteMany({ where: { month: req.params.month } });
  res.json({ message: `Month ${req.params.month} unlocked.` });
}));

// GET /process-check?month=&companyId= — Pre-payroll checklist (admin)
router.get('/process-check', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month, companyId } = req.query;
  if (!month) throw badRequest('Month is required');
  if (!companyId) throw badRequest('companyId is required');

  const [year, mon] = month.split('-');
  const monthEnd = `${year}-${mon}-${String(new Date(parseInt(year), parseInt(mon), 0).getDate()).padStart(2, '0')}`;

  const activeEmployees = await req.prisma.user.findMany({
    where: { isActive: true, companyId: parseInt(companyId), dateOfJoining: { lte: monthEnd }, employeeId: { not: null } },
    select: { id: true, name: true, employeeId: true, isAttendanceExempt: true, salaryStructure: { select: { id: true, stopSalaryProcessing: true } } },
  });

  const withSalary = activeEmployees.filter(u => u.salaryStructure && !u.salaryStructure.stopSalaryProcessing);
  const withoutSalary = activeEmployees.filter(u => !u.salaryStructure);
  const stopped = activeEmployees.filter(u => u.salaryStructure?.stopSalaryProcessing);
  // Attendance-exempt employees never need biometric — exclude from attendance coverage check
  const needsAttendance = withSalary.filter(u => !u.isAttendanceExempt);

  // Attendance coverage
  const attendanceCounts = await req.prisma.attendance.groupBy({
    by: ['userId'],
    where: { date: { startsWith: month } },
    _count: { id: true },
  });
  const attendanceUserIds = new Set(attendanceCounts.map(a => a.userId));
  const withAttendance = needsAttendance.filter(u => attendanceUserIds.has(u.id)).length;

  // Pending leave approvals
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const pendingLeaves = await req.prisma.leaveRequest.count({
    where: {
      status: 'pending',
      startDate: { lte: `${month}-${String(daysInMonth).padStart(2, '0')}` },
      endDate: { gte: `${month}-01` },
    },
  });

  // Existing payslips for month
  const existingPayslips = await req.prisma.payslip.count({ where: { month } });
  const publishedPayslips = await req.prisma.payslip.count({ where: { month, status: 'published' } });

  // Pending reimbursements
  const pendingReimb = await req.prisma.expenseClaim.count({
    where: { status: 'approved', settleOnSalary: true, settlementMonth: null },
  });

  // Salary advances — approved but not yet disbursed
  const pendingDisbursements = await req.prisma.salaryAdvance.findMany({
    where: { status: 'approved' },
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  });

  // Salary advances — repayments due this month
  const advanceRepaymentsDue = await req.prisma.salaryAdvanceRepayment.count({
    where: { month, status: 'pending' },
  });

  // Pending attendance regularization requests for the month
  const pendingRegularizations = await req.prisma.attendanceRegularization.count({
    where: {
      status: 'pending',
      date: { startsWith: month },
    },
  });

  // Off-day allowance eligible employees this month
  const today2 = new Date().toISOString().slice(0, 10);
  const offDayEligibleCount = await req.prisma.offDayAllowanceEligibility.count({
    where: {
      eligibleFrom: { lte: `${month}-31` },
      OR: [{ eligibleTo: null }, { eligibleTo: { gte: `${month}-01` } }],
    },
  });

  res.json({
    month,
    summary: {
      activeEmployees: activeEmployees.length,
      eligibleForPayroll: withSalary.length,
      withoutSalaryStructure: withoutSalary.length,
      salaryProcessingStopped: stopped.length,
      attendanceCoverage: withSalary.length > 0 ? `${withAttendance}/${withSalary.length}` : '0/0',
      pendingLeaveApprovals: pendingLeaves,
      existingPayslips,
      publishedPayslips,
      pendingReimbursements: pendingReimb,
      pendingAdvanceDisbursements: pendingDisbursements.length,
      advanceRepaymentsDue,
      pendingRegularizations,
      offDayEligibleCount,
    },
    checks: [
      { label: 'Salary structures set', status: withoutSalary.length === 0 ? 'ok' : 'warning', detail: withoutSalary.length > 0 ? `${withoutSalary.length} employees missing` : 'All set' },
      { label: 'Attendance data finalized', status: needsAttendance.length === 0 || withAttendance >= needsAttendance.length * 0.8 ? 'ok' : 'warning', detail: `${withAttendance}/${needsAttendance.length} employees have attendance records${withSalary.length - needsAttendance.length > 0 ? ` (${withSalary.length - needsAttendance.length} exempt)` : ''}` },
      { label: 'Attendance regularizations', status: pendingRegularizations === 0 ? 'ok' : 'warning', detail: pendingRegularizations > 0 ? `${pendingRegularizations} regularization request(s) still pending approval` : 'All cleared' },
      { label: 'Pending leave approvals', status: pendingLeaves === 0 ? 'ok' : 'warning', detail: pendingLeaves > 0 ? `${pendingLeaves} leave request(s) still pending` : 'None pending' },
      { label: 'Payslips generated', status: existingPayslips > 0 ? 'ok' : 'pending', detail: existingPayslips > 0 ? `${existingPayslips} generated, ${publishedPayslips} published` : 'Not generated yet' },
      { label: 'Pending reimbursements', status: pendingReimb === 0 ? 'ok' : 'info', detail: pendingReimb > 0 ? `${pendingReimb} expense claims will be included in next generation` : 'None' },
      { label: 'Advance disbursements pending', status: pendingDisbursements.length === 0 ? 'ok' : 'warning', detail: pendingDisbursements.length > 0 ? `${pendingDisbursements.length} approved advances not yet disbursed` : 'All disbursed' },
      { label: 'Advance repayments this month', status: advanceRepaymentsDue === 0 ? 'ok' : 'info', detail: advanceRepaymentsDue > 0 ? `${advanceRepaymentsDue} deductions will auto-apply on payslip generation` : 'None due' },
      { label: 'Off-Day Allowance', status: offDayEligibleCount === 0 ? 'ok' : 'info', detail: offDayEligibleCount > 0 ? `${offDayEligibleCount} employees eligible — allowance will auto-calculate on generation` : 'No employees assigned' },
    ],
    employees: {
      withoutSalary: withoutSalary.map(u => ({ id: u.id, name: u.name, employeeId: u.employeeId })),
      stopped: stopped.map(u => ({ id: u.id, name: u.name, employeeId: u.employeeId })),
      pendingDisbursements: pendingDisbursements.map(a => ({ id: a.id, name: a.user.name, employeeId: a.user.employeeId, amount: a.approvedAmount || a.amount })),
    },
  });
}));

// GET /neft-export?month= — Bank transfer CSV export (admin)
router.get('/neft-export', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('Month is required');

  const payslips = await req.prisma.payslip.findMany({
    where: { month, status: 'published' },
    include: {
      user: { select: { name: true, employeeId: true, department: true, bankName: true, bankAccountNumber: true, bankIfscCode: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });

  // Salary advance bank disbursements for this month (released in this month, bank_transfer mode)
  const advanceDisbursements = await req.prisma.salaryAdvance.findMany({
    where: {
      releaseMode: 'bank_transfer',
      releasedAt: { gte: new Date(`${month}-01`), lt: new Date(`${month}-01`) },
      status: { in: ['released', 'repaying', 'closed'] },
    },
    include: { user: { select: { name: true, employeeId: true, department: true, bankName: true, bankAccountNumber: true, bankIfscCode: true } } },
  });

  const rows = [['Sr No', 'Employee ID', 'Employee Name', 'Department', 'Bank Name', 'Account Number', 'IFSC Code', 'Net Pay (INR)', 'Type']];
  payslips.forEach((p, i) => {
    rows.push([
      i + 1,
      p.user?.employeeId || '',
      p.user?.name || '',
      p.user?.department || '',
      p.user?.bankName || '',
      p.user?.bankAccountNumber || '',
      p.user?.bankIfscCode || '',
      p.netPay,
      'Salary',
    ]);
  });

  if (advanceDisbursements.length > 0) {
    rows.push([]);
    rows.push(['--- Salary Advance Disbursements ---', '', '', '', '', '', '', '', '']);
    rows.push(['Sr No', 'Employee ID', 'Employee Name', 'Department', 'Bank Name', 'Account Number', 'IFSC Code', 'Advance Amount (INR)', 'Type']);
    advanceDisbursements.forEach((a, i) => {
      rows.push([
        i + 1,
        a.user?.employeeId || '',
        a.user?.name || '',
        a.user?.department || '',
        a.user?.bankName || '',
        a.user?.bankAccountNumber || '',
        a.user?.bankIfscCode || '',
        a.approvedAmount || a.amount,
        'Advance',
      ]);
    });
  }

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="neft-${month}.csv"`);
  res.send(csv);
}));

// GET /pay-register?month= — Pay register summary (admin)
router.get('/pay-register', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('Month is required');

  const payslips = await req.prisma.payslip.findMany({
    where: { month },
    include: { 
      user: { 
        select: {
          name: true, employeeId: true, department: true, designation: true, dateOfJoining: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date().toISOString().slice(0, 10) },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date().toISOString().slice(0, 10) } }
              ]
            },
            take: 1,
            select: {
              shift: {
                select: {
                  name: true,
                  startTime: true,
                  endTime: true,
                }
              }
            }
          }
        } 
      } 
    },
  });

  const totals = {
    totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalLopDeduction: 0,
    totalBasic: 0, totalHra: 0, totalPf: 0, totalEsi: 0, totalPt: 0, totalTds: 0,
  };
  const byDepartment = {};

  for (const p of payslips) {
    totals.totalGross += p.grossEarnings;
    totals.totalDeductions += p.totalDeductions;
    totals.totalNetPay += p.netPay;
    totals.totalLopDeduction += p.lopDeduction;
    totals.totalBasic += p.basic;
    totals.totalHra += p.hra;
    totals.totalPf += p.employeePf;
    totals.totalEsi += p.employeeEsi;
    totals.totalPt += p.professionalTax;
    totals.totalTds += p.tds;
    const dept = p.user.department || 'Unassigned';
    if (!byDepartment[dept]) {
      byDepartment[dept] = { department: dept, count: 0, gross: 0, deductions: 0, netPay: 0 };
    }
    byDepartment[dept].count++;
    byDepartment[dept].gross += p.grossEarnings;
    byDepartment[dept].deductions += p.totalDeductions;
    byDepartment[dept].netPay += p.netPay;
  }

  res.json({
    month, employeeCount: payslips.length, totals,
    departments: Object.values(byDepartment).sort((a, b) => b.netPay - a.netPay),
    payslips,
  });
}));

// GET /api/payroll/pending-salary?companyId=&month= — active employees with no salary structure (admin)
router.get('/pending-salary', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { companyId, month } = req.query;
  const where = { isActive: true, salaryStructure: null, employeeId: { not: null } };
  if (companyId) where.companyId = parseInt(companyId);
  if (month) {
    const [year, mon] = month.split('-');
    const monthEnd = `${year}-${mon}-${String(new Date(parseInt(year), parseInt(mon), 0).getDate()).padStart(2, '0')}`;
    where.dateOfJoining = { lte: monthEnd };
  }
  const pending = await req.prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      employeeId: true,
      designation: true,
      department: true,
      dateOfJoining: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(pending);
}));

// ═══════════════════════════════════════════════
// Salary Components — Configuration master list
// ═══════════════════════════════════════════════

// GET /components — List all salary components
router.get('/components', requireAdmin, asyncHandler(async (req, res) => {
  const components = await req.prisma.salaryComponent.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  res.json(components);
}));

// POST /components — Create custom component
router.post('/components', requireAdmin, asyncHandler(async (req, res) => {
  const { name, code, type } = req.body;
  if (!name?.trim() || !code?.trim() || !type?.trim()) throw badRequest('Name, code, and type are required.');
  if (!['earning', 'deduction', 'employer'].includes(type)) throw badRequest('Type must be earning, deduction, or employer.');

  const maxSort = await req.prisma.salaryComponent.aggregate({ _max: { sortOrder: true } });
  const component = await req.prisma.salaryComponent.create({
    data: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      type,
      taxable: req.body.taxable ?? true,
      mandatory: req.body.mandatory ?? false,
      calculationType: req.body.calculationType || 'fixed',
      percentageOf: req.body.percentageOf || null,
      defaultPercentage: parseFloat(req.body.defaultPercentage) || null,
      description: req.body.description || null,
      complianceNote: req.body.complianceNote || null,
      sortOrder: (maxSort._max.sortOrder || 0) + 1,
      isActive: true,
      isSystem: false,
    },
  });
  res.status(201).json(component);
}));

// PUT /components/:id — Update component
router.put('/components/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const data = {};
  const allowed = ['name', 'description', 'complianceNote', 'taxable', 'mandatory', 'calculationType', 'percentageOf', 'defaultPercentage', 'isActive', 'sortOrder'];
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      if (f === 'taxable' || f === 'mandatory' || f === 'isActive') data[f] = Boolean(req.body[f]);
      else if (f === 'defaultPercentage' || f === 'sortOrder') data[f] = parseFloat(req.body[f]) || null;
      else data[f] = req.body[f];
    }
  }
  // Allow code/type update only for non-system components
  const existing = await req.prisma.salaryComponent.findUnique({ where: { id } });
  if (!existing) throw notFound('Component');
  if (!existing.isSystem) {
    if (req.body.code) data.code = req.body.code.trim().toUpperCase();
    if (req.body.type) data.type = req.body.type;
  }
  const component = await req.prisma.salaryComponent.update({ where: { id }, data });
  res.json(component);
}));

// DELETE /components/:id — Soft-delete (non-system only)
router.delete('/components/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.salaryComponent.findUnique({ where: { id } });
  if (!existing) throw notFound('Component');
  if (existing.isSystem) throw badRequest('System components cannot be deleted. You can deactivate them instead.');
  await req.prisma.salaryComponent.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Component deleted.' });
}));

// ═══════════════════════════════════════════════
// Salary Templates — Reusable salary structures
// ═══════════════════════════════════════════════

const TEMPLATE_FIELDS = [
  'name', 'description', 'ctcAnnual', 'basic', 'hra', 'da',
  'specialAllowance', 'medicalAllowance', 'conveyanceAllowance',
  'otherAllowance', 'otherAllowanceLabel', 'employerPf', 'employerEsi',
  'employeePf', 'employeeEsi', 'professionalTax', 'tds',
];

const SALARY_COMPONENT_FIELDS = [
  'basic', 'hra', 'da', 'specialAllowance', 'medicalAllowance',
  'conveyanceAllowance', 'otherAllowance', 'otherAllowanceLabel',
  'employerPf', 'employerEsi', 'employeePf', 'employeeEsi',
  'professionalTax', 'tds',
];

// GET /templates — List all salary templates
router.get('/templates', requireAdmin, asyncHandler(async (req, res) => {
  const templates = await req.prisma.salaryTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(templates);
}));

// POST /templates — Create new template
router.post('/templates', requireAdmin, asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw badRequest('Template name is required.');
  const data = {};
  for (const f of TEMPLATE_FIELDS) {
    if (f === 'name') data.name = name.trim();
    else if (f === 'description' || f === 'otherAllowanceLabel') data[f] = req.body[f] || null;
    else data[f] = parseFloat(req.body[f]) || 0;
  }
  const template = await req.prisma.salaryTemplate.create({ data });
  res.status(201).json(template);
}));

// PUT /templates/:id — Update template
router.put('/templates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const data = {};
  for (const f of TEMPLATE_FIELDS) {
    if (req.body[f] !== undefined) {
      if (f === 'name') data.name = req.body[f]?.trim() || undefined;
      else if (f === 'description' || f === 'otherAllowanceLabel') data[f] = req.body[f] || null;
      else data[f] = parseFloat(req.body[f]) || 0;
    }
  }
  const template = await req.prisma.salaryTemplate.update({ where: { id }, data });
  res.json(template);
}));

// DELETE /templates/:id — Soft-delete template
router.delete('/templates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.salaryTemplate.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Template deleted.' });
}));

// POST /templates/:id/assign — Assign template to employees
router.post('/templates/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { userIds, effectiveFrom } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) throw badRequest('Select at least one employee.');

  const template = await req.prisma.salaryTemplate.findUnique({ where: { id } });
  if (!template || !template.isActive) throw notFound('Template');

  const today = new Date().toISOString().split('T')[0];
  const effDate = effectiveFrom || today;
  const results = [];

  for (const uid of userIds) {
    const userId = parseInt(uid);
    if (isNaN(userId)) continue;

    // Build salary data from template
    const salaryData = { ctcMonthly: template.ctcAnnual / 12 };
    for (const f of SALARY_COMPONENT_FIELDS) salaryData[f] = template[f] || 0;
    if (template.otherAllowanceLabel) salaryData.otherAllowanceLabel = template.otherAllowanceLabel;
    salaryData.ctcAnnual = template.ctcAnnual;
    salaryData.effectiveFrom = effDate;
    salaryData.notes = `Assigned from template: ${template.name}`;

    // Calculate net pay
    const gross = (salaryData.basic || 0) + (salaryData.hra || 0) + (salaryData.da || 0) +
      (salaryData.specialAllowance || 0) + (salaryData.medicalAllowance || 0) +
      (salaryData.conveyanceAllowance || 0) + (salaryData.otherAllowance || 0);
    const deductions = (salaryData.employeePf || 0) + (salaryData.employeeEsi || 0) +
      (salaryData.professionalTax || 0) + (salaryData.tds || 0);
    salaryData.netPayMonthly = gross - deductions;

    // Get existing salary for revision tracking
    const existing = await req.prisma.salaryStructure.findUnique({ where: { userId } });
    const oldCtc = existing?.ctcAnnual || 0;

    // Upsert salary structure
    await req.prisma.salaryStructure.upsert({
      where: { userId },
      create: { userId, ...salaryData },
      update: salaryData,
    });

    // Create revision record
    if (oldCtc !== template.ctcAnnual) {
      await req.prisma.salaryRevision.create({
        data: {
          userId,
          effectiveFrom: effDate,
          oldCtc,
          newCtc: template.ctcAnnual,
          reason: `Assigned template: ${template.name}`,
          revisedBy: req.user.id,
        },
      });
    }

    results.push(userId);
  }

  res.json({ message: `Template assigned to ${results.length} employee(s).`, assigned: results });
}));

// ═══════════════════════════════════════════════
// P1: Payroll Differences — Month-over-month compare
// ═══════════════════════════════════════════════

router.get('/pay-differences', requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('Month is required (YYYY-MM)');

  // Calculate previous month
  const [y, m] = month.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const [currentPayslips, prevPayslips] = await Promise.all([
    req.prisma.payslip.findMany({
      where: { month },
      include: { user: { select: { id: true, name: true, employeeId: true, department: true } } },
    }),
    req.prisma.payslip.findMany({
      where: { month: prevMonth },
    }),
  ]);

  const prevMap = {};
  for (const p of prevPayslips) prevMap[p.userId] = p;

  let totalChanged = 0, totalFlagged = 0, netDiffSum = 0;
  const employees = currentPayslips.map(curr => {
    const prev = prevMap[curr.userId];
    if (!prev) {
      return {
        user: curr.user, current: curr, previous: null,
        diffs: { gross: curr.grossEarnings, deductions: curr.totalDeductions, net: curr.netPay, lop: curr.lopDeduction },
        diffPercent: 100, hasSignificantChange: true, isNew: true,
      };
    }

    const grossDiff = (curr.grossEarnings || 0) - (prev.grossEarnings || 0);
    const deductionDiff = (curr.totalDeductions || 0) - (prev.totalDeductions || 0);
    const netDiff = (curr.netPay || 0) - (prev.netPay || 0);
    const lopDiff = (curr.lopDeduction || 0) - (prev.lopDeduction || 0);
    const diffPercent = prev.netPay ? Math.round((netDiff / prev.netPay) * 100) : 0;
    const hasSignificantChange = Math.abs(diffPercent) > 20 || Math.abs(netDiff) > 5000;

    if (netDiff !== 0) totalChanged++;
    if (hasSignificantChange) totalFlagged++;
    netDiffSum += netDiff;

    return {
      user: curr.user,
      current: { grossEarnings: curr.grossEarnings, totalDeductions: curr.totalDeductions, netPay: curr.netPay, lopDeduction: curr.lopDeduction, basic: curr.basic, hra: curr.hra },
      previous: { grossEarnings: prev.grossEarnings, totalDeductions: prev.totalDeductions, netPay: prev.netPay, lopDeduction: prev.lopDeduction, basic: prev.basic, hra: prev.hra },
      diffs: { gross: grossDiff, deductions: deductionDiff, net: netDiff, lop: lopDiff },
      diffPercent, hasSignificantChange, isNew: false,
    };
  });

  // Sort: flagged first, then by absolute net diff desc
  employees.sort((a, b) => {
    if (a.hasSignificantChange !== b.hasSignificantChange) return a.hasSignificantChange ? -1 : 1;
    return Math.abs(b.diffs.net) - Math.abs(a.diffs.net);
  });

  res.json({
    month, prevMonth,
    employees,
    summary: {
      totalEmployees: currentPayslips.length,
      totalChanged,
      avgNetDiff: totalChanged > 0 ? Math.round(netDiffSum / totalChanged) : 0,
      flaggedCount: totalFlagged,
    },
  });
}));

// ═══════════════════════════════════════════════
// P2: YTD Summary — Year-to-date for employees
// ═══════════════════════════════════════════════

router.get('/ytd-summary', asyncHandler(async (req, res) => {
  const userId = req.query.userId ? parseId(req.query.userId) : req.user.id;
  if (!isAdminRole(req.user) && req.user.id !== userId) throw forbidden('Access denied');

  // Determine financial year (Apr-Mar)
  let fy = req.query.fy; // e.g., "2025-2026"
  if (!fy) {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    fy = `${startYear}-${startYear + 1}`;
  }

  const [startYear, endYear] = fy.split('-').map(Number);
  // FY months: Apr startYear to Mar endYear
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${endYear}-${String(m).padStart(2, '0')}`);

  const payslips = await req.prisma.payslip.findMany({
    where: { userId, month: { in: months }, status: 'published' },
    orderBy: { month: 'asc' },
  });

  const totals = {
    grossEarnings: 0, totalDeductions: 0, netPay: 0, lopDeduction: 0,
    basic: 0, hra: 0, employeePf: 0, employeeEsi: 0, professionalTax: 0, tds: 0,
    employerPf: 0, employerEsi: 0,
  };

  const monthly = payslips.map(p => {
    totals.grossEarnings += p.grossEarnings || 0;
    totals.totalDeductions += p.totalDeductions || 0;
    totals.netPay += p.netPay || 0;
    totals.lopDeduction += p.lopDeduction || 0;
    totals.basic += p.basic || 0;
    totals.hra += p.hra || 0;
    totals.employeePf += p.employeePf || 0;
    totals.employeeEsi += p.employeeEsi || 0;
    totals.professionalTax += p.professionalTax || 0;
    totals.tds += p.tds || 0;
    totals.employerPf += p.employerPf || 0;
    totals.employerEsi += p.employerEsi || 0;

    return {
      month: p.month, grossEarnings: p.grossEarnings, totalDeductions: p.totalDeductions,
      netPay: p.netPay, lopDeduction: p.lopDeduction, basic: p.basic, hra: p.hra,
      employeePf: p.employeePf, employeeEsi: p.employeeEsi,
      professionalTax: p.professionalTax, tds: p.tds,
      employerPf: p.employerPf, employerEsi: p.employerEsi,
    };
  });

  res.json({ fy, userId, monthly, totals, monthCount: payslips.length });
}));

// ═══════════════════════════════════════════════
// P3: CTC Register — Employer cost breakdown
// ═══════════════════════════════════════════════

router.get('/ctc-register', requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.query;
  if (!month) throw badRequest('Month is required');

  const payslips = await req.prisma.payslip.findMany({
    where: { month },
    include: { user: { select: { name: true, employeeId: true, department: true, designation: true } } },
  });

  let totalGross = 0, totalDeductions = 0, totalNet = 0, totalEmployerPf = 0, totalEmployerEsi = 0, totalCtc = 0;
  const byDepartment = {};

  const employees = payslips.map(p => {
    const ctcMonthly = (p.grossEarnings || 0) + (p.employerPf || 0) + (p.employerEsi || 0);
    totalGross += p.grossEarnings || 0;
    totalDeductions += p.totalDeductions || 0;
    totalNet += p.netPay || 0;
    totalEmployerPf += p.employerPf || 0;
    totalEmployerEsi += p.employerEsi || 0;
    totalCtc += ctcMonthly;

    const dept = p.user?.department || 'Unassigned';
    if (!byDepartment[dept]) byDepartment[dept] = { department: dept, count: 0, gross: 0, employerPf: 0, employerEsi: 0, ctc: 0, net: 0 };
    byDepartment[dept].count++;
    byDepartment[dept].gross += p.grossEarnings || 0;
    byDepartment[dept].employerPf += p.employerPf || 0;
    byDepartment[dept].employerEsi += p.employerEsi || 0;
    byDepartment[dept].ctc += ctcMonthly;
    byDepartment[dept].net += p.netPay || 0;

    return {
      user: p.user, grossEarnings: p.grossEarnings, totalDeductions: p.totalDeductions,
      netPay: p.netPay, employerPf: p.employerPf, employerEsi: p.employerEsi, ctcMonthly,
    };
  });

  res.json({
    month, employeeCount: payslips.length,
    totals: { totalGross, totalDeductions, totalNet, totalEmployerPf, totalEmployerEsi, totalCtc, totalCtcAnnual: totalCtc * 12 },
    departments: Object.values(byDepartment).sort((a, b) => b.ctc - a.ctc),
    employees,
  });
}));

// ═══════════════════════════════════════════════
// P4: Arrears Auto-Calculation
// ═══════════════════════════════════════════════

// Calculate arrears for a backdated revision
router.post('/calculate-arrears', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, fromMonth, toMonth } = req.body;
  if (!userId || !fromMonth || !toMonth) throw badRequest('userId, fromMonth, and toMonth are required');

  const uid = parseId(userId);
  const salary = await req.prisma.salaryStructure.findUnique({ where: { userId: uid } });
  if (!salary) throw notFound('Salary structure');

  // Get payslips for the period
  const payslips = await req.prisma.payslip.findMany({
    where: { userId: uid, month: { gte: fromMonth, lte: toMonth } },
    orderBy: { month: 'asc' },
  });

  if (payslips.length === 0) throw badRequest('No payslips found for the given period');

  // Calculate what the new salary would produce vs what was paid
  const newGross = salary.basic + salary.hra + salary.da + salary.specialAllowance +
    salary.medicalAllowance + salary.conveyanceAllowance + salary.otherAllowance;
  const newDeductions = salary.employeePf + salary.employeeEsi + salary.professionalTax + salary.tds;

  const breakdown = payslips.map(p => {
    const workingDays = p.workingDays || 30;
    const perDayNew = workingDays > 0 ? salary.ctcMonthly / workingDays : 0;
    const newLopDeduction = Math.round(perDayNew * (p.lopDays || 0));
    const newNet = Math.round(newGross - newDeductions - newLopDeduction);
    const arrearAmount = newNet - (p.netPay || 0);

    return { month: p.month, oldNet: p.netPay, newNet, arrearAmount, lopDays: p.lopDays };
  });

  const totalArrears = breakdown.reduce((sum, b) => sum + b.arrearAmount, 0);

  // Save calculation
  const arrear = await req.prisma.payrollArrear.create({
    data: {
      userId: uid, fromMonth, toMonth, totalArrears,
      breakdown, status: 'calculated',
    },
  });

  res.json({ arrear, breakdown, totalArrears });
}));

// Apply calculated arrears to a payslip month
router.post('/apply-arrears', requireAdmin, asyncHandler(async (req, res) => {
  const { arrearId, applyInMonth } = req.body;
  if (!arrearId || !applyInMonth) throw badRequest('arrearId and applyInMonth are required');

  const id = parseId(arrearId);
  const arrear = await req.prisma.payrollArrear.findUnique({ where: { id } });
  if (!arrear) throw notFound('Arrear record');
  if (arrear.status === 'applied') throw badRequest('Arrears already applied');

  // Update the payslip for applyInMonth — add arrears to otherAllowance
  const payslip = await req.prisma.payslip.findUnique({
    where: { userId_month: { userId: arrear.userId, month: applyInMonth } },
  });
  if (!payslip) throw notFound('Payslip for the apply month');

  const newOtherAllowance = (payslip.otherAllowance || 0) + arrear.totalArrears;
  const newGross = (payslip.grossEarnings || 0) + arrear.totalArrears;
  const newNet = (payslip.netPay || 0) + arrear.totalArrears;

  await req.prisma.payslip.update({
    where: { id: payslip.id },
    data: {
      otherAllowance: newOtherAllowance,
      otherAllowanceLabel: payslip.otherAllowanceLabel
        ? `${payslip.otherAllowanceLabel} + Arrears`
        : 'Salary Arrears',
      grossEarnings: newGross,
      netPay: newNet,
    },
  });

  await req.prisma.payrollArrear.update({
    where: { id },
    data: { status: 'applied', appliedInMonth: applyInMonth, appliedBy: req.user.id },
  });

  res.json({ message: 'Arrears applied successfully', totalArrears: arrear.totalArrears, appliedInMonth: applyInMonth });
}));

// List arrears for a user or all
router.get('/arrears', requireAdmin, asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.userId) where.userId = parseId(req.query.userId);
  if (req.query.status) where.status = req.query.status;

  const arrears = await req.prisma.payrollArrear.findMany({
    where,
    include: { user: { select: { id: true, name: true, employeeId: true, department: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(arrears);
}));

// Cancel arrears
router.put('/arrears/:id/cancel', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const arrear = await req.prisma.payrollArrear.findUnique({ where: { id } });
  if (!arrear) throw notFound('Arrear');
  if (arrear.status === 'applied') throw badRequest('Cannot cancel applied arrears');
  await req.prisma.payrollArrear.update({ where: { id }, data: { status: 'cancelled' } });
  res.json({ message: 'Arrears cancelled' });
}));

// ═══════════════════════════════════════════════
// P5: Stop Salary Processing
// ═══════════════════════════════════════════════

// Stop salary processing for an employee
router.put('/stop-salary/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const { reason } = req.body;
  if (!reason?.trim()) throw badRequest('Reason is required');

  const salary = await req.prisma.salaryStructure.findUnique({ where: { userId } });
  if (!salary) throw notFound('Salary structure');

  await req.prisma.salaryStructure.update({
    where: { userId },
    data: { stopSalaryProcessing: true, stopSalaryReason: reason.trim(), stopSalaryBy: req.user.id, stopSalaryAt: new Date() },
  });
  res.json({ message: 'Salary processing stopped', userId });
}));

// Release salary processing
router.put('/release-salary/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  await req.prisma.salaryStructure.update({
    where: { userId },
    data: { stopSalaryProcessing: false, stopSalaryReason: null, stopSalaryBy: null, stopSalaryAt: null },
  });
  res.json({ message: 'Salary processing released', userId });
}));

// Get stopped employees
router.get('/stopped-employees', requireAdmin, asyncHandler(async (req, res) => {
  const stopped = await req.prisma.salaryStructure.findMany({
    where: { stopSalaryProcessing: true },
    include: { user: { select: { id: true, name: true, employeeId: true, department: true } } },
  });
  res.json(stopped);
}));

// ── GET /export?month=YYYY-MM — Download all payslips as Excel ───────────────
router.get('/export', requireAdmin, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be YYYY-MM format.');

  const XLSX = require('xlsx');
  const payslips = await req.prisma.payslip.findMany({
    where: { month },
    include: { user: { select: { name: true, employeeId: true, department: true, designation: true, dateOfJoining: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  if (payslips.length === 0) throw notFound('No payslips found for this month.');

  const rows = payslips.map(p => ({
    'Emp ID':         p.user?.employeeId || '',
    'Name':           p.user?.name || '',
    'Department':     p.user?.department || '',
    'Designation':    p.user?.designation || p.designation || '',
    'Date of Joining': p.user?.dateOfJoining || p.dateOfJoining || '',
    'Basic':          p.basic || 0,
    'HRA':            p.hra || 0,
    'DA':             p.da || 0,
    'Special Allow.': p.specialAllowance || 0,
    'Medical Allow.': p.medicalAllowance || 0,
    'Conveyance':     p.conveyanceAllowance || 0,
    'Other Allow.':   p.otherAllowance || 0,
    'Gross Earnings': p.grossEarnings || 0,
    'Emp PF':         p.employeePf || 0,
    'Emp ESI':        p.employeeEsi || 0,
    'Prof. Tax':      p.professionalTax || 0,
    'TDS':            p.tds || 0,
    'LOP Deduction':  p.lopDeduction || 0,
    'Other Ded.':     p.otherDeductions || 0,
    'Total Deductions': p.totalDeductions || 0,
    'Net Pay':        p.netPay || 0,
    'Employer PF':    p.employerPf || 0,
    'Employer ESI':   p.employerEsi || 0,
    'LOP Days':       p.lopDays || 0,
    'Working Days':   p.workingDays || 0,
    'Present Days':   p.presentDays || 0,
    'Status':         p.status || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 12) }));
  XLSX.utils.book_append_sheet(wb, ws, `Payroll ${month}`);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="payroll_${month}.xlsx"`);
  res.send(buffer);
}));

// ── POST /increment — Apply salary increment OR decrement ──
// Modes: { newCtcAnnual } | { changePercent } | { changeAmount }
// changePercent: positive = increment, negative = decrement
// changeAmount:  positive = increment, negative = decrement
router.post('/increment', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, newCtcAnnual, changePercent, changeAmount, effectiveFrom, reason, appraisalReviewId } = req.body;

  if (!userId || !effectiveFrom) throw badRequest('userId and effectiveFrom are required.');
  if (newCtcAnnual == null && changePercent == null && changeAmount == null)
    throw badRequest('Provide newCtcAnnual, changePercent, or changeAmount.');

  const uid = parseInt(userId);
  const existing = await req.prisma.salaryStructure.findUnique({ where: { userId: uid } });
  if (!existing) throw notFound('No salary structure found for this employee. Create one first.');

  let finalCtc;
  if (newCtcAnnual != null) {
    finalCtc = Math.round(parseFloat(newCtcAnnual) * 100) / 100;
  } else if (changePercent != null) {
    finalCtc = Math.round(existing.ctcAnnual * (1 + parseFloat(changePercent) / 100) * 100) / 100;
  } else {
    finalCtc = Math.round((existing.ctcAnnual + parseFloat(changeAmount)) * 100) / 100;
  }

  if (finalCtc <= 0) throw badRequest('New CTC must be positive.');
  if (finalCtc === existing.ctcAnnual) throw badRequest('New CTC is the same as current CTC. No change.');

  const diff = finalCtc - existing.ctcAnnual;
  const changePct = Math.round((diff / existing.ctcAnnual) * 10000) / 100;
  const revisionType = diff > 0 ? 'increment' : 'decrement';
  const newCtcMonthly = Math.round((finalCtc / 12) * 100) / 100;

  const scaleFactor = finalCtc / existing.ctcAnnual;
  const scale = (v) => Math.round((v || 0) * scaleFactor * 100) / 100;

  const data = {
    ctcAnnual: finalCtc, ctcMonthly: newCtcMonthly,
    basic: scale(existing.basic), hra: scale(existing.hra), da: scale(existing.da),
    specialAllowance: scale(existing.specialAllowance), medicalAllowance: scale(existing.medicalAllowance),
    conveyanceAllowance: scale(existing.conveyanceAllowance), otherAllowance: scale(existing.otherAllowance),
    employerPf: scale(existing.employerPf), employerEsi: scale(existing.employerEsi),
    employeePf: scale(existing.employeePf), employeeEsi: scale(existing.employeeEsi),
    professionalTax: existing.professionalTax, tds: scale(existing.tds),
    effectiveFrom,
  };
  data.netPayMonthly = data.basic + data.hra + data.da + data.specialAllowance + data.medicalAllowance +
    data.conveyanceAllowance + data.otherAllowance - data.employeePf - data.employeeEsi -
    (data.professionalTax || 0) - data.tds;

  const [updated] = await req.prisma.$transaction([
    req.prisma.salaryStructure.update({ where: { userId: uid }, data }),
    req.prisma.salaryRevision.create({
      data: {
        userId: uid, effectiveFrom,
        oldCtc: existing.ctcAnnual, newCtc: finalCtc,
        reason: reason || `Salary ${revisionType} ${Math.abs(changePct)}%`,
        revisedBy: req.user.id,
        revisionType,
      },
    }),
  ]);

  if (appraisalReviewId) {
    await req.prisma.appraisalReview.update({
      where: { id: parseInt(appraisalReviewId) },
      data: { hrNotes: `${revisionType === 'increment' ? 'Increment' : 'Decrement'} applied: ₹${existing.ctcAnnual.toLocaleString('en-IN')} → ₹${finalCtc.toLocaleString('en-IN')} (${changePct}%) effective ${effectiveFrom}` },
    }).catch(() => {});
  }

  const label = revisionType === 'increment'
    ? `${changePct}% raise effective ${effectiveFrom}.`
    : `${Math.abs(changePct)}% reduction effective ${effectiveFrom}.`;
  res.json({ message: `Salary ${revisionType} applied. ${label}`, revisionType, changePct, oldCtc: existing.ctcAnnual, newCtc: finalCtc, salaryStructure: updated });
}));

// ── GET /statutory?month=YYYY-MM — PF/ESI/TDS statutory report ──────────────
router.get('/statutory', requireAdmin, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be YYYY-MM format.');

  const payslips = await req.prisma.payslip.findMany({
    where: { month },
    include: { user: { select: { name: true, employeeId: true, department: true, designation: true, dateOfJoining: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  const rows = payslips.map(p => ({
    userId: p.userId,
    employeeId: p.user?.employeeId || '',
    name: p.user?.name || '',
    department: p.user?.department || '',
    designation: p.user?.designation || '',
    grossEarnings: p.grossEarnings || 0,
    basic: p.basic || 0,
    // PF
    employeePf: p.employeePf || 0,
    employerPf: p.employerPf || 0,
    totalPf: (p.employeePf || 0) + (p.employerPf || 0),
    // ESI
    employeeEsi: p.employeeEsi || 0,
    employerEsi: p.employerEsi || 0,
    totalEsi: (p.employeeEsi || 0) + (p.employerEsi || 0),
    // TDS / PT
    tds: p.tds || 0,
    professionalTax: p.professionalTax || 0,
    netPay: p.netPay || 0,
  }));

  const totals = rows.reduce((acc, r) => {
    acc.grossEarnings  += r.grossEarnings;
    acc.employeePf     += r.employeePf;
    acc.employerPf     += r.employerPf;
    acc.totalPf        += r.totalPf;
    acc.employeeEsi    += r.employeeEsi;
    acc.employerEsi    += r.employerEsi;
    acc.totalEsi       += r.totalEsi;
    acc.tds            += r.tds;
    acc.professionalTax+= r.professionalTax;
    acc.netPay         += r.netPay;
    return acc;
  }, { grossEarnings: 0, employeePf: 0, employerPf: 0, totalPf: 0, employeeEsi: 0, employerEsi: 0, totalEsi: 0, tds: 0, professionalTax: 0, netPay: 0 });

  res.json({ month, headcount: rows.length, rows, totals });
}));

// ── GET /statutory-export?month=YYYY-MM — Download statutory report as Excel ─
router.get('/statutory-export', requireAdmin, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be YYYY-MM format.');

  const XLSX = require('xlsx');
  const payslips = await req.prisma.payslip.findMany({
    where: { month },
    include: { user: { select: { name: true, employeeId: true, department: true, designation: true, dateOfJoining: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  if (payslips.length === 0) throw notFound('No payslips found for this month.');

  const rows = payslips.map(p => ({
    'Emp ID':       p.user?.employeeId || '',
    'Name':         p.user?.name || '',
    'Department':   p.user?.department || '',
    'Gross':        p.grossEarnings || 0,
    'Basic':        p.basic || 0,
    'Emp PF (12%)': p.employeePf || 0,
    'Emp ESI (0.75%)': p.employeeEsi || 0,
    'TDS':          p.tds || 0,
    'Prof. Tax':    p.professionalTax || 0,
    'Employer PF (12%)': p.employerPf || 0,
    'Employer ESI (3.25%)': p.employerEsi || 0,
    'Total PF':     (p.employeePf || 0) + (p.employerPf || 0),
    'Total ESI':    (p.employeeEsi || 0) + (p.employerEsi || 0),
    'Net Pay':      p.netPay || 0,
  }));

  // Summary row
  const totals = rows.reduce((acc, r) => {
    Object.keys(r).forEach(k => { if (typeof r[k] === 'number') acc[k] = (acc[k] || 0) + r[k]; });
    return acc;
  }, { 'Emp ID': '', 'Name': 'TOTAL', 'Department': '' });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([...rows, totals]);
  ws['!cols'] = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, `Statutory ${month}`);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="statutory_${month}.xlsx"`);
  res.send(buffer);
}));

// ─── Off-Day Allowance Eligibility CRUD ──────────────────────────────────────

// GET /off-day-allowance — All eligible employees
router.get('/off-day-allowance', requireAdmin, asyncHandler(async (req, res) => {
  const records = await req.prisma.offDayAllowanceEligibility.findMany({
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } },
      createdByUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(records);
}));

// GET /off-day-allowance/active — Only currently active eligibilities
router.get('/off-day-allowance/active', requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const records = await req.prisma.offDayAllowanceEligibility.findMany({
    where: {
      eligibleFrom: { lte: today },
      OR: [{ eligibleTo: null }, { eligibleTo: { gte: today } }],
    },
    include: {
      user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(records);
}));

// GET /off-day-allowance/user/:userId — Eligibility history for a specific employee
router.get('/off-day-allowance/user/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const records = await req.prisma.offDayAllowanceEligibility.findMany({
    where: { userId },
    orderBy: { eligibleFrom: 'desc' },
  });
  res.json(records);
}));

// POST /off-day-allowance — Assign eligibility
router.post('/off-day-allowance', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'eligibleFrom');
  const { userId, eligibleFrom, eligibleTo, notes } = req.body;
  const uid = parseId(userId);

  // Check user exists
  const user = await req.prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true } });
  if (!user) throw notFound('Employee');

  // Check no overlapping active eligibility
  const existing = await req.prisma.offDayAllowanceEligibility.findFirst({
    where: { userId: uid, OR: [{ eligibleTo: null }, { eligibleTo: { gte: eligibleFrom } }] },
  });
  if (existing) throw badRequest('This employee already has an active off-day allowance eligibility. Stop the existing one first.');

  const record = await req.prisma.offDayAllowanceEligibility.create({
    data: { userId: uid, eligibleFrom, eligibleTo: eligibleTo || null, notes: notes || null, createdBy: req.user.id },
    include: { user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } } },
  });
  res.status(201).json(record);
}));

// PUT /off-day-allowance/:id — Update eligibility dates/notes
router.put('/off-day-allowance/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { eligibleFrom, eligibleTo, notes } = req.body;
  const record = await req.prisma.offDayAllowanceEligibility.findUnique({ where: { id } });
  if (!record) throw notFound('Off-Day Allowance Eligibility');

  const updated = await req.prisma.offDayAllowanceEligibility.update({
    where: { id },
    data: {
      ...(eligibleFrom && { eligibleFrom }),
      eligibleTo: eligibleTo !== undefined ? (eligibleTo || null) : record.eligibleTo,
      ...(notes !== undefined && { notes: notes || null }),
    },
    include: { user: { select: { id: true, name: true, employeeId: true, department: true, designation: true } } },
  });
  res.json(updated);
}));

// PUT /off-day-allowance/:id/stop — Stop eligibility today
router.put('/off-day-allowance/:id/stop', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const today = new Date().toISOString().slice(0, 10);
  const record = await req.prisma.offDayAllowanceEligibility.findUnique({ where: { id } });
  if (!record) throw notFound('Off-Day Allowance Eligibility');
  if (record.eligibleTo) throw badRequest('This eligibility is already stopped.');

  const updated = await req.prisma.offDayAllowanceEligibility.update({
    where: { id },
    data: { eligibleTo: today },
    include: { user: { select: { id: true, name: true, employeeId: true } } },
  });
  res.json(updated);
}));

// DELETE /off-day-allowance/:id — Remove completely
router.delete('/off-day-allowance/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const record = await req.prisma.offDayAllowanceEligibility.findUnique({ where: { id } });
  if (!record) throw notFound('Off-Day Allowance Eligibility');
  await req.prisma.offDayAllowanceEligibility.delete({ where: { id } });
  res.json({ message: 'Off-day allowance eligibility removed.' });
}));

module.exports = router;
