/**
 * Comp-Off 90-Day Expiry Service
 *
 * Runs daily (maintenance cron). For each employee's comp-off (COF) earn grants:
 * - Uses FIFO: oldest grants consumed by redemptions first
 * - Any remaining unused days in a grant that is >90 days old → lapsed
 * - Updates CompOffRequest.lapsedDays (per grant) + LeaveBalance.lapsed + LeaveBalance.balance
 * - Idempotent: re-running does not double-lapse already-lapsed days
 *
 * 90-day clock starts from reviewedAt (date manager approved the earn request).
 * Lapsed days are tracked on the individual grant so FIFO accounting stays correct
 * across multiple daily runs.
 */

const COF_EXPIRY_DAYS = 90;

/**
 * Returns the current financial year start year (Apr–Mar cycle).
 * e.g. April 2026 → 2026; January 2026 → 2025
 */
function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Main entry point — called by maintenance cron.
 * @param {PrismaClient} prisma
 * @returns {{ checked: number, lapsedDays: number, usersAffected: number }}
 */
async function runCompOffExpiryCheck(prisma) {
  const cofLeaveType = await prisma.leaveType.findFirst({ where: { code: 'COF', isActive: true } });
  if (!cofLeaveType) {
    console.log('[COMPOFF_EXPIRY] No active COF leave type found — skipping.');
    return { checked: 0, lapsedDays: 0, usersAffected: 0 };
  }

  const fyYear = getCurrentFY();
  const today = new Date();
  // Date before which earn approvals are considered expired
  const expiryDate = new Date(today);
  expiryDate.setDate(expiryDate.getDate() - COF_EXPIRY_DAYS);

  console.log(`[COMPOFF_EXPIRY] Checking COF expiry for FY ${fyYear}. Grants approved before ${expiryDate.toISOString().slice(0, 10)} are expired.`);

  // All users with a COF balance this FY
  const balances = await prisma.leaveBalance.findMany({
    where: { leaveTypeId: cofLeaveType.id, year: fyYear },
    select: { id: true, userId: true, balance: true, lapsed: true },
  });

  let totalLapsedDays = 0;
  let usersAffected = 0;

  for (const bal of balances) {
    if (bal.balance <= 0) continue;

    const userId = bal.userId;

    // All approved 'earn' requests, oldest first
    const earnRequests = await prisma.compOffRequest.findMany({
      where: { userId, type: 'earn', status: 'approved' },
      orderBy: { reviewedAt: 'asc' },
    });

    if (earnRequests.length === 0) continue;

    // Total redeemed (all approved redeem requests — lifetime, not FY-scoped)
    const redeemAgg = await prisma.compOffRequest.aggregate({
      where: { userId, type: 'redeem', status: 'approved' },
      _sum: { days: true },
    });
    let remainingRedeemed = redeemAgg._sum.days || 0;

    // FIFO: walk through earn grants, consume redemptions from oldest first
    // For each grant: determine remaining unused days, then check if expired
    let newLapsedThisRun = 0;
    const grantsToUpdate = [];

    for (const earn of earnRequests) {
      const grantDays = earn.days || 1;
      const alreadyLapsed = earn.lapsedDays || 0;
      const effectiveDays = grantDays - alreadyLapsed; // days still potentially available

      // How many of this grant's effective days are consumed by redemptions?
      const consumed = Math.min(remainingRedeemed, effectiveDays);
      remainingRedeemed = Math.max(remainingRedeemed - consumed, 0);
      const remainingUnused = effectiveDays - consumed;

      if (remainingUnused <= 0) continue; // fully consumed — nothing to lapse

      // Is this grant expired?
      const approvalDate = earn.reviewedAt;
      if (!approvalDate) continue;
      if (approvalDate > expiryDate) continue; // still within 90 days — active

      // This grant has expired unused days → lapse them
      newLapsedThisRun += remainingUnused;
      grantsToUpdate.push({ id: earn.id, additionalLapse: remainingUnused });
    }

    if (newLapsedThisRun <= 0) continue;

    // Cap lapse to current balance (safety)
    const actualLapse = Math.min(newLapsedThisRun, bal.balance);
    if (actualLapse <= 0) continue;

    // Update each affected earn grant
    for (const g of grantsToUpdate) {
      await prisma.compOffRequest.update({
        where: { id: g.id },
        data: {
          lapsedDays: { increment: g.additionalLapse },
          lapsedAt: new Date(),
        },
      });
    }

    // Update the balance: decrement available, increment lapsed counter
    await prisma.leaveBalance.update({
      where: { id: bal.id },
      data: {
        balance: { decrement: actualLapse },
        lapsed: { increment: actualLapse },
      },
    });

    totalLapsedDays += actualLapse;
    usersAffected++;

    console.log(`[COMPOFF_EXPIRY] User ${userId}: lapsed ${actualLapse} COF day(s).`);
  }

  console.log(
    `[COMPOFF_EXPIRY] Done. ${usersAffected} user(s) affected. Total ${totalLapsedDays} COF day(s) lapsed.`
  );

  return {
    checked: balances.length,
    lapsedDays: totalLapsedDays,
    usersAffected,
  };
}

module.exports = { runCompOffExpiryCheck, COF_EXPIRY_DAYS };
