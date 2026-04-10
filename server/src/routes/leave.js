const express = require('express');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { parseId, requireFields } = require('../utils/validate');
const {
  getFinancialYear,
  getFYRange,
  getFYLabel,
  applyLeave,
  reviewLeave,
  cancelLeave,
  getLeaveBalance,
  getMyLeaveRequests,
  getPendingRequests,
  initializeFYBalances,
  getAllBalances,
  grantLeave,
  updateLeaveGrant,
  toggleGrantLock,
  getLeaveGrants,
  deleteLeaveGrant,
  calendarToFYMonth,
  previewFYRollover,
  executeFYRollover,
} = require('../services/leave/leaveService');
const { notifyUsers } = require('../utils/notify');
const { isDateRangeLocked } = require('../utils/payrollLock');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// ─── Employee Endpoints ─────────────────────────────────

// GET /api/leave/types — List active leave types
router.get('/types', asyncHandler(async (req, res) => {
  const types = await req.prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(types);
}));

// GET /api/leave/financial-year — Get current FY info
router.get('/financial-year', asyncHandler(async (req, res) => {
  const fyYear = getFinancialYear();
  const { start, end } = getFYRange(fyYear);
  res.json({
    year: fyYear,
    label: getFYLabel(fyYear),
    start,
    end,
  });
}));

// GET /api/leave/balance?year=2025&userId=X — Leave balances (admin can pass userId for another employee)
router.get('/balance', asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  let targetUserId = req.user.id;
  if (req.query.userId && (req.user.role === 'admin' || req.user.role === 'team_lead')) {
    targetUserId = parseInt(req.query.userId);
  }
  const balances = await getLeaveBalance(targetUserId, fyYear, req.prisma);
  res.json(balances);
}));

// GET /api/leave/my-approver — Get current user's reporting manager (for apply modal)
router.get('/my-approver', asyncHandler(async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      reportingManager: {
        select: { id: true, name: true, designation: true, department: true, profilePhotoUrl: true, driveProfilePhotoUrl: true },
      },
    },
  });
  res.json(user?.reportingManager || null);
}));

// GET /api/leave/my?year=2025&status=all — Own leave requests in FY
router.get('/my', asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  const status = req.query.status || 'all';
  const requests = await getMyLeaveRequests(req.user.id, fyYear, status, req.prisma);
  res.json(requests);
}));

// POST /api/leave/apply — Apply for leave
router.post('/apply', asyncHandler(async (req, res) => {
  const request = await applyLeave(req.user.id, req.body, req.prisma);

  // Notify admins
  const admins = await req.prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] }, id: { not: req.user.id } },
    select: { id: true },
  });
  notifyUsers(req.prisma, {
    userIds: admins.map(a => a.id), type: 'leave',
    title: 'New Leave Request',
    message: `${req.user.name || 'An employee'} applied for ${request.leaveType?.name || 'leave'} (${req.body.startDate} to ${req.body.endDate}, ${request.days} day${request.days !== 1 ? 's' : ''})`,
    link: '/admin/leave-requests',
  });

  res.status(201).json(request);
}));

// DELETE /api/leave/:id — Cancel own pending/approved request
router.delete('/:id', asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  // Block if leave dates fall in a payroll-locked month
  const leave = await req.prisma.leaveRequest.findUnique({ where: { id: requestId }, select: { startDate: true, endDate: true } });
  if (leave) {
    const lockedMonth = await isDateRangeLocked(req.prisma, leave.startDate, leave.endDate);
    if (lockedMonth) throw badRequest(`Cannot cancel leave — payroll for ${lockedMonth} is locked and published.`);
  }
  const result = await cancelLeave(requestId, req.user.id, req.prisma);
  res.json(result);
}));

// GET /api/leave/check-overlap?startDate=...&endDate=...
router.get('/check-overlap', asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) throw badRequest('startDate and endDate are required');

  const dept = req.user.department;
  const overlapping = await req.prisma.leaveRequest.findMany({
    where: {
      status: { in: ['approved', 'pending'] },
      startDate: { lte: endDate }, endDate: { gte: startDate },
      userId: { not: req.user.id },
      user: dept ? { department: dept, isActive: true } : { isActive: true },
    },
    include: {
      user: { select: { name: true, designation: true } },
      leaveType: { select: { name: true } },
    },
  });

  res.json({
    hasOverlap: overlapping.length > 0,
    count: overlapping.length,
    colleagues: overlapping.map(l => ({
      name: l.user.name, designation: l.user.designation,
      dates: `${l.startDate} to ${l.endDate}`, days: l.days,
      leaveType: l.leaveType?.name || 'Leave', status: l.status,
    })),
  });
}));

