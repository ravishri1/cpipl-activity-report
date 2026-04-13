const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── helpers ────────────────────────────────────────────────────────────────

function isAdminRole(u) { return ['admin', 'sub_admin', 'team_lead'].includes(u.role); }

/** Add calendar days to a YYYY-MM-DD string */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Count calendar days between two YYYY-MM-DD strings (inclusive start, exclusive end) */
function daysBetween(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 86400000);
}

/** Build salary hold breakdown: 30 days working back from LWD */
function buildSalaryHoldBreakdown(lwdStr, dailyRate, holdDays = 30) {
  const lwd = new Date(lwdStr);
  const holds = [];
  let remaining = holdDays;
  // Start from LWD month, work backwards
  let current = new Date(lwd);
  while (remaining > 0) {
    const monthStr = current.toISOString().slice(0, 7); // "YYYY-MM"
    const monthStart = new Date(`${monthStr}-01`);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // last day of month
    const dayInMonth = current.getDate(); // last day of employment in this month
    const daysInThisMonth = Math.min(dayInMonth, remaining);
    const startDay = dayInMonth - daysInThisMonth + 1;
    const startDateStr = `${monthStr}-${String(startDay).padStart(2, '0')}`;
    const endDateStr = current.toISOString().slice(0, 10);
    holds.unshift({
      month: monthStr,
      heldDays: daysInThisMonth,
      heldAmount: Math.round(dailyRate * daysInThisMonth * 100) / 100,
      description: `${monthStr} (${startDateStr} to ${endDateStr})`,
    });
    remaining -= daysInThisMonth;
    // Move to last day of previous month
    current = new Date(current.getFullYear(), current.getMonth(), 0);
  }
  return holds;
}

/** Default clearance checklist tasks */
const DEFAULT_CHECKLIST = [
  { department: 'IT',      task: 'Revoke system and email access',            sortOrder: 1 },
  { department: 'IT',      task: 'Collect laptop / phone / hardware',          sortOrder: 2 },
  { department: 'Admin',   task: 'Collect ID card and access card',            sortOrder: 3 },
  { department: 'Admin',   task: 'Collect office keys / locker keys',          sortOrder: 4 },
  { department: 'Finance', task: 'Verify all expense claims are settled',       sortOrder: 5 },
  { department: 'Finance', task: 'Verify no pending salary advances',          sortOrder: 6 },
  { department: 'Manager', task: 'Knowledge transfer completed',               sortOrder: 7 },
  { department: 'Manager', task: 'Handover note / documentation received',     sortOrder: 8 },
  { department: 'HR',      task: 'Exit interview conducted',                   sortOrder: 9 },
  { department: 'HR',      task: 'NOC obtained from all departments',          sortOrder: 10 },
];

