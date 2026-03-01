const { sendReminderEmail, sendEscalationEmail, sendSummaryToLead } = require('./emailService');
const { sendChatReminder, sendChatEscalation, sendChatSummary } = require('./googleChatNotifier');
const { getTodayDate, getYesterdayDate } = require('../../utils/helpers');

async function runFirstReminder(prisma) {
  const today = getTodayDate();
  console.log(`[REMINDER] Running first reminder check for ${today}`);

  const allMembers = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'admin' } },
  });

  const reports = await prisma.dailyReport.findMany({
    where: { reportDate: today },
  });

  const reportedIds = new Set(reports.map((r) => r.userId));
  const nonReporters = allMembers.filter((m) => !reportedIds.has(m.id));

  console.log(`[REMINDER] ${reportedIds.size} reported, ${nonReporters.length} pending`);

  // Send reminder to each non-reporter
  for (const member of nonReporters) {
    await sendReminderEmail(member.name, member.email);
    await prisma.reminder.create({
      data: {
        userId: member.id,
        reportDate: today,
        reminderType: 'first',
      },
    });
  }

  // Send Google Chat reminder to the team space
  await sendChatReminder(nonReporters, today);

  // Send summary to team lead
  const leadEmail = process.env.TEAM_LEAD_EMAIL;
  const reported = allMembers
    .filter((m) => reportedIds.has(m.id))
    .map((m) => {
      const report = reports.find((r) => r.userId === m.id);
      return { name: m.name, submittedAt: report.submittedAt };
    });

  const summaryData = {
    reported,
    notReported: nonReporters.map((m) => ({ name: m.name, reminded: true })),
    ignoredReminder: [],
    totalReported: reported.length,
    totalNotReported: nonReporters.length,
    totalIgnored: 0,
  };

  if (leadEmail) {
    await sendSummaryToLead(leadEmail, today, summaryData);
  }

  // Also post summary to Google Chat
  await sendChatSummary(today, summaryData);

  console.log(`[REMINDER] First reminder complete. Reminded ${nonReporters.length} members.`);
}

async function runEscalation(prisma) {
  const yesterday = getYesterdayDate();
  console.log(`[ESCALATION] Running escalation check for ${yesterday}`);

  // Find members who received a first reminder yesterday
  const firstReminders = await prisma.reminder.findMany({
    where: { reportDate: yesterday, reminderType: 'first' },
    include: { user: true },
  });

  // Check if they submitted after the reminder
  const reports = await prisma.dailyReport.findMany({
    where: { reportDate: yesterday },
  });

  const reportedIds = new Set(reports.map((r) => r.userId));
  const stillPending = firstReminders.filter((r) => !reportedIds.has(r.userId));

  console.log(`[ESCALATION] ${stillPending.length} members ignored yesterday's reminder`);

  for (const reminder of stillPending) {
    await sendEscalationEmail(reminder.user.name, reminder.user.email);
    await prisma.reminder.create({
      data: {
        userId: reminder.userId,
        reportDate: yesterday,
        reminderType: 'escalation',
      },
    });
  }

  // Send Google Chat escalation to the team space
  await sendChatEscalation(stillPending, yesterday);

  // Send escalation summary to team lead
  const leadEmail = process.env.TEAM_LEAD_EMAIL;
  if (leadEmail && stillPending.length > 0) {
    const allMembers = await prisma.user.findMany({ where: { isActive: true, role: { not: 'admin' } } });
    const reported = allMembers
      .filter((m) => reportedIds.has(m.id))
      .map((m) => {
        const report = reports.find((r) => r.userId === m.id);
        return { name: m.name, submittedAt: report.submittedAt };
      });

    await sendSummaryToLead(leadEmail, `${yesterday} (Escalation)`, {
      reported,
      notReported: [],
      ignoredReminder: stillPending.map((r) => ({ name: r.user.name })),
      totalReported: reported.length,
      totalNotReported: 0,
      totalIgnored: stillPending.length,
    });
  }

  console.log(`[ESCALATION] Escalation complete. ${stillPending.length} escalated.`);
}

module.exports = { runFirstReminder, runEscalation };
