/**
 * Passport Expiry Alert Service
 * Runs daily at 9:30 AM Mon-Sat.
 * Sends milestone alerts to admins/team_leads when an active employee's
 * passport is approaching expiry — at 90, 60, 30, and 14 days in advance.
 *
 * Urgency tiers:
 *   🔴 Critical  — expires in ≤ 14 days
 *   🟠 Warning   — expires in 15–30 days
 *   🟡 Upcoming  — expires in 31–90 days
 */
const { sendPassportExpiryAlert } = require('./emailService');

const ALERT_MILESTONES = [90, 60, 30, 14];

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
 * Main entry point — called by cron at 9:30 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} count of employees whose passport alert was sent today
 */
async function runPassportExpiryCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[PASSPORT_ALERT] Running passport expiry check for ${today}`);

  const alertDates = buildAlertDates(today);
  console.log(`[PASSPORT_ALERT] Alert milestone dates: ${alertDates.join(', ')}`);

  // Active employees whose passport hits a milestone today
  const employees = await prisma.user.findMany({
    where: {
      isActive:         true,
      employmentStatus: { notIn: ['separated', 'terminated', 'absconding'] },
      passportExpiry:   { in: alertDates },
    },
    select: {
      id:             true,
      name:           true,
      email:          true,
      department:     true,
      designation:    true,
      employeeId:     true,
      passportNumber: true,
      passportExpiry: true,
      nationality:    true,
    },
    orderBy: { passportExpiry: 'asc' },
  });

  if (employees.length === 0) {
    console.log('[PASSPORT_ALERT] No passport expiry milestones today.');
    return 0;
  }

  // Annotate with days until expiry
  const today_ms  = new Date(today).getTime();
  const annotated = employees.map((emp) => {
    const exp_ms      = new Date(emp.passportExpiry).getTime();
    const daysUntilExpiry = Math.round((exp_ms - today_ms) / (1000 * 60 * 60 * 24));
    return { ...emp, daysUntilExpiry };
  });

  console.log(`[PASSPORT_ALERT] Found ${annotated.length} passport milestone(s) today.`);

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendPassportExpiryAlert(admin.email, admin.name, annotated);
  }

  console.log(`[PASSPORT_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} passport milestone(s).`);
  return annotated.length;
}

module.exports = { runPassportExpiryCheck };
