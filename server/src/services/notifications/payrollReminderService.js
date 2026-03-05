/**
 * Payroll Processing Reminder Service
 * Runs on the 25th of every month at 8:00 AM.
 * Checks whether payslips have been generated (status = generated | published)
 * for all active/notice-period employees for the current month.
 * If any are missing, emails all admins with a summary.
 */
const { sendPayrollReminderAlert } = require('./emailService');

/**
 * Returns "YYYY-MM" for the current month.
 */
function currentMonthString() {
  return new Date().toISOString().slice(0, 7); // "2026-03"
}

/**
 * Human-readable month label, e.g. "March 2026".
 * @param {string} ym  "YYYY-MM"
 */
function formatMonthLabel(ym) {
  const [year, month] = ym.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Main entry point — called by cron on the 25th at 08:00.
 * @param {PrismaClient} prisma
 * @returns {number} count of employees missing payslips (0 = all done)
 */
async function runPayrollReminderCheck(prisma) {
  const month = currentMonthString();
  const label = formatMonthLabel(month);
  console.log(`[PAYROLL_REMINDER] Checking payroll completion for ${label}`);

  // Active + notice-period employees who should receive a payslip
  const eligibleEmployees = await prisma.user.findMany({
    where: {
      isActive: true,
      employmentStatus: { in: ['active', 'notice_period'] },
    },
    select: {
      id:          true,
      name:        true,
      email:       true,
      department:  true,
      designation: true,
      employeeId:  true,
    },
    orderBy: [{ department: 'asc' }, { name: 'asc' }],
  });

  if (eligibleEmployees.length === 0) {
    console.log('[PAYROLL_REMINDER] No eligible employees found. Skipping.');
    return 0;
  }

  // Payslips already generated/published for this month
  const existingPayslips = await prisma.payslip.findMany({
    where: {
      month,
      status: { in: ['generated', 'published'] },
    },
    select: { userId: true, status: true },
  });

  const processedIds = new Set(existingPayslips.map((p) => p.userId));
  const missingEmployees = eligibleEmployees.filter((e) => !processedIds.has(e.id));

  if (missingEmployees.length === 0) {
    console.log(`[PAYROLL_REMINDER] All ${eligibleEmployees.length} payslips complete for ${label}. No reminder needed.`);
    return 0;
  }

  console.log(
    `[PAYROLL_REMINDER] ${missingEmployees.length}/${eligibleEmployees.length} payslips missing for ${label}.`
  );

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  const summary = {
    month,
    label,
    totalEligible:  eligibleEmployees.length,
    processed:      processedIds.size,
    missing:        missingEmployees.length,
    missingEmployees,
  };

  for (const admin of admins) {
    await sendPayrollReminderAlert(admin.email, admin.name, summary);
  }

  console.log(`[PAYROLL_REMINDER] Reminded ${admins.length} admin(s) about ${missingEmployees.length} missing payslip(s).`);
  return missingEmployees.length;
}

module.exports = { runPayrollReminderCheck };
