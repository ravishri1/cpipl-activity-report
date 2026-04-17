/**
 * Apply July 2025 salary structure revisions for employees whose pay changed
 * between June and July 2025 per the Excel salary registers.
 */
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const REVISIONS = [
  // COLOR001: basic 89500→25000, full restructuring
  { empId: 'COLOR001', basic: 25000, hra: 12000, otherAllowance: 10000,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 25000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 12000 },
      { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 10000 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 5000 },
    ],
    employeePf: 1800, professionalTax: 200, ptExempt: false,
    netPayMonthly: 50000, ctcMonthly: 52000, ctcAnnual: 624000 },

  // COLOR002: basic 22500→15000, restructured to basic+HRA+stat bonus
  { empId: 'COLOR002', basic: 15000, hra: 5000, otherAllowance: 0,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 5000 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 2000 },
    ],
    employeePf: 1800, professionalTax: 0, ptExempt: true,
    netPayMonthly: 20200, ctcMonthly: 23800, ctcAnnual: 285600 },

  // COLOR003: basic 25000→20000
  { empId: 'COLOR003', basic: 20000, hra: 8000, otherAllowance: 0,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 20000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 8000 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 4000 },
    ],
    employeePf: 1800, professionalTax: 200, ptExempt: false,
    netPayMonthly: 30000, ctcMonthly: 33800, ctcAnnual: 405600 },

  // COLOR005: basic 60000→25000, restructured
  { empId: 'COLOR005', basic: 25000, hra: 12000, otherAllowance: 10000,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 25000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 12000 },
      { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 10000 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 5000 },
    ],
    employeePf: 1800, professionalTax: 200, ptExempt: false,
    netPayMonthly: 50000, ctcMonthly: 52000, ctcAnnual: 624000 },

  // COLOR015: basic 15500→15000, minor revision with different components
  { empId: 'COLOR015', basic: 15000, hra: 7742, otherAllowance: 1935,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 7742 },
      { code: 'OTHER_ALLOWANCE', name: 'Other Allowance', type: 'earning', amount: 1935 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 3000 },
    ],
    employeePf: 1800, professionalTax: 200, ptExempt: false,
    netPayMonthly: 25677, ctcMonthly: 29477, ctcAnnual: 353724 },

  // COLOR155: basic 20628→15000, restructured
  { empId: 'COLOR155', basic: 15000, hra: 5000, otherAllowance: 0,
    components: [
      { code: 'BASIC', name: 'Basic Salary', type: 'earning', amount: 15000 },
      { code: 'HRA', name: 'House Rent Allowance (HRA)', type: 'earning', amount: 5000 },
      { code: 'STATUTORY_BONUS', name: 'Statutory Bonus', type: 'earning', amount: 2000 },
    ],
    employeePf: 1800, professionalTax: 0, ptExempt: true,
    netPayMonthly: 20200, ctcMonthly: 23800, ctcAnnual: 285600 },
];

async function main() {
  for (const rev of REVISIONS) {
    const u = await prisma.user.findFirst({ where: { employeeId: rev.empId }, select: { id: true, name: true } });
    if (!u) { console.log(`SKIP: ${rev.empId} not found`); continue; }
    const cur = await prisma.salaryStructure.findUnique({ where: { userId: u.id }, select: { basic: true } });
    await prisma.salaryStructure.update({
      where: { userId: u.id },
      data: {
        basic: rev.basic,
        hra: rev.hra || 0,
        otherAllowance: rev.otherAllowance || 0,
        da: 0, specialAllowance: 0, medicalAllowance: 0, conveyanceAllowance: 0,
        components: rev.components,
        employeePf: rev.employeePf,
        professionalTax: rev.professionalTax,
        ptExempt: rev.ptExempt,
        netPayMonthly: rev.netPayMonthly,
        ctcMonthly: rev.ctcMonthly,
        ctcAnnual: rev.ctcAnnual,
      }
    });
    console.log(`UPDATED: ${rev.empId} ${u.name} | basic: ${cur?.basic} → ${rev.basic} | net: ${rev.netPayMonthly}`);
  }
  await prisma.$disconnect();
  console.log('\nJuly revisions applied. Now run: PAYROLL_MONTH=2025-07 node scripts/bulkPayroll.js');
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