// ─── notification helper (lazy-load to avoid circular deps) ─────────────────
async function notify(event, data) {
  try {
    const svc = require('../services/notifications/separationNotificationService');
    await svc.sendSeparationNotification(event, data);
  } catch (e) {
    console.error(`[separation-notify] ${event}:`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. EMPLOYEE SELF-RESIGNATION
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation/resign  — employee submits resignation
router.post('/resign', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { reason, preferredLWD } = req.body;

  // Only active employees
  const user = await req.prisma.user.findUnique({
    where: { id: userId },
    include: {
      reportingManager: { select: { id: true, name: true, email: true } },
      salaryStructure: { select: { grossEarnings: true, netPayMonthly: true, basic: true, hra: true, da: true, specialAllowance: true, medicalAllowance: true, conveyanceAllowance: true, otherAllowance: true } },
    },
  });
  if (!user) throw notFound('User');
  if (user.employmentStatus !== 'active') throw badRequest('Only active employees can submit resignation.');

  const existing = await req.prisma.separation.findUnique({ where: { userId } });
  if (existing && !['completed', 'cancelled', 'rejected'].includes(existing.status)) {
    throw conflict('You already have an active resignation request.');
  }

  const today = new Date().toISOString().slice(0, 10);
  const noticeDays = user.noticePeriodDays || 30;
  const expectedLWD = addDays(today, noticeDays);

  const separation = await req.prisma.separation.create({
    data: {
      userId,
      type: 'resignation',
      requestDate: today,
      preferredLWD: preferredLWD || expectedLWD,
      expectedLWD,
      adjustedLWD: expectedLWD,
      reason: reason || null,
      noticePeriodDays: noticeDays,
      status: 'pending_manager',
      initiatedBy: 'employee',
    },
    include: { user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, reportingManager: { select: { id: true, name: true, email: true } } } } },
  });

  await notify('employee_resigned', { separation, user });
  res.status(201).json(separation);
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  2. HR/ADMIN INITIATES SEPARATION (termination, absconding, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation  — HR/admin initiates
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { userId, type, requestDate, lastWorkingDate, reason, noticePeriodDays } = req.body;
  requireFields(req.body, 'userId', 'type', 'requestDate');
  requireEnum(type, ['resignation', 'termination', 'absconding', 'retirement'], 'type');

  const user = await req.prisma.user.findUnique({
    where: { id: parseInt(userId) },
    include: { reportingManager: { select: { id: true, name: true, email: true } } },
  });
  if (!user) throw notFound('User');

  const existing = await req.prisma.separation.findUnique({ where: { userId: parseInt(userId) } });
  if (existing && !['completed', 'cancelled', 'rejected'].includes(existing.status)) {
    throw conflict('An active separation already exists for this employee.');
  }
  if (existing) await req.prisma.separation.delete({ where: { userId: parseInt(userId) } });

  const noticeDays = noticePeriodDays || user.noticePeriodDays || 30;
  const expectedLWD = addDays(requestDate, noticeDays);
  const isForced = ['termination', 'absconding'].includes(type);

  const separation = await req.prisma.separation.create({
    data: {
      userId: parseInt(userId),
      type,
      requestDate,
      expectedLWD,
      adjustedLWD: lastWorkingDate || expectedLWD,
      lastWorkingDate: lastWorkingDate || null,
      reason: reason || null,
      noticePeriodDays: noticeDays,
      status: isForced ? 'notice_period' : 'pending_manager',
      initiatedBy: 'hr',
      processedBy: req.user.id,
      // For termination/absconding, mark HR confirm immediately
      hrConfirmedAt: isForced ? new Date().toISOString().slice(0, 10) : null,
      hrConfirmedBy: isForced ? req.user.id : null,
      leavesBlocked: isForced,
      leavesBlockedAt: isForced ? new Date() : null,
    },
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true } },
    },
  });

  if (isForced) {
    await req.prisma.user.update({ where: { id: parseInt(userId) }, data: { employmentStatus: type === 'absconding' ? 'absconding' : 'notice_period', isActive: type === 'absconding' ? false : true } });
    // Auto-create clearance checklist
    await _createChecklist(req.prisma, separation.id);
  }

  await notify('separation_initiated', { separation, user, initiatorName: req.user.name });
  res.status(201).json(separation);
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  3. MANAGER ACTION — approve / reject / propose new LWD
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/separation/:id/manager-action
router.put('/:id/manager-action', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { action, managerNote, managerProposedLWD } = req.body;
  requireEnum(action, ['approve', 'reject', 'propose_lwd'], 'action');

  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, reportingManagerId: true, designation: true, department: true } } },
  });
  if (!sep) throw notFound('Separation');
  if (sep.status !== 'pending_manager') throw badRequest('This resignation is not pending manager approval.');

  // Only reporting manager or admin can act
  const isManager = sep.user.reportingManagerId === req.user.id;
  if (!isManager && !isAdminRole(req.user)) throw forbidden('Only the reporting manager can approve this resignation.');

  if (action === 'reject') {
    await req.prisma.separation.update({ where: { id }, data: { status: 'rejected', rejectionReason: managerNote || 'Rejected by manager', managerApprovedAt: new Date().toISOString().slice(0, 10), managerApprovedBy: req.user.id, managerNote: managerNote || null } });
    await notify('manager_rejected', { sep, managerName: req.user.name });
    return res.json({ message: 'Resignation rejected and employee notified.' });
  }

  if (action === 'propose_lwd') {
    if (!managerProposedLWD) throw badRequest('managerProposedLWD is required for propose_lwd action.');
    await req.prisma.separation.update({ where: { id }, data: { managerProposedLWD, managerNote: managerNote || null, managerApprovedAt: new Date().toISOString().slice(0, 10), managerApprovedBy: req.user.id } });
    await notify('manager_proposed_lwd', { sep, managerName: req.user.name, proposedLWD: managerProposedLWD });
    return res.json({ message: 'Proposed LWD sent to HR for confirmation.' });
  }

  // approve
  const updated = await req.prisma.separation.update({
    where: { id },
    data: { status: 'pending_hr', managerApprovedAt: new Date().toISOString().slice(0, 10), managerApprovedBy: req.user.id, managerNote: managerNote || null },
    include: { user: { select: { id: true, name: true, email: true, designation: true, department: true } } },
  });
  await notify('manager_approved', { sep: updated, managerName: req.user.name });
  res.json(updated);
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  4. HR CONFIRMATION — sets final LWD, blocks leaves, creates checklist
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/separation/:id/hr-confirm
router.put('/:id/hr-confirm', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { lastWorkingDate, type, noticePeriodWaiver, hrNote } = req.body;
  if (!lastWorkingDate) throw badRequest('lastWorkingDate (final LWD) is required.');

  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, designation: true, department: true, noticePeriodDays: true } } },
  });
  if (!sep) throw notFound('Separation');
  if (!['pending_hr', 'pending_manager'].includes(sep.status)) throw badRequest('Separation is not in a state for HR confirmation.');

  const today = new Date().toISOString().slice(0, 10);
  const salaryHoldUntil = addDays(lastWorkingDate, 45);

  await req.prisma.separation.update({
    where: { id },
    data: {
      lastWorkingDate,
      adjustedLWD: lastWorkingDate,
      status: 'notice_period',
      type: type || sep.type,
      hrConfirmedAt: today,
      hrConfirmedBy: req.user.id,
      hrNote: hrNote || null,
      leavesBlocked: true,
      leavesBlockedAt: new Date(),
      salaryHoldUntil,
    },
  });

  // Update user employment status
  await req.prisma.user.update({
    where: { id: sep.userId },
    data: { employmentStatus: 'notice_period' },
  });

  // Cancel all PENDING leave requests for this employee (they become LOP during notice)
  await req.prisma.leaveRequest.updateMany({
    where: { userId: sep.userId, status: 'pending' },
    data: { status: 'rejected', rejectionReason: 'Auto-rejected: Employee is in notice period. All leaves during notice period are treated as LOP.' },
  });

  // Auto-create clearance checklist (idempotent)
  const existingChecklist = await req.prisma.separationChecklist.count({ where: { separationId: id } });
  if (existingChecklist === 0) await _createChecklist(req.prisma, id);

  const updated = await req.prisma.separation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, designation: true, department: true } },
      checklist: { orderBy: { sortOrder: 'asc' } },
    },
  });

  await notify('hr_confirmed', { sep: updated, hrName: req.user.name, salaryHoldUntil });
  res.json(updated);
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  5. NOTICE PERIOD TRACKING — recalculate LWD when leave is taken
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /api/separation/:id/notice-update  — called whenever leave approved during notice
router.put('/:id/notice-update', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id } });
  if (!sep) throw notFound('Separation');
  if (sep.status !== 'notice_period') throw badRequest('Not in notice period.');

  // Count ALL leave days taken during notice period (any leave type = LOP extension)
  const noticePeriodStart = sep.hrConfirmedAt || sep.requestDate;
  const currentAdjustedLWD = sep.adjustedLWD || sep.lastWorkingDate;

  // Count approved + pending leaves taken from notice start to current adjusted LWD
  const leavesInNotice = await req.prisma.leaveRequest.findMany({
    where: {
      userId: sep.userId,
      status: { in: ['approved', 'pending'] },
      startDate: { gte: noticePeriodStart },
    },
    select: { numberOfDays: true, startDate: true, endDate: true },
  });

  const totalLeaveDays = leavesInNotice.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
  const newAdjustedLWD = addDays(sep.lastWorkingDate, totalLeaveDays);

  const newSalaryHoldUntil = addDays(newAdjustedLWD, 45);

  await req.prisma.separation.update({
    where: { id },
    data: {
      leaveDaysDuringNotice: totalLeaveDays,
      adjustedLWD: newAdjustedLWD,
      salaryHoldUntil: newSalaryHoldUntil,
    },
  });

  if (totalLeaveDays > 0) {
    await notify('lwd_extended', {
      sep,
      leaveDays: totalLeaveDays,
      originalLWD: sep.lastWorkingDate,
      newLWD: newAdjustedLWD,
    });
  }

  res.json({
    leaveDaysDuringNotice: totalLeaveDays,
    originalLWD: sep.lastWorkingDate,
    adjustedLWD: newAdjustedLWD,
    salaryHoldUntil: newSalaryHoldUntil,
    message: totalLeaveDays > 0
      ? `LWD extended by ${totalLeaveDays} day(s) due to leave taken during notice period.`
      : 'No leave taken during notice period. LWD unchanged.',
  });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  6. CHECKLIST
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/separation/:id/checklist
router.get('/:id/checklist', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const checklist = await req.prisma.separationChecklist.findMany({
    where: { separationId: id },
    orderBy: [{ department: 'asc' }, { sortOrder: 'asc' }],
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true } },
    },
  });
  res.json(checklist);
}));