// ─── Admin/Manager Endpoints ────────────────────────────

// GET /api/leave/pending — Pending requests for approvers
router.get('/pending', requireAdmin, asyncHandler(async (req, res) => {
  const department = req.user.role === 'team_lead' ? req.user.department : null;
  const requests = await getPendingRequests(department, req.prisma);
  res.json(requests);
}));

// GET /api/leave/all-requests?year=2025&status=all — All requests for admin
router.get('/all-requests', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  const { start, end } = getFYRange(fyYear);
  const where = {
    startDate: { gte: start, lte: end },
  };
  if (req.query.status && req.query.status !== 'all') {
    where.status = req.query.status;
  }
  if (req.user.role === 'team_lead') {
    where.user = { department: req.user.department };
  }

  const requests = await req.prisma.leaveRequest.findMany({
    where,
    include: {
      user: {
        select: {
          id: true, name: true, employeeId: true, department: true,
          profilePhotoUrl: true, driveProfilePhotoUrl: true,
          reportingManager: {
            select: { id: true, name: true, designation: true, profilePhotoUrl: true, driveProfilePhotoUrl: true },
          },
        },
      },
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// PUT /api/leave/:id/review — Approve or reject
router.put('/:id/review', requireAdmin, asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const { status, reviewNote } = req.body;
  if (!status) throw badRequest('Status is required (approved or rejected).');
  // Block review changes if leave falls in a locked payroll month
  const leave = await req.prisma.leaveRequest.findUnique({ where: { id: requestId }, select: { startDate: true, endDate: true } });
  if (leave) {
    const lockedMonth = await isDateRangeLocked(req.prisma, leave.startDate, leave.endDate);
    if (lockedMonth) throw badRequest(`Cannot modify leave — payroll for ${lockedMonth} is locked and published.`);
  }
  const updated = await reviewLeave(requestId, req.user.id, status, reviewNote, req.prisma);

  // Notify the requestor
  if (updated.userId && updated.userId !== req.user.id) {
    notifyUsers(req.prisma, {
      userIds: [updated.userId], type: 'leave',
      title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: `Your ${updated.leaveType?.name || 'leave'} request has been ${status} by ${req.user.name || 'admin'}${updated.reviewNote ? ': ' + updated.reviewNote : ''}`,
      link: '/leave',
    });
  }

  res.json(updated);
}));

// POST /api/leave/admin/apply-on-behalf — Admin applies leave for an employee
router.post('/admin/apply-on-behalf', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, leaveTypeId, startDate, endDate, session, reason, autoApprove } = req.body;
  requireFields(req.body, 'userId', 'leaveTypeId', 'startDate', 'endDate', 'reason');

  const targetUser = await req.prisma.user.findUnique({
    where: { id: parseInt(userId) },
    select: { id: true, name: true, isActive: true },
  });
  if (!targetUser || !targetUser.isActive) throw notFound('Employee');

  // Use the same applyLeave service (creates as 'pending')
  const request = await applyLeave(targetUser.id, {
    leaveTypeId: parseInt(leaveTypeId),
    startDate,
    endDate,
    session: session || 'full_day',
    reason: `[Applied by ${req.user.name}] ${reason}`,
  }, req.prisma);

  // Auto-approve if requested
  let result = request;
  if (autoApprove) {
    result = await reviewLeave(request.id, req.user.id, 'approved', `Auto-approved (applied on behalf by ${req.user.name})`, req.prisma);
  }

  // Notify the employee
  notifyUsers(req.prisma, {
    userIds: [targetUser.id], type: 'leave',
    title: autoApprove ? 'Leave Applied & Approved' : 'Leave Applied on Your Behalf',
    message: `${req.user.name} applied ${request.leaveType?.name || 'leave'} for you (${startDate} to ${endDate}, ${request.days} day${request.days !== 1 ? 's' : ''})${autoApprove ? ' — auto-approved' : ' — pending approval'}`,
    link: '/leave',
  });

  res.status(201).json(result);
}));

// GET /api/leave/admin/balances?year=2025&department=X — All employee balances
router.get('/admin/balances', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  const department = req.user.role === 'team_lead' ? req.user.department : req.query.department || null;
  const balances = await getAllBalances(fyYear, department, req.prisma);
  res.json(balances);
}));

