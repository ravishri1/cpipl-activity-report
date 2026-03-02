const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All analytics routes require authentication + admin/team_lead role
router.use(authenticate);
router.use(requireAdmin);

// ─── GET /api/analytics/headcount ───────────────────────────────────────────
// Headcount breakdown by department, company, and employment type
router.get('/headcount', async (req, res) => {
  try {
    const prisma = req.prisma;

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        department: true,
        employmentType: true,
        companyId: true,
        company: { select: { name: true } },
      },
    });

    const inactiveCount = await prisma.user.count({ where: { isActive: false } });

    // By department
    const deptMap = {};
    activeUsers.forEach((u) => {
      const dept = u.department || 'Unassigned';
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    const byDepartment = Object.entries(deptMap)
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count);

    // By company
    const companyMap = {};
    activeUsers.forEach((u) => {
      const name = u.company?.name || 'Unassigned';
      companyMap[name] = (companyMap[name] || 0) + 1;
    });
    const byCompany = Object.entries(companyMap)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);

    // By employment type
    const typeMap = {};
    activeUsers.forEach((u) => {
      const type = u.employmentType || 'full_time';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    const byEmploymentType = Object.entries(typeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalActive: activeUsers.length,
      totalInactive: inactiveCount,
      byDepartment,
      byCompany,
      byEmploymentType,
    });
  } catch (err) {
    console.error('Headcount analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch headcount data.' });
  }
});

// ─── GET /api/analytics/attrition?months=6 ──────────────────────────────────
// Joiners vs leavers for the last N months
router.get('/attrition', async (req, res) => {
  try {
    const prisma = req.prisma;
    const months = parseInt(req.query.months) || 6;
    const now = new Date();

    const data = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const prefix = `${year}-${month}`;
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });

      // Count joiners: users whose dateOfJoining starts with this YYYY-MM
      const joiners = await prisma.user.count({
        where: {
          dateOfJoining: { startsWith: prefix },
        },
      });

      // Count leavers: separations whose requestDate starts with this YYYY-MM
      const leavers = await prisma.separation.count({
        where: {
          requestDate: { startsWith: prefix },
        },
      });

      data.push({ month: prefix, label, joiners, leavers });
    }

    res.json(data);
  } catch (err) {
    console.error('Attrition analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch attrition data.' });
  }
});

// ─── GET /api/analytics/attendance-summary?month=YYYY-MM ────────────────────
// Attendance breakdown by status with department-level detail
router.get('/attendance-summary', async (req, res) => {
  try {
    const prisma = req.prisma;
    const month = req.query.month || new Date().toISOString().substring(0, 7);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
    }

    // Fetch all attendance records for the month with user department
    const records = await prisma.attendance.findMany({
      where: { date: { startsWith: month } },
      include: { user: { select: { department: true } } },
    });

    // Overall status counts
    const statusCounts = { present: 0, absent: 0, half_day: 0, late: 0, on_leave: 0, holiday: 0, weekend: 0 };
    records.forEach((r) => {
      if (statusCounts.hasOwnProperty(r.status)) {
        statusCounts[r.status]++;
      }
    });

    // Total LOP days from payslips for that month
    const payslips = await prisma.payslip.findMany({
      where: { month },
      select: { lopDays: true },
    });
    const totalLopDays = payslips.reduce((sum, p) => sum + (p.lopDays || 0), 0);

    // Department-level breakdown
    const deptBreakdown = {};
    records.forEach((r) => {
      const dept = r.user?.department || 'Unassigned';
      if (!deptBreakdown[dept]) {
        deptBreakdown[dept] = { department: dept, present: 0, absent: 0, half_day: 0, late: 0, on_leave: 0, total: 0 };
      }
      deptBreakdown[dept].total++;
      if (deptBreakdown[dept].hasOwnProperty(r.status)) {
        deptBreakdown[dept][r.status]++;
      }
    });

    res.json({
      month,
      totalRecords: records.length,
      statusCounts,
      totalLopDays,
      byDepartment: Object.values(deptBreakdown).sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    console.error('Attendance summary error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance summary.' });
  }
});