// PUT /api/separation/:id/checklist/:checklistId
router.put('/:id/checklist/:checklistId', requireAdmin, asyncHandler(async (req, res) => {
  const separationId = parseId(req.params.id);
  const checklistId = parseId(req.params.checklistId);
  const { status, remarks, assignedToId } = req.body;

  const item = await req.prisma.separationChecklist.findFirst({ where: { id: checklistId, separationId } });
  if (!item) throw notFound('Checklist item');

  requireEnum(status || item.status, ['pending', 'done', 'na'], 'status');

  const updated = await req.prisma.separationChecklist.update({
    where: { id: checklistId },
    data: {
      status: status || item.status,
      remarks: remarks !== undefined ? remarks : item.remarks,
      assignedToId: assignedToId !== undefined ? assignedToId : item.assignedToId,
      completedAt: status === 'done' ? new Date().toISOString().slice(0, 10) : item.completedAt,
      completedById: status === 'done' ? req.user.id : item.completedById,
    },
    include: { completedBy: { select: { id: true, name: true } } },
  });

  // Check if all checklist items are done or na — if so, auto-move to fnf_pending
  const sep = await req.prisma.separation.findUnique({ where: { id: separationId } });
  if (sep && sep.status === 'clearance') {
    const pending = await req.prisma.separationChecklist.count({ where: { separationId, status: 'pending' } });
    if (pending === 0) {
      await req.prisma.separation.update({ where: { id: separationId }, data: { status: 'fnf_pending' } });
    }
  }

  res.json(updated);
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  7. MOVE TO CLEARANCE STAGE
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation/:id/start-clearance
router.post('/:id/start-clearance', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id }, include: { user: true } });
  if (!sep) throw notFound('Separation');
  if (sep.status !== 'notice_period') throw badRequest('Employee must be in notice period before clearance.');

  const today = new Date().toISOString().slice(0, 10);
  const lwdToCheck = sep.adjustedLWD || sep.lastWorkingDate;
  if (today < lwdToCheck) throw badRequest(`Cannot start clearance before LWD (${lwdToCheck}).`);

  await req.prisma.separation.update({ where: { id }, data: { status: 'clearance' } });
  res.json({ message: 'Clearance stage started. Complete all checklist items to proceed to FnF.' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  8. FnF CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/separation/:id/fnf-preview  — auto-calculate FnF from all modules
router.get('/:id/fnf-preview', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { include: { salaryStructure: true } } },
  });
  if (!sep) throw notFound('Separation');

  const user = sep.user;
  const ss = user.salaryStructure;
  if (!ss) throw badRequest('Employee has no salary structure. Please set up salary first.');

  const grossMonthly = ss.grossEarnings || (ss.basic + ss.hra + ss.da + ss.specialAllowance + ss.medicalAllowance + ss.conveyanceAllowance + ss.otherAllowance);
  const dailyRate = Math.round((grossMonthly / 30) * 100) / 100;
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  if (!lwd) throw badRequest('Last working date is not set. HR must confirm LWD first.');

  const items = [];

  // 1. Last month salary (days worked in final month)
  const lwdDate = new Date(lwd);
  const lwdDay = lwdDate.getDate();
  const lastMonthStr = lwd.slice(0, 7); // "YYYY-MM"
  items.push({
    component: 'last_month_salary',
    label: `Last month salary (${lastMonthStr}: ${lwdDay} days worked)`,
    amount: Math.round(dailyRate * lwdDay * 100) / 100,
    days: lwdDay,
    dailyRate,
    autoCalculated: true,
  });

  // 2. Leave encashment — PL balance × daily rate
  let plBalance = 0;
  try {
    const fyYear = lwdDate.getMonth() >= 3 ? lwdDate.getFullYear() : lwdDate.getFullYear() - 1;
    const plLeaveType = await req.prisma.leaveType.findFirst({ where: { code: 'PL', isActive: true } });
    if (plLeaveType) {
      const plBal = await req.prisma.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId: user.id, leaveTypeId: plLeaveType.id, year: fyYear } },
      });
      plBalance = plBal ? Math.max(plBal.balance || 0, 0) : 0;
    }
  } catch {}
  items.push({
    component: 'leave_encashment',
    label: `Leave encashment (${plBalance.toFixed(1)} PL days × ₹${dailyRate.toFixed(2)}/day)`,
    amount: Math.round(dailyRate * plBalance * 100) / 100,
    days: plBalance,
    dailyRate,
    autoCalculated: true,
    note: 'Formula: Gross ÷ 30 × PL balance days',
  });

  // 3. Notice period recovery / buyout
  const expectedLWD = sep.expectedLWD;
  if (expectedLWD && lwd < expectedLWD) {
    const shortDays = daysBetween(lwd, expectedLWD);
    items.push({
      component: 'notice_recovery',
      label: `Notice period recovery (${shortDays} days short-served)`,
      amount: -Math.round(dailyRate * shortDays * 100) / 100, // deduction
      days: shortDays,
      dailyRate,
      autoCalculated: true,
      note: `Employee left ${shortDays} days before completing notice period`,
    });
  } else if (expectedLWD && lwd > expectedLWD && sep.type === 'termination') {
    const extraDays = daysBetween(expectedLWD, lwd);
    items.push({
      component: 'notice_buyout',
      label: `Notice period buyout (${extraDays} days waived by company)`,
      amount: Math.round(dailyRate * extraDays * 100) / 100,
      days: extraDays,
      dailyRate,
      autoCalculated: true,
    });
  }

  // 4. Asset deductions — unreturned mandatory assets
  const unreturned = await req.prisma.asset.findMany({
    where: { assignedTo: user.id, status: 'assigned', isMandatoryReturn: true },
    select: { id: true, name: true, type: true, value: true, purchasePrice: true },
  });
  for (const asset of unreturned) {
    const cost = asset.value || asset.purchasePrice || 0;
    items.push({
      component: 'asset_deduction',
      label: `Asset deduction: ${asset.name} (${asset.type})`,
      amount: -cost,
      autoCalculated: true,
      note: cost === 0 ? 'Asset value not set — override with actual deduction amount' : undefined,
    });
  }

  // 5. Pending expense claims (approved, not yet reimbursed)
  const pendingClaims = await req.prisma.expenseClaim.findMany({
    where: { userId: user.id, status: 'approved' },
    select: { id: true, title: true, totalAmount: true, submittedAt: true },
  });
  for (const claim of pendingClaims) {
    items.push({
      component: 'expense_claim',
      label: `Expense reimbursement: ${claim.title}`,
      amount: claim.totalAmount || 0,
      autoCalculated: true,
    });
  }

  // Salary hold breakdown
  const salaryHoldBreakdown = buildSalaryHoldBreakdown(lwd, dailyRate, sep.salaryHoldDays || 30);
  const totalHeldAmount = salaryHoldBreakdown.reduce((s, h) => s + h.heldAmount, 0);

  const netFnF = items.reduce((sum, i) => sum + i.amount, 0);

  res.json({
    employeeId: user.employeeId,
    employeeName: user.name,
    designation: user.designation,
    department: user.department,
    lastWorkingDate: lwd,
    grossMonthly,
    dailyRate,
    items,
    netFnF: Math.round(netFnF * 100) / 100,
    salaryHoldBreakdown,
    totalHeldAmount: Math.round(totalHeldAmount * 100) / 100,
    salaryHoldUntil: sep.salaryHoldUntil,
    note: 'Salary hold: last 30 days held in books, released 45 days after LWD. FnF processed after hold release.',
  });
}));

