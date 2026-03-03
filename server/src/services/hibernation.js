/**
 * Auto-Hibernation Service
 *
 * Security feature: If an employee has no system activity for 3 consecutive
 * calendar days (excluding approved leave days and company holidays),
 * their account is automatically hibernated. Only HR/admin can reactivate.
 *
 * Admins (role=admin) are NEVER auto-hibernated.
 */

const INACTIVITY_THRESHOLD_DAYS = 7;
const CHECK_WINDOW_DAYS = INACTIVITY_THRESHOLD_DAYS + 30; // wider window for leave/holiday buffer

/**
 * Generate YYYY-MM-DD string from a Date object.
 */
function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate an array of date strings going backwards from yesterday.
 * @param {number} days - How many days back to generate
 * @returns {string[]} Array of "YYYY-MM-DD" strings, most recent first
 */
function getRecentDateStrings(days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(toDateStr(d));
  }
  return dates;
}

/**
 * Build a Set of all dates covered by a user's approved leave requests.
 */
function buildLeaveDaysSet(leaves) {
  const set = new Set();
  for (const leave of leaves) {
    const start = new Date(leave.startDate + 'T00:00:00');
    const end = new Date(leave.endDate + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(toDateStr(d));
    }
  }
  return set;
}

/**
 * Main hibernation check — called by cron daily.
 *
 * Algorithm:
 * 1. Find all eligible users (active, not hibernated, not admin)
 * 2. Get holidays and approved leaves in the check window
 * 3. For each user, count consecutive inactive days (excluding leave & holidays)
 * 4. If 3+ inactive days → hibernate the user
 * 5. Notify admins about hibernated accounts
 */
async function runHibernationCheck(prisma) {
  const windowDates = getRecentDateStrings(CHECK_WINDOW_DAYS);
  const oldestDate = windowDates[windowDates.length - 1];
  const newestDate = windowDates[0];

  // ── Get holidays in the check window ──
  const holidays = await prisma.holiday.findMany({
    where: { date: { in: windowDates } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map(h => h.date));

  // ── Find eligible users ──
  // Admins are exempt. Separated/terminated/absconding already handled elsewhere.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      isHibernated: false,
      role: { not: 'admin' },
      employmentStatus: { in: ['active', 'notice_period'] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      lastActivityAt: true,
    },
  });

  if (users.length === 0) {
    console.log('[CRON] Hibernation check: no eligible users to evaluate.');
    return 0;
  }

  const userIds = users.map(u => u.id);

  // ── Get approved leaves overlapping the check window ──
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: 'approved',
      endDate: { gte: oldestDate },   // leave ends on/after oldest window date
      startDate: { lte: newestDate }, // leave starts on/before newest window date
    },
    select: { userId: true, startDate: true, endDate: true },
  });

  // Build per-user leave day sets
  const userLeaveMap = {};
  for (const leave of approvedLeaves) {
    if (!userLeaveMap[leave.userId]) userLeaveMap[leave.userId] = [];
    userLeaveMap[leave.userId].push(leave);
  }

  // ── Evaluate each user ──
  const toHibernate = [];

  for (const user of users) {
    const lastActivity = user.lastActivityAt ? new Date(user.lastActivityAt) : null;
    const userLeaveDays = userLeaveMap[user.id]
      ? buildLeaveDaysSet(userLeaveMap[user.id])
      : new Set();

    // Count consecutive inactive days (from yesterday backwards)
    // Stop counting when we hit a day the user was active
    let inactiveDays = 0;

    for (const dateStr of windowDates) {
      const dateObj = new Date(dateStr + 'T00:00:00');

      // Skip holidays — don't count against the user
      if (holidaySet.has(dateStr)) continue;

      // Skip approved leave days — don't count against the user
      if (userLeaveDays.has(dateStr)) continue;

      // If user was active on or after this date, stop counting
      if (lastActivity && lastActivity >= dateObj) break;

      inactiveDays++;

      if (inactiveDays >= INACTIVITY_THRESHOLD_DAYS) {
        toHibernate.push(user);
        break;
      }
    }
  }

  // ── Hibernate identified users ──
  if (toHibernate.length > 0) {
    const hibernateIds = toHibernate.map(u => u.id);

    await prisma.user.updateMany({
      where: { id: { in: hibernateIds } },
      data: { isHibernated: true },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      try {
        const { notifyUsers } = require('../utils/notify');
        const names = toHibernate.map(u => u.name).join(', ');
        await notifyUsers(prisma, {
          userIds: admins.map(a => a.id),
          type: 'security',
          title: `${toHibernate.length} account(s) auto-hibernated`,
          message: `Hibernated due to ${INACTIVITY_THRESHOLD_DAYS}+ days of inactivity: ${names}`,
          link: '/admin/team',
        });
      } catch (notifyErr) {
        console.error('[CRON] Failed to notify admins about hibernation:', notifyErr.message);
      }
    }

    console.log(`[CRON] Hibernated ${toHibernate.length} users: ${toHibernate.map(u => u.email).join(', ')}`);
  } else {
    console.log('[CRON] Hibernation check: no users to hibernate.');
  }

  return toHibernate.length;
}

module.exports = { runHibernationCheck, INACTIVITY_THRESHOLD_DAYS };
