const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const eids = ['COLOR034', 'COLOR121', 'COLOR147'];
  for (const eid of eids) {
    const u = await prisma.user.findFirst({ where: { employeeId: eid }, select: { id: true, name: true } });
    const advances = await prisma.salaryAdvance.findMany({
      where: { userId: u.id },
      select: { id: true, amount: true, status: true, reason: true, repaymentMonths: true, repaymentStart: true, repayments: {
        select: { id: true, amount: true, status: true, month: true, payslipId: true }
      }},
    });
    const ps = await prisma.payslip.findFirst({
      where: { userId: u.id, month: '2025-05' },
      select: { id: true, netPay: true, salaryAdvanceDeduction: true, status: true },
    });
    console.log(`\n${eid} ${u.name} (id: ${u.id})`);
    if (advances.length === 0) {
      console.log('  NO advances found!');
    }
    for (const adv of advances) {
      console.log(`  Advance #${adv.id}: amount=${adv.amount} status=${adv.status} reason=${adv.reason}`);
      for (const r of adv.repayments) {
        console.log(`    Repayment #${r.id}: amount=${r.amount} status=${r.status} month=${r.month} payslipId=${r.payslipId}`);
      }
    }
    console.log(`  Payslip May-25: id=${ps?.id} net=${ps?.netPay?.toFixed(0)} advDeduction=${ps?.salaryAdvanceDeduction} status=${ps?.status}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