// POST /api/leave/admin/init-fy — Initialize FY balances for all employees
router.post('/admin/init-fy', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.body.year) || getFinancialYear();
  const result = await initializeFYBalances(fyYear, req.prisma);
  res.json({ message: `Initialized FY ${getFYLabel(fyYear)} balances`, ...result });
}));

// GET /api/leave/admin/fy-rollover-preview — Preview FY rollover
router.get('/admin/fy-rollover-preview', requireAdmin, asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || getFinancialYear();
  const preview = await previewFYRollover(year, req.prisma);

  const stats = {
    totalEmployees: new Set(preview.map(p => p.userId)).size,
    totalCarry: preview.reduce((s, p) => s + p.willCarry, 0),
    totalLapse: preview.reduce((s, p) => s + p.willLapse, 0),
    fyLabel: getFYLabel(year),
    nextFYLabel: getFYLabel(year + 1),
  };

  res.json({ stats, preview });
}));

// POST /api/leave/admin/fy-rollover — Execute FY rollover
router.post('/admin/fy-rollover', requireAdmin, asyncHandler(async (req, res) => {
  const { year } = req.body;
  if (!year) throw badRequest('Year is required');

  const summary = await executeFYRollover(year, req.prisma);

  const stats = {
    totalEmployees: new Set(summary.map(s => s.userId)).size,
    totalCarry: summary.reduce((s, r) => s + r.carryForward, 0),
    totalLapsed: summary.reduce((s, r) => s + r.lapsed, 0),
  };

  res.json({ message: 'FY rollover completed successfully', stats, summary });
}));

// PUT /api/leave/admin/balance/:id — Admin adjust a balance (opening, total, used)
router.put('/admin/balance/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { opening, total, used } = req.body;

  const balance = await req.prisma.leaveBalance.findUnique({ where: { id } });
  if (!balance) throw notFound('Balance');

  const data = {};
  if (opening !== undefined) data.opening = parseFloat(opening);
  if (total !== undefined) data.total = parseFloat(total);
  if (used !== undefined) data.used = parseFloat(used);

  const updated = await req.prisma.leaveBalance.update({
    where: { id },
    data,
    include: {
      user: { select: { name: true } },
      leaveType: { select: { name: true, code: true } },
    },
  });
  res.json(updated);
}));

// ─── Leave Type Admin ───────────────────────────────────

// POST /api/leave/admin/types — Create leave type
router.post('/admin/types', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'code', 'defaultBalance');
  const { name, code, defaultBalance, accrualType, accrualAmount, carryForward, maxCarryForward } = req.body;

  const type = await req.prisma.leaveType.create({
    data: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      defaultBalance: parseFloat(defaultBalance),
      accrualType: accrualType || 'monthly',
      accrualAmount: parseFloat(accrualAmount) || 1,
      carryForward: carryForward || false,
      maxCarryForward: parseFloat(maxCarryForward) || 0,
    },
  });
  res.status(201).json(type);
}));

// PUT /api/leave/admin/types/:id — Update leave type
router.put('/admin/types/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, code, defaultBalance, accrualType, accrualAmount, carryForward, maxCarryForward, isActive } = req.body;

  const data = {};
  if (name) data.name = name.trim();
  if (code) data.code = code.trim().toUpperCase();
  if (defaultBalance !== undefined) data.defaultBalance = parseFloat(defaultBalance);
  if (accrualType) data.accrualType = accrualType;
  if (accrualAmount !== undefined) data.accrualAmount = parseFloat(accrualAmount);
  if (carryForward !== undefined) data.carryForward = carryForward;
  if (maxCarryForward !== undefined) data.maxCarryForward = parseFloat(maxCarryForward);
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await req.prisma.leaveType.update({ where: { id }, data });
  res.json(updated);
}));

// ─── Leave Granter (Admin) ─────────────────────────────

