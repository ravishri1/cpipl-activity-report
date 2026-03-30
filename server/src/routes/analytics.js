const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest } = require('../utils/httpErrors');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);
router.use(requireAdmin);

// GET /headcount — Headcount breakdown by department, company, and employment type
router.get('/headcount', asyncHandler(async (req, res) => {
  const activeUsers = await req.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, department: true, employmentType: true, companyId: true, company: { select: { name: true } } },
  });
  const inactiveCount = await req.prisma.user.count({ where: { isActive: false } });

  const deptMap = {};
  const companyMap = {};
  const typeMap = {};
  activeUsers.forEach(u => {
    const dept = u.department || 'Unassigned';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
    const name = u.company?.name || 'Unassigned';
    companyMap[name] = (companyMap[name] || 0) + 1;
    const type = u.employmentType || 'full_time';
    typeMap[type] = (typeMap[type] || 0) + 1;
  });

  res.json({
    totalActive: activeUsers.length, totalInactive: inactiveCount,
    byDepartment: Object.entries(deptMap).map(([department, count]) => ({ department, count })).sort((a, b) => b.count - a.count),
    byCompany: Object.entries(companyMap).map(([company, count]) => ({ company, count })).sort((a, b) => b.count - a.count),
    byEmploymentType: Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
  });
}));

// GET /attrition?months=6 — Joiners vs leavers for the last N months
router.get('/attrition', asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  const now = new Date();
  const data = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });

    const joiners = await req.prisma.user.count({ where: { dateOfJoining: { startsWith: prefix } } });
    const leavers = await req.prisma.separation.count({ where: { requestDate: { startsWith: prefix } } });
    data.push({ month: prefix, label, joiners, leavers });
  }

  res.json(data);
}));

// GET /attendance-summary?month=YYYY-MM — Attendance breakdown
router.get('/attendance-summary', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be in YYYY-MM format.');

  const records = await req.prisma.attendance.findMany({
    where: { date: { startsWith: month } },
    include: { user: { select: { department: true } } },
  });

  const statusCounts = { present: 0, absent: 0, half_day: 0, late: 0, on_leave: 0, holiday: 0, weekend: 0 };
  records.forEach(r => { if (statusCounts.hasOwnProperty(r.status)) statusCounts[r.status]++; });

  const payslips = await req.prisma.payslip.findMany({ where: { month }, select: { lopDays: true } });
  const totalLopDays = payslips.reduce((sum, p) => sum + (p.lopDays || 0), 0);

  const deptBreakdown = {};
  records.forEach(r => {
    const dept = r.user?.department || 'Unassigned';
    if (!deptBreakdown[dept]) {
      deptBreakdown[dept] = { department: dept, present: 0, absent: 0, half_day: 0, late: 0, on_leave: 0, total: 0 };
    }
    deptBreakdown[dept].total++;
    if (deptBreakdown[dept].hasOwnProperty(r.status)) deptBreakdown[dept][r.status]++;
  });

  res.json({
    month, totalRecords: records.length, statusCounts, totalLopDays,
    byDepartment: Object.values(deptBreakdown).sort((a, b) => b.total - a.total),
  });
}));

