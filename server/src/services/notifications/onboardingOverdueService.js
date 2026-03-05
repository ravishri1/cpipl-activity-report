/**
 * Onboarding Overdue Task Alert Service
 * Runs daily at 10:00 AM Mon-Sat.
 * Finds all incomplete OnboardingChecklist items whose dueDate has passed,
 * groups them by employee, and sends a consolidated alert to admins/team_leads.
 *
 * Overdue tiers (by days past due):
 *   🔴 Critical  — overdue > 7 days
 *   🟠 Warning   — overdue 4–7 days
 *   🟡 Recent    — overdue 1–3 days
 */
const { sendOnboardingOverdueAlert } = require('./emailService');

/**
 * Main entry point — called by cron at 10:00 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} total overdue task count
 */
async function runOnboardingOverdueCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[ONBOARDING_ALERT] Running onboarding overdue check for ${today}`);

  // Find all incomplete checklist items with a past due date for active employees
  const overdueItems = await prisma.onboardingChecklist.findMany({
    where: {
      isCompleted: false,
      dueDate:     { not: null, lt: today },
      user:        { isActive: true },
    },
    include: {
      user: {
        select: {
          id:          true,
          name:        true,
          email:       true,
          department:  true,
          designation: true,
          employeeId:  true,
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }],
  });

  if (overdueItems.length === 0) {
    console.log('[ONBOARDING_ALERT] No overdue onboarding tasks found today.');
    return 0;
  }

  // Annotate with daysOverdue
  const today_ms  = new Date(today).getTime();
  const annotated = overdueItems.map((item) => {
    const due_ms      = new Date(item.dueDate).getTime();
    const daysOverdue = Math.round((today_ms - due_ms) / (1000 * 60 * 60 * 24));
    return { ...item, daysOverdue };
  });

  // Group by employee for the email
  const byEmployee = annotated.reduce((acc, item) => {
    const key = item.userId;
    if (!acc[key]) {
      acc[key] = { user: item.user, tasks: [] };
    }
    acc[key].tasks.push(item);
    return acc;
  }, {});

  const employeeGroups = Object.values(byEmployee).sort(
    (a, b) => Math.max(...b.tasks.map((t) => t.daysOverdue)) - Math.max(...a.tasks.map((t) => t.daysOverdue))
  );

  console.log(
    `[ONBOARDING_ALERT] Found ${annotated.length} overdue task(s) across ${employeeGroups.length} employee(s).`
  );

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendOnboardingOverdueAlert(admin.email, admin.name, employeeGroups, annotated.length);
  }

  console.log(
    `[ONBOARDING_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} overdue task(s).`
  );
  return annotated.length;
}

module.exports = { runOnboardingOverdueCheck };
