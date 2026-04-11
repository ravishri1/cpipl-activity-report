const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count({
    where: { isActive: true, companyId: 1, dateOfJoining: { lte: '2025-04-30' } },
  });
  console.log(`CPIPL (companyId=1) active employees joined <= Apr 2025: ${count}`);

  const users = await prisma.user.findMany({
    where: { isActive: true, companyId: 1, dateOfJoining: { lte: '2025-04-30' } },
    select: { employeeId: true, name: true, dateOfJoining: true },
    orderBy: { name: 'asc' },
  });
  users.forEach(u => console.log(`  ${u.employeeId} | ${u.name} | joined=${u.dateOfJoining}`));

  // Color Papers employees
  const cp = await prisma.user.findMany({
    where: { companyId: 2 },
    select: { employeeId: true, name: true, companyId: true },
  });
  console.log(`\nColor Papers (companyId=2) employees: ${cp.length}`);
  cp.forEach(u => console.log(`  ${u.employeeId} | ${u.name}`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