// POST /api/separation/:id/fnf-save  — save FnF line items (with HR overrides)
router.post('/:id/fnf-save', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { items } = req.body; // array of FnF line items
  if (!Array.isArray(items) || items.length === 0) throw badRequest('items array is required.');

  const sep = await req.prisma.separation.findUnique({ where: { id } });
  if (!sep) throw notFound('Separation');

  // Delete previous FnF items and re-create
  await req.prisma.separationFnF.deleteMany({ where: { separationId: id } });
  await req.prisma.separationFnF.createMany({
    data: items.map(item => ({
      separationId: id,
      component: item.component || 'other',
      label: item.label,
      amount: parseFloat(item.amount),
      days: item.days ? parseFloat(item.days) : null,
      dailyRate: item.dailyRate ? parseFloat(item.dailyRate) : null,
      autoCalculated: item.autoCalculated !== false,
      note: item.note || null,
      overriddenBy: item.overriddenBy ? req.user.id : null,
      overriddenAt: item.overriddenBy ? new Date().toISOString().slice(0, 10) : null,
    })),
  });

  const netFnF = items.reduce((sum, i) => sum + parseFloat(i.amount), 0);
  await req.prisma.separation.update({ where: { id }, data: { fnfNetAmount: Math.round(netFnF * 100) / 100 } });

  // Save salary hold breakdown to DB
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  if (lwd) {
    const ss = await req.prisma.salaryStructure.findUnique({ where: { userId: sep.userId } });
    if (ss) {
      const gross = ss.grossEarnings || 0;
      const dailyRate = gross / 30;
      const holds = buildSalaryHoldBreakdown(lwd, dailyRate, sep.salaryHoldDays || 30);
      await req.prisma.separationSalaryHold.deleteMany({ where: { separationId: id } });
      await req.prisma.separationSalaryHold.createMany({
        data: holds.map(h => ({ separationId: id, ...h })),
      });
      // Flag payslips with hold
      for (const hold of holds) {
        const payslip = await req.prisma.payslip.findUnique({ where: { userId_month: { userId: sep.userId, month: hold.month } } });
        if (payslip) {
          await req.prisma.payslip.update({
            where: { userId_month: { userId: sep.userId, month: hold.month } },
            data: { fnfHoldFlag: true, fnfHoldDays: hold.heldDays, fnfHoldAmount: hold.heldAmount, fnfHoldNote: hold.description },
          });
        }
      }
    }
  }

  res.json({ message: 'FnF saved.', netFnF: Math.round(netFnF * 100) / 100 });
}));

