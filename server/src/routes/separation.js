const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden, conflict } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { calcStatutory, DEFAULT_PAYROLL_RULES } = require('../utils/payrollRules');

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
  const salaryHoldUntil = addDays(expectedLWD, 45);

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
      salaryHoldUntil,
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
  const { userId, type, requestDate, lastWorkingDate, reason, noticePeriodDays, salaryHoldUntil: salaryHoldUntilOverride } = req.body;
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
  const salaryHoldUntil = salaryHoldUntilOverride || addDays(expectedLWD, 45);

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
      salaryHoldUntil,
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
  const { lastWorkingDate, type, noticePeriodWaiver, hrNote, waiveLeaveExtension, salaryHoldDays, salaryHoldUntil: salaryHoldUntilOverride } = req.body;
  if (!lastWorkingDate) throw badRequest('lastWorkingDate (final LWD) is required.');

  const sep = await req.prisma.separation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, designation: true, department: true, noticePeriodDays: true } } },
  });
  if (!sep) throw notFound('Separation');
  if (!['pending_hr', 'pending_manager'].includes(sep.status)) throw badRequest('Separation is not in a state for HR confirmation.');

  const today = new Date().toISOString().slice(0, 10);
  const holdDays = (salaryHoldDays !== undefined && salaryHoldDays !== null) ? parseInt(salaryHoldDays) : 45;
  // HR can directly override the settlement date, or it's calculated from expectedLWD + holdDays.
  // expectedLWD is always the base (not the agreed/early LWD) so the hold covers the full notice window.
  const holdBase = sep.expectedLWD || lastWorkingDate;
  const salaryHoldUntil = salaryHoldUntilOverride || (holdDays > 0 ? addDays(holdBase, holdDays) : holdBase);

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
      salaryHoldDays: holdDays,
      ...(waiveLeaveExtension ? { leaveDaysDuringNotice: 0 } : {}), // waive any pending notice extension
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
  const { force } = req.body; // force: true = HR override, bypass LWD date check
  const sep = await req.prisma.separation.findUnique({ where: { id }, include: { user: true } });
  if (!sep) throw notFound('Separation');
  if (sep.status !== 'notice_period') throw badRequest('Employee must be in notice period before clearance.');

  const today = new Date().toISOString().slice(0, 10);
  const lwdToCheck = sep.adjustedLWD || sep.lastWorkingDate;
  const isHistorical = sep.requestDate && sep.requestDate < '2026-04-01'; // pre-Apr-2026 records bypass date checks

  if (!force && !isHistorical && today < lwdToCheck) {
    throw badRequest(`Cannot start clearance before LWD (${lwdToCheck}). Use HR Override to bypass.`);
  }

  await req.prisma.separation.update({ where: { id }, data: { status: 'clearance' } });

  // Auto-create clearance checklist if it doesn't exist (handles historical records)
  const existing = await req.prisma.separationChecklist.count({ where: { separationId: id } });
  if (existing === 0) await _createChecklist(req.prisma, id);

  res.json({ message: 'Clearance stage started. Checklist created. Complete all checklist items to proceed to FnF.' });
}));

