/**
 * Shared payroll rules utilities
 * Used by payroll.js (generate) and settings.js (rules endpoint)
 */

const DEFAULT_PAYROLL_RULES = {
  pf: {
    employeeRate: 0.12,   // 12% employee contribution
    employerRate: 0.12,   // 12% employer contribution
    wageCap: 15000,       // PF applied on min(basic, wageCap)
    maxMonthly: 1800,     // max PF per month (wageCap * employeeRate)
  },
  esi: {
    employeeRate: 0.0075,  // 0.75% employee contribution
    employerRate: 0.0325,  // 3.25% employer contribution
    grossCeiling: 21000,   // ESI applies only if grossEarnings <= grossCeiling
  },
  pt: {
    // Gender-aware slabs — maleSlabs and femaleSlabs evaluated separately
    // The highest matching slab wins (same as old logic, but per gender)
    // februaryTopUp: extra PT amount charged in February (Maharashtra: ₹100 extra → ₹300 total)
    maleSlabs: [
      { minGross: 7501,  maxGross: 10000, amount: 175 },
      { minGross: 10001, maxGross: null,  amount: 200 },
    ],
    femaleSlabs: [
      { minGross: 25001, maxGross: null,  amount: 200 },
    ],
    februaryTopUp: 100, // added to the applicable slab amount in February only
  },
  lop: {
    divisor: 30, // 0 = use actual days in month; 30 = fixed Greythr-compatible
  },
};

/**
 * Calculate Professional Tax from gross earnings.
 * @param {number} gross       - Gross earnings
 * @param {object} ptRules     - pt config: { maleSlabs, femaleSlabs, februaryTopUp, slabs (legacy) }
 * @param {string} gender      - 'male' | 'female' | 'other' | null
 * @param {number} monthNum    - 1-12 (used for February top-up)
 * @returns {number}
 */
function calcPT(gross, ptRules, gender, monthNum) {
  if (!ptRules) return 0;

  // Determine which slab set to use
  // Legacy fallback: if maleSlabs/femaleSlabs not present, use old `slabs`
  let slabs;
  if (ptRules.maleSlabs || ptRules.femaleSlabs) {
    const isFemale = gender === 'female';
    slabs = isFemale
      ? (ptRules.femaleSlabs || [])
      : (ptRules.maleSlabs || []);
  } else {
    slabs = ptRules.slabs || [];
  }

  if (!slabs || slabs.length === 0) return 0;

  // Find highest matching slab (last match wins — slabs ordered lowest to highest)
  let pt = 0;
  for (const slab of slabs) {
    const inRange = gross >= slab.minGross &&
      (slab.maxGross === null || slab.maxGross === undefined || gross <= slab.maxGross);
    if (inRange) pt = slab.amount;
  }

  // February top-up (Maharashtra charges ₹100 extra in February)
  if (pt > 0 && monthNum === 2 && ptRules.februaryTopUp) {
    pt += ptRules.februaryTopUp;
  }

  return pt;
}

/**
 * Compute all statutory deductions for an employee using payroll rules.
 * @param {number}  grossBase  - Gross earnings (pre-LOP, prorated for separation)
 * @param {number}  payBasic   - Basic salary (PF base)
 * @param {boolean} ptExempt   - Employee is PT-exempt (set on salary structure)
 * @param {boolean} isIntern   - Interns have no statutory deductions
 * @param {object}  rules      - Full payroll rules object
 * @param {string}  gender     - 'male' | 'female' | 'other' | null  (for PT gender slabs)
 * @param {number}  monthNum   - 1-12 (for February PT top-up)
 * @returns {{ employeePf, employerPf, employeeEsi, employerEsi, professionalTax }}
 */
function calcStatutory(grossBase, payBasic, ptExempt, isIntern, rules, gender, monthNum) {
  const r = rules || DEFAULT_PAYROLL_RULES;
  if (isIntern) {
    return { employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0, professionalTax: 0 };
  }
  const pf  = r.pf  || DEFAULT_PAYROLL_RULES.pf;
  const esi = r.esi || DEFAULT_PAYROLL_RULES.esi;
  const pt  = r.pt  || DEFAULT_PAYROLL_RULES.pt;

  const pfBase    = Math.min(payBasic || 0, pf.wageCap || 15000);
  const employeePf = Math.min(Math.round(pfBase * (pf.employeeRate || 0.12)), pf.maxMonthly || 1800);
  const employerPf = Math.min(Math.round(pfBase * (pf.employerRate || 0.12)), pf.maxMonthly || 1800);

  const esiApplies  = grossBase > 0 && grossBase <= (esi.grossCeiling || 21000);
  const employeeEsi = esiApplies ? Math.round(grossBase * (esi.employeeRate || 0.0075)) : 0;
  const employerEsi = esiApplies ? Math.round(grossBase * (esi.employerRate || 0.0325)) : 0;

  const professionalTax = ptExempt ? 0 : calcPT(grossBase, pt, gender || null, monthNum || null);

  return { employeePf, employerPf, employeeEsi, employerEsi, professionalTax };
}

module.exports = { DEFAULT_PAYROLL_RULES, calcPT, calcStatutory };