// ─── GET /api/analytics/leave-summary?month=YYYY-MM or ?year=2026 ───────────
// Leave requests aggregated by type, status, and department
router.get('/leave-summary', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { month, year: yearParam } = req.query;

    // Build date filter: either a specific month or full year
    let dateFilter = {};
    let periodLabel = '';

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      // Filter leave requests where the startDate falls within the given month
      dateFilter = { startDate: { startsWith: month } };
      periodLabel = month;
    } else {
      const year = parseInt(yearParam) || new Date().getFullYear();
      dateFilter = { startDate: { startsWith: String(year) } };
      periodLabel = String(year);
    }

    const requests = await prisma.leaveRequest.findMany({
      where: dateFilter,
      include: {
        leaveType: { select: { name: true, code: true } },
        user: { select: { department: true } },
      },
    });

    // By leave type
    const byType = {};
    requests.forEach((r) => {
      const typeName = r.leaveType?.name || 'Unknown';
      if (!byType[typeName]) {
        byType[typeName] = { type: typeName, code: r.leaveType?.code, count: 0, totalDays: 0 };
      }
      byType[typeName].count++;
      byType[typeName].totalDays += r.days || 0;
    });

    // By status
    const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    requests.forEach((r) => {
      if (byStatus.hasOwnProperty(r.status)) {
        byStatus[r.status]++;
      }
    });

    // By department
    const byDepartment = {};
    requests.forEach((r) => {
      const dept = r.user?.department || 'Unassigned';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { department: dept, count: 0, totalDays: 0, approved: 0, pending: 0, rejected: 0 };
      }
      byDepartment[dept].count++;
      byDepartment[dept].totalDays += r.days || 0;
      if (byDepartment[dept].hasOwnProperty(r.status)) {
        byDepartment[dept][r.status]++;
      }
    });

    // Utilization rates: approved days / total leave balance allocated
    const yearForBalance = month ? parseInt(month.substring(0, 4)) : (parseInt(yearParam) || new Date().getFullYear());
    const balances = await prisma.leaveBalance.findMany({
      where: { year: yearForBalance },
      select: { total: true, used: true },
    });
    const totalAllocated = balances.reduce((sum, b) => sum + (b.total || 0), 0);
    const totalUsed = balances.reduce((sum, b) => sum + (b.used || 0), 0);
    const utilizationRate = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 10000) / 100 : 0;

    res.json({
      period: periodLabel,
      totalRequests: requests.length,
      byType: Object.values(byType).sort((a, b) => b.count - a.count),
      byStatus,
      byDepartment: Object.values(byDepartment).sort((a, b) => b.count - a.count),
      utilization: {
        totalAllocated,
        totalUsed,
        utilizationRate,
      },
    });
  } catch (err) {
    console.error('Leave summary error:', err);
    res.status(500).json({ error: 'Failed to fetch leave summary.' });
  }
});

// ─── GET /api/analytics/gender-diversity ────────────────────────────────────
// Gender distribution among active employees
router.get('/gender-diversity', async (req, res) => {
  try {
    const prisma = req.prisma;

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { gender: true },
    });

    const total = users.length;
    const counts = { male: 0, female: 0, other: 0, notSpecified: 0 };

    users.forEach((u) => {
      if (u.gender === 'male') counts.male++;
      else if (u.gender === 'female') counts.female++;
      else if (u.gender === 'other') counts.other++;
      else counts.notSpecified++;
    });

    const pct = (val) => (total > 0 ? Math.round((val / total) * 10000) / 100 : 0);

    res.json({
      total,
      male: counts.male,
      female: counts.female,
      other: counts.other,
      notSpecified: counts.notSpecified,
      percentages: {
        male: pct(counts.male),
        female: pct(counts.female),
        other: pct(counts.other),
        notSpecified: pct(counts.notSpecified),
      },
    });
  } catch (err) {
    console.error('Gender diversity error:', err);
    res.status(500).json({ error: 'Failed to fetch gender diversity data.' });
  }
});

