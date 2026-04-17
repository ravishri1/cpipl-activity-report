/**
 * Fix May 2025 payslips — delete stale ones and regenerate
 * Prisma-based (no raw SQL). Run from project root:
 *   node scripts/fixMayPayslips.js
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({
  path: path.join(__dirname, '../server/.env'),
});
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const { execSync } = require('child_process');

const prisma = new PrismaClient();
const MONTH = '2025-05';
const COMPANY_ID = 1;

// Employees whose payslips are stale and need regeneration
const AFFECTED_EMP_IDS = [
  'COLOR090', // Abhishek — sandwich for Sundays May 4, May 11 and off-Saturday May 10 now applied
];

async function main() {
  console.log('='.repeat(60));
  console.log('Fix May 2025 Payslips');
  console.log('='.repeat(60));

  // 1. Find user IDs
  const users = await prisma.user.findMany({
    where: { employeeId: { in: AFFECTED_EMP_IDS }, companyId: COMPANY_ID },
    select: { id: true, name: true, employeeId: true },
  });
  console.log(`\nFound ${users.length} of ${AFFECTED_EMP_IDS.length} employees`);

  const userIds = users.map(u => u.id);

  // 2. Check which have payslips (skip published ones)
  const payslips = await prisma.payslip.findMany({
    where: { userId: { in: userIds }, month: MONTH },
    select: { id: true, userId: true, status: true },
  });
  console.log(`\nExisting payslips: ${payslips.length}`);
  const publishedPayslips = payslips.filter(p => p.status === 'published');
  if (publishedPayslips.length > 0) {
    const pubUserIds = publishedPayslips.map(p => p.userId);
    const pubUsers = users.filter(u => pubUserIds.includes(u.id));
    console.log(`SKIPPING published payslips: ${pubUsers.map(u => u.employeeId).join(', ')}`);
  }

  // Unpublish all affected payslips so they can be regenerated
  if (publishedPayslips.length > 0) {
    console.log(`\nUnpublishing ${publishedPayslips.length} payslips for correction...`);
    await prisma.payslip.updateMany({
      where: { id: { in: publishedPayslips.map(p => p.id) } },
      data: { status: 'generated', publishedAt: null },
    });
    console.log('  Unpublished (status → generated)');
  }

  const deletablePayslips = payslips; // now all are unpublished
  const deletableIds = deletablePayslips.map(p => p.id);

  if (deletableIds.length === 0) {
    console.log('No payslips found to fix — they may not have been generated yet.');
  } else {
    // 3. Reset advance repayments before deleting payslips
    console.log(`\nResetting advance repayments for ${deletableIds.length} payslips...`);
    const repayments = await prisma.salaryAdvanceRepayment.findMany({
      where: { payslipId: { in: deletableIds } },
      select: { id: true, advanceId: true },
    });
    if (repayments.length > 0) {
      await prisma.salaryAdvanceRepayment.updateMany({
        where: { id: { in: repayments.map(r => r.id) } },
        data: { status: 'pending', payslipId: null, deductedAt: null },
      });
      const advanceIds = [...new Set(repayments.map(r => r.advanceId))];
      await prisma.salaryAdvance.updateMany({
        where: { id: { in: advanceIds }, status: 'closed' },
        data: { status: 'released', closedAt: null },
      });
      console.log(`  Reset ${repayments.length} advance repayments`);
    }

    // 4. Delete the payslips
    console.log(`\nDeleting ${deletableIds.length} payslips for month ${MONTH}...`);
    const deleted = await prisma.payslip.deleteMany({
      where: { id: { in: deletableIds } },
    });
    console.log(`  Deleted: ${deleted.count}`);
    for (const u of users) {
      const p = deletablePayslips.find(ps => ps.userId === u.id);
      if (p) console.log(`    ${u.employeeId} ${u.name}`);
    }
  }

  await prisma.$disconnect();

  // 5. Regenerate using bulkPayroll.js
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

  console.log('\nDone. Run diagnoseMayLOP.js to verify.');
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
