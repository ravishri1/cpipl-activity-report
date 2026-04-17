const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  // Check joining dates for mid-month employees
  console.log('=== Mid-month join check ===');
  for (const eid of ['COLOR051', 'COLOR170']) {
    const u = await prisma.user.findFirst({
      where: { employeeId: eid },
      select: { id: true, name: true, employeeId: true, dateOfJoining: true, isActive: true },
    });
    const ps = await prisma.payslip.findFirst({ where: { userId: u.id, month: '2025-05' }, select: { grossEarnings: true, lopDays: true, presentDays: true, workingDays: true } });
    console.log(`${eid} ${u.name}: joined=${u.dateOfJoining} active=${u.isActive} payslip: gross=${ps?.grossEarnings} lop=${ps?.lopDays} present=${ps?.presentDays} wdays=${ps?.workingDays}`);
  }

  // COLOR128 May 14 attendance
  console.log('\n=== COLOR128 May 14 ===');
  const u128 = await prisma.user.findFirst({ where: { employeeId: 'COLOR128' }, select: { id: true } });
  const att128 = await prisma.attendance.findFirst({ where: { userId: u128.id, date: '2025-05-14' } });
  console.log('May 14:', att128?.status, 'override:', att128?.adminOverride, 'remark:', att128?.adminRemark);

  // COLOR090 late May
  console.log('\n=== COLOR090 May 19-31 attendance ===');
  const u090 = await prisma.user.findFirst({ where: { employeeId: 'COLOR090' }, select: { id: true } });
  const atts = await prisma.attendance.findMany({
    where: { userId: u090.id, date: { gte: '2025-05-19', lte: '2025-05-31' } },
    orderBy: { date: 'asc' },
  });
  for (const a of atts) console.log(' ', a.date, a.status, 'override:', a.adminOverride);

  // COLOR145 (Shikha) - check May 10 (off-Saturday) attendance
  console.log('\n=== COLOR145 May 10 attendance ===');
  const u145 = await prisma.user.findFirst({ where: { employeeId: 'COLOR145' }, select: { id: true } });
  const att145_10 = await prisma.attendance.findFirst({ where: { userId: u145.id, date: '2025-05-10' } });
  console.log('May 10:', att145_10 ? att145_10.status : 'NO RECORD');

  // COLOR154 (Aashutosh) - all attendance
  console.log('\n=== COLOR154 May attendance ===');
  const u154 = await prisma.user.findFirst({ where: { employeeId: 'COLOR154' }, select: { id: true } });
  const atts154 = await prisma.attendance.findMany({
    where: { userId: u154.id, date: { startsWith: '2025-05' } },
    orderBy: { date: 'asc' },
  });
  for (const a of atts154) console.log(' ', a.date, a.status);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
