/**
 * Payroll Month Lock Utility
 *
 * Once a month is locked, ALL related data is read-only:
 * attendance, leave, holidays, separations, salary advances,
 * payslip generation — nothing affecting that month can change
 * until admin explicitly unlocks it.
 */
const { forbidden } = require('./httpErrors');

/**
 * Check if a specific month is locked for a company.
 * @param {PrismaClient} prisma
 * @param {string} month - "YYYY-MM"
 * @param {number} [companyId=1]
 * @returns {Promise<boolean>}
 */
async function isMonthLocked(prisma, month, companyId = 1) {
  if (!month) return false;
  const lock = await prisma.payrollMonthLock.findUnique({
    where: { companyId_month: { companyId, month } },
  });
  return !!lock;
}

/**
 * Throw 403 Forbidden if the month is locked. Call this at the top of any
 * route that writes data affecting payroll for that month.
 * @param {PrismaClient} prisma
 * @param {string} month - "YYYY-MM"
 * @param {number} [companyId=1]
 */
async function assertPayrollUnlocked(prisma, month, companyId = 1) {
  if (!month) return;
  const lock = await prisma.payrollMonthLock.findUnique({
    where: { companyId_month: { companyId, month } },
    select: { lockedAt: true },
  });
  if (lock) {
    throw forbidden(
      `Payroll for ${month} is locked (since ${lock.lockedAt.toISOString().slice(0, 10)}). ` +
      `Admin must unlock it before making any changes for this month.`
    );
  }
}

/**
 * Extract YYYY-MM from a date string or Date object.
 * @param {string|Date} date
 * @returns {string} "YYYY-MM"
 */
function toMonth(date) {
  if (!date) return null;
  return String(date).slice(0, 7);
}

/**
 * Check if any month in a date range is locked. Returns the first locked month
 * string, or null if none are locked.
 * @param {PrismaClient} prisma
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {string} endDate   - "YYYY-MM-DD"
 * @param {number} [companyId=1]
 * @returns {Promise<string|null>} locked month string or null
 */
async function isDateRangeLocked(prisma, startDate, endDate, companyId = 1) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const months = new Set();

  const cur = new Date(start);
  while (cur <= end) {
    months.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
    cur.setDate(1);
  }

  for (const month of months) {
    const lock = await prisma.payrollMonthLock.findUnique({
      where: { companyId_month: { companyId, month } },
    });
    if (lock) return month;
  }
  return null;
}

module.exports = { isMonthLocked, assertPayrollUnlocked, isDateRangeLocked, toMonth };