// GET /leave-summary?month=YYYY-MM or ?year=2026 — Leave requests aggregated
router.get('/leave-summary', asyncHandler(async (req, res) => {
  const { month, year: yearParam } = req.query;
  let dateFilter = {};
  let periodLabel = '';

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    dateFilter = { startDate: { startsWith: month } };
    periodLabel = month;
  } else {
    const year = parseInt(yearParam) || new Date().getFullYear();
    dateFilter = { startDate: { startsWith: String(year) } };
    periodLabel = String(year);
  }

  const requests = await req.prisma.leaveRequest.findMany({
    where: dateFilter,
    include: { leaveType: { select: { name: true, code: true } }, user: { select: { department: true } } },
  });

  const byType = {};
  requests.forEach(r => {
    const typeName = r.leaveType?.name || 'Unknown';
    if (!byType[typeName]) byType[typeName] = { type: typeName, code: r.leaveType?.code, count: 0, totalDays: 0 };
    byType[typeName].count++;
    byType[typeName].totalDays += r.days || 0;
  });

  const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  requests.forEach(r => { if (byStatus.hasOwnProperty(r.status)) byStatus[r.status]++; });

  const byDepartment = {};
  requests.forEach(r => {
    const dept = r.user?.department || 'Unassigned';
    if (!byDepartment[dept]) byDepartment[dept] = { department: dept, count: 0, totalDays: 0, approved: 0, pending: 0, rejected: 0 };
    byDepartment[dept].count++;
    byDepartment[dept].totalDays += r.days || 0;
    if (byDepartment[dept].hasOwnProperty(r.status)) byDepartment[dept][r.status]++;
  });

  const yearForBalance = month ? parseInt(month.substring(0, 4)) : (parseInt(yearParam) || new Date().getFullYear());
  const balances = await req.prisma.leaveBalance.findMany({ where: { year: yearForBalance }, select: { total: true, used: true } });
  const totalAllocated = balances.reduce((sum, b) => sum + (b.total || 0), 0);
  const totalUsed = balances.reduce((sum, b) => sum + (b.used || 0), 0);
  const utilizationRate = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 10000) / 100 : 0;

  res.json({
    period: periodLabel, totalRequests: requests.length,
    byType: Object.values(byType).sort((a, b) => b.count - a.count),
    byStatus,
    byDepartment: Object.values(byDepartment).sort((a, b) => b.count - a.count),
    utilization: { totalAllocated, totalUsed, utilizationRate },
  });
}));

// GET /gender-diversity — Gender distribution among active employees
router.get('/gender-diversity', asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({ where: { isActive: true }, select: { gender: true } });
  const total = users.length;
  const counts = { male: 0, female: 0, other: 0, notSpecified: 0 };
  users.forEach(u => {
    if (u.gender === 'male') counts.male++;
    else if (u.gender === 'female') counts.female++;
    else if (u.gender === 'other') counts.other++;
    else counts.notSpecified++;
  });

  const pct = (val) => (total > 0 ? Math.round((val / total) * 10000) / 100 : 0);
  res.json({
    total, ...counts,
    percentages: { male: pct(counts.male), female: pct(counts.female), other: pct(counts.other), notSpecified: pct(counts.notSpecified) },
  });
}));

// GET /age-distribution — Age buckets
router.get('/age-distribution', asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({
    where: { isActive: true, dateOfBirth: { not: null } },
    select: { dateOfBirth: true },
  });

  const now = new Date();
  const buckets = { '18-25': 0, '26-30': 0, '31-35': 0, '36-40': 0, '41-50': 0, '50+': 0 };

  users.forEach(u => {
    const dob = new Date(u.dateOfBirth);
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;

    if (age >= 18 && age <= 25) buckets['18-25']++;
    else if (age >= 26 && age <= 30) buckets['26-30']++;
    else if (age >= 31 && age <= 35) buckets['31-35']++;
    else if (age >= 36 && age <= 40) buckets['36-40']++;
    else if (age >= 41 && age <= 50) buckets['41-50']++;
    else if (age > 50) buckets['50+']++;
  });

  const total = users.length;
  res.json({
    total,
    distribution: Object.entries(buckets).map(([range, count]) => ({
      range, count, percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    })),
  });
}));