// ─── GET /api/analytics/age-distribution ────────────────────────────────────
// Age buckets: 18-25, 26-30, 31-35, 36-40, 41-50, 50+
router.get('/age-distribution', async (req, res) => {
  try {
    const prisma = req.prisma;

    const users = await prisma.user.findMany({
      where: { isActive: true, dateOfBirth: { not: null } },
      select: { dateOfBirth: true },
    });

    const now = new Date();
    const buckets = {
      '18-25': 0,
      '26-30': 0,
      '31-35': 0,
      '36-40': 0,
      '41-50': 0,
      '50+': 0,
    };

    users.forEach((u) => {
      const dob = new Date(u.dateOfBirth);
      // Calculate age in full years
      let age = now.getFullYear() - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
      }

      if (age >= 18 && age <= 25) buckets['18-25']++;
      else if (age >= 26 && age <= 30) buckets['26-30']++;
      else if (age >= 31 && age <= 35) buckets['31-35']++;
      else if (age >= 36 && age <= 40) buckets['36-40']++;
      else if (age >= 41 && age <= 50) buckets['41-50']++;
      else if (age > 50) buckets['50+']++;
    });

    const total = users.length;
    const distribution = Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }));

    res.json({ total, distribution });
  } catch (err) {
    console.error('Age distribution error:', err);
    res.status(500).json({ error: 'Failed to fetch age distribution.' });
  }
});

// ─── GET /api/analytics/tenure-distribution ─────────────────────────────────
// Tenure buckets: 0-6mo, 6mo-1yr, 1-2yr, 2-3yr, 3-5yr, 5yr+
router.get('/tenure-distribution', async (req, res) => {
  try {
    const prisma = req.prisma;

    const users = await prisma.user.findMany({
      where: { isActive: true, dateOfJoining: { not: null } },
      select: { dateOfJoining: true },
    });

    const now = new Date();
    const buckets = {
      '0-6mo': 0,
      '6mo-1yr': 0,
      '1-2yr': 0,
      '2-3yr': 0,
      '3-5yr': 0,
      '5yr+': 0,
    };

    users.forEach((u) => {
      const joined = new Date(u.dateOfJoining);
      const diffMs = now - joined;
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // approximate months

      if (diffMonths < 6) buckets['0-6mo']++;
      else if (diffMonths < 12) buckets['6mo-1yr']++;
      else if (diffMonths < 24) buckets['1-2yr']++;
      else if (diffMonths < 36) buckets['2-3yr']++;
      else if (diffMonths < 60) buckets['3-5yr']++;
      else buckets['5yr+']++;
    });

    const total = users.length;
    const distribution = Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }));

    res.json({ total, distribution });
  } catch (err) {
    console.error('Tenure distribution error:', err);
    res.status(500).json({ error: 'Failed to fetch tenure distribution.' });
  }
});

// ─── GET /api/analytics/birthday-calendar ───────────────────────────────────
// Upcoming birthdays this month and next month
router.get('/birthday-calendar', async (req, res) => {
  try {
    const prisma = req.prisma;
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0');

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        name: true,
        department: true,
        dateOfBirth: true,
        profilePhotoUrl: true,
        company: { select: { name: true } },
      },
    });

    // Filter users whose birth month matches current or next month
    const birthdays = users
      .filter((u) => {
        const birthMonth = u.dateOfBirth.substring(5, 7); // "MM" from "YYYY-MM-DD"
        return birthMonth === currentMonth || birthMonth === nextMonth;
      })
      .map((u) => {
        const birthMonth = u.dateOfBirth.substring(5, 7);
        const birthDay = u.dateOfBirth.substring(8, 10);
        const birthYear = parseInt(u.dateOfBirth.substring(0, 4));
        const age = now.getFullYear() - birthYear;

        // Build this year's birthday date for sorting
        const birthdayThisYear = new Date(now.getFullYear(), parseInt(birthMonth) - 1, parseInt(birthDay));
        // If the birthday month is before the current month, it means it is next year's occurrence
        // But since we only care about this month and next, this shouldn't apply

        return {
          id: u.id,
          name: u.name,
          department: u.department,
          company: u.company?.name || null,
          dateOfBirth: u.dateOfBirth,
          birthDay: `${birthMonth}-${birthDay}`,
          age,
          profilePhotoUrl: u.profilePhotoUrl,
          isThisMonth: birthMonth === currentMonth,
          sortDate: birthdayThisYear,
        };
      })
      .sort((a, b) => a.sortDate - b.sortDate);

    // Remove internal sortDate from response
    const result = birthdays.map(({ sortDate, ...rest }) => rest);

    res.json({
      currentMonth: currentMonth,
      nextMonth: nextMonth,
      total: result.length,
      birthdays: result,
    });
  } catch (err) {
    console.error('Birthday calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch birthday calendar.' });
  }
});

module.exports = router;
