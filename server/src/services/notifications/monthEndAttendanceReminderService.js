/**
 * Month-End Attendance & Leave Reminder Service
 *
 * Fires daily via cron (9 AM IST, every day).
 * Only acts on:
 *   • 2nd-to-last day of month  → 1st reminder
 *   • Last day of month          → Final reminder
 *
 * Per-employee: checks for
 *   1. Pending AttendanceRegularization requests (submitted, awaiting manager review)
 *   2. Pending LeaveRequest for current month
 *   3. Absent attendance records with no leave applied or approved
 *
 * Per-manager: checks for pending team approvals (leave + regularization)
 *
 * Setting key: "payroll_month_end_reminders" (default ON — only skips if explicitly "false")
 */

const {
  sendMonthEndEmployeeReminder,
  sendMonthEndManagerReminder,
} = require('./emailService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const lastDateStr = `${ym}-${String(lastDay).padStart(2, '0')}`;

  return {
    today,
    lastDay,
    ym,
    monthLabel,
    lastDateStr,
    isSecondToLast: today === lastDay - 1,
    isLastDay: today === lastDay,
  };
}

// Build a Set of date strings covered by a leave request (inclusive range)
function buildLeaveDateSet(startDate, endDate) {
  const dates = new Set();
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.add(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Main entry point ─────────────────────────────────────────────────────────

async function runMonthEndAttendanceReminder(prisma) {
  const { today, lastDay, ym, monthLabel, lastDateStr, isSecondToLast, isLastDay } = getMonthInfo();

  if (!isSecondToLast && !isLastDay) {
    console.log(`[MONTH_END_REMINDER] Day ${today}/${lastDay} — not a reminder day. Skipping.`);
    return { sent: 0, skipped: true };
  }

  // Check setting (default ON — only disable if explicitly "false")
  const setting = await prisma.setting.findUnique({ where: { key: 'payroll_month_end_reminders' } });
  if (setting && setting.value === 'false') {
    console.log('[MONTH_END_REMINDER] Setting disabled — skipping.');
    return { sent: 0, disabled: true };
  }

  const reminderType = isLastDay ? 'final' : 'first';
  console.log(`[MONTH_END_REMINDER] Running ${reminderType} reminder for ${monthLabel}`);

  const monthStart = `${ym}-01`;
  const monthEnd = lastDateStr;

  // ── Load active employees ─────────────────────────────────────────────────
  const activeEmployees = await prisma.user.findMany({
    where: { isActive: true, employmentStatus: { in: ['active', 'notice_period'] } },
    select: {
      id: true, name: true, email: true,
      department: true, designation: true,
      reportingManagerId: true,
    },
  });

  const employeeIds = activeEmployees.map(e => e.id);
  const employeeMap = new Map(activeEmployees.map(e => [e.id, e]));

  // ── 1. Pending regularization requests for current month ──────────────────
  const pendingRegs = await prisma.attendanceRegularization.findMany({
    where: {
      userId: { in: employeeIds },
      date: { gte: monthStart, lte: monthEnd },
      status: 'pending',
    },
    select: { userId: true, date: true, reason: true },
  });

  // ── 2. Pending leave requests overlapping current month ───────────────────
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: employeeIds },
      status: 'pending',
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: {
      userId: true, startDate: true, endDate: true, days: true,
      leaveType: { select: { name: true } },
    },
  });

  // ── 3. Absences not covered by any leave (pending or approved) ────────────
  const [absentRecords, allLeavesThisMonth] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        userId: { in: employeeIds },
        date: { gte: monthStart, lte: monthEnd },
        status: 'absent',
      },
      select: { userId: true, date: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: employeeIds },
        status: { in: ['pending', 'approved'] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { userId: true, startDate: true, endDate: true },
    }),
  ]);

  // Build per-user leave coverage map
  const leaveCoverage = new Map(); // userId → Set<dateStr>
  for (const lr of allLeavesThisMonth) {
    if (!leaveCoverage.has(lr.userId)) leaveCoverage.set(lr.userId, new Set());
    const covered = leaveCoverage.get(lr.userId);
    const dateSet = buildLeaveDateSet(lr.startDate, lr.endDate);
    for (const d of dateSet) covered.add(d);
  }

  // Find uncovered absent dates per user
  const uncoveredAbsences = {}; // userId → [dateStr]
  for (const rec of absentRecords) {
    const covered = leaveCoverage.get(rec.userId);
    if (!covered || !covered.has(rec.date)) {
      if (!uncoveredAbsences[rec.userId]) uncoveredAbsences[rec.userId] = [];
      uncoveredAbsences[rec.userId].push(rec.date);
    }
  }

  // ── Group by employee ─────────────────────────────────────────────────────
  const regByUser = {};
  for (const r of pendingRegs) {
    if (!regByUser[r.userId]) regByUser[r.userId] = [];
    regByUser[r.userId].push(r);
  }
  const leaveByUser = {};
  for (const l of pendingLeaves) {
    if (!leaveByUser[l.userId]) leaveByUser[l.userId] = [];
    leaveByUser[l.userId].push(l);
  }

  const affectedEmployeeIds = new Set([
    ...Object.keys(regByUser).map(Number),
    ...Object.keys(leaveByUser).map(Number),
    ...Object.keys(uncoveredAbsences).map(Number),
  ]);

  let emailsSent = 0;

  // ── Send employee reminders ───────────────────────────────────────────────
  for (const uid of affectedEmployeeIds) {
    const emp = employeeMap.get(uid);
    if (!emp?.email) continue;

    try {
      await sendMonthEndEmployeeReminder(emp.email, emp.name, {
        monthLabel,
        lastDate: lastDateStr,
        reminderType,
        pendingRegularizations: regByUser[uid] || [],
        pendingLeaves: leaveByUser[uid] || [],
        uncoveredAbsences: uncoveredAbsences[uid] || [],
      });
      emailsSent++;
    } catch (err) {
      console.error(`[MONTH_END_REMINDER] Failed to email employee ${emp.name}: ${err.message}`);
    }
  }

  // ── Group pending items by reporting manager ──────────────────────────────
  const managerPending = {}; // managerId → { leaves: [], regs: [] }

  for (const uid of affectedEmployeeIds) {
    const emp = employeeMap.get(uid);
    if (!emp?.reportingManagerId) continue;
    const mid = emp.reportingManagerId;
    if (!managerPending[mid]) managerPending[mid] = { leaves: [], regs: [] };

    if (leaveByUser[uid]) {
      managerPending[mid].leaves.push(
        ...leaveByUser[uid].map(l => ({ ...l, employee: emp }))
      );
    }
    if (regByUser[uid]) {
      managerPending[mid].regs.push(
        ...regByUser[uid].map(r => ({ ...r, employee: emp }))
      );
    }
  }

  // ── Send manager reminders ────────────────────────────────────────────────
  const managerIds = Object.keys(managerPending).map(Number).filter(id => id > 0);
  if (managerIds.length > 0) {
    const managers = await prisma.user.findMany({
      where: { id: { in: managerIds }, isActive: true },
      select: { id: true, name: true, email: true },
    });

    for (const mgr of managers) {
      const pending = managerPending[mgr.id];
      if (!pending || (pending.leaves.length === 0 && pending.regs.length === 0)) continue;
      if (!mgr.email) continue;

      try {
        await sendMonthEndManagerReminder(mgr.email, mgr.name, {
          monthLabel,
          lastDate: lastDateStr,
          reminderType,
          pendingLeaves: pending.leaves,
          pendingRegs: pending.regs,
        });
        emailsSent++;
      } catch (err) {
        console.error(`[MONTH_END_REMINDER] Failed to email manager ${mgr.name}: ${err.message}`);
      }
    }
  }

  console.log(
    `[MONTH_END_REMINDER] Done. ${emailsSent} email(s) sent for ${monthLabel} (${reminderType} reminder). ` +
    `Affected employees: ${affectedEmployeeIds.size}`
  );

  return {
    sent: emailsSent,
    reminderType,
    affectedEmployees: affectedEmployeeIds.size,
    month: ym,
  };
}

module.exports = { runMonthEndAttendanceReminder };
