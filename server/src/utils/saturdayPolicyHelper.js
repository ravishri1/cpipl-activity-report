/**
 * Saturday Policy Helper
 * Types: "all" = all Saturdays off | "2nd_4th" = 2nd & 4th only | "none" = all Saturdays working
 */

/**
 * Get all Saturday day-of-month numbers for a given year/month
 */
function getSaturdaysInMonth(year, monthNum) {
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const saturdays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, monthNum - 1, d).getDay() === 6) saturdays.push(d);
  }
  return saturdays;
}

/**
 * Given a date string "YYYY-MM-DD" and a policy type, is this Saturday an off day?
 */
function isOffSaturdayDate(dateStr, saturdayType) {
  const [year, mon, day] = dateStr.split('-').map(Number);
  if (saturdayType === 'all') return true;
  if (saturdayType === 'none') return false;
  if (saturdayType === '2nd_4th') {
    const saturdays = getSaturdaysInMonth(year, mon);
    const idx = saturdays.indexOf(day);
    return idx === 1 || idx === 3; // 2nd or 4th Saturday
  }
  return true; // default safe
}

/**
 * Load Saturday policy for a company and month from DB.
 * month: "2025-04"
 * Returns policy object or null (null = use weeklyOffPattern default)
 */
async function getSaturdayPolicyForMonth(companyId, month, prisma) {
  const monthStart = `${month}-01`;
  const policy = await prisma.saturdayPolicy.findFirst({
    where: {
      companyId,
      effectiveFrom: { lte: `${month}-31` },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return policy;
}

/**
 * Build a Set of off-Saturday date strings for the month based on policy.
 * month: "2025-04"
 */
function buildOffSaturdaySet(month, saturdayType) {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const offSats = new Set();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    if (new Date(year, mon - 1, d).getDay() === 6) {
      if (isOffSaturdayDate(dateStr, saturdayType)) {
        offSats.add(dateStr);
      }
    }
  }
  return offSats;
}

module.exports = { getSaturdayPolicyForMonth, buildOffSaturdaySet, isOffSaturdayDate };
