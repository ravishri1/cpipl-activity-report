/**
 * Saturday policy utilities
 * Determines which Saturdays are off based on company date-range policies.
 * satType values:
 *   'all'      — every Saturday is off
 *   'none'     — all Saturdays are working days
 *   '2nd'      — only the 2nd Saturday is off
 *   '2nd_4th'  — 2nd and 4th Saturdays are off
 *   '1st_3rd'  — 1st and 3rd Saturdays are off
 */

/**
 * Build a Set of off-Saturday date strings for a given month and sat type.
 * @param {number} year
 * @param {number} monthNum  1-12
 * @param {string} satType
 * @returns {Set<string>}  Set of 'YYYY-MM-DD' strings
 */
function buildOffSaturdaySet(year, monthNum, satType) {
  const set = new Set();
  if (!satType || satType === 'none') return set;

  // Find all Saturdays in the month
  const saturdays = [];
  const lastDay = new Date(year, monthNum, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(year, monthNum - 1, d);
    if (dt.getDay() === 6) {
      saturdays.push(`${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }

  if (satType === 'all') {
    saturdays.forEach(s => set.add(s));
  } else if (satType === '2nd') {
    if (saturdays[1]) set.add(saturdays[1]);
  } else if (satType === '2nd_4th') {
    if (saturdays[1]) set.add(saturdays[1]);
    if (saturdays[3]) set.add(saturdays[3]);
  } else if (satType === '1st_3rd') {
    if (saturdays[0]) set.add(saturdays[0]);
    if (saturdays[2]) set.add(saturdays[2]);
  }

  return set;
}

/**
 * For multiple companies, fetch Saturday policies covering the given month
 * and return a Map<companyId, Set<dateString>> of off-Saturday dates.
 *
 * Falls back to 'all' (every Saturday off) when no policy is configured.
 *
 * @param {number[]} companyIds
 * @param {number}   year
 * @param {number}   monthNum   1-12
 * @param {object}   prisma
 * @returns {Promise<Map<number, Set<string>>>}
 */
async function getSaturdaySetsForMonth(companyIds, year, monthNum, prisma) {
  if (!companyIds || companyIds.length === 0) return new Map();

  const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const policies = await prisma.saturdayPolicy.findMany({
    where: {
      companyId: { in: companyIds },
      effectiveFrom: { lte: monthEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });

  const result = new Map();
  for (const companyId of companyIds) {
    // Most recent policy that overlaps this month
    const policy = policies.find(p => p.companyId === companyId);
    const satType = policy?.saturdayType ?? 'all'; // default: all Saturdays off
    result.set(companyId, buildOffSaturdaySet(year, monthNum, satType));
  }

  return result;
}

module.exports = { buildOffSaturdaySet, getSaturdaySetsForMonth };
