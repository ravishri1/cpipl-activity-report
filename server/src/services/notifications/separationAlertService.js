/**
 * Separation Last Working Day Alert Service
 * Runs daily at 10:30 AM Mon-Sat.
 * Sends milestone alerts to admins/team_leads when an employee's
 * last working date is approaching — at 7, 3, and 1 day(s) in advance.
 *
 * Urgency tiers:
 *   🔴 Critical  — 1 day away (tomorrow is last day)
 *   🟠 Warning   — 2–3 days away
 *   🟡 Upcoming  — 4–7 days away
 *
 * Only processes separations with status: notice_period | initiated
 * (i.e., employee still active, FnF not yet started)
 */
const { sendSeparationAlert } = require('./emailService');

const ALERT_MILESTONES = [7, 3, 1];

/**
 * Build ISO target dates for each milestone (today + N days).
 * @param {string} today  "YYYY-MM-DD"
 * @returns {string[]}
 */
function buildAlertDates(today) {
  return ALERT_MILESTONES.map((days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  });
}

/**
 * Main entry point — called by cron at 10:30 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} count of separations whose last-day alert was sent today
 */
async function runSeparationAlert(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[SEPARATION_ALERT] Running separation alert check for ${today}`);

  const alertDates = buildAlertDates(today);
  console.log(`[SEPARATION_ALERT] Alert milestone dates: ${alertDates.join(', ')}`);

  // Active separations whose lastWorkingDate hits a milestone today
  const separations = await prisma.separation.findMany({
    where: {
      status:          { in: ['initiated', 'notice_period'] },
      lastWorkingDate: { in: alertDates },
    },
    include: {
      user: {
        select: {
          id:          true,
          name:        true,
          email:       true,
          department:  true,
          designation: true,
          employeeId:  true,
        },
      },
    },
    orderBy: { lastWorkingDate: 'asc' },
  });

  if (separations.length === 0) {
    console.log('[SEPARATION_ALERT] No last-working-day milestones today.');
    return 0;
  }

  // Annotate with daysUntilLastDay
  const today_ms  = new Date(today).getTime();
  const annotated = separations.map((sep) => {
    const lwd_ms         = new Date(sep.lastWorkingDate).getTime();
    const daysUntilLastDay = Math.round((lwd_ms - today_ms) / (1000 * 60 * 60 * 24));
    return { ...sep, daysUntilLastDay };
  });

  console.log(`[SEPARATION_ALERT] Found ${annotated.length} last-working-day milestone(s) today.`);

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendSeparationAlert(admin.email, admin.name, annotated);
  }

  console.log(
    `[SEPARATION_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} last-working-day milestone(s).`
  );
  return annotated.length;
}

module.exports = { runSeparationAlert };
