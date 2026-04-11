const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, shortName: true, isActive: true },
  });
  console.log('=== ALL COMPANIES ===');
  companies.forEach(c => console.log(`  id=${c.id} | ${c.name} | short=${c.shortName} | active=${c.isActive}`));

  const extras = await prisma.user.findMany({
    where: { name: { in: ['Aman Saini', 'Dilip Kumar', 'Lahiri Noopur', 'Rahul Yadav', 'Shashi Pai'] } },
    select: { id: true, name: true, employeeId: true, companyId: true },
  });
  console.log('\n=== EXTRA EMPLOYEES & THEIR COMPANY ===');
  extras.forEach(u => console.log(`  ${u.employeeId} | ${u.name} | companyId=${u.companyId}`));

  // Also show CPIPL employees' companyId sample
  const cpipl = await prisma.user.findFirst({
    where: { employeeId: 'COLOR001' },
    select: { name: true, companyId: true },
  });
  console.log('\n=== CPIPL REFERENCE (COLOR001) ===');
  console.log(`  ${cpipl.name} | companyId=${cpipl.companyId}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
