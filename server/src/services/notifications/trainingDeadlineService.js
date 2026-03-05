/**
 * Training Assignment Deadline Alert Service
 * Runs daily at 10:15 AM Mon-Sat.
 * Finds incomplete training assignments whose dueDate has passed,
 * groups them by employee, and sends a consolidated alert to admins/team_leads.
 *
 * Overdue tiers (by days past due):
 *   🔴 Critical  — overdue > 7 days
 *   🟠 Warning   — overdue 4–7 days
 *   🟡 Recent    — overdue 1–3 days
 */
const { sendTrainingDeadlineAlert } = require('./emailService');

/**
 * Main entry point — called by cron at 10:15 AM Mon-Sat.
 * @param {PrismaClient} prisma
 * @returns {number} total overdue assignment count
 */
async function runTrainingDeadlineCheck(prisma) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`[TRAINING_ALERT] Running training deadline check for ${today}`);

  // Find all incomplete assignments with a past dueDate for active employees
  const overdueAssignments = await prisma.trainingAssignment.findMany({
    where: {
      status:     { not: 'completed' },
      dueDate:    { not: null, lt: today },
      assignedTo: { isActive: true },
    },
    include: {
      module: {
        select: {
          id:          true,
          title:       true,
          category:    true,
          isMandatory: true,
        },
      },
      assignedTo: {
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

  if (overdueAssignments.length === 0) {
    console.log('[TRAINING_ALERT] No overdue training assignments found today.');
    return 0;
  }

  // Annotate with daysOverdue
  const today_ms  = new Date(today).getTime();
  const annotated = overdueAssignments.map((assignment) => {
    const due_ms      = new Date(assignment.dueDate).getTime();
    const daysOverdue = Math.round((today_ms - due_ms) / (1000 * 60 * 60 * 24));
    return { ...assignment, daysOverdue };
  });

  // Group by employee for the email
  const byEmployee = annotated.reduce((acc, item) => {
    const key = item.assignedToId;
    if (!acc[key]) {
      acc[key] = { user: item.assignedTo, assignments: [] };
    }
    acc[key].assignments.push(item);
    return acc;
  }, {});

  const employeeGroups = Object.values(byEmployee).sort(
    (a, b) =>
      Math.max(...b.assignments.map((t) => t.daysOverdue)) -
      Math.max(...a.assignments.map((t) => t.daysOverdue))
  );

  console.log(
    `[TRAINING_ALERT] Found ${annotated.length} overdue assignment(s) across ${employeeGroups.length} employee(s).`
  );

  // Notify all active admins and team leads
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['admin', 'team_lead'] } },
    select: { name: true, email: true },
  });

  for (const admin of admins) {
    await sendTrainingDeadlineAlert(admin.email, admin.name, employeeGroups, annotated.length);
  }

  console.log(
    `[TRAINING_ALERT] Alerted ${admins.length} admin(s) about ${annotated.length} overdue training assignment(s).`
  );
  return annotated.length;
}

module.exports = { runTrainingDeadlineCheck };
