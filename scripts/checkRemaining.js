const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  // COLOR051 - check separation, attendance
  const u051 = await prisma.user.findFirst({ where: { employeeId: 'COLOR051' }, select: { id: true, name: true, dateOfJoining: true, isActive: true, employmentStatus: true } });
  const sep051 = await prisma.separation.findFirst({ where: { userId: u051.id }, select: { lastWorkingDate: true, type: true } });
  const att051 = await prisma.attendance.findMany({ where: { userId: u051.id, date: { startsWith: '2025-05' } }, orderBy: { date: 'asc' } });
  console.log('COLOR051', u051.name, 'joined:', u051.dateOfJoining, 'active:', u051.isActive, 'status:', u051.employmentStatus);
  console.log('  Separation:', sep051);
  console.log('  Attendance:', att051.map(a => `${a.date}=${a.status}`).join(', '));

  // COLOR089 - check salary structure (EOD gross is LESS than Excel)
  const u089 = await prisma.user.findFirst({ where: { employeeId: 'COLOR089' }, select: { id: true, name: true } });
  const sal089 = await prisma.salaryStructure.findUnique({ where: { userId: u089.id }, select: { ctcMonthly: true, basic: true, netPayMonthly: true, components: true } });
  const ps089 = await prisma.payslip.findFirst({ where: { userId: u089.id, month: '2025-05' }, select: { grossEarnings: true, netPay: true, lopDays: true } });
  console.log('\nCOLOR089', u089.name, 'salaryNet:', sal089?.netPayMonthly, 'payslip:', ps089?.grossEarnings, ps089?.netPay, 'lop:', ps089?.lopDays);

  // COLOR163 - find user
  const u163 = await prisma.user.findFirst({ where: { employeeId: 'COLOR163' }, select: { id: true, name: true, employeeId: true, isActive: true } });
  const sal163 = u163 ? await prisma.salaryStructure.findUnique({ where: { userId: u163.id } }) : null;
  console.log('\nCOLOR163:', u163 ? `${u163.name} (id: ${u163.id}) active=${u163.isActive}` : 'NOT FOUND', 'salary:', sal163 ? sal163.ctcMonthly : 'NONE');

  // Summary of what remains to fix
  console.log('\n=== REMAINING FIX SUMMARY ===');
  console.log('1. LOP: Check muster for COLOR090 (EOD=14, XL=17), COLOR145 (13.5, XL=15.5), COLOR154 (4, XL=5), COLOR128 (3, XL=2)');
  console.log('2. Advance/loan deductions: COLOR034 (10000), COLOR121 (4984), COLOR147 (5000)');
  console.log('3. Missing payslip: COLOR163');
  console.log('4. Mid-month pro-rata: COLOR170 (joined May 22)');
  console.log('5. Gross diff (salary structure): COLOR013,085,137,143,153,156,157,158 — XL may use different salary basis');

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
