/**
 * Generate May 2025 payslip for COLOR163 Sagar Stavarmath
 * Joined May 6 → mid-month joiner pro-rata applies
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { execSync } = require('child_process');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findFirst({
    where: { employeeId: 'COLOR163' },
    select: { id: true, name: true, employeeId: true, dateOfJoining: true, isActive: true, employmentStatus: true },
  });
  console.log('COLOR163', u.name, '| joined:', u.dateOfJoining, '| status:', u.employmentStatus, '| active:', u.isActive);

  const sal = await prisma.salaryStructure.findUnique({
    where: { userId: u.id },
    select: { ctcMonthly: true, basic: true, components: true, netPayMonthly: true },
  });
  console.log('Salary: CTC=', sal?.ctcMonthly, 'basic=', sal?.basic, 'net=', sal?.netPayMonthly);

  // Check if payslip already exists
  const existing = await prisma.payslip.findFirst({ where: { userId: u.id, month: '2025-05' } });
  if (existing) {
    console.log('Payslip already exists! id=' + existing.id + ' status=' + existing.status);
    await prisma.$disconnect();
    return;
  }

  await prisma.$disconnect();

  // Run bulkPayroll for just this employee's company/month
  console.log('\nRunning bulkPayroll...');
  const env = { ...process.env, PAYROLL_MONTH: '2025-05', PAYROLL_COMPANY: '1' };
  const output = execSync('node scripts/bulkPayroll.js', {
    cwd: path.join(__dirname, '..'),
    env,
    timeout: 120000,
    encoding: 'utf-8',
  });
  console.log(output);

  // Verify result
  const p2 = new PrismaClient();
  const ps = await p2.payslip.findFirst({
    where: { userId: u.id, month: '2025-05' },
    select: { id: true, grossEarnings: true, netPay: true, lopDays: true, presentDays: true, workingDays: true },
  });
  if (ps) {
    console.log('Generated payslip:', JSON.stringify(ps));
  } else {
    console.log('ERROR: payslip was NOT generated — check if salary structure stopSalaryProcessing=true or employee is skipped');
  }
  await p2.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
