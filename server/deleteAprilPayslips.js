const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  // Show what will be deleted
  const payslips = await prisma.payslip.findMany({
    where: { month: '2025-04' },
    select: { id: true, userId: true, status: true, user: { select: { name: true, employeeId: true } } },
  });

  console.log(`Found ${payslips.length} April 2025 payslips to delete:`);
  payslips.forEach(p => console.log(`  ${p.user?.employeeId} ${p.user?.name} — status=${p.status}`));

  if (payslips.length === 0) { console.log('Nothing to delete.'); return; }

  const deleted = await prisma.payslip.deleteMany({ where: { month: '2025-04' } });
  console.log(`\nDeleted ${deleted.count} payslips.`);
  console.log('\nNow go to Payroll → April 2025 → click Generate to regenerate with correct data.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