// POST /api/separation/:id/fnf-approve  — HR approves FnF
router.post('/:id/fnf-approve', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } }, fnfItems: true } });
  if (!sep) throw notFound('Separation');
  if (sep.fnfItems.length === 0) throw badRequest('FnF line items not saved yet. Run FnF preview and save first.');

  const today = new Date().toISOString().slice(0, 10);
  await req.prisma.separation.update({
    where: { id },
    data: { status: 'fnf_approved', fnfApprovedAt: today, fnfApprovedBy: req.user.id },
  });

  await notify('fnf_approved', { sep, hrName: req.user.name });
  res.json({ message: 'FnF approved. Salary will be released on ' + sep.salaryHoldUntil });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  9. SALARY HOLD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/separation/:id/salary-hold
router.get('/:id/salary-hold', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { salaryHolds: { orderBy: { month: 'asc' } } },
  });
  if (!sep) throw notFound('Separation');
  // Self or admin
  if (!isAdminRole(req.user) && req.user.id !== sep.userId) throw forbidden();

  const today = new Date().toISOString().slice(0, 10);
  const holdUntil = sep.salaryHoldUntil;
  const daysRemaining = holdUntil && !sep.salaryReleased ? Math.max(0, daysBetween(today, holdUntil)) : 0;

  res.json({
    salaryHoldDays: sep.salaryHoldDays,
    salaryHoldUntil: holdUntil,
    salaryReleased: sep.salaryReleased,
    salaryReleasedAt: sep.salaryReleasedAt,
    daysRemainingToRelease: daysRemaining,
    canReleaseNow: holdUntil && today >= holdUntil,
    holds: sep.salaryHolds,
    totalHeldAmount: sep.salaryHolds.reduce((s, h) => s + h.heldAmount, 0),
    notice: sep.salaryReleased
      ? `Salary released on ${sep.salaryReleasedAt}`
      : holdUntil
        ? `Salary on hold until ${holdUntil}. ${daysRemaining} day(s) remaining.`
        : 'Hold date not set yet.',
  });
}));

