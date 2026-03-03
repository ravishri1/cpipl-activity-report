const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function isAdminRole(user) { return user.role === 'admin' || user.role === 'team_lead'; }

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

  const grossEarnings = (d.basic || 0) + (d.hra || 0) + (d.da || 0) + (d.specialAllowance || 0) +
    (d.medicalAllowance || 0) + (d.conveyanceAllowance || 0) + (d.otherAllowance || 0);
  const totalDeductions = (d.employeePf || 0) + (d.employeeEsi || 0) + (d.professionalTax || 0) + (d.tds || 0);
  const netPayMonthly = grossEarnings - totalDeductions;

  const data = {
    ctcAnnual: d.ctcAnnual || 0, ctcMonthly: d.ctcMonthly || (d.ctcAnnual ? d.ctcAnnual / 12 : 0),
    basic: d.basic || 0, hra: d.hra || 0, da: d.da || 0,
    specialAllowance: d.specialAllowance || 0, medicalAllowance: d.medicalAllowance || 0,
    conveyanceAllowance: d.conveyanceAllowance || 0, otherAllowance: d.otherAllowance || 0,
    otherAllowanceLabel: d.otherAllowanceLabel || null,
    employerPf: d.employerPf || 0, employerEsi: d.employerEsi || 0,
    employeePf: d.employeePf || 0, employeeEsi: d.employeeEsi || 0,
    professionalTax: d.professionalTax || 0, tds: d.tds || 0,
    netPayMonthly, effectiveFrom: d.effectiveFrom || null, notes: d.notes || null,
  };

  const existing = await req.prisma.salaryStructure.findUnique({ where: { userId } });
  const salary = await req.prisma.salaryStructure.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  if (existing && existing.ctcAnnual !== data.ctcAnnual) {
    await req.prisma.salaryRevision.create({
      data: {
        userId, effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
        oldCtc: existing.ctcAnnual, newCtc: data.ctcAnnual,
        reason: d.revisionReason || 'Salary structure updated', revisedBy: req.user.id,
      },
    });
  } else if (!existing) {
    await req.prisma.salaryRevision.create({
      data: {
        userId, effectiveFrom: data.effectiveFrom || new Date().toISOString().slice(0, 10),
        oldCtc: 0, newCtc: data.ctcAnnual,
        reason: 'Initial salary structure created', revisedBy: req.user.id,
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

// POST /generate — Generate payslips for a month (admin)
router.post('/generate', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month) throw badRequest('Month is required (format: YYYY-MM)');

  const year = parseInt(month.split('-')[0]);
  const monthNum = parseInt(month.split('-')[1]);

  const salaries = await req.prisma.salaryStructure.findMany({
    include: { user: { select: { id: true, name: true, isActive: true, department: true } } },
  });
  const activeSalaries = salaries.filter(s => s.user.isActive);
  if (activeSalaries.length === 0) throw badRequest('No active employees with salary structures');

  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const holidays = await req.prisma.holiday.findMany({ where: { date: { startsWith: month } } });
  const holidayDates = new Set(holidays.map(h => h.date));

  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, monthNum - 1, d).getDay();
    if (dayOfWeek !== 0 && !holidayDates.has(date)) workingDays++;
  }

  const results = [];
  for (const sal of activeSalaries) {
    const existing = await req.prisma.payslip.findUnique({
      where: { userId_month: { userId: sal.userId, month } },
    });
    if (existing) { results.push({ userId: sal.userId, status: 'skipped', reason: 'already exists' }); continue; }

    const attendances = await req.prisma.attendance.findMany({
      where: { userId: sal.userId, date: { startsWith: month } },
    });
    let presentDays = 0, lopDays = 0;
    for (const att of attendances) {
      if (att.status === 'present' || att.status === 'half_day') {
        presentDays += att.status === 'half_day' ? 0.5 : 1;
      } else if (att.status === 'absent') { lopDays++; }
    }
    if (attendances.length === 0) { presentDays = workingDays; lopDays = 0; }

    const perDaySalary = workingDays > 0 ? sal.ctcMonthly / workingDays : 0;
    const lopDeduction = Math.round(perDaySalary * lopDays);
    const grossEarnings = sal.basic + sal.hra + sal.da + sal.specialAllowance +
      sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowance;
    const totalDeductions = sal.employeePf + sal.employeeEsi + sal.professionalTax + sal.tds;
    const netPay = Math.round(grossEarnings - totalDeductions - lopDeduction);

    await req.prisma.payslip.create({
      data: {
        userId: sal.userId, month, year,
        basic: sal.basic, hra: sal.hra, da: sal.da,
        specialAllowance: sal.specialAllowance, medicalAllowance: sal.medicalAllowance,
        conveyanceAllowance: sal.conveyanceAllowance, otherAllowance: sal.otherAllowance,
        otherAllowanceLabel: sal.otherAllowanceLabel, grossEarnings,
        employeePf: sal.employeePf, employeeEsi: sal.employeeEsi,
        professionalTax: sal.professionalTax, tds: sal.tds,
        otherDeductions: 0, totalDeductions: totalDeductions + lopDeduction,
        netPay, workingDays, presentDays, lopDays, lopDeduction,
        status: 'generated', generatedAt: new Date(),
      },
    });
    results.push({ userId: sal.userId, status: 'generated', netPay });
  }
  res.json({ message: `Payslips generated for ${month}`, workingDays, results });
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
          id: true, name: true, email: true, employeeId: true, designation: true, department: true, companyId: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
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
          id: true, name: true, email: true, employeeId: true, designation: true, department: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
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
          id: true, name: true, email: true, employeeId: true, designation: true, department: true, bankName: true, bankAccountNumber: true, bankIfscCode: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
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
      },
    },
  });
  if (!payslip) throw notFound('Payslip');
  if (!isAdminRole(req.user) && payslip.userId !== req.user.id) throw forbidden('Access denied');
  res.json(payslip);
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

// POST /payslips/publish-all — Publish all payslips for a month (admin)
router.post('/payslips/publish-all', requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  const { month } = req.body;
  if (!month) throw badRequest('Month is required');
  const result = await req.prisma.payslip.updateMany({
    where: { month, status: 'generated' },
    data: { status: 'published', publishedAt: new Date() },
  });
  res.json({ message: `Published ${result.count} payslips for ${month}`, count: result.count });
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
          name: true, employeeId: true, department: true, designation: true,
          shiftAssignments: {
            where: {
              status: 'active',
              effectiveFrom: { lte: new Date() },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: new Date() } }
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

module.exports = router;