// GET /api/leave/admin/grants-overview?year=2025 — Table overview: all employees × all leave types
router.get('/admin/grants-overview', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();

  const [leaveTypes, allUsers, grants, balances] = await Promise.all([
    req.prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, defaultBalance: true } }),
    req.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, employeeId: true, department: true, confirmationDate: true, dateOfJoining: true, employmentStatus: true },
      orderBy: { name: 'asc' },
    }),
    req.prisma.leaveGranter.findMany({
      where: { fyYear },
      select: { id: true, userId: true, leaveTypeId: true, totalGranted: true, probationAllowance: true, isLocked: true, notes: true, joiningMonth: true },
    }),
    req.prisma.leaveBalance.findMany({
      where: { year: fyYear },
      select: { userId: true, leaveTypeId: true, opening: true, total: true, used: true, balance: true },
    }),
  ]);

  const grantMap = {};
  grants.forEach(g => { if (!grantMap[g.userId]) grantMap[g.userId] = {}; grantMap[g.userId][g.leaveTypeId] = g; });
  const balMap = {};
  balances.forEach(b => { if (!balMap[b.userId]) balMap[b.userId] = {}; balMap[b.userId][b.leaveTypeId] = b; });

  res.json({
    leaveTypes,
    employees: allUsers.map(u => ({ ...u, grants: grantMap[u.id] || {}, balances: balMap[u.id] || {} })),
    fyYear,
  });
}));

// GET /api/leave/admin/grants?year=2025 — List all leave grants
router.get('/admin/grants', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  const grants = await getLeaveGrants(fyYear, req.prisma);
  res.json(grants);
}));

// POST /api/leave/admin/grants/bulk — Bulk grant leave to multiple employees
// ⚠️ Must be BEFORE the generic POST /admin/grants route so Express matches it first
router.post('/admin/grants/bulk', requireAdmin, asyncHandler(async (req, res) => {
  const { grants: grantRows, fyYear, leaveTypeId } = req.body;
  if (!grantRows || !Array.isArray(grantRows) || grantRows.length === 0) throw badRequest('No employees selected');
  if (!fyYear) throw badRequest('Financial year is required');
  if (!leaveTypeId) throw badRequest('Leave type is required');

  const year = parseInt(fyYear);
  const ltId = parseInt(leaveTypeId);
  const results = { success: 0, skipped: 0, errors: [] };

  for (let i = 0; i < grantRows.length; i++) {
    const row = grantRows[i];
    try {
      await grantLeave(req.user.id, {
        userId: parseInt(row.userId),
        leaveTypeId: ltId,
        fyYear: year,
        totalGranted: parseFloat(row.totalGranted),
        probationAllowance: row.probationAllowance !== null && row.probationAllowance !== undefined
          ? parseFloat(row.probationAllowance) : null,
        joiningMonth: row.joiningMonth ? parseInt(row.joiningMonth) : null,
        notes: row.notes || null,
      }, req.prisma);
      results.success++;
    } catch (err) {
      results.errors.push(`${row.employeeName || 'Employee'}: ${err.message}`);
      results.skipped++;
    }
  }

  res.json(results);
}));

// POST /api/leave/admin/grants — Grant leave to an employee
router.post('/admin/grants', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'userId', 'leaveTypeId', 'fyYear', 'totalGranted');
  const grant = await grantLeave(req.user.id, {
    userId: parseInt(req.body.userId),
    leaveTypeId: parseInt(req.body.leaveTypeId),
    fyYear: parseInt(req.body.fyYear),
    totalGranted: parseFloat(req.body.totalGranted),
    probationAllowance: req.body.probationAllowance !== undefined && req.body.probationAllowance !== null ? parseFloat(req.body.probationAllowance) : null,
    joiningMonth: req.body.joiningMonth ? parseInt(req.body.joiningMonth) : null,
    notes: req.body.notes || null,
  }, req.prisma);
  res.status(201).json(grant);
}));

// PUT /api/leave/admin/grants/:id — Edit a leave grant
router.put('/admin/grants/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  requireFields(req.body, 'totalGranted');
  const updated = await updateLeaveGrant(req.user.id, id, {
    totalGranted: parseFloat(req.body.totalGranted),
    probationAllowance: req.body.probationAllowance !== null && req.body.probationAllowance !== undefined
      ? parseFloat(req.body.probationAllowance) : null,
    joiningMonth: req.body.joiningMonth ? parseInt(req.body.joiningMonth) : null,
    notes: req.body.notes || null,
  }, req.prisma);
  res.json(updated);
}));

// PUT /api/leave/admin/grants/:id/lock — Toggle lock/unlock for payroll
router.put('/admin/grants/:id/lock', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await toggleGrantLock(id, req.prisma);
  res.json(result);
}));

// DELETE /api/leave/admin/grants/:id — Remove a leave grant
router.delete('/admin/grants/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const result = await deleteLeaveGrant(id, req.prisma);
  res.json(result);
}));

