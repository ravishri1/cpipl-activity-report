const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const users = await p.user.findMany({
    where: { name: { contains: 'Jyoti' } },
    select: { id: true, name: true, employeeId: true }
  });
  console.log('Jyoti users:', JSON.stringify(users, null, 2));

  for (const u of users) {
    const count = await p.leaveRequest.count({
      where: { userId: u.id, startDate: { gte: '2025-04-01' } }
    });
    console.log(`  ${u.name} (id=${u.id}): ${count} leave requests in FY2025`);
  }
}
main().catch(console.error).finally(() => p.$disconnect());
