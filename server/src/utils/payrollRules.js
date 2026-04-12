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
    // Slabs are evaluated in order; highest matching slab wins
    // maxGross: null means "no upper limit"
    slabs: [
      { minGross: 7500,  maxGross: 10000, amount: 75 },
      { minGross: 10001, maxGross: null,  amount: 200 },
    ],
  },
  lop: {
    divisor: 30, // 0 = use actual days in month; 30 = fixed Greythr-compatible
  },
};

/**
 * Calculate Professional Tax from gross earnings using configured slabs.
 * Returns 0 if slabs are empty or gross doesn't match any slab.
 */
function calcPT(gross, slabs) {
  if (!slabs || slabs.length === 0) return 0;
  let pt = 0;
  for (const slab of slabs) {
    const inRange = gross >= slab.minGross &&
      (slab.maxGross === null || slab.maxGross === undefined || gross <= slab.maxGross);
    if (inRange) pt = slab.amount;
  }
  return pt;
}

/**
 * Compute all statutory deductions for an employee using payroll rules.
 * @param {number} grossBase  - Gross earnings (pre-LOP)
 * @param {number} payBasic   - Basic salary (PF base)
 * @param {boolean} ptExempt  - Employee is PT-exempt
 * @param {boolean} isIntern  - Interns have no statutory deductions
 * @param {object} rules      - Payroll rules object
 * @returns {{ employeePf, employerPf, employeeEsi, employerEsi, professionalTax }}
 */
function calcStatutory(grossBase, payBasic, ptExempt, isIntern, rules) {
  const r = rules || DEFAULT_PAYROLL_RULES;
  if (isIntern) {
    return { employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0, professionalTax: 0 };
  }
  const pf = r.pf || DEFAULT_PAYROLL_RULES.pf;
  const esi = r.esi || DEFAULT_PAYROLL_RULES.esi;
  const pt = r.pt || DEFAULT_PAYROLL_RULES.pt;

  const pfBase = Math.min(payBasic || 0, pf.wageCap || 15000);
  const employeePf = Math.min(Math.round(pfBase * (pf.employeeRate || 0.12)), pf.maxMonthly || 1800);
  const employerPf = Math.min(Math.round(pfBase * (pf.employerRate || 0.12)), pf.maxMonthly || 1800);

  const esiApplies = grossBase > 0 && grossBase <= (esi.grossCeiling || 21000);
  const employeeEsi = esiApplies ? Math.round(grossBase * (esi.employeeRate || 0.0075)) : 0;
  const employerEsi = esiApplies ? Math.round(grossBase * (esi.employerRate || 0.0325)) : 0;

  const professionalTax = ptExempt ? 0 : calcPT(grossBase, pt.slabs);

  return { employeePf, employerPf, employeeEsi, employerEsi, professionalTax };
}

module.exports = { DEFAULT_PAYROLL_RULES, calcPT, calcStatutory };
