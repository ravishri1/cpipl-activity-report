/**
 * Warranty Expiry Alert Service
 * Runs daily and sends email alerts at key milestones:
 *   30, 14, 7, and 1 day(s) before an asset's warrantyExpiry date.
 * Emails are sent to all active admins and team leads.
 */
const { sendWarrantyExpiryAlert } = require('./emailService');

/** Milestone windows (days before expiry) that trigger an alert */
const ALERT_MILESTONES = [30, 14, 7, 1];

/**
 * Build the set of "target" ISO dates that should trigger alerts today.
 * @param {string} today  "YYYY-MM-DD"
 * @returns {string[]}    array of ISO date strings (one per milestone)
 */
function buildAlertDates(today) {
  return ALERT_MILESTONES.map((days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  });
}

/**
 * Main entry point — called by cron at 8:30 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} count of assets whose alerts were sent today
 */
async function runWarrantyExpiryCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[WARRANTY_ALERT] Running warranty expiry check for ${today}`);

  const alertDates = buildAlertDates(today);
  console.log(`[WARRANTY_ALERT] Alert milestone dates: ${alertDates.join(', ')}`);

  // Find assets with a warrantyExpiry that falls on any milestone date
  const expiringAssets = await prisma.asset.findMany({
    where: {
      warrantyExpiry: { in: alertDates },
      status: { notIn: ['retired', 'lost'] },
    },
    include: {
      handovers: {
        where: { toUserId: { not: null } },
        orderBy: { handoverDate: 'desc' },
        take: 1,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { warrantyExpiry: 'asc' },
  });

  if (expiringAssets.length === 0) {
    console.log('[WARRANTY_ALERT] No warranty expiry milestones today.');
    return 0;
  }

  // Annotate each asset with daysUntilExpiry
  const today_ms = new Date(today).getTime();
  const annotated = expiringAssets.map((asset) => {
    const expiry_ms = new Date(asset.warrantyExpiry).getTime();
    const daysUntil = Math.round((expiry_ms - today_ms) / (1000 * 60 * 60 * 24));
    const currentHolder = asset.handovers[0]?.user ?? null;
    return { ...asset, daysUntilExpiry: daysUntil, currentHolder };
  });

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendWarrantyExpiryAlert(admin.email, admin.name, annotated);
  }

  console.log(
    `[WARRANTY_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} expiring warranty asset(s).`
  );
  return annotated.length;
}

module.exports = { runWarrantyExpiryCheck };
