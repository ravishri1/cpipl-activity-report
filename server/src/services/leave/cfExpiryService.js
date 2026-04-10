/**
 * CF (Carry Forward) 90-Day Expiry Service
 *
 * CF.opening is granted at FY rollover (April 1).
 * It is valid for 90 days only — expires June 30 of the same year.
 * Any CF balance remaining after June 30 → auto-lapsed.
 *
 * Runs nightly via maintenance cron. Idempotent.
 */

/**
 * Returns current FY year in IST (Apr–Mar cycle).
 */
function getCurrentFY() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

async function runCFExpiryCheck(prisma) {
  const todayIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fyYear   = getCurrentFY();
  // CF granted on April 1 of fyYear → expires June 30 of fyYear (90 days)
  const cfExpiry = `${fyYear}-06-30`;

  if (todayIST <= cfExpiry) {
    console.log(`[CF_EXPIRY] Today ${todayIST} ≤ expiry ${cfExpiry} — CF still valid. Skipping.`);
    return { checked: 0, lapsedDays: 0, usersAffected: 0 };
  }

  console.log(`[CF_EXPIRY] CF for FY ${fyYear} expired on ${cfExpiry}. Lapsing remaining balances.`);

  const cfLeaveType = await prisma.leaveType.findFirst({ where: { code: 'CF', isActive: true } });
  if (!cfLeaveType) {
    console.log('[CF_EXPIRY] No active CF leave type found — skipping.');
    return { checked: 0, lapsedDays: 0, usersAffected: 0 };
  }

  // All users with positive CF balance for this FY
  const balances = await prisma.leaveBalance.findMany({
    where: { leaveTypeId: cfLeaveType.id, year: fyYear, balance: { gt: 0 } },
    select: { id: true, userId: true, balance: true, lapsed: true },
  });

  let totalLapsed = 0;
  let usersAffected = 0;

  for (const bal of balances) {
    const lapseAmount = bal.balance;
    await prisma.leaveBalance.update({
      where: { id: bal.id },
      data: {
        balance: 0,
        lapsed: { increment: lapseAmount },
      },
    });
    totalLapsed += lapseAmount;
    usersAffected++;
    console.log(`[CF_EXPIRY] User ${bal.userId}: ${lapseAmount} CF day(s) lapsed.`);
  }

  console.log(
    `[CF_EXPIRY] Done. ${usersAffected}/${balances.length} user(s) affected. ` +
    `Total ${totalLapsed} CF day(s) lapsed.`
  );

  return { checked: balances.length, lapsedDays: totalLapsed, usersAffected };
}

module.exports = { runCFExpiryCheck };
