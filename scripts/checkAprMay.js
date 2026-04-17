const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const p = new PrismaClient();

async function main() {
  for (const month of ['2025-04', '2025-05']) {
    const ps = await p.payslip.findMany({
      where: { month, user: { companyId: 1 } },
      select: {
        id: true, status: true, grossEarnings: true, netPay: true, lopDays: true,
        salaryAdvanceDeduction: true, totalDeductions: true,
        user: { select: { employeeId: true, name: true, isActive: true, employmentStatus: true } }
      },
      orderBy: { user: { employeeId: 'asc' } }
    });

    const totalNet = ps.reduce((s, x) => s + (x.netPay || 0), 0);
    console.log(`\n${month}: ${ps.length} payslips | totalNet: ${Math.round(totalNet)}`);
    console.log('EmpID'.padEnd(12) + 'Name'.padEnd(30) + 'Net'.padEnd(10) + 'LOP'.padEnd(6) + 'AdvDed'.padEnd(8) + 'Status'.padEnd(12) + 'empStatus');
    console.log('-'.repeat(95));
    for (const x of ps) {
      console.log(
        x.user.employeeId.padEnd(12) +
        x.user.name.slice(0,28).padEnd(30) +
        String(Math.round(x.netPay||0)).padEnd(10) +
        String(x.lopDays||0).padEnd(6) +
        String(Math.round(x.salaryAdvanceDeduction||0)).padEnd(8) +
        x.status.padEnd(12) +
        x.user.employmentStatus
      );
    }
  }

  // Check which employees have NO April/May payslip
  const users = await p.user.findMany({
    where: { companyId: 1, isActive: true },
    select: { id: true, employeeId: true, name: true, dateOfJoining: true, employmentStatus: true },
    orderBy: { employeeId: 'asc' }
  });
  console.log(`\nTotal active users: ${users.length}`);

  const aprIds = new Set((await p.payslip.findMany({ where: { month: '2025-04', user: { companyId: 1 } }, select: { user: { select: { employeeId: true } } } })).map(x => x.user.employeeId));
  const mayIds = new Set((await p.payslip.findMany({ where: { month: '2025-05', user: { companyId: 1 } }, select: { user: { select: { employeeId: true } } } })).map(x => x.user.employeeId));

  const missing_apr = users.filter(u => !aprIds.has(u.employeeId) && u.dateOfJoining <= '2025-04-30');
  const missing_may = users.filter(u => !mayIds.has(u.employeeId) && u.dateOfJoining <= '2025-05-31');
  console.log(`\nMissing April payslips (${missing_apr.length}):`, missing_apr.map(u => u.employeeId + '(' + u.employmentStatus + ')').join(', '));
  console.log(`Missing May payslips (${missing_may.length}):`, missing_may.map(u => u.employeeId + '(' + u.employmentStatus + ')').join(', '));

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); process.exit(1); });
