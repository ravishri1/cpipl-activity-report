const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({ where: { employeeId: 'COLOR089' }, select: { id: true, name: true } });
  const atts = await prisma.attendance.findMany({
    where: { userId: u.id, date: { startsWith: '2025-05' } },
    orderBy: { date: 'asc' },
    select: { date: true, status: true, adminOverride: true },
  });

  // Off-Saturdays for 2nd/4th policy in May 2025: May 10, May 24
  // Sundays in May 2025: May 4, 11, 18, 25
  const offDays = {
    '2025-05-04': 'Sunday',
    '2025-05-10': 'off-Saturday (2nd)',
    '2025-05-11': 'Sunday',
    '2025-05-18': 'Sunday',
    '2025-05-24': 'off-Saturday (4th)',
    '2025-05-25': 'Sunday',
  };

  console.log('COLOR089', u.name);
  console.log('\nOff-day attendance (Sundays + off-Saturdays):');
  for (const [date, label] of Object.entries(offDays)) {
    const a = atts.find(x => x.date === date);
    console.log(` ${date} ${label}: ${a ? a.status : 'NO RECORD'}`);
  }

  console.log('\nAll May attendance records:');
  for (const a of atts) {
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(a.date).getDay()];
    console.log(` ${a.date} ${dow}: ${a.status}${a.adminOverride ? ' [admin]' : ''}`);
  }

  // EOD gross=18650, Excel=21658, diff=3008
  // Daily rate check
  const sal = await prisma.salaryStructure.findUnique({ where: { userId: u.id }, select: { ctcMonthly: true, basic: true } });
  const dailyBasic = sal.basic / 26;
  const dailyGross = 18650 / 26;
  console.log('\nSalary: basic/day (÷26)=', dailyBasic.toFixed(2), '| gross/day (÷26)=', dailyGross.toFixed(2));
  console.log('Diff 3008 ÷ basic/day=', (3008 / dailyBasic).toFixed(1), 'days');
  console.log('Diff 3008 ÷ gross/day=', (3008 / dailyGross).toFixed(1), 'days');

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
