/**
 * Probation End Date Alert Service
 * Runs daily at 9:00 AM Mon-Sat.
 * Alerts admins / team leads when an active employee's probation period
 * is approaching its end date — at 14 days and 7 days in advance.
 *
 * Milestone windows:
 *   14 days  — early heads-up to prepare evaluation
 *    7 days  — final reminder to confirm or extend employment
 */
const { sendProbationEndAlert } = require('./emailService');

/** Days-before-probationEnd that trigger an alert */
const ALERT_MILESTONES = [14, 7];

/**
 * Build the set of ISO target dates whose probation ends exactly N days from today.
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
 * Main entry point — called by cron at 9:00 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} number of employees whose alert was sent today
 */
async function runProbationEndCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[PROBATION_ALERT] Running probation end check for ${today}`);

  const alertDates = buildAlertDates(today);
  console.log(`[PROBATION_ALERT] Alert milestone dates: ${alertDates.join(', ')}`);

  // Active employees whose probation ends on a milestone date
  const employees = await prisma.user.findMany({
    where: {
      isActive:         true,
      employmentStatus: 'active',
      probationEndDate: { in: alertDates },
    },
    select: {
      id:              true,
      name:            true,
      email:           true,
      department:      true,
      designation:     true,
      employeeId:      true,
      probationEndDate: true,
      dateOfJoining:   true,
    },
    orderBy: [{ probationEndDate: 'asc' }, { name: 'asc' }],
  });

  if (employees.length === 0) {
    console.log('[PROBATION_ALERT] No probation milestones today.');
    return 0;
  }

  // Annotate with daysUntilEnd
  const today_ms = new Date(today).getTime();
  const annotated = employees.map((emp) => {
    const end_ms = new Date(emp.probationEndDate).getTime();
    const daysUntilEnd = Math.round((end_ms - today_ms) / (1000 * 60 * 60 * 24));
    return { ...emp, daysUntilEnd };
  });

  console.log(`[PROBATION_ALERT] Found ${annotated.length} employee(s) at probation milestone today.`);

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendProbationEndAlert(admin.email, admin.name, annotated);
  }

  console.log(`[PROBATION_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} probation milestone(s).`);
  return annotated.length;
}

module.exports = { runProbationEndCheck };
