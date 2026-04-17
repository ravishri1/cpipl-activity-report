/**
 * Compare all May 2025 payslips — output a clean table with LOP, Gross, Net
 * for manual verification against Excel
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const MONTH = '2025-05';
const COMPANY_ID = 1;

async function main() {
  const payslips = await prisma.payslip.findMany({
    where: { month: MONTH, user: { companyId: COMPANY_ID } },
    select: {
      id: true, grossEarnings: true, netPay: true, lopDays: true,
      presentDays: true, workingDays: true, lopDeduction: true,
      totalDeductions: true, offDayAllowance: true, offDaysWorked: true,
      salaryAdvanceDeduction: true, status: true,
      user: { select: { id: true, name: true, employeeId: true, employmentStatus: true } },
    },
    orderBy: { user: { employeeId: 'asc' } },
  });

  console.log(`\nMay 2025 Payslips — ${payslips.length} total\n`);
  console.log(
    'EmpID'.padEnd(12) +
    'Name'.padEnd(32) +
    'LOP'.padEnd(6) +
    'Present'.padEnd(9) +
    'WD'.padEnd(5) +
    'Gross'.padEnd(10) +
    'LOP Ded'.padEnd(10) +
    'OffDay'.padEnd(8) +
    'AdvDed'.padEnd(8) +
    'TotalDed'.padEnd(10) +
    'Net'.padEnd(10) +
    'Status'
  );
  console.log('-'.repeat(130));

  for (const ps of payslips) {
    const u = ps.user;
    const sep = u.employmentStatus === 'separated' ? ' [SEP]' : '';
    console.log(
      (u.employeeId || '').padEnd(12) +
      (u.name + sep).padEnd(32) +
      String(ps.lopDays ?? 0).padEnd(6) +
      String(ps.presentDays ?? 0).padEnd(9) +
      String(ps.workingDays ?? 0).padEnd(5) +
      String(Math.round(ps.grossEarnings ?? 0)).padEnd(10) +
      String(Math.round(ps.lopDeduction ?? 0)).padEnd(10) +
      String(Math.round(ps.offDayAllowance ?? 0)).padEnd(8) +
      String(Math.round(ps.salaryAdvanceDeduction ?? 0)).padEnd(8) +
      String(Math.round(ps.totalDeductions ?? 0)).padEnd(10) +
      String(Math.round(ps.netPay ?? 0)).padEnd(10) +
      (ps.status || '')
    );
  }

  console.log('-'.repeat(130));
  console.log(`Total payslips: ${payslips.length}`);
  console.log(`Published: ${payslips.filter(p => p.status === 'published').length}`);
  console.log(`Generated (unpublished): ${payslips.filter(p => p.status === 'generated').length}`);

  // Summary of special cases
  const withLop = payslips.filter(p => (p.lopDays ?? 0) > 0);
  const withOffDay = payslips.filter(p => (p.offDayAllowance ?? 0) > 0);
  const withAdvance = payslips.filter(p => (p.salaryAdvanceDeduction ?? 0) > 0);
  const separated = payslips.filter(p => p.user.employmentStatus === 'separated');
  console.log(`\nWith LOP > 0: ${withLop.length}`);
  console.log(`With off-day allowance: ${withOffDay.length} → ${withOffDay.map(p => p.user.employeeId).join(', ')}`);
  console.log(`With advance deduction: ${withAdvance.length} → ${withAdvance.map(p => `${p.user.employeeId}(${Math.round(p.salaryAdvanceDeduction)})`).join(', ')}`);
  console.log(`Separated employees: ${separated.length} → ${separated.map(p => p.user.employeeId).join(', ')}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
