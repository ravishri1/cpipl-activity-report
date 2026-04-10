const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // Jyoti Vasant Naik, id=1, COLOR047
  const userId = 1;
  const del = await p.leaveRequest.deleteMany({
    where: {
      userId,
      startDate: { gte: '2025-04-01' },
      endDate: { lte: '2026-03-31' }
    }
  });
  console.log('Deleted:', del.count, 'leave requests for Jyoti Vasant Naik');
  // Reset used=0 on FY2025 balances
  await p.leaveBalance.updateMany({
    where: { userId, year: 2025 },
    data: { used: 0 }
  });
  console.log('Reset used=0 on all FY2025 leave balances');
}
main().catch(console.error).finally(() => p.$disconnect());
