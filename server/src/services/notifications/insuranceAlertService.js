/**
 * Insurance Card Expiry Alert Service
 * Runs daily at 9:45 AM Mon-Sat.
 * Sends milestone alerts to admins/team_leads when an active employee's
 * insurance card is approaching its effectiveTo expiry date — at 60, 30, 14,
 * and 7 days in advance.
 *
 * Urgency tiers:
 *   🔴 Critical  — expires in ≤ 14 days
 *   🟠 Warning   — expires in 15–30 days
 *   🟡 Upcoming  — expires in 31–60 days
 */
const { sendInsuranceExpiryAlert } = require('./emailService');

const ALERT_MILESTONES = [60, 30, 14, 7];

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
 * Main entry point — called by cron at 9:45 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} count of insurance cards whose alert was sent today
 */
async function runInsuranceExpiryCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[INSURANCE_ALERT] Running insurance expiry check for ${today}`);

  const alertDates = buildAlertDates(today);
  console.log(`[INSURANCE_ALERT] Alert milestone dates: ${alertDates.join(', ')}`);

  // Active insurance cards whose effectiveTo hits a milestone today
  const cards = await prisma.insuranceCard.findMany({
    where: {
      isActive:    true,
      effectiveTo: { in: alertDates },
    },
    include: {
      user: {
        select: {
          id:           true,
          name:         true,
          email:        true,
          department:   true,
          designation:  true,
          employeeId:   true,
        },
      },
    },
    orderBy: { effectiveTo: 'asc' },
  });

  if (cards.length === 0) {
    console.log('[INSURANCE_ALERT] No insurance expiry milestones today.');
    return 0;
  }

  // Annotate with days until expiry
  const today_ms  = new Date(today).getTime();
  const annotated = cards.map((card) => {
    const exp_ms        = new Date(card.effectiveTo).getTime();
    const daysUntilExpiry = Math.round((exp_ms - today_ms) / (1000 * 60 * 60 * 24));
    return { ...card, daysUntilExpiry };
  });

  console.log(`[INSURANCE_ALERT] Found ${annotated.length} insurance expiry milestone(s) today.`);

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendInsuranceExpiryAlert(admin.email, admin.name, annotated);
  }

  console.log(`[INSURANCE_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} insurance expiry milestone(s).`);
  return annotated.length;
}

module.exports = { runInsuranceExpiryCheck };