// GET /api/leave/admin/employees-for-grant?year=2025 — Employees without grants for this FY
router.get('/admin/employees-for-grant', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();

  const users = await req.prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, employeeId: true, department: true,
      dateOfJoining: true, confirmationDate: true, confirmationStatus: true, probationEndDate: true,
    },
    orderBy: { name: 'asc' },
  });

  // Get existing grants for this FY
  const existingGrants = await req.prisma.leaveGranter.findMany({
    where: { fyYear },
    select: { userId: true, leaveTypeId: true },
  });

  const grantSet = new Set(existingGrants.map(g => `${g.userId}-${g.leaveTypeId}`));

  // Calculate suggested values for mid-year joiners
  const enriched = users.map(u => {
    let suggestedJoiningMonth = null;
    let suggestedTotal = 12;
    let onProbation = false;

    if (u.dateOfJoining) {
      const joinDate = new Date(u.dateOfJoining);
      const joinCalMonth = joinDate.getMonth(); // 0-indexed
      const joinCalYear = joinDate.getFullYear();
      const joinFY = joinCalMonth >= 3 ? joinCalYear : joinCalYear - 1;

      if (joinFY === fyYear) {
        // Joined in this FY — pro-rate
        suggestedJoiningMonth = calendarToFYMonth(joinCalMonth, joinCalYear, fyYear);
        suggestedTotal = Math.max(12 - (suggestedJoiningMonth - 1), 0);
      }

      // Check probation (6 months from joining)
      const today = new Date(Date.now() + 330 * 60 * 1000);
      const sixMonths = new Date(joinDate);
      sixMonths.setMonth(sixMonths.getMonth() + 6);
      if (today < sixMonths && u.confirmationStatus !== 'confirmed' && !u.confirmationDate) {
        onProbation = true;
      }
    }

    if (u.probationEndDate) {
      const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().split('T')[0];
      if (u.probationEndDate > today && u.confirmationStatus !== 'confirmed') {
        onProbation = true;
      }
    }

    return {
      ...u,
      suggestedJoiningMonth,
      suggestedTotal,
      onProbation,
      hasGrant: (leaveTypeId) => grantSet.has(`${u.id}-${leaveTypeId}`),
    };
  });

  // Serialize hasGrant results for all active leave types
  const leaveTypes = await req.prisma.leaveType.findMany({ where: { isActive: true } });
  const result = enriched.map(u => {
    const grants = {};
    for (const lt of leaveTypes) {
      grants[lt.id] = grantSet.has(`${u.id}-${lt.id}`);
    }
    return { ...u, hasGrant: undefined, existingGrants: grants };
  });

  res.json({ employees: result, leaveTypes });
}));