// POST /api/separation/:id/release-salary
router.post('/:id/release-salary', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id }, include: { salaryHolds: true, user: { select: { id: true, name: true, email: true } } } });
  if (!sep) throw notFound('Separation');
  if (sep.salaryReleased) throw conflict('Salary already released.');
  if (!['fnf_approved', 'completed'].includes(sep.status)) throw badRequest('FnF must be approved before releasing salary.');

  const today = new Date().toISOString().slice(0, 10);
  await req.prisma.separation.update({
    where: { id },
    data: { salaryReleased: true, salaryReleasedAt: today, salaryReleasedBy: req.user.id },
  });

  // Mark salary holds as released
  await req.prisma.separationSalaryHold.updateMany({
    where: { separationId: id },
    data: { released: true, releasedAt: new Date() },
  });

  // Remove hold flags from payslips
  for (const hold of sep.salaryHolds) {
    try {
      await req.prisma.payslip.updateMany({
        where: { userId: sep.userId, month: hold.month },
        data: { fnfHoldNote: `Released on ${today}` },
      });
    } catch {}
  }

  await notify('salary_released', { sep, hrName: req.user.name, releasedOn: today });
  res.json({ message: `Salary released. Employee will receive ₹${sep.salaryHolds.reduce((s, h) => s + h.heldAmount, 0).toFixed(2)}` });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  10. DOCUMENT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation/:id/generate-documents
router.post('/:id/generate-documents', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, designation: true, department: true, dateOfJoining: true, employeeId: true } } },
  });
  if (!sep) throw notFound('Separation');

  const user = sep.user;
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;

  // Find or create letter templates
  let relievingTemplate = await req.prisma.letterTemplate.findFirst({ where: { type: 'relieving_letter', isActive: true } });
  let experienceTemplate = await req.prisma.letterTemplate.findFirst({ where: { type: 'experience_letter', isActive: true } });

  const generatedLetters = [];

  const placeholders = {
    employee_name: user.name,
    employee_id: user.employeeId || '',
    designation: user.designation || '',
    department: user.department || '',
    joining_date: user.dateOfJoining || '',
    last_working_date: lwd || '',
    date: new Date().toISOString().slice(0, 10),
  };

  for (const [template, letterType] of [[relievingTemplate, 'relieving_letter'], [experienceTemplate, 'experience_letter']]) {
    if (!template) { generatedLetters.push({ type: letterType, status: 'skipped', reason: 'Template not found. Create template in Letters module first.' }); continue; }
    try {
      const letter = await req.prisma.generatedLetter.create({
        data: {
          userId: user.id,
          templateId: template.id,
          generatedBy: req.user.id,
          placeholders: JSON.stringify(placeholders),
          status: 'generated',
          generatedAt: new Date(),
        },
      });
      generatedLetters.push({ type: letterType, status: 'generated', letterId: letter.id });
    } catch (e) {
      generatedLetters.push({ type: letterType, status: 'error', reason: e.message });
    }
  }

  await req.prisma.separation.update({
    where: { id },
    data: { documentsGenerated: true, documentsGeneratedAt: new Date() },
  });

  await notify('documents_generated', { sep, user });
  res.json({ message: 'Documents generated.', letters: generatedLetters });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  11. COMPLETE SEPARATION
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation/:id/complete
router.post('/:id/complete', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!sep) throw notFound('Separation');

  // Validate checklist
  const pendingChecklist = await req.prisma.separationChecklist.count({ where: { separationId: id, status: 'pending' } });
  if (pendingChecklist > 0) throw badRequest(`${pendingChecklist} clearance checklist item(s) still pending.`);

  if (!sep.fnfApprovedAt) throw badRequest('FnF must be approved before completing separation.');

  const today = new Date().toISOString().slice(0, 10);
  const { suspendWorkspaceUser, setupEmailForwarding } = require('../services/google/googleWorkspace');

  // Determine Workspace action
  const isForcedExit = ['termination', 'absconding'].includes(sep.type);
  let wsAction = null;
  if (sep.user) {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
    if (domain && sep.user.email.endsWith(`@${domain}`)) {
      try {
        if (isForcedExit) {
          await suspendWorkspaceUser(sep.user.email);
          wsAction = 'suspended';
          if (sep.workspaceBackupEmail) { try { await setupEmailForwarding(sep.user.email, sep.workspaceBackupEmail); wsAction = 'suspended_forwarding'; } catch {} }
        } else {
          wsAction = 'active_limited';
          if (sep.workspaceBackupEmail) { try { await setupEmailForwarding(sep.user.email, sep.workspaceBackupEmail); wsAction = 'forwarding_only'; } catch {} }
        }
      } catch { wsAction = 'failed'; }
    }
  }

  await req.prisma.separation.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date(), workspaceAction: wsAction },
  });

  await req.prisma.user.update({
    where: { id: sep.userId },
    data: {
      employmentStatus: isForcedExit ? sep.type : 'separated',
      isActive: isForcedExit ? false : true,
      workspaceSuspendPending: !isForcedExit,
    },
  });

  // Stop salary processing
  try {
    await req.prisma.salaryStructure.update({ where: { userId: sep.userId }, data: { stopSalaryProcessing: true, stopSalaryReason: 'Employee separated', stopSalaryBy: req.user.id, stopSalaryAt: new Date() } });
  } catch {}

  await notify('separation_completed', { sep, completedBy: req.user.name });
  res.json({ message: 'Separation completed. Alumni portal access activated.' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  12. LIST & DETAIL
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/separation  — admin: all separations
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const separations = await req.prisma.separation.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, profilePhotoUrl: true, driveProfilePhotoUrl: true } },
      checklist: { select: { id: true, status: true } },
      fnfItems: { select: { id: true, amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(separations.map(s => ({
    ...s,
    checklistProgress: {
      total: s.checklist.length,
      done: s.checklist.filter(c => c.status !== 'pending').length,
    },
    fnfTotal: s.fnfItems.reduce((sum, f) => sum + f.amount, 0),
  })));
}));

