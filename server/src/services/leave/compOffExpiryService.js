/**
 * Comp-Off 90-Day Expiry Service
 *
 * Runs daily (maintenance cron). For each employee's comp-off (COF) earn grants
 * within the CURRENT financial year:
 * - Uses FIFO: oldest grants consumed by redemptions first
 * - Remaining unused days in a grant approved >90 days ago → lapsed
 * - Updates CompOffRequest.lapsedDays (per grant) + LeaveBalance.lapsed + LeaveBalance.balance
 * - Idempotent: re-running does not double-lapse already-lapsed days
 *
 * 90-day clock starts from reviewedAt (date manager approved the earn request).
 * Earn/redeem queries are scoped to the CURRENT FY (workDate range) to avoid
 * cross-FY contamination — previous FY comp-offs that carried forward to CF
 * are tracked separately and not double-counted here.
 */

const COF_EXPIRY_DAYS = 90;

/**
 * Returns the current financial year start year (Apr–Mar cycle, IST).
 * April 2026 → 2026; January 2026 → 2025
 */
function getCurrentFY() {
  // Use IST (UTC+5:30) — add 5.5 hours to UTC
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
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
  const fyStart = `${fyYear}-04-01`;
  const fyEnd   = `${fyYear + 1}-03-31`;

  // Date before which earn approvals are considered expired (90 days ago in IST)
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() - COF_EXPIRY_DAYS);
  const expiryDateStr = expiryDate.toISOString().slice(0, 10);

  console.log(
    `[COMPOFF_EXPIRY] FY ${fyYear} (${fyStart}→${fyEnd}). ` +
    `Grants approved before ${expiryDateStr} are expired.`
  );

  // All users with a positive COF balance this FY
  const balances = await prisma.leaveBalance.findMany({
    where: { leaveTypeId: cofLeaveType.id, year: fyYear, balance: { gt: 0 } },
    select: { id: true, userId: true, balance: true, lapsed: true },
  });

  let totalLapsedDays = 0;
  let usersAffected = 0;

  for (const bal of balances) {
    const userId = bal.userId;

    // ── Current FY earn grants only, oldest approval first ──
    const earnRequests = await prisma.compOffRequest.findMany({
      where: {
        userId,
        type: 'earn',
        status: 'approved',
        workDate: { gte: fyStart, lte: fyEnd },
      },
      orderBy: { reviewedAt: 'asc' },
    });

    if (earnRequests.length === 0) continue;

    // ── Total redeemed this FY (FIFO: oldest earn grants consumed first) ──
    const redeemAgg = await prisma.compOffRequest.aggregate({
      where: {
        userId,
        type: 'redeem',
        status: 'approved',
        workDate: { gte: fyStart, lte: fyEnd },
      },
      _sum: { days: true },
    });
    let remainingRedeemed = redeemAgg._sum.days || 0;

    // ── FIFO walk — find expired unused days ──
    const grantsToLapse = []; // [{ id, lapseAmount }]

    for (const earn of earnRequests) {
      const grantDays    = earn.days || 1;
      const alreadyLapsed = earn.lapsedDays || 0;
      const effectiveDays = grantDays - alreadyLapsed; // unlapsed days remaining on this grant

      // Consume redemptions from this grant (oldest first)
      const consumed = Math.min(remainingRedeemed, effectiveDays);
      remainingRedeemed = Math.max(remainingRedeemed - consumed, 0);
      const unused = effectiveDays - consumed;

      if (unused <= 0) continue; // fully consumed — nothing to lapse

      // Check expiry: 90 days from manager's approval date
      const approvalDate = earn.reviewedAt;
      if (!approvalDate) continue;
      const approvalDateStr = approvalDate.toISOString().slice(0, 10);
      if (approvalDateStr > expiryDateStr) continue; // still within 90 days — active

      grantsToLapse.push({ id: earn.id, lapseAmount: unused });
    }

    if (grantsToLapse.length === 0) continue;

    // ── Apply lapse — capped by actual balance, FIFO order ──
    let balanceRemaining = bal.balance;
    let actualLapsed = 0;

    for (const g of grantsToLapse) {
      const amount = Math.min(g.lapseAmount, balanceRemaining);
      if (amount <= 0) break;

      await prisma.compOffRequest.update({
        where: { id: g.id },
        data: { lapsedDays: { increment: amount }, lapsedAt: new Date() },
      });

      balanceRemaining -= amount;
      actualLapsed     += amount;
    }

    if (actualLapsed <= 0) continue;

    await prisma.leaveBalance.update({
      where: { id: bal.id },
      data: {
        balance: { decrement: actualLapsed },
        lapsed:  { increment: actualLapsed },
      },
    });

    totalLapsedDays += actualLapsed;
    usersAffected++;
    console.log(`[COMPOFF_EXPIRY] User ${userId}: ${actualLapsed} COF day(s) lapsed.`);
  }

  console.log(
    `[COMPOFF_EXPIRY] Done. ${usersAffected}/${balances.length} user(s) affected. ` +
    `Total ${totalLapsedDays} COF day(s) lapsed.`
  );

  return { checked: balances.length, lapsedDays: totalLapsedDays, usersAffected };
}

module.exports = { runCompOffExpiryCheck, COF_EXPIRY_DAYS };
