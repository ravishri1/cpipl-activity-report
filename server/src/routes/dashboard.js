const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getTodayDate } = require('../utils/helpers');

const router = express.Router();

// GET /api/dashboard?date=YYYY-MM-DD
router.get('/', authenticate, async (req, res) => {
  try {
    // Only admin/team_lead can access full dashboard
    if (req.user.role === 'member') {
      return res.status(403).json({ error: 'Access denied. Members use /reports/my endpoint.' });
    }

    const date = req.query.date || getTodayDate();

    // Get all active members
    const allMembers = await req.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, department: true, role: true },
    });

    // Get reports submitted for this date
    const reports = await req.prisma.dailyReport.findMany({
      where: { reportDate: date },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        thumbsUps: { include: { givenBy: { select: { id: true, name: true } } } },
      },
    });

    // Get reminders sent for this date
    const reminders = await req.prisma.reminder.findMany({
      where: { reportDate: date },
    });

    // Fetch email activity (2-day delayed data)
    const emailDate = new Date(date);
    emailDate.setDate(emailDate.getDate() - 2);
    const emailDateStr = emailDate.toISOString().split('T')[0];
    const emailActivities = await req.prisma.emailActivity.findMany({
      where: { activityDate: emailDateStr },
    });
    const emailMap = new Map(emailActivities.map((e) => [e.userId, { emailsSent: e.emailsSent, emailsReceived: e.emailsReceived }]));

    // Fetch chat activity (same 2-day delayed data)
    const chatActivities = await req.prisma.chatActivity.findMany({
      where: { activityDate: emailDateStr },
    });
    const chatMap = new Map(chatActivities.map((c) => [c.userId, c.messagesSent]));

    const reportedUserIds = new Set(reports.map((r) => r.userId));
    const remindedUserIds = new Set(
      reminders.filter((r) => r.reminderType === 'first').map((r) => r.userId)
    );
    const escalatedUserIds = new Set(
      reminders.filter((r) => r.reminderType === 'escalation').map((r) => r.userId)
    );

    // Categorize members
    const reported = [];
    const notReported = [];
    const ignoredReminder = [];

    for (const member of allMembers) {
      const email = emailMap.get(member.id) || {};
      const chatMsgs = chatMap.get(member.id) || 0;
      const activityData = {
        emailsSent: email.emailsSent || 0,
        emailsReceived: email.emailsReceived || 0,
        chatMessages: chatMsgs,
      };

      if (reportedUserIds.has(member.id)) {
        const report = reports.find((r) => r.userId === member.id);
        reported.push({
          ...member,
          ...activityData,
          reportId: report.id,
          submittedAt: report.submittedAt,
          activities: report.activities,
          thumbsUps: report.thumbsUps || [],
          thumbsUpCount: report.thumbsUps?.length || 0,
        });
      } else if (escalatedUserIds.has(member.id)) {
        ignoredReminder.push({
          ...member,
          ...activityData,
          reminderSentAt: reminders.find((r) => r.userId === member.id && r.reminderType === 'first')?.sentAt,
        });
      } else if (remindedUserIds.has(member.id)) {
        notReported.push({
          ...member,
          ...activityData,
          reminded: true,
          reminderSentAt: reminders.find((r) => r.userId === member.id)?.sentAt,
        });
      } else {
        notReported.push({ ...member, ...activityData, reminded: false });
      }
    }

    res.json({
      date,
      emailDataDate: emailDateStr,
      summary: {
        total: allMembers.length,
        reported: reported.length,
        notReported: notReported.length,
        ignoredReminder: ignoredReminder.length,
      },
      reported,
      notReported,
      ignoredReminder,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
