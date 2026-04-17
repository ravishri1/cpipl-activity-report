/**
 * Fix May 2025 payslips where advance repayments were linked to old payslip IDs.
 * Re-opens the repayments, deletes the stale payslips, regenerates.
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { execSync } = require('child_process');

const prisma = new PrismaClient();
const MONTH = '2025-05';
const COMPANY_ID = 1;

// Advances are linked to old payslip IDs — reset & regenerate
const AFFECTED_EMP_IDS = ['COLOR034', 'COLOR121', 'COLOR147'];

async function main() {
  console.log('='.repeat(60));
  console.log('Fix Advance Links — May 2025');
  console.log('='.repeat(60));

  const users = await prisma.user.findMany({
    where: { employeeId: { in: AFFECTED_EMP_IDS }, companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  console.log(`\nFound ${users.length} of ${AFFECTED_EMP_IDS.length} employees`);

  for (const user of users) {
    console.log(`\n── ${user.employeeId} ${user.name} ──`);

    // 1. Find ALL May 2025 repayments for this user (regardless of payslipId)
    const repayments = await prisma.salaryAdvanceRepayment.findMany({
      where: { month: MONTH, advance: { userId: user.id } },
      select: { id: true, advanceId: true, amount: true, status: true, payslipId: true },
    });
    console.log(`  Repayments for ${MONTH}: ${repayments.length}`);
    for (const r of repayments) {
      console.log(`    #${r.id} amount=${r.amount} status=${r.status} payslipId=${r.payslipId}`);
    }

    // 2. Reset repayments to pending
    if (repayments.length > 0) {
      await prisma.salaryAdvanceRepayment.updateMany({
        where: { id: { in: repayments.map(r => r.id) } },
        data: { status: 'pending', payslipId: null, deductedAt: null },
      });
      console.log(`  Reset ${repayments.length} repayment(s) to pending`);

      // 3. Re-open closed advances so bulkPayroll picks them up
      const advanceIds = [...new Set(repayments.map(r => r.advanceId))];
      await prisma.salaryAdvance.updateMany({
        where: { id: { in: advanceIds }, status: 'closed' },
        data: { status: 'repaying', closedAt: null },
      });
      console.log(`  Re-opened ${advanceIds.length} advance(s) to 'repaying'`);
    }

    // 4. Find and delete current payslip (may be published)
    const payslip = await prisma.payslip.findFirst({
      where: { userId: user.id, month: MONTH },
      select: { id: true, status: true },
    });
    if (payslip) {
      // Unpublish first if needed
      if (payslip.status === 'published') {
        await prisma.payslip.update({ where: { id: payslip.id }, data: { status: 'generated', publishedAt: null } });
        console.log(`  Unpublished payslip #${payslip.id}`);
      }
      await prisma.payslip.delete({ where: { id: payslip.id } });
      console.log(`  Deleted payslip #${payslip.id}`);
    } else {
      console.log(`  No payslip found for ${MONTH} — will generate fresh`);
    }
  }

  await prisma.$disconnect();

  // 5. Regenerate
  console.log(`\nRegenerating May 2025 payslips...`);
  const env = { ...process.env, PAYROLL_MONTH: MONTH, PAYROLL_COMPANY: String(COMPANY_ID) };
  try {
    const output = execSync('node scripts/bulkPayroll.js', {
      cwd: path.join(__dirname, '..'),
      env,
      timeout: 120000,
      encoding: 'utf-8',
    });
    console.log(output);
  } catch (e) {
    console.error('bulkPayroll error:', e.stdout || e.message);
  }

  console.log('Done. Verify with checkAdvances.js');
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
