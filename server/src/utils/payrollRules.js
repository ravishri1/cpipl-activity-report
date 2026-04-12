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
    grossCeiling: 21000,   // ESI eligibility ceiling — checked at contribution PERIOD START only
    // Contribution periods: Apr–Sep (starts Apr) and Oct–Mar (starts Oct)
    // If covered at period start, ESI continues even if gross later exceeds ceiling
  },
  pt: {
    maleSlabs: [
      { minGross: 7501,  maxGross: 10000, amount: 175 },
      { minGross: 10001, maxGross: null,  amount: 200 },
    ],
    femaleSlabs: [
      { minGross: 25001, maxGross: null,  amount: 200 },
    ],
    februaryTopUp: 100, // extra PT charged in February only (Maharashtra rule)
  },
  lwf: {
    // Labour Welfare Fund — applies only to ESIC-covered employees
    // If ESIC is removed (gross > ceiling at period start), LWF is also removed
    employeeAmount: 12,    // ₹12 deducted from employee
    employerAmount: 36,    // ₹36 employer contribution
    months: [6, 12],       // June and December only
  },
  lop: {
    divisor: 30, // 0 = use actual days in month; 30 = fixed Greythr-compatible
  },
};

/**
 * Determine the ESIC contribution period start month string for a given year + month.
 * Contribution periods:
 *   April (4) – September (9)  → period starts April   → returns "YYYY-04"
 *   October (10) – March (3)   → period starts October → returns "YYYY-10" or "(YYYY-1)-10"
 *
 * @param {number} year
 * @param {number} monthNum  1–12
 * @returns {string}  "YYYY-MM"
 */
function getEsicPeriodStartMonth(year, monthNum) {
  if (monthNum >= 4 && monthNum <= 9) return `${year}-04`;
  if (monthNum >= 10) return `${year}-10`;
  return `${year - 1}-10`; // Jan–Mar: period started October of previous year
}

/**
 * Calculate Professional Tax from gross earnings.
 * @param {number} gross       - Gross earnings
 * @param {object} ptRules     - pt config: { maleSlabs, femaleSlabs, februaryTopUp }
 * @param {string} gender      - 'male' | 'female' | 'other' | null
 * @param {number} monthNum    - 1–12 (used for February top-up)
 * @returns {number}
 */
function calcPT(gross, ptRules, gender, monthNum) {
  if (!ptRules) return 0;

  // Pick slab set by gender (legacy `slabs` fallback for old DB data)
  let slabs;
  if (ptRules.maleSlabs || ptRules.femaleSlabs) {
    slabs = gender === 'female' ? (ptRules.femaleSlabs || []) : (ptRules.maleSlabs || []);
  } else {
    slabs = ptRules.slabs || [];
  }

  if (!slabs || slabs.length === 0) return 0;

  // Highest matching slab wins
  let pt = 0;
  for (const slab of slabs) {
    const inRange = gross >= slab.minGross &&
      (slab.maxGross === null || slab.maxGross === undefined || gross <= slab.maxGross);
    if (inRange) pt = slab.amount;
  }

  // February top-up (Maharashtra: ₹100 extra in February)
  if (pt > 0 && monthNum === 2 && ptRules.februaryTopUp) {
    pt += ptRules.februaryTopUp;
  }

  return pt;
}

/**
 * Calculate LWF for a given month.
 * LWF applies ONLY if the employee is ESIC-covered AND the month is in lwf.months.
 *
 * @param {boolean} esicEligible  - Whether ESI applies this month
 * @param {number}  monthNum      - 1–12
 * @param {boolean} isIntern      - Interns are exempt
 * @param {object}  lwfRules      - { employeeAmount, employerAmount, months }
 * @returns {{ lwfEmployee: number, lwfEmployer: number }}
 */
function calcLWF(esicEligible, monthNum, isIntern, lwfRules) {
  if (isIntern || !esicEligible) return { lwfEmployee: 0, lwfEmployer: 0 };
  const r = lwfRules || DEFAULT_PAYROLL_RULES.lwf;
  const applicableMonths = Array.isArray(r.months) ? r.months : [6, 12];
  if (!applicableMonths.includes(monthNum)) return { lwfEmployee: 0, lwfEmployer: 0 };
  return {
    lwfEmployee: r.employeeAmount || 0,
    lwfEmployer: r.employerAmount || 0,
  };
}

/**
 * Compute all statutory deductions for an employee using payroll rules.
 *
 * @param {number}  grossBase           - Gross earnings (prorated for separation)
 * @param {number}  payBasic            - Basic salary (PF base)
 * @param {boolean} ptExempt            - Employee is PT-exempt
 * @param {boolean} isIntern            - Interns have no statutory deductions
 * @param {object}  rules               - Full payroll rules object
 * @param {string}  gender              - 'male' | 'female' | 'other' | null
 * @param {number}  monthNum            - 1–12
 * @param {boolean} esicEligibleOverride - If provided, bypasses the ceiling check for ESIC.
 *                                         Used for contribution-period continuation rule:
 *                                         once covered at period start, stays covered all period.
 * @returns {{ employeePf, employerPf, employeeEsi, employerEsi, professionalTax }}
 */
function calcStatutory(grossBase, payBasic, ptExempt, isIntern, rules, gender, monthNum, esicEligibleOverride) {
  const r = rules || DEFAULT_PAYROLL_RULES;
  if (isIntern) {
    return { employeePf: 0, employerPf: 0, employeeEsi: 0, employerEsi: 0, professionalTax: 0 };
  }
  const pf  = r.pf  || DEFAULT_PAYROLL_RULES.pf;
  const esi = r.esi || DEFAULT_PAYROLL_RULES.esi;
  const pt  = r.pt  || DEFAULT_PAYROLL_RULES.pt;

  const pfBase     = Math.min(payBasic || 0, pf.wageCap || 15000);
  const employeePf = Math.min(Math.round(pfBase * (pf.employeeRate || 0.12)), pf.maxMonthly || 1800);
  const employerPf = Math.min(Math.round(pfBase * (pf.employerRate || 0.12)), pf.maxMonthly || 1800);

  // ESIC eligibility:
  // If esicEligibleOverride is explicitly provided (true/false), use it —
  // this handles the contribution period continuation rule (payroll.js resolves it).
  // Otherwise, fall back to simple ceiling check.
  const esiApplies = (esicEligibleOverride !== undefined && esicEligibleOverride !== null)
    ? esicEligibleOverride
    : (grossBase > 0 && grossBase <= (esi.grossCeiling || 21000));

  const employeeEsi = esiApplies ? Math.round(grossBase * (esi.employeeRate || 0.0075)) : 0;
  const employerEsi = esiApplies ? Math.round(grossBase * (esi.employerRate || 0.0325)) : 0;

  const professionalTax = ptExempt ? 0 : calcPT(grossBase, pt, gender || null, monthNum || null);

  return { employeePf, employerPf, employeeEsi, employerEsi, professionalTax };
}

module.exports = { DEFAULT_PAYROLL_RULES, calcPT, calcLWF, calcStatutory, getEsicPeriodStartMonth };