// GET /api/separation/my  — employee's own separation
router.get('/my', asyncHandler(async (req, res) => {
  const sep = await req.prisma.separation.findUnique({
    where: { userId: req.user.id },
    include: {
      checklist: { orderBy: { sortOrder: 'asc' } },
      fnfItems: { orderBy: { id: 'asc' } },
      salaryHolds: { orderBy: { month: 'asc' } },
    },
  });
  if (!sep) return res.json(null);
  const today = new Date().toISOString().slice(0, 10);
  res.json({
    ...sep,
    daysRemainingInNotice: sep.adjustedLWD ? Math.max(0, daysBetween(today, sep.adjustedLWD)) : null,
    daysUntilSalaryRelease: sep.salaryHoldUntil && !sep.salaryReleased ? Math.max(0, daysBetween(today, sep.salaryHoldUntil)) : null,
    totalHeldAmount: sep.salaryHolds.reduce((s, h) => s + h.heldAmount, 0),
  });
}));

// GET /api/separation/:id  — admin: full detail
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true, employeeId: true, department: true, designation: true, dateOfJoining: true, profilePhotoUrl: true, driveProfilePhotoUrl: true, noticePeriodDays: true, reportingManager: { select: { id: true, name: true, email: true } } },
      },
      managerApprover: { select: { id: true, name: true } },
      hrConfirmer: { select: { id: true, name: true } },
      fnfApprover: { select: { id: true, name: true } },
      salaryReleaser: { select: { id: true, name: true } },
      checklist: { orderBy: { sortOrder: 'asc' }, include: { assignedTo: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true } } } },
      fnfItems: { orderBy: { id: 'asc' } },
      salaryHolds: { orderBy: { month: 'asc' } },
    },
  });
  if (!sep) throw notFound('Separation');

  const pendingAssets = await req.prisma.asset.findMany({
    where: { assignedTo: sep.userId, status: 'assigned', isMandatoryReturn: true },
    select: { id: true, name: true, type: true, value: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  res.json({
    ...sep,
    pendingAssets,
    checklistProgress: { total: sep.checklist.length, done: sep.checklist.filter(c => c.status !== 'pending').length },
    daysRemainingInNotice: sep.adjustedLWD ? Math.max(0, daysBetween(today, sep.adjustedLWD)) : null,
    daysUntilSalaryRelease: sep.salaryHoldUntil && !sep.salaryReleased ? Math.max(0, daysBetween(today, sep.salaryHoldUntil)) : null,
    totalHeldAmount: sep.salaryHolds.reduce((s, h) => s + h.heldAmount, 0),
  });
}));

