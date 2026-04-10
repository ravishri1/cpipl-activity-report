// Update salary components with exact rules from salary consultant
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updates = [
  // ── PF: Two options — Full PF vs Minimum PF ───────────────────────────────
  {
    code: 'PF_EMP',
    data: {
      description: 'Employee PF contribution @ 12% of Basic. Two options: Full PF (12% of actual basic) or Minimum PF (12% of ₹15,000 = ₹1,800 fixed).',
      complianceNote: [
        'EPF Act 1952.',
        'Option 1 – Full PF: 12% of actual basic deducted from employee salary. Same 12% contributed by employer.',
        'Option 2 – Minimum PF: 12% of minimum threshold ₹15,000 = ₹1,800/month fixed (employee & employer both).',
        'PF breakup: 8.33% → EPS (Employee Pension Scheme), balance 3.67% → EPF.',
        'Employer EDLI insurance: 0.5% of basic (max ₹75/month).',
        'Employee contribution exempt u/s 80C up to ₹1.5L/year.',
      ].join(' '),
    },
  },
  {
    code: 'PF_ER',
    data: {
      description: 'Employer PF contribution @ 12% of Basic. Split: 8.33% to EPS (pension) + 3.67% to EPF.',
      complianceNote: [
        'EPF Act 1952.',
        'Option 1 – Full PF: 12% of actual basic from employer. Same 12% deducted from employee.',
        'Option 2 – Minimum PF: 12% of ₹15,000 = ₹1,800/month (capped regardless of actual basic).',
        'Breakup: 8.33% → EPS (max ₹1,250/month at ₹15,000 basic ceiling), 3.67% → EPF.',
        '+ 0.5% EDLI insurance on basic (max ₹75/month).',
      ].join(' '),
    },
  },

  // ── ESI: Correct as per consultant ───────────────────────────────────────
  {
    code: 'ESI_EMP',
    data: {
      description: 'Employee ESIC contribution @ 0.75% of Gross. Applicable only if gross ≤ ₹21,000/month.',
      complianceNote: 'ESI Act 1948. Applicable if gross salary ≤ ₹21,000/month. Employee = 0.75% of Gross. Employer = 3.25% of Gross. Total = 4% of Gross.',
    },
  },
  {
    code: 'ESI_ER',
    data: {
      description: 'Employer ESIC contribution @ 3.25% of Gross. Applicable only if gross ≤ ₹21,000/month.',
      complianceNote: 'ESI Act 1948. Applicable if gross salary ≤ ₹21,000/month. Employer = 3.25% of Gross. Employee = 0.75% of Gross. Total = 4% of Gross.',
    },
  },

  // ── PT: Maharashtra gender-specific slabs ────────────────────────────────
  {
    code: 'PT',
    data: {
      description: 'Professional Tax — Maharashtra. Gender-specific slabs. Max ₹2,500/year.',
      complianceNote: [
        'Maharashtra PT (state-wise, gender-specific):',
        'MALE — Gross < ₹7,500: NIL | ₹7,501–₹10,000: ₹175/month | ₹10,001+: ₹200/month (₹300 in February).',
        'FEMALE — Gross < ₹7,500: NIL | ₹7,501–₹24,999: NIL | ₹25,000+: ₹200/month (₹300 in February).',
        'Max annual PT = ₹2,500/year. Deductible u/s 16(iii) of Income Tax Act.',
      ].join(' '),
    },
  },

  // ── LWF: Corrected Maharashtra amounts ───────────────────────────────────
  {
    code: 'LWF_EMP',
    data: {
      description: 'Labour Welfare Fund — Employee contribution. Maharashtra: ₹12 per deduction (June & December).',
      complianceNote: 'Maharashtra LWF: Employee = ₹12 per deduction (deducted twice a year — June & December). Employer = ₹36 per deduction. Rates are state-specific.',
    },
  },
  {
    code: 'LWF_ER',
    data: {
      description: 'Labour Welfare Fund — Employer contribution. Maharashtra: ₹36 per deduction (June & December).',
      complianceNote: 'Maharashtra LWF: Employer = ₹36 per deduction (June & December). Employee = ₹12 per deduction. Rates are state-specific.',
    },
  },

  // ── TDS: Both New Regime (default) and Old Regime slabs ──────────────────
  {
    code: 'TDS',
    data: {
      description: 'TDS on salary as per Income Tax Act. New Regime is default from FY 2024-25. Employee can opt for Old Regime with investments.',
      complianceNote: [
        'Sec 192 — TDS on Salary.',
        '--- NEW TAX REGIME (DEFAULT — no investment declarations) ---',
        '₹0–₹3L: NIL | ₹3L–₹6L: 5% | ₹6L–₹9L: 10% | ₹9L–₹12L: 15% | ₹12L–₹15L: 20% | Above ₹15L: 30%.',
        'Rebate u/s 87A: up to ₹75,000 (net tax nil if income ≤ ₹7L).',
        '--- OLD TAX REGIME (With investment proof/declarations) ---',
        '₹0–₹2.5L: NIL | ₹2.5L–₹5L: 5% | ₹5L–₹10L: 20% | Above ₹10L: 30%.',
        'Rebate u/s 87A: up to ₹50,000.',
        'Both regimes: Health & Education Cess = 4% of (Tax + Surcharge).',
        'If employee does not declare regime → New Regime applies by default.',
        'Form 16 issued by employer by June 15 each year.',
      ].join(' '),
    },
  },
];

async function main() {
  let updated = 0;
  for (const item of updates) {
    const existing = await prisma.salaryComponent.findUnique({ where: { code: item.code } });
    if (!existing) {
      console.log(`  ⚠️  NOT FOUND: ${item.code}`);
      continue;
    }
    await prisma.salaryComponent.update({ where: { code: item.code }, data: item.data });
    console.log(`  ✅ Updated ${item.code} — ${existing.name}`);
    updated++;
  }
  console.log(`\nDone. Updated: ${updated} components`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
