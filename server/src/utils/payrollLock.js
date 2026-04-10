/**
 * Payroll Month Lock Utility
 * Once payslips are published for a month, all related data auto-locks.
 * No delete or status changes allowed on attendance, leaves, expenses for locked months.
 */

/**
 * Check if a specific month is locked.
 * @param {PrismaClient} prisma
 * @param {string} month - "YYYY-MM"
 * @returns {Promise<boolean>}
 */
async function isMonthLocked(prisma, month) {
  if (!month) return false;
  const lock = await prisma.payrollMonthLock.findUnique({ where: { month } });
  return !!lock;
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
 * Check if any month in a date range is locked.
 * @param {PrismaClient} prisma
 * @param {string} startDate - "YYYY-MM-DD"
 * @param {string} endDate   - "YYYY-MM-DD"
 * @returns {Promise<string|null>} locked month string or null
 */
async function isDateRangeLocked(prisma, startDate, endDate) {
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
    const lock = await prisma.payrollMonthLock.findUnique({ where: { month } });
    if (lock) return month;
  }
  return null;
}

module.exports = { isMonthLocked, isDateRangeLocked, toMonth };
