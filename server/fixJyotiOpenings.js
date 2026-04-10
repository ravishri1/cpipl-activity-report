const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const userId = 1; // Jyoti Vasant Naik
  const year = 2025;

  // CF (leaveTypeId=10): opening=4 (PL carry from FY2024), total=0
  const cfUpd = await p.leaveBalance.updateMany({
    where: { userId, leaveTypeId: 10, year },
    data: { opening: 4, total: 0, used: 0, balance: 4 }
  });
  console.log('CF updated:', cfUpd.count, '→ opening=4, total=0');

  // COF (leaveTypeId=9): opening=0.5 (COF carry from FY2024), total=7 (new comp-off this FY)
  const cofUpd = await p.leaveBalance.updateMany({
    where: { userId, leaveTypeId: 9, year },
    data: { opening: 0.5, total: 7, used: 0, balance: 7.5 }
  });
  console.log('COF updated:', cofUpd.count, '→ opening=0.5, total=7');

  // PL (leaveTypeId=7): opening=0 always, total=12 (defaultBalance, bucket system)
  const plUpd = await p.leaveBalance.updateMany({
    where: { userId, leaveTypeId: 7, year },
    data: { opening: 0, total: 12, used: 0, balance: 12 }
  });
  console.log('PL updated:', plUpd.count, '→ opening=0, total=12');

  // Verify
  const bals = await p.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: { select: { code: true, name: true } } },
    orderBy: { leaveTypeId: 'asc' }
  });
  console.log('\nFinal FY2025 balances for Jyoti:');
  for (const b of bals) {
    console.log(`  ${b.leaveType.code}: opening=${b.opening} total=${b.total} used=${b.used} balance=${b.balance}`);
  }
}
main().catch(console.error).finally(() => p.$disconnect());