// GET /tenure-distribution — Tenure buckets
router.get('/tenure-distribution', asyncHandler(async (req, res) => {
  const users = await req.prisma.user.findMany({
    where: { isActive: true, dateOfJoining: { not: null } },
    select: { dateOfJoining: true },
  });

  const now = new Date();
  const buckets = { '0-6mo': 0, '6mo-1yr': 0, '1-2yr': 0, '2-3yr': 0, '3-5yr': 0, '5yr+': 0 };

  users.forEach(u => {
    const joined = new Date(u.dateOfJoining);
    const diffMonths = (now - joined) / (1000 * 60 * 60 * 24 * 30.44);

    if (diffMonths < 6) buckets['0-6mo']++;
    else if (diffMonths < 12) buckets['6mo-1yr']++;
    else if (diffMonths < 24) buckets['1-2yr']++;
    else if (diffMonths < 36) buckets['2-3yr']++;
    else if (diffMonths < 60) buckets['3-5yr']++;
    else buckets['5yr+']++;
  });

  const total = users.length;
  res.json({
    total,
    distribution: Object.entries(buckets).map(([range, count]) => ({
      range, count, percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    })),
  });
}));

// GET /birthday-calendar — Upcoming birthdays this month and next
router.get('/birthday-calendar', asyncHandler(async (req, res) => {
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');

  const users = await req.prisma.user.findMany({
    where: { isActive: true, dateOfBirth: { not: null } },
    select: { id: true, name: true, department: true, dateOfBirth: true, profilePhotoUrl: true, company: { select: { name: true } } },
  });

  const birthdays = users
    .filter(u => {
      const birthMonth = u.dateOfBirth.substring(5, 7);
      return birthMonth === currentMonth || birthMonth === nextMonth;
    })
    .map(u => {
      const birthMonth = u.dateOfBirth.substring(5, 7);
      const birthDay = u.dateOfBirth.substring(8, 10);
      const birthYear = parseInt(u.dateOfBirth.substring(0, 4));
      const birthdayThisYear = new Date(now.getFullYear(), parseInt(birthMonth) - 1, parseInt(birthDay));

      return {
        id: u.id, name: u.name, department: u.department,
        company: u.company?.name || null, dateOfBirth: u.dateOfBirth,
        birthDay: `${birthMonth}-${birthDay}`, age: now.getFullYear() - birthYear,
        profilePhotoUrl: u.profilePhotoUrl, isThisMonth: birthMonth === currentMonth,
        sortDate: birthdayThisYear,
      };
    })
    .sort((a, b) => a.sortDate - b.sortDate);

  res.json({
    currentMonth, nextMonth, total: birthdays.length,
    birthdays: birthdays.map(({ sortDate, ...rest }) => rest),
  });
}));

// GET /payroll-summary?months=6 — Monthly payroll cost trend + current month breakdown
router.get('/payroll-summary', asyncHandler(async (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 12);
  const now = new Date();

  // Monthly trend for last N months
  const trend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    const payslips = await req.prisma.payslip.findMany({
      where: { month },
      select: { grossEarnings: true, totalDeductions: true, netPay: true, employerPf: true, employerEsi: true },
    });
    const gross = payslips.reduce((s, p) => s + (p.grossEarnings || 0), 0);
    const deductions = payslips.reduce((s, p) => s + (p.totalDeductions || 0), 0);
    const net = payslips.reduce((s, p) => s + (p.netPay || 0), 0);
    const empPf = payslips.reduce((s, p) => s + (p.employerPf || 0), 0);
    const empEsi = payslips.reduce((s, p) => s + (p.employerEsi || 0), 0);
    trend.push({ month, label, headcount: payslips.length, gross, deductions, net, totalCost: gross + empPf + empEsi });
  }

  // Current month dept breakdown
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentPayslips = await req.prisma.payslip.findMany({
    where: { month: currentMonth },
    include: { user: { select: { department: true } } },
    select: { grossEarnings: true, netPay: true, totalDeductions: true, user: { select: { department: true } } },
  });

  const deptMap = {};
  currentPayslips.forEach(p => {
    const dept = p.user?.department || 'Unassigned';
    if (!deptMap[dept]) deptMap[dept] = { department: dept, count: 0, gross: 0, net: 0, deductions: 0 };
    deptMap[dept].count++;
    deptMap[dept].gross += p.grossEarnings || 0;
    deptMap[dept].net += p.netPay || 0;
    deptMap[dept].deductions += p.totalDeductions || 0;
  });

  // Active salary structures total CTC
  const salaries = await req.prisma.salaryStructure.findMany({
    where: { user: { isActive: true } },
    select: { ctcAnnual: true, ctcMonthly: true },
  });
  const totalCTCAnnual  = salaries.reduce((s, sal) => s + (sal.ctcAnnual  || 0), 0);
  const totalCTCMonthly = salaries.reduce((s, sal) => s + (sal.ctcMonthly || 0), 0);

  res.json({
    trend,
    currentMonth,
    byDepartment: Object.values(deptMap).sort((a, b) => b.gross - a.gross),
    ctc: { totalCTCAnnual, totalCTCMonthly, employeeCount: salaries.length },
  });
}));