// DELETE /api/separation/:id  — cancel/withdraw
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id } });
  if (!sep) throw notFound('Separation');
  if (!['pending_manager', 'pending_hr', 'rejected'].includes(sep.status) && !isAdminRole(req.user)) {
    throw badRequest('Resignation can only be withdrawn before HR confirmation.');
  }
  if (!isAdminRole(req.user) && req.user.id !== sep.userId) throw forbidden();

  await req.prisma.separation.update({ where: { id }, data: { status: 'cancelled', rejectionReason: 'Resignation withdrawn.' } });
  await req.prisma.user.update({ where: { id: sep.userId }, data: { employmentStatus: 'active' } });
  res.json({ message: 'Resignation withdrawn successfully.' });
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  BULK IMPORT — historical separation records (admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/separation/bulk-import
// Body: { records: [{ employeeName, separationDate, settlementDate, resignationDate, type }] }
// separationDate  = LWD (last working day)
// settlementDate  = FnF paid date, or null/"Not Yet Settle"
// resignationDate = date resignation was submitted, or "Absconded"/"Terminated"
router.post('/bulk-import', requireAdmin, asyncHandler(async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    throw badRequest('records array is required');
  }

  const results = { created: 0, skipped: 0, errors: [] };

  for (const rec of records) {
    try {
      const { employeeName, separationDate, settlementDate, resignationDate } = rec;
      if (!employeeName || !separationDate) {
        results.errors.push({ name: employeeName, error: 'employeeName and separationDate are required' });
        continue;
      }

      // Find employee by name (case-insensitive, partial match)
      const user = await req.prisma.user.findFirst({
        where: { name: { contains: employeeName.trim(), mode: 'insensitive' } },
      });
      if (!user) {
        results.errors.push({ name: employeeName, error: 'Employee not found' });
        continue;
      }

      // Skip if already has an active/completed separation
      const existing = await req.prisma.separation.findUnique({ where: { userId: user.id } });
      if (existing) {
        results.skipped++;
        continue;
      }

      // Determine type
      const isAbsconded = typeof resignationDate === 'string' && resignationDate.toLowerCase().includes('abscond');
      const isTerminated = typeof resignationDate === 'string' && resignationDate.toLowerCase().includes('terminat');
      const type = isAbsconded ? 'absconding' : isTerminated ? 'termination' : 'resignation';

      // Determine requestDate (resignation submitted date)
      let requestDate = separationDate; // fallback
      if (resignationDate && !isAbsconded && !isTerminated) {
        // Parse DD-MMM-YY or D-Mon-YY format
        const d = new Date(resignationDate);
        if (!isNaN(d)) requestDate = d.toISOString().slice(0, 10);
      }

      // Parse separation date
      const lwdDate = new Date(separationDate);
      if (isNaN(lwdDate)) {
        results.errors.push({ name: employeeName, error: `Invalid separationDate: ${separationDate}` });
        continue;
      }
      const lwd = lwdDate.toISOString().slice(0, 10);

      // Parse settlement date
      let fnfPaidOn = null;
      const isSettled = settlementDate && typeof settlementDate === 'string'
        && !settlementDate.toLowerCase().includes('not yet')
        && settlementDate.trim() !== '';
      if (isSettled) {
        const sd = new Date(settlementDate);
        if (!isNaN(sd)) fnfPaidOn = sd.toISOString().slice(0, 10);
      }

      // Determine status
      const status = fnfPaidOn ? 'completed' : 'fnf_pending';

      await req.prisma.separation.create({
        data: {
          userId: user.id,
          type,
          requestDate,
          lastWorkingDate: lwd,
          expectedLWD: lwd,
          adjustedLWD: lwd,
          preferredLWD: lwd,
          status,
          initiatedBy: isAbsconded || isTerminated ? 'hr' : 'employee',
          processedBy: req.user.id,
          fnfPaidOn,
          fnfApprovedAt: fnfPaidOn,
          salaryReleased: !!fnfPaidOn,
          salaryReleasedAt: fnfPaidOn,
          completedAt: fnfPaidOn ? new Date(fnfPaidOn) : null,
          hrConfirmedAt: requestDate,
          hrConfirmedBy: req.user.id,
          leavesBlocked: true,
        },
      });

      // Update user employment status
      await req.prisma.user.update({
        where: { id: user.id },
        data: {
          employmentStatus: isAbsconded ? 'absconding' : 'separated',
          isActive: false,
        },
      });

      results.created++;
    } catch (err) {
      results.errors.push({ name: rec.employeeName, error: err.message });
    }
  }

  res.json({
    message: `Import complete: ${results.created} created, ${results.skipped} skipped`,
    ...results,
  });
}));

// ─── private helper: create default clearance checklist ──────────────────────
async function _createChecklist(prisma, separationId) {
  await prisma.separationChecklist.createMany({
    data: DEFAULT_CHECKLIST.map(t => ({ separationId, ...t })),
    skipDuplicates: true,
  });
}

module.exports = router;
