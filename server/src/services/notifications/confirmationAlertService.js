const {
  sendConfirmationDueAlert,
  sendConfirmationDueManagerAlert,
} = require('./emailService');

/**
 * Runs daily: finds internal employees whose confirmation is due today
 * and sends reminder emails to both the employee and their reporting manager.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<number>} number of alerts sent
 */
async function runConfirmationAlerts(prisma) {
  const today = new Date().toISOString().slice(0, 10);

  const due = await prisma.user.findMany({
    where: {
      confirmationDate: today,
      confirmationStatus: { in: ['pending', 'extended'] },
      isActive: true,
      employeeType: 'internal',
    },
    select: {
      id: true,
      name: true,
      email: true,
      reportingManager: {
        select: { name: true, email: true },
      },
    },
  });

  let count = 0;
  for (const emp of due) {
    // Notify the employee
    if (emp.email) {
      try {
        await sendConfirmationDueAlert(emp.email, emp.name);
        count++;
      } catch (err) {
        console.error(`[ConfirmationAlert] Failed to email employee ${emp.name}:`, err.message);
      }
    }

    // Notify the reporting manager
    if (emp.reportingManager?.email) {
      try {
        await sendConfirmationDueManagerAlert(emp.reportingManager.email, emp.name);
      } catch (err) {
        console.error(`[ConfirmationAlert] Failed to email manager for ${emp.name}:`, err.message);
      }
    }
  }

  return count;
}

module.exports = { runConfirmationAlerts };
