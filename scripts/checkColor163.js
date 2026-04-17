const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: { employeeId: 'COLOR163' },
    select: {
      id: true, name: true, employeeId: true, email: true, isActive: true,
      employmentStatus: true, department: true, designation: true,
      dateOfJoining: true, gender: true, employeeType: true,
      location: true, branch: true, role: true,
    },
  });
  console.log('COLOR163:', JSON.stringify(u, null, 2));

  const sal = u ? await prisma.salaryStructure.findUnique({ where: { userId: u.id } }) : null;
  console.log('\nSalary structure:', sal ? JSON.stringify(sal, null, 2) : 'NONE');

  const sep = u ? await prisma.separation.findFirst({ where: { userId: u.id } }) : null;
  console.log('\nSeparation:', sep || 'NONE');

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
