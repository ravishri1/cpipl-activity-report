/**
 * Setup for June and July 2025 payroll:
 * 1. Add salary structure for COLOR171 (Avinash Kadam - joined June 7, 2025)
 * 2. Add salary advances from Excel:
 *    - COLOR057: LOAN 10K x 2 months (June + July)
 *    - COLOR120: SALARY ADVANCE 5K x 2 months (June + July)
 *    - COLOR121: SALARY ADVANCE 5K x 1 month (June only)
 *    - COLOR147: SALARY ADVANCE 5K x 1 month (June only)
 * 3. Check COLOR128, COLOR137, COLOR157 status (not in July Excel)
 * 4. Prepare July salary structure revisions
 */

const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const ADMIN_ID = 1; // Ravi

// July 2025 salary revisions (from July Excel vs June Excel - where basics changed)
const JULY_REVISIONS = [
  // empId, newBasic, newComponents, newNet, ptExempt
  { empId: 'COLOR001', basic: 25000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 25000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 12000 },
    { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 10000 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 5000 },
  ], netPayMonthly: 50000, ctcMonthly: 52000, ctcAnnual: 624000, ptExempt: false, professionalTax: 200 },

  { empId: 'COLOR002', basic: 15000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 5000 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 2000 },
  ], netPayMonthly: 20200, ctcMonthly: 23800, ctcAnnual: 285600, ptExempt: true, professionalTax: 0 },

  { empId: 'COLOR003', basic: 20000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 20000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 8000 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 4000 },
  ], netPayMonthly: 30000, ctcMonthly: 33800, ctcAnnual: 405600, ptExempt: false, professionalTax: 200 },

  { empId: 'COLOR005', basic: 25000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 25000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 12000 },
    { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 10000 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 5000 },
  ], netPayMonthly: 50000, ctcMonthly: 52000, ctcAnnual: 624000, ptExempt: false, professionalTax: 200 },

  { empId: 'COLOR015', basic: 15000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 7742 },
    { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 1935 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 3000 },
  ], netPayMonthly: 25677, ctcMonthly: 29477, ctcAnnual: 353724, ptExempt: false, professionalTax: 200 },

  { empId: 'COLOR155', basic: 15000, components: [
    { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
    { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 5000 },
    { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 2000 },
  ], netPayMonthly: 20200, ctcMonthly: 23800, ctcAnnual: 285600, ptExempt: true, professionalTax: 0 },
];

async function findUser(empId) {
  return prisma.user.findFirst({ where: { employeeId: empId }, select: { id: true, name: true, dateOfJoining: true } });
}

async function addAdvance(empId, totalAmount, repayMonths, startMonth, repayPerMonth) {
  const user = await findUser(empId);
  if (!user) { console.log(`  SKIP: ${empId} not found`); return; }

  // Check if already exists for this start month
  const existing = await prisma.salaryAdvance.findFirst({
    where: { userId: user.id, repaymentStart: startMonth, status: { in: ['repaying', 'released'] } }
  });
  if (existing) {
    console.log(`  SKIP: ${empId} already has advance for ${startMonth}`);
    return;
  }

  const advance = await prisma.salaryAdvance.create({
    data: {
      userId: user.id,
      amount: totalAmount,
      reason: `Salary advance/loan from Excel payroll register`,
      repaymentMonths: repayMonths,
      repaymentStart: startMonth,
      status: 'repaying',
      approvedBy: ADMIN_ID,
      approvedAt: new Date(`${startMonth}-01T00:00:00Z`),
      approvedAmount: totalAmount,
      releasedBy: ADMIN_ID,
      releasedAt: new Date(`${startMonth}-01T00:00:00Z`),
      releaseMode: 'bank_transfer',
    }
  });

  // Create repayment records
  let [yr, mn] = startMonth.split('-').map(Number);
  for (let i = 0; i < repayMonths; i++) {
    const mm = String(mn).padStart(2, '0');
    await prisma.salaryAdvanceRepayment.create({
      data: { advanceId: advance.id, month: `${yr}-${mm}`, amount: repayPerMonth, status: 'pending' }
    });
    mn++; if (mn > 12) { mn = 1; yr++; }
  }
  console.log(`  ADDED: ${empId} advance ${totalAmount} × ${repayMonths} months of ${repayPerMonth} from ${startMonth}`);
}

async function main() {
  console.log('=== STEP 1: Add salary structure for COLOR171 ===');
  const u171 = await findUser('COLOR171');
  if (u171) {
    const existing171 = await prisma.salaryStructure.findUnique({ where: { userId: u171.id } });
    if (!existing171) {
      await prisma.salaryStructure.create({
        data: {
          userId: u171.id,
          ctcAnnual: 272028, ctcMonthly: 22669,
          basic: 13000, hra: 5509,
          employeePf: 1560, professionalTax: 200,
          netPayMonthly: 19349,
          components: [
            { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 13000 },
            { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 5509 },
            { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 2600 },
          ]
        }
      });
      console.log('  ADDED: COLOR171 salary structure (basic=13000, HRA=5509, stat_bonus=2600, net=19349)');
    } else {
      console.log('  EXISTS: COLOR171 already has salary structure');
    }
  } else {
    console.log('  ERROR: COLOR171 not found in DB');
  }

  console.log('\n=== STEP 2: Add salary advances from Excel ===');
  // COLOR057: LOAN 10K x 2 months (June + July)
  await addAdvance('COLOR057', 20000, 2, '2025-06', 10000);
  // COLOR120: SALARY ADVANCE 5K x 2 months (June + July)
  await addAdvance('COLOR120', 10000, 2, '2025-06', 5000);
  // COLOR121: SALARY ADVANCE 5K x 1 month (June only)
  await addAdvance('COLOR121', 5000, 1, '2025-06', 5000);
  // COLOR147: SALARY ADVANCE 5K x 1 month (June only)
  await addAdvance('COLOR147', 5000, 1, '2025-06', 5000);

  console.log('\n=== STEP 3: Check employees missing from July Excel ===');
  for (const empId of ['COLOR128', 'COLOR137', 'COLOR157']) {
    const u = await findUser(empId);
    if (u) {
      const sep = await prisma.separation.findFirst({ where: { userId: u.id }, select: { lastWorkingDay: true, status: true } });
      console.log(`  ${empId}: joined=${u.dateOfJoining}, separation=${sep ? JSON.stringify(sep) : 'NONE'}`);
    }
  }

  console.log('\n=== STEP 4: Preview July salary revisions (run after June payroll) ===');
  for (const rev of JULY_REVISIONS) {
    const u = await findUser(rev.empId);
    if (u) {
      const cur = await prisma.salaryStructure.findUnique({ where: { userId: u.id }, select: { basic: true } });
      console.log(`  ${rev.empId}: current_basic=${cur?.basic} → july_basic=${rev.basic}`);
    }
  }

  await prisma.$disconnect();
  console.log('\nSetup complete. Now run: node scripts/bulkPayroll.js (with PAYROLL_MONTH=2025-06)');
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
