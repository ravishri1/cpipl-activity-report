const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const p = new PrismaClient();

async function main() {
  const findUser = (empId) => p.user.findFirst({ where: { employeeId: empId }, select: { id: true, name: true, dateOfJoining: true, isActive: true, employmentStatus: true } });

  // Check COLOR057 May payslip
  const u057 = await findUser('COLOR057');
  const ps057 = await p.payslip.findFirst({ where: { userId: u057.id, month: '2025-05' },
    select: { grossEarnings: true, netPay: true, lopDays: true, totalDeductions: true, salaryAdvanceDeduction: true } });
  console.log('COLOR057 May payslip:', JSON.stringify(ps057));

  // Check salary structure components for COLOR001 and COLOR013
  const u001 = await findUser('COLOR001');
  const s001 = await p.salaryStructure.findUnique({ where: { userId: u001.id } });
  console.log('\nCOLOR001 components:', JSON.stringify(s001?.components));
  console.log('COLOR001 basic:', s001?.basic, 'net:', s001?.netPayMonthly, 'ctc:', s001?.ctcMonthly);

  const u013 = await findUser('COLOR013');
  const s013 = await p.salaryStructure.findUnique({ where: { userId: u013.id } });
  console.log('\nCOLOR013 components:', JSON.stringify(s013?.components));
  console.log('COLOR013 basic:', s013?.basic, 'net:', s013?.netPayMonthly);

  // Check COLOR171 and COLOR128
  const u171 = await findUser('COLOR171');
  console.log('\nCOLOR171:', JSON.stringify(u171));
  const s171 = u171 ? await p.salaryStructure.findUnique({ where: { userId: u171.id } }) : null;
  console.log('COLOR171 salary:', s171 ? 'basic=' + s171.basic + ' net=' + s171.netPayMonthly : 'NONE');

  const u128 = await findUser('COLOR128');
  console.log('\nCOLOR128:', JSON.stringify(u128));

  // Check OffDayAllowanceEligibility
  const elig = await p.offDayAllowanceEligibility.findMany({
    include: { user: { select: { employeeId: true, name: true } } }
  });
  console.log('\nOffDayEligibility:', elig.map(e => `${e.user.employeeId} from:${e.eligibleFrom}`).join(', '));

  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); process.exit(1); });
