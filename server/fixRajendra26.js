const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { employeeId: 'COLOR006' },
    select: { id: true, name: true },
  });
  console.log('Fixing:', user.name);

  // Mark Apr 26 as weekend (alternate Saturday off per muster)
  const att = await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date: '2025-04-26' } },
    create: { userId: user.id, date: '2025-04-26', status: 'weekend', adminOverride: true, notes: 'Alternate Saturday off — confirmed by GreytHR muster' },
    update: { status: 'weekend', adminOverride: true, notes: 'Alternate Saturday off — confirmed by GreytHR muster' },
  });
  console.log('Attendance Apr 26 set to:', att.status);

  // Fix payslip: remove 1 LOP day
  const sal = await prisma.salaryStructure.findUnique({
    where: { userId: user.id },
    select: { ctcMonthly: true },
  });
  const perDay = sal.ctcMonthly / 26;
  const lopToRemove = Math.round(perDay * 1);

  const payslip = await prisma.payslip.findUnique({
    where: { userId_month: { userId: user.id, month: '2025-04' } },
    select: { id: true, lopDeduction: true, netPay: true },
  });
  const newLop = 0;
  const newNet = payslip.netPay + lopToRemove;

  await prisma.payslip.update({
    where: { id: payslip.id },
    data: { lopDeduction: newLop, netPay: newNet },
  });

  console.log(`Payslip: lopDeduction ${payslip.lopDeduction} → ${newLop}`);
  console.log(`Payslip: netPay ${payslip.netPay} → ${newNet}`);
  console.log('\nDone. Rajendra Apr 2025: LOP = 0, full salary.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
