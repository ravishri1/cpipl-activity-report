/**
 * Add COLOR089 Nishad to OffDayAllowanceEligibility and check current state
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: { employeeId: 'COLOR089' },
    select: { id: true, name: true },
  });
  console.log('COLOR089', u.name, '(id:', u.id + ')');

  // Check existing eligibility
  const existing = await prisma.offDayAllowanceEligibility.findFirst({
    where: { userId: u.id },
  });
  console.log('Existing eligibility:', existing || 'NONE');

  if (!existing) {
    const rec = await prisma.offDayAllowanceEligibility.create({
      data: {
        userId: u.id,
        eligibleFrom: '2025-05-01', // from May 2025
        eligibleTo: null,            // ongoing
      },
    });
    console.log('Created eligibility:', rec);
  } else {
    console.log('Already eligible — no change needed');
  }

  // Show which off-days he worked in May
  const offDates = ['2025-05-04','2025-05-10','2025-05-11','2025-05-18','2025-05-24','2025-05-25'];
  const atts = await prisma.attendance.findMany({
    where: { userId: u.id, date: { in: offDates } },
    select: { date: true, status: true },
  });
  const attMap = Object.fromEntries(atts.map(a => [a.date, a.status]));

  // Check daily reports for off-days
  const reports = await prisma.dailyReport.findMany({
    where: { userId: u.id, reportDate: { in: offDates } },
    select: { reportDate: true },
  });
  const reportDates = new Set(reports.map(r => r.reportDate));

  console.log('\nOff-days in May 2025:');
  let offDaysWorked = 0;
  for (const d of offDates) {
    const status = attMap[d];
    const hasReport = reportDates.has(d);
    const worked = status === 'present' || (!status && hasReport);
    if (worked) offDaysWorked++;
    console.log(` ${d}: status=${status || 'NO RECORD'} report=${hasReport} → ${worked ? 'WORKED' : 'off'}`);
  }

  // Off-day allowance formula: round(gross / daysInMonth * offDaysWorked)
  const grossBase = 18650; // Basic + HRA + Statutory Bonus
  const daysInMonth = 31;
  const allowance = Math.round((grossBase / daysInMonth) * offDaysWorked);
  console.log(`\noffDaysWorked=${offDaysWorked} → offDayAllowance=${allowance}`);
  console.log(`New gross would be: ${grossBase + allowance}`);
  console.log(`Excel expected gross: 21658, diff remaining: ${21658 - (grossBase + allowance)}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
