// Seed standard Indian payroll salary components
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const components = [
  // ── EARNINGS ──────────────────────────────────────────────────────────────
  {
    name: 'Basic Salary', code: 'BASIC', type: 'earning',
    taxable: true, mandatory: true,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Core salary component. Basis for PF, HRA, Gratuity calculations.',
    complianceNote: 'Minimum wages as per state. Basis for PF deduction (12% employee + 12% employer).',
    sortOrder: 1, isSystem: true,
  },
  {
    name: 'House Rent Allowance', code: 'HRA', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'percentage', percentageOf: 'basic', defaultPercentage: 40,
    description: 'HRA paid to employees. Partially exempt u/s 10(13A) for rent-paying employees.',
    complianceNote: 'Sec 10(13A): Exempt = least of (actual HRA, rent paid - 10% of basic, 50%/40% of basic for metro/non-metro).',
    sortOrder: 2, isSystem: true,
  },
  {
    name: 'Transport Allowance', code: 'TA', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Conveyance/transport allowance.',
    complianceNote: 'Fully taxable post FY 2018-19 budget. Covered under standard deduction of ₹50,000.',
    sortOrder: 3, isSystem: true,
  },
  {
    name: 'Special Allowance', code: 'SPECIAL', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Balancing allowance to make up the CTC. Fully taxable.',
    complianceNote: 'Fully taxable under the head "Salaries".',
    sortOrder: 4, isSystem: true,
  },
  {
    name: 'Medical Allowance', code: 'MEDICAL', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Medical reimbursement allowance.',
    complianceNote: 'Fully taxable post FY 2018-19. Earlier exemption of ₹15,000/yr removed.',
    sortOrder: 5, isSystem: false,
  },
  {
    name: 'Overtime', code: 'OT', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Overtime pay for extra hours worked.',
    complianceNote: 'Fully taxable. Factories Act: double the ordinary rate for overtime.',
    sortOrder: 6, isSystem: false,
  },
  {
    name: 'Bonus', code: 'BONUS', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Performance or statutory bonus.',
    complianceNote: 'Payment of Bonus Act 1965: 8.33% to 20% of basic+DA for eligible employees (basic ≤ ₹21,000/month).',
    sortOrder: 7, isSystem: false,
  },
  {
    name: 'Leave Encashment', code: 'LEAVE_ENC', type: 'earning',
    taxable: true, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Payment for unused leave days.',
    complianceNote: 'Sec 10(10AA): Exempt up to 10 months average salary at retirement/resignation.',
    sortOrder: 8, isSystem: false,
  },

  // ── DEDUCTIONS (Employee) ─────────────────────────────────────────────────
  {
    name: 'PF Employee', code: 'PF_EMP', type: 'deduction',
    taxable: false, mandatory: true,
    calculationType: 'percentage', percentageOf: 'basic', defaultPercentage: 12,
    description: 'Employee contribution to Provident Fund @ 12% of Basic.',
    complianceNote: 'EPF Act 1952: 12% of basic (capped at ₹15,000 basic → max ₹1,800/month). Exempt u/s 80C up to ₹1.5L/yr.',
    sortOrder: 10, isSystem: true,
  },
  {
    name: 'ESI Employee', code: 'ESI_EMP', type: 'deduction',
    taxable: false, mandatory: false,
    calculationType: 'percentage', percentageOf: 'gross', defaultPercentage: 0.75,
    description: 'Employee contribution to ESI @ 0.75% of gross. Applicable if gross ≤ ₹21,000/month.',
    complianceNote: 'ESI Act 1948: 0.75% of gross wages. Applicable only when gross salary ≤ ₹21,000/month.',
    sortOrder: 11, isSystem: true,
  },
  {
    name: 'Professional Tax', code: 'PT', type: 'deduction',
    taxable: false, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'State-level professional tax. Maharashtra: up to ₹2,500/year.',
    complianceNote: 'Maharashtra PT slabs: ₹0 (< ₹7,500), ₹175/month (₹7,500–₹10,000), ₹200/month (> ₹10,000, ₹300 in Feb). Max ₹2,500/year. Deductible u/s 16(iii).',
    sortOrder: 12, isSystem: true,
  },
  {
    name: 'TDS / Income Tax', code: 'TDS', type: 'deduction',
    taxable: false, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Tax Deducted at Source based on projected annual income and IT declaration.',
    complianceNote: 'Sec 192: Employer must deduct TDS on salary. New regime default from FY 2024-25. Form 16 issued by June 15.',
    sortOrder: 13, isSystem: true,
  },
  {
    name: 'Labour Welfare Fund (Employee)', code: 'LWF_EMP', type: 'deduction',
    taxable: false, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Employee LWF contribution. Maharashtra: ₹6 per month (deducted Dec & June).',
    complianceNote: 'Maharashtra LWF: Employee ₹6, Employer ₹12 per half-year.',
    sortOrder: 14, isSystem: false,
  },
  {
    name: 'Loan / Advance Deduction', code: 'LOAN_DED', type: 'deduction',
    taxable: false, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'EMI deduction for salary advances or company loans.',
    complianceNote: 'Interest-free loans > ₹20,000 may attract perquisite tax u/s 17(2).',
    sortOrder: 15, isSystem: false,
  },

  // ── EMPLOYER CONTRIBUTIONS ────────────────────────────────────────────────
  {
    name: 'PF Employer', code: 'PF_ER', type: 'employer',
    taxable: false, mandatory: true,
    calculationType: 'percentage', percentageOf: 'basic', defaultPercentage: 12,
    description: 'Employer PF contribution @ 12% of Basic (3.67% EPF + 8.33% EPS).',
    complianceNote: 'EPF Act: 3.67% → EPF account. 8.33% → EPS (pension) capped at ₹1,250/month. 0.5% EDLI insurance.',
    sortOrder: 20, isSystem: true,
  },
  {
    name: 'ESI Employer', code: 'ESI_ER', type: 'employer',
    taxable: false, mandatory: false,
    calculationType: 'percentage', percentageOf: 'gross', defaultPercentage: 3.25,
    description: 'Employer ESI contribution @ 3.25% of gross. Applicable if gross ≤ ₹21,000/month.',
    complianceNote: 'ESI Act: 3.25% employer + 0.75% employee = 4% total. Wage ceiling ₹21,000/month.',
    sortOrder: 21, isSystem: true,
  },
  {
    name: 'Gratuity Provision', code: 'GRATUITY', type: 'employer',
    taxable: false, mandatory: false,
    calculationType: 'percentage', percentageOf: 'basic', defaultPercentage: 4.81,
    description: 'Monthly gratuity provision @ 4.81% of Basic (= 15/26 × 1 month).',
    complianceNote: 'Payment of Gratuity Act 1972: 15 days × years of service ÷ 26. Payable after 5 years. Exempt up to ₹20L u/s 10(10).',
    sortOrder: 22, isSystem: true,
  },
  {
    name: 'Labour Welfare Fund (Employer)', code: 'LWF_ER', type: 'employer',
    taxable: false, mandatory: false,
    calculationType: 'fixed', defaultPercentage: null, percentageOf: null,
    description: 'Employer LWF contribution. Maharashtra: ₹12 per month.',
    complianceNote: 'Maharashtra LWF: Employer ₹12, Employee ₹6 per half-year (Jun & Dec).',
    sortOrder: 23, isSystem: false,
  },
];

async function main() {
  let created = 0, skipped = 0;
  for (const comp of components) {
    const existing = await prisma.salaryComponent.findUnique({ where: { code: comp.code } });
    if (existing) {
      console.log(`  ⏭️  SKIP  ${comp.code} — already exists`);
      skipped++;
      continue;
    }
    await prisma.salaryComponent.create({ data: comp });
    console.log(`  ✅ ${comp.type.padEnd(9)} ${comp.code.padEnd(12)} ${comp.name}`);
    created++;
  }
  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