// POST /:id/create-checklist — manually create checklist (for historical records where it was skipped)
router.post('/:id/create-checklist', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id } });
  if (!sep) throw notFound('Separation');
  await req.prisma.separationChecklist.deleteMany({ where: { separationId: id } }); // reset and recreate
  await _createChecklist(req.prisma, id);
  const checklist = await req.prisma.separationChecklist.findMany({ where: { separationId: id }, orderBy: { sortOrder: 'asc' } });
  res.json({ message: 'Checklist created.', checklist });
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
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  if (!lwd) throw badRequest('Last working date is not set. HR must confirm LWD first.');

  // Derive gross from salary structure, or fall back to latest payslip, or 0 (HR overrides)
  let grossMonthly = 0;
  let salarySource = 'none';
  if (ss) {
    // Try grossEarnings field first, then sum individual fields,
    // then sum earning components array (catches Statutory Bonus, Other Allowance etc.)
    const fieldSum = (ss.basic||0) + (ss.hra||0) + (ss.da||0) + (ss.specialAllowance||0) + (ss.medicalAllowance||0) + (ss.conveyanceAllowance||0) + (ss.otherAllowance||0);
    const componentSum = Array.isArray(ss.components)
      ? ss.components.filter(c => c.type === 'earning').reduce((s, c) => s + (c.amount || 0), 0)
      : 0;
    grossMonthly = ss.grossEarnings || Math.max(fieldSum, componentSum) || 0;
    salarySource = 'salary_structure';
  }
  if (!grossMonthly) {
    try {
      const latestPayslip = await req.prisma.payslip.findFirst({ where: { userId: user.id }, orderBy: { month: 'desc' } });
      if (latestPayslip?.grossEarnings) { grossMonthly = latestPayslip.grossEarnings; salarySource = 'payslip'; }
    } catch {}
  }
  const manualMode = !grossMonthly;
  const dailyRate = grossMonthly ? Math.round((grossMonthly / 30) * 100) / 100 : 0;

  const items = [];

  // 1. Last month salary — use generated payslip if available (has real attendance/LOP/advances/off-day)
  //    Fall back to simple estimate (gross ÷ 30 × lwdDay) only if no payslip exists yet.
  const lwdDate = new Date(lwd);
  const lwdDay = lwdDate.getDate();
  const lwdMonth = lwdDate.getMonth() + 1; // 1-12 for PT slab
  const lastMonthStr = lwd.slice(0, 7); // "YYYY-MM"

  let lastMonthPayslip = null;
  try {
    lastMonthPayslip = await req.prisma.payslip.findUnique({
      where: { userId_month: { userId: user.id, month: lastMonthStr } },
    });
  } catch {}

  if (lastMonthPayslip) {
    // Use actual payslip — it already accounts for attendance, LOP, advances, off-day allowance
    const earnedGross = (lastMonthPayslip.grossEarnings || 0) - (lastMonthPayslip.lopDeduction || 0);
    const paidDays = lastMonthPayslip.presentDays ?? lastMonthPayslip.workingDays ?? lwdDay;
    items.push({
      component: 'last_month_salary',
      label: `Last month salary (${lastMonthStr}: ${paidDays} paid days — from payslip)`,
      amount: Math.round(earnedGross * 100) / 100,
      autoCalculated: true,
      note: `Gross earned ₹${earnedGross.toFixed(2)} from generated payslip (attendance + LOP + off-day already applied)`,
    });
    // PF, ESI, PT — use actual payslip values
    if ((lastMonthPayslip.employeePf || 0) > 0) {
      items.push({
        component: 'pf_deduction',
        label: `Employee PF deduction (last month)`,
        amount: -(lastMonthPayslip.employeePf || 0),
        autoCalculated: true,
        note: 'From generated payslip',
      });
    }
    if ((lastMonthPayslip.employeeEsi || 0) > 0) {
      items.push({
        component: 'esi_deduction',
        label: `Employee ESI deduction (last month)`,
        amount: -(lastMonthPayslip.employeeEsi || 0),
        autoCalculated: true,
        note: 'From generated payslip',
      });
    }
    if ((lastMonthPayslip.professionalTax || 0) > 0) {
      items.push({
        component: 'pt_deduction',
        label: `Professional Tax (last month)`,
        amount: -(lastMonthPayslip.professionalTax || 0),
        autoCalculated: true,
        note: 'From generated payslip',
      });
    }
    if ((lastMonthPayslip.salaryAdvanceDeduction || 0) > 0) {
      items.push({
        component: 'advance_recovery',
        label: `Salary advance recovery (last month)`,
        amount: -(lastMonthPayslip.salaryAdvanceDeduction || 0),
        autoCalculated: true,
        note: 'From generated payslip',
      });
    }
  } else {
    // No payslip yet — calculate from actual attendance records for the last month
    // Count present/absent/leave days from 1st of month up to LWD
    let paidDays = 0;
    let lopDays = 0;
    let attendanceNote = '';
    try {
      // Fetch attendance records for this month up to LWD
      const attRecords = await req.prisma.attendance.findMany({
        where: { userId: user.id, date: { gte: `${lastMonthStr}-01`, lte: lwd } },
      });
      // Fetch approved paid leave days in this period
      const paidLeaveTypes = await req.prisma.leaveType.findMany({
        where: { isActive: true, isPaid: true },
        select: { id: true },
      });
      const paidLeaveTypeIds = paidLeaveTypes.map(l => l.id);
      const leaveRequests = await req.prisma.leaveRequest.findMany({
        where: {
          userId: user.id,
          status: 'approved',
          startDate: { lte: lwd },
          endDate: { gte: `${lastMonthStr}-01` },
        },
        select: { startDate: true, endDate: true, leaveTypeId: true, isHalfDay: true },
      });
      // Build sets of paid-leave dates and LOP-leave dates
      const paidLeaveDates = new Set();
      const lopLeaveDates = new Set();
      for (const lr of leaveRequests) {
        const isPaid = paidLeaveTypeIds.includes(lr.leaveTypeId);
        let d = new Date(lr.startDate);
        const end = new Date(lr.endDate);
        while (d <= end) {
          const ds = d.toISOString().slice(0, 10);
          if (ds >= `${lastMonthStr}-01` && ds <= lwd) {
            if (isPaid) paidLeaveDates.add(ds);
            else lopLeaveDates.add(ds);
          }
          d.setDate(d.getDate() + 1);
        }
      }
      // Count days
      const attMap = new Map(attRecords.map(a => [a.date, a.status]));
      for (let d = 1; d <= lwdDay; d++) {
        const ds = `${lastMonthStr}-${String(d).padStart(2, '0')}`;
        const status = attMap.get(ds);
        if (lopLeaveDates.has(ds)) { lopDays += 1; }
        else if (paidLeaveDates.has(ds)) { paidDays += 1; }
        else if (status === 'present') { paidDays += 1; }
        else if (status === 'half_day') { paidDays += 0.5; lopDays += 0.5; }
        else if (status === 'absent') { lopDays += 1; }
        else if (status === 'on_leave') { paidDays += 1; }
        else if (!status) { paidDays += 1; } // no record = assume present (same as payroll)
      }
      attendanceNote = `Calculated from attendance muster: ${paidDays} paid days, ${lopDays} LOP days out of ${lwdDay} days`;
    } catch {
      // Attendance fetch failed — fall back to day count
      paidDays = lwdDay;
      attendanceNote = `Attendance data unavailable — using ${lwdDay} days as paid days`;
    }

    const earnedGross = Math.round(grossMonthly * paidDays / 30 * 100) / 100;
    items.push({
      component: 'last_month_salary',
      label: `Last month salary (${lastMonthStr}: ${paidDays} paid days of ${lwdDay})`,
      amount: earnedGross,
      autoCalculated: true,
      note: `${attendanceNote}. Payslip not yet generated — FnF will auto-update once payslip is processed.`,
    });

    // Statutory deductions on attendance-based earned gross
    if (ss && earnedGross > 0) {
      const earnedBasic = Math.round((ss.basic || 0) * paidDays / 30 * 100) / 100;
      const statutory = calcStatutory(earnedGross, earnedBasic, ss.ptExempt || false, false, DEFAULT_PAYROLL_RULES, user.gender, lwdMonth, undefined);
      if (statutory.employeePf > 0) {
        items.push({
          component: 'pf_deduction',
          label: `Employee PF deduction (last month)`,
          amount: -statutory.employeePf,
          autoCalculated: true,
          note: `12% of earned basic ₹${earnedBasic.toFixed(0)}, max ₹1,800`,
        });
      }
      if (statutory.employeeEsi > 0) {
        items.push({
          component: 'esi_deduction',
          label: `Employee ESI deduction (last month)`,
          amount: -statutory.employeeEsi,
          autoCalculated: true,
        });
      }
      if (statutory.professionalTax > 0) {
        items.push({
          component: 'pt_deduction',
          label: `Professional Tax (last month)`,
          amount: -statutory.professionalTax,
          autoCalculated: true,
        });
      }
    }

    // Pending salary advances not yet recovered
    try {
      const advances = await req.prisma.salaryAdvance.findMany({
        where: { userId: user.id, status: 'approved', remainingAmount: { gt: 0 } },
      });
      for (const adv of advances) {
        items.push({
          component: 'advance_recovery',
          label: `Salary advance recovery (balance ₹${adv.remainingAmount})`,
          amount: -(adv.remainingAmount || 0),
          autoCalculated: true,
          note: 'Outstanding advance balance to be recovered in FnF',
        });
      }
    } catch {}
  }

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

  // 3. Notice period buyout (termination only — company waives remaining notice)
  // NOTE: Notice *recovery* is intentionally NOT auto-added. When HR confirms the LWD
  // (lastWorkingDate), it is treated as a mutually agreed date — no penalty applies.
  // If HR wants to deduct notice recovery, they can add it as a custom item.
  const expectedLWD = sep.expectedLWD;
  if (expectedLWD && lwd > expectedLWD && sep.type === 'termination') {
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
    select: { id: true, title: true, amount: true, createdAt: true },
  });
  for (const claim of pendingClaims) {
    items.push({
      component: 'expense_claim',
      label: `Expense reimbursement: ${claim.title}`,
      amount: claim.amount || 0,
      autoCalculated: true,
    });
  }

  // Salary hold breakdown
  const salaryHoldBreakdown = buildSalaryHoldBreakdown(lwd, dailyRate, sep.salaryHoldDays || 30);
  const totalHeldAmount = salaryHoldBreakdown.reduce((s, h) => s + h.heldAmount, 0);

  const netFnF = items.reduce((sum, i) => sum + i.amount, 0);

  // Historical: records initiated before April 2026 bypass the 45-day hold check
  const isHistorical = !!(sep.requestDate && sep.requestDate < '2026-04-01');

  // Salary hold info — which payslip month shows "On Hold"
  const lwdMonthStr = lwd.slice(0, 7); // "YYYY-MM"
  const salaryReleaseDate = sep.salaryHoldUntil || addDays(sep.expectedLWD || lwd, 45);
  const formula = grossMonthly
    ? `Gross ₹${grossMonthly.toFixed(2)} ÷ 30 = ₹${dailyRate.toFixed(2)}/day`
    : null;

  res.json({
    employeeId: user.employeeId,
    employeeName: user.name,
    designation: user.designation,
    department: user.department,
    lastWorkingDate: lwd,
    grossMonthly,
    dailyRate,
    formula,
    items,
    netFnF: Math.round(netFnF * 100) / 100,
    salaryHoldBreakdown,
    totalHeldAmount: Math.round(totalHeldAmount * 100) / 100,
    salaryHoldUntil: salaryReleaseDate,
    lwdMonth: lwdMonthStr,
    salaryReleaseDate,
    isHistorical,
    manualMode,
    salarySource,
    note: manualMode
      ? 'No salary data found. Amounts are ₹0 — override each item or add custom items.'
      : `Salary from ${salarySource === 'payslip' ? 'latest payslip' : 'salary structure'}. Override any amount or remove items as needed.`,
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
    include: {
      user: {
        include: { company: true, salaryStructure: true },
      },
    },
  });
  if (!sep) throw notFound('Separation');
  if (sep.type !== 'resignation') throw badRequest('Letters can only be generated for resigned employees.');

  const user = sep.user;
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;

  // Helpers (same logic as letters.js)
  function getSalutation(gender) {
    if (!gender) return 'Mr./Ms.';
    return gender.toLowerCase() === 'female' ? 'Ms.' : 'Mr.';
  }
  function renderContent(content, ph) {
    let out = content;
    for (const [k, v] of Object.entries(ph)) out = out.split(k).join(v);
    return out;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const salutation = getSalutation(user.gender);
  const placeholders = {
    '{{name}}': user.name || '', '{{salutation}}': salutation,
    '{{employeeId}}': user.employeeId || '', '{{designation}}': user.designation || '',
    '{{department}}': user.department || '', '{{dateOfJoining}}': user.dateOfJoining || '',
    '{{joiningDate}}': user.dateOfJoining || '', '{{email}}': user.email || '',
    '{{lwd}}': lwd || '', '{{lastWorkingDate}}': lwd || '',
    '{{company.name}}': user.company?.name || '', '{{company.address}}': user.company?.address || '',
    '{{company.city}}': user.company?.city || '', '{{company.state}}': user.company?.state || '',
    '{{date}}': dateStr,
  };

  const relievingTemplate = await req.prisma.letterTemplate.findFirst({ where: { type: 'relieving', isActive: true } });
  const experienceTemplate = await req.prisma.letterTemplate.findFirst({ where: { type: 'experience', isActive: true } });

  // Delete old experience/relieving letters for this user before regenerating (prevents duplicates)
  await req.prisma.generatedLetter.deleteMany({ where: { userId: user.id, letterType: { in: ['experience', 'relieving'] } } });

  const generatedLetters = [];
  for (const [template, letterType] of [[experienceTemplate, 'experience'], [relievingTemplate, 'relieving']]) {
    if (!template) {
      generatedLetters.push({ type: letterType, status: 'skipped', reason: 'Template not found. Run POST /api/letters/seed-separation-templates first.' });
      continue;
    }
    try {
      const renderedContent = renderContent(template.content, placeholders);
      const letter = await req.prisma.generatedLetter.create({
        data: { userId: user.id, templateId: template.id, letterType, content: renderedContent, generatedBy: req.user.id },
      });
      generatedLetters.push({ type: letterType, status: 'generated', letterId: letter.id, templateName: template.name });
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

  // Auto-create clearance checklist if status is clearance+ and checklist is empty
  const CLEARANCE_STATUSES = ['clearance', 'fnf_pending', 'fnf_approved', 'completed'];
  if (CLEARANCE_STATUSES.includes(sep.status) && sep.checklist.length === 0) {
    await _createChecklist(req.prisma, id);
    // Reload with checklist
    const fresh = await req.prisma.separationChecklist.findMany({ where: { separationId: id }, orderBy: { sortOrder: 'asc' }, include: { assignedTo: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true } } } });
    sep.checklist = fresh;
  }

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

// GET /:id/letters — Get experience/relieving letters for a separation (admin or self)
router.get('/:id/letters', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const sep = await req.prisma.separation.findUnique({ where: { id }, select: { userId: true, type: true } });
  if (!sep) throw notFound('Separation');
  if (!isAdminRole(req.user) && req.user.id !== sep.userId) throw forbidden();

  const all = await req.prisma.generatedLetter.findMany({
    where: { userId: sep.userId, letterType: { in: ['experience', 'relieving'] } },
    include: { template: { select: { id: true, name: true, type: true } }, generatedByUser: { select: { id: true, name: true } } },
    orderBy: { generatedAt: 'desc' },
  });
  // Return only the latest of each type (experience + relieving)
  const latest = {};
  for (const l of all) {
    if (!latest[l.letterType]) latest[l.letterType] = l;
  }
  res.json(Object.values(latest));
}));

// ─── private helper: create default clearance checklist ──────────────────────
async function _createChecklist(prisma, separationId) {
  await prisma.separationChecklist.createMany({
    data: DEFAULT_CHECKLIST.map(t => ({ separationId, ...t })),
    skipDuplicates: true,
  });
}

module.exports = router;
