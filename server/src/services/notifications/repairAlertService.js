/**
 * Overdue Repair Alert Service
 * Finds active AssetRepairs past their expectedReturnDate,
 * updates daysOverdue, and emails all admins/team leads.
 */
const { sendOverdueRepairAlert } = require('./emailService');

/**
 * Main entry point — called by cron at 9:00 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} count of overdue repairs found
 */
async function runOverdueRepairCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[REPAIR_ALERT] Running overdue repair check for ${today}`);

  // All active repairs (not yet completed or cancelled)
  const activeRepairs = await prisma.assetRepair.findMany({
    where: {
      status: { notIn: ['completed', 'cancelled'] },
    },
    include: {
      asset: { select: { id: true, name: true, assetTag: true, type: true } },
      initiator: { select: { id: true, name: true, email: true } },
    },
  });

  // Keep only those past expectedReturnDate
  const overdueRepairs = activeRepairs.filter(
    (r) => r.expectedReturnDate && r.expectedReturnDate < today
  );

  if (overdueRepairs.length === 0) {
    console.log('[REPAIR_ALERT] No overdue repairs found.');
    return 0;
  }

  // Recalculate daysOverdue and persist to DB
  const todayDate = new Date(today);
  for (const repair of overdueRepairs) {
    const expected  = new Date(repair.expectedReturnDate);
    const diffMs    = todayDate - expected;
    const days      = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    repair.daysOverdue = days;

    await prisma.assetRepair.update({
      where: { id: repair.id },
      data:  { daysOverdue: days },
    });
  }

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendOverdueRepairAlert(admin.email, admin.name, overdueRepairs);
  }

  console.log(
    `[REPAIR_ALERT] Alerted ${admins.length} admin(s) about ${overdueRepairs.length} overdue repair(s).`
  );
  return overdueRepairs.length;
}

module.exports = { runOverdueRepairCheck };
