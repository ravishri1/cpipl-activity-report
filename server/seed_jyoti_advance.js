/**
 * One-time script: Add salary advance for Jyoti (COLOR047) for April 2025
 * - Creates SalaryAdvance record (status: released, amount: 15000)
 * - Creates SalaryAdvanceRepayment for 2025-04 (amount: 15000, status: pending)
 * - Deletes existing April 2025 payslip for Jyoti
 *
 * After running this script, run regen_payslips_apr2025.js to regenerate the payslip.
 *
 * Usage: node seed_jyoti_advance.js
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const EMPLOYEE_ID = 'COLOR047';
const ADVANCE_AMOUNT = 15000;
const MONTH = '2025-04';

async function main() {
  // Find Jyoti
  const user = await prisma.user.findFirst({
    where: { employeeId: EMPLOYEE_ID },
    select: { id: true, name: true, employeeId: true },
  });
  if (!user) throw new Error(`Employee ${EMPLOYEE_ID} not found`);
  console.log(`Found: ${user.name} (id=${user.id}, employeeId=${user.employeeId})`);

  // Check for existing active advance
  const existingAdvance = await prisma.salaryAdvance.findFirst({
    where: { userId: user.id, status: { in: ['pending', 'approved', 'released', 'repaying'] } },
  });
  if (existingAdvance) {
    console.log(`Existing active advance found (id=${existingAdvance.id}, status=${existingAdvance.status}). Skipping advance creation.`);
  } else {
    // Create the advance in released state (no approval workflow needed — admin direct entry)
    const advance = await prisma.salaryAdvance.create({
      data: {
        userId: user.id,
        amount: ADVANCE_AMOUNT,
        approvedAmount: ADVANCE_AMOUNT,
        reason: 'Salary advance — April 2025 (admin entry)',
        repaymentMonths: 1,
        repaymentStart: MONTH,
        status: 'released',
        approvedBy: 1,          // admin user id
        approvedAt: new Date(),
        releasedBy: 1,
        releasedAt: new Date(),
        releaseMode: 'bank_transfer',
        releaseNote: 'Direct admin entry for April 2025 payslip deduction',
      },
    });
    console.log(`Created SalaryAdvance id=${advance.id}`);

    // Create repayment schedule
    await prisma.salaryAdvanceRepayment.upsert({
      where: { advanceId_month: { advanceId: advance.id, month: MONTH } },
      create: { advanceId: advance.id, month: MONTH, amount: ADVANCE_AMOUNT, status: 'pending' },
      update: {},
    });
    console.log(`Created SalaryAdvanceRepayment for ${MONTH}, amount=₹${ADVANCE_AMOUNT}`);
  }

  // Delete existing April 2025 payslip so regen can recreate it
  const deleted = await prisma.payslip.deleteMany({
    where: { userId: user.id, month: MONTH },
  });
  console.log(`Deleted ${deleted.count} existing payslip(s) for ${MONTH}`);

  console.log(`\nDone! Now run: node regen_payslips_apr2025.js`);
  console.log(`Jyoti's April 2025 payslip will be regenerated with ₹${ADVANCE_AMOUNT} salary advance deduction.`);
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
