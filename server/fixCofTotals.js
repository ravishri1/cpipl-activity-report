const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// COF leave type id = 9
const COF_LT_ID = 9;
const YEAR = 2025;

async function main() {
  // Get all active users
  const users = await p.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employeeId: true }
  });

  // Get all COF balances for FY2025 in one query
  const cofBals = await p.leaveBalance.findMany({
    where: { leaveTypeId: COF_LT_ID, year: YEAR }
  });
  const cofBalMap = {};
  for (const b of cofBals) cofBalMap[b.userId] = b;

  // Get all COF leave requests for FY2025 in one query
  const cofUsedAgg = await p.leaveRequest.groupBy({
    by: ['userId'],
    where: {
      leaveTypeId: COF_LT_ID,
      status: 'approved',
      startDate: { gte: '2025-04-01' },
      endDate:   { lte: '2026-03-31' }
    },
    _sum: { days: true }
  });
  const cofUsedMap = {};
  for (const r of cofUsedAgg) cofUsedMap[r.userId] = r._sum.days || 0;

  const updates = [];
  let fixed = 0;

  for (const user of users) {
    const bal = cofBalMap[user.id];
    const cofUsed = cofUsedMap[user.id] || 0;
    if (!bal || cofUsed === 0) continue;

    const cofOpening = bal.opening || 0;
    // Minimum total needed = max(0, cofUsed - cofOpening)
    // so that opening + total >= used → available >= 0
    const minTotal = Math.max(0, cofUsed - cofOpening);

    if ((bal.total || 0) < minTotal) {
      updates.push({ id: bal.id, total: minTotal, userId: user.id, name: user.name, empId: user.employeeId, cofUsed, cofOpening, minTotal });
    }
  }

  console.log(`Fixing ${updates.length} COF balances where total < required...`);
  await Promise.all(updates.map(u =>
    p.leaveBalance.update({ where: { id: u.id }, data: { total: u.total } })
  ));

  for (const u of updates) {
    const avail = u.cofOpening + u.minTotal - u.cofUsed;
    console.log(`  ${u.empId} ${u.name}: opening=${u.cofOpening} total=${u.minTotal} used=${u.cofUsed} available=${avail}`);
    fixed++;
  }

  console.log(`\nDone — fixed ${fixed} employees`);
}

main().catch(console.error).finally(() => p.$disconnect());