// GET /api/leave/team-calendar?month=2026-03 — Team leave calendar
router.get('/team-calendar', asyncHandler(async (req, res) => {
  const { month, department } = req.query;
  if (!month) throw badRequest('Month is required (format: YYYY-MM)');

  const isAdminUser = ['admin', 'sub_admin', 'team_lead'].includes(req.user.role);
  const targetDept = isAdminUser && department ? department : req.user.department;

  const [year, mon] = month.split('-').map(Number);
  const monthStart = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

  const leaves = await req.prisma.leaveRequest.findMany({
    where: {
      status: { in: ['approved', 'pending'] },
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
      user: targetDept ? { department: targetDept, isActive: true } : { isActive: true },
    },
    include: {
      user: { select: { id: true, name: true, department: true, designation: true } },
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const byUser = {};
  for (const l of leaves) {
    if (!byUser[l.userId]) {
      byUser[l.userId] = { user: l.user, leaves: [] };
    }
    byUser[l.userId].leaves.push({
      id: l.id, startDate: l.startDate, endDate: l.endDate,
      days: l.days, status: l.status, session: l.session,
      leaveType: l.leaveType?.name || 'Leave', reason: l.reason,
    });
  }

  res.json({
    month, department: targetDept || 'All',
    teamLeaves: Object.values(byUser),
    totalOnLeave: Object.keys(byUser).length,
  });
}));

// ─── Admin Leave Dashboard — Full employee leave overview ────────

// GET /api/leave/admin/dashboard?year=2025&userId=X&department=Y
// Returns: per-employee leave balances, leave request history, comp-off history
router.get('/admin/dashboard', requireAdmin, asyncHandler(async (req, res) => {
  const fyYear = parseInt(req.query.year) || getFinancialYear();
  const { start, end } = getFYRange(fyYear);
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  const department = req.user.role === 'team_lead' ? req.user.department : (req.query.department || null);

  // Build user filter
  const userWhere = { isActive: true };
  if (userId) userWhere.id = userId;
  if (department) userWhere.department = department;

  // 1. Get all employees
  const employees = await req.prisma.user.findMany({
    where: userWhere,
    select: {
      id: true, name: true, employeeId: true, department: true, designation: true,
      dateOfJoining: true, confirmationDate: true, confirmationStatus: true,
      probationEndDate: true, driveProfilePhotoUrl: true, profilePhotoUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  if (employees.length === 0) {
    return res.json({ employees: [], fyYear, fyLabel: getFYLabel(fyYear) });
  }

  const employeeIds = employees.map(e => e.id);

  // 2. Get leave balances for all employees in this FY
  const balances = await getAllBalances(fyYear, department, req.prisma);

  // Group balances by userId
  const balancesByUser = {};
  for (const b of balances) {
    if (!balancesByUser[b.userId]) balancesByUser[b.userId] = [];
    balancesByUser[b.userId].push(b);
  }

  // 3. Get ALL leave requests for this FY (approved, pending, rejected, cancelled)
  const requests = await req.prisma.leaveRequest.findMany({
    where: {
      userId: { in: employeeIds },
      startDate: { gte: start, lte: end },
    },
    include: {
      leaveType: { select: { name: true, code: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  // Group requests by userId
  const requestsByUser = {};
  for (const r of requests) {
    if (!requestsByUser[r.userId]) requestsByUser[r.userId] = [];
    requestsByUser[r.userId].push(r);
  }

  // 4. Get comp-off balances + requests for the financial year
  const compOffBalances = await req.prisma.compOffBalance.findMany({
    where: { userId: { in: employeeIds }, year: fyYear },
  });
  const compOffBalByUser = {};
  for (const c of compOffBalances) {
    compOffBalByUser[c.userId] = c;
  }

  const compOffRequests = await req.prisma.compOffRequest.findMany({
    where: { userId: { in: employeeIds } },
    orderBy: { createdAt: 'desc' },
    take: 500, // limit
  });
  const compOffReqByUser = {};
  for (const c of compOffRequests) {
    if (!compOffReqByUser[c.userId]) compOffReqByUser[c.userId] = [];
    compOffReqByUser[c.userId].push(c);
  }

  // 5. Assemble per-employee dashboard data
  const result = employees.map(emp => {
    const empBalances = (balancesByUser[emp.id] || []).map(b => ({
      id: b.id,
      leaveType: b.leaveType,
      opening: b.opening || 0,
      credited: b.credited,
      total: b.total,
      used: b.used,
      available: b.available,
      onProbation: b.onProbation,
      probationAllowance: b.probationAllowance,
      joiningMonth: b.joiningMonth,
    }));

    const empRequests = (requestsByUser[emp.id] || []).map(r => ({
      id: r.id,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      session: r.session,
      reason: r.reason,
      status: r.status,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
    }));

    const compOff = compOffBalByUser[emp.id] || { earned: 0, used: 0, balance: 0 };
    const compOffHistory = compOffReqByUser[emp.id] || [];

    // Summary counts
    const approved = empRequests.filter(r => r.status === 'approved');

    // COF used = sum of approved COF leave requests in this FY (not hardcoded import value)
    const cofUsed = approved
      .filter(r => r.leaveType?.code === 'COF')
      .reduce((sum, r) => sum + r.days, 0);
    const cofEarned = compOff.earned;
    const cofBalance = Math.max(0, cofEarned - cofUsed);
    const pending = empRequests.filter(r => r.status === 'pending');
    const totalApprovedDays = approved.reduce((sum, r) => sum + r.days, 0);

    return {
      employee: emp,
      balances: empBalances,
      requests: empRequests,
      compOff: {
        earned: cofEarned,
        used: cofUsed,
        balance: cofBalance,
        history: compOffHistory.map(c => ({
          id: c.id,
          type: c.type,
          workDate: c.workDate,
          days: c.days,
          reason: c.reason,
          status: c.status,
          createdAt: c.createdAt,
        })),
      },
      summary: {
        totalApprovedDays,
        pendingCount: pending.length,
        approvedCount: approved.length,
        rejectedCount: empRequests.filter(r => r.status === 'rejected').length,
        cancelledCount: empRequests.filter(r => r.status === 'cancelled').length,
      },
    };
  });

  res.json({
    employees: result,
    fyYear,
    fyLabel: getFYLabel(fyYear),
    totalEmployees: employees.length,
  });
}));

module.exports = router;