// GET /productivity?month=YYYY-MM — EOD report submission rate + hours by dept
router.get('/productivity', asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('Month must be YYYY-MM format.');

  // Active employees
  const activeUsers = await req.prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: true },
  });
  const totalEmployees = activeUsers.length;

  // Reports for this month
  const reports = await req.prisma.dailyReport.findMany({
    where: { reportDate: { startsWith: month } },
    include: {
      user: { select: { department: true } },
      tasks: { select: { hours: true } },
    },
    select: {
      userId: true, reportDate: true, totalHours: true,
      user: { select: { department: true } },
      tasks: { select: { hours: true } },
    },
  });

  // Working days in month (Mon-Fri, rough estimate)
  const [yr, mo] = month.split('-').map(Number);
  let workingDays = 0;
  const daysInMonth = new Date(yr, mo, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(yr, mo - 1, d).getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  // Unique reporters
  const uniqueReporters = new Set(reports.map(r => r.userId)).size;
  const totalReports = reports.length;
  const totalHours = reports.reduce((s, r) => s + (r.totalHours || 0), 0);
  const submissionRate = totalEmployees > 0
    ? Math.round((uniqueReporters / totalEmployees) * 10000) / 100
    : 0;

  // By department
  const deptMap = {};
  reports.forEach(r => {
    const dept = r.user?.department || 'Unassigned';
    if (!deptMap[dept]) deptMap[dept] = { department: dept, reports: 0, hours: 0, reporters: new Set() };
    deptMap[dept].reports++;
    deptMap[dept].hours += r.totalHours || 0;
    deptMap[dept].reporters.add(r.userId);
  });

  // Active reporters per dept
  const deptBreakdown = Object.values(deptMap).map(d => ({
    department: d.department,
    reports: d.reports,
    hours: Math.round(d.hours * 10) / 10,
    reporters: d.reporters.size,
    avgHoursPerReport: d.reports > 0 ? Math.round((d.hours / d.reports) * 10) / 10 : 0,
  })).sort((a, b) => b.reports - a.reports);

  // Top 10 by hours
  const userHours = {};
  reports.forEach(r => {
    if (!userHours[r.userId]) userHours[r.userId] = { userId: r.userId, reports: 0, hours: 0 };
    userHours[r.userId].reports++;
    userHours[r.userId].hours += r.totalHours || 0;
  });
  const userMap = Object.fromEntries(activeUsers.map(u => [u.id, u]));
  const topContributors = Object.values(userHours)
    .map(u => ({ ...u, hours: Math.round(u.hours * 10) / 10, name: userMap[u.userId]?.name || '—', department: userMap[u.userId]?.department || '—' }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  res.json({
    month, totalEmployees, workingDays, totalReports, uniqueReporters, submissionRate,
    totalHours: Math.round(totalHours * 10) / 10,
    avgHoursPerReport: totalReports > 0 ? Math.round((totalHours / totalReports) * 10) / 10 : 0,
    byDepartment: deptBreakdown,
    topContributors,
  });
}));

module.exports = router;
