/**
 * Pending Approvals Reminder Service
 * Runs daily at 9:15 AM Mon-Sat.
 * Collects all pending LeaveRequests and ExpenseClaims, then sends
 * a single consolidated action-digest email to all admins / team leads.
 *
 * Leave urgency tiers (by days until leave starts):
 *   🔴 Urgent  — starts within 3 days
 *   🟠 Soon    — starts within 7 days
 *   🟡 Normal  — starts later
 *
 * Expense age tiers (by days since submission):
 *   🔴 Overdue — pending > 7 days
 *   🟠 Aging   — pending 4-7 days
 *   🟡 Recent  — pending < 4 days
 */
const { sendPendingApprovalsAlert } = require('./emailService');

/**
 * Days between two ISO date strings.
 */
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

/**
 * Main entry point — called by cron at 9:15 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} total pending items found
 */
async function runPendingApprovalsCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[PENDING_APPROVALS] Running pending approvals check for ${today}`);

  // ── Pending Leave Requests ─────────────────────────────────────────────
  const pendingLeaves = await prisma.leaveRequest.findMany({
    where: { status: 'pending' },
    include: {
      user:      { select: { id: true, name: true, email: true, department: true } },
      leaveType: { select: { name: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  const annotatedLeaves = pendingLeaves.map((lr) => {
    const daysUntilStart = daysBetween(today, lr.startDate);
    const daysPending    = daysBetween(lr.createdAt.toISOString().split('T')[0], today);
    return { ...lr, daysUntilStart, daysPending };
  });

  // ── Pending Expense Claims ─────────────────────────────────────────────
  const pendingExpenses = await prisma.expenseClaim.findMany({
    where: { status: 'pending' },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const annotatedExpenses = pendingExpenses.map((ec) => {
    const daysPending = daysBetween(ec.createdAt.toISOString().split('T')[0], today);
    return { ...ec, daysPending };
  });

  const totalPending = annotatedLeaves.length + annotatedExpenses.length;

  if (totalPending === 0) {
    console.log('[PENDING_APPROVALS] No pending approvals. Nothing to send.');
    return 0;
  }

  console.log(
    `[PENDING_APPROVALS] Found ${annotatedLeaves.length} pending leave(s) and ${annotatedExpenses.length} pending expense(s).`
  );

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendPendingApprovalsAlert(admin.email, admin.name, annotatedLeaves, annotatedExpenses);
  }

  console.log(`[PENDING_APPROVALS] Alerted ${admins.length} admin(s) about ${totalPending} pending item(s).`);
  return totalPending;
}

module.exports = { runPendingApprovalsCheck };
