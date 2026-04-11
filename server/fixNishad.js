const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({ where: { name: 'Nishad Sujit' }, select: { id: true, employeeId: true, dateOfJoining: true } });
  console.log('Current:', u.employeeId, u.dateOfJoining);
  await prisma.user.update({ where: { id: u.id }, data: { dateOfJoining: '2022-12-05' } });
  console.log('Updated dateOfJoining → 2022-12-05');

  const count = await prisma.user.count({ where: { isActive: true, companyId: 1, dateOfJoining: { lte: '2025-04-30' } } });
  console.log(`CPIPL count now: ${count} ${count === 49 ? '✅' : '⚠'}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
