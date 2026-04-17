const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const jun = await prisma.payslip.findMany({
    where: { month: '2025-06', user: { companyId: 1 } },
    select: { id: true, status: true, grossEarnings: true, netPay: true, lopDays: true, presentDays: true,
              user: { select: { employeeId: true, name: true } } },
    orderBy: { user: { employeeId: 'asc' } }
  });
  const jul = await prisma.payslip.findMany({
    where: { month: '2025-07', user: { companyId: 1 } },
    select: { id: true, status: true, grossEarnings: true, netPay: true, lopDays: true, presentDays: true,
              user: { select: { employeeId: true, name: true } } },
    orderBy: { user: { employeeId: 'asc' } }
  });
  console.log('June 2025 payslips:', jun.length);
  console.log('July 2025 payslips:', jul.length);

  const advances = await prisma.salaryAdvance.findMany({
    where: { user: { companyId: 1 } },
    select: { id: true, amount: true, status: true, repaymentMonths: true, repaymentStart: true, reason: true,
              user: { select: { employeeId: true, name: true } },
              repayments: { select: { id: true, month: true, amount: true, status: true, payslipId: true } } },
    orderBy: { user: { employeeId: 'asc' } }
  });
  console.log('\nExisting advances:', advances.length);
  for (const a of advances) {
    console.log(' ', a.user.employeeId, '|', a.user.name, '| amt:', a.amount, '| status:', a.status, '| start:', a.repaymentStart, '| months:', a.repaymentMonths);
    for (const r of a.repayments) {
      console.log('    repayment:', r.month, 'amt:', r.amount, 'status:', r.status, 'payslipId:', r.payslipId);
    }
  }

  // Check salary structures for key employees
  const salStructs = await prisma.salaryStructure.findMany({
    where: { user: { companyId: 1 } },
    select: { userId: true, ctcMonthly: true, basic: true, netPayMonthly: true,
              user: { select: { employeeId: true } } },
    orderBy: { user: { employeeId: 'asc' } }
  });
  console.log('\nSalary structures:', salStructs.length);
  for (const s of salStructs) {
    console.log(' ', s.user.employeeId, '| basic:', s.basic, '| net:', s.netPayMonthly, '| ctc:', s.ctcMonthly);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
