/**
 * Fix Nishad (COLOR089) May 2025 payslip:
 * 1. Add May 11 (Sunday) attendance as present — biometric sandwich + muster
 * 2. Regenerate payslip so off-day allowance is calculated (5 off-days × 18650/31 = 3008)
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { execSync } = require('child_process');
const prisma = new PrismaClient();

const MONTH = '2025-05';
const COMPANY_ID = 1;

async function main() {
  const u = await prisma.user.findFirst({
    where: { employeeId: 'COLOR089', companyId: COMPANY_ID },
    select: { id: true, name: true },
  });
  console.log('COLOR089', u.name);

  // 1. Add May 11 (Sunday) as present
  const may11 = await prisma.attendance.findFirst({ where: { userId: u.id, date: '2025-05-11' } });
  if (!may11) {
    await prisma.attendance.create({
      data: {
        userId: u.id,
        date: '2025-05-11',
        status: 'present',
        adminOverride: true,
        adminRemark: 'Worked on Sunday — off-day allowance applicable per muster',
      },
    });
    console.log('Created May 11 attendance: present');
  } else {
    console.log('May 11 already exists:', may11.status);
  }

  // 2. Delete current payslip
  const ps = await prisma.payslip.findFirst({ where: { userId: u.id, month: MONTH }, select: { id: true, status: true } });
  if (ps) {
    if (ps.status === 'published') {
      await prisma.payslip.update({ where: { id: ps.id }, data: { status: 'generated', publishedAt: null } });
    }
    await prisma.payslip.delete({ where: { id: ps.id } });
    console.log('Deleted payslip #' + ps.id);
  }

  await prisma.$disconnect();

  // 3. Regenerate
  console.log('\nRegenerating...');
  const env = { ...process.env, PAYROLL_MONTH: MONTH, PAYROLL_COMPANY: String(COMPANY_ID) };
  const output = execSync('node scripts/bulkPayroll.js', {
    cwd: path.join(__dirname, '..'),
    env,
    timeout: 120000,
    encoding: 'utf-8',
  });
  console.log(output);
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
