const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({ where: { employeeId: 'COLOR089' }, select: { id: true, name: true } });

  const sal = await prisma.salaryStructure.findUnique({
    where: { userId: u.id },
    select: { ctcMonthly: true, basic: true, hra: true, netPayMonthly: true, components: true },
  });

  const ps = await prisma.payslip.findFirst({
    where: { userId: u.id, month: '2025-05' },
    select: {
      grossEarnings: true, netPay: true, lopDays: true, presentDays: true, workingDays: true,
      offDayAllowance: true, offDaysWorked: true, weeklyOffAllowance: true, weeklyOffDays: true,
      otherAdditions: true, otherAdditionsLabel: true, earningsBreakdown: true,
      totalDeductions: true, employeePf: true, employeeEsi: true, professionalTax: true,
    },
  });

  console.log('COLOR089', u.name);
  console.log('Salary structure: CTC=', sal?.ctcMonthly, 'basic=', sal?.basic, 'hra=', sal?.hra, 'netMonthly=', sal?.netPayMonthly);
  console.log('Components:', JSON.stringify(sal?.components, null, 2));
  console.log('\nPayslip May-25:');
  console.log('  Gross:', ps?.grossEarnings, '| Net:', ps?.netPay);
  console.log('  LOP:', ps?.lopDays, '| Present:', ps?.presentDays, '| WorkingDays:', ps?.workingDays);
  console.log('  offDayAllowance:', ps?.offDayAllowance, '| offDaysWorked:', ps?.offDaysWorked);
  console.log('  weeklyOffAllowance:', ps?.weeklyOffAllowance, '| weeklyOffDays:', ps?.weeklyOffDays);
  console.log('  otherAdditions:', ps?.otherAdditions, '(', ps?.otherAdditionsLabel, ')');
  console.log('  earningsBreakdown:', JSON.stringify(ps?.earningsBreakdown, null, 2));
  console.log('  totalDeductions:', ps?.totalDeductions, '| PF:', ps?.employeePf, '| ESI:', ps?.employeeEsi, '| PT:', ps?.professionalTax);

  // Excel shows gross=21658 vs EOD gross=18650, diff=3008
  console.log('\nDiff from Excel gross (21658 - 18650):', 21658 - 18650);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
