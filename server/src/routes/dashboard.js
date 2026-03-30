const express = require('express');
const { authenticate, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { forbidden } = require('../utils/httpErrors');
const { getTodayDate } = require('../utils/helpers');

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// GET /api/dashboard?date=YYYY-MM-DD
router.get('/', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role === 'member') throw forbidden('Members use /reports/my endpoint.');

  const date = req.query.date || getTodayDate();

  const memberFilter = { isActive: true };
  if (req.user.role === 'team_lead') memberFilter.department = req.user.department;

  const allMembers = await req.prisma.user.findMany({
    where: memberFilter,
    select: { id: true, name: true, email: true, department: true, role: true },
  });

  const reports = await req.prisma.dailyReport.findMany({
    where: { reportDate: date },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      thumbsUps: { include: { givenBy: { select: { id: true, name: true } } } },
    },
  });

  const reminders = await req.prisma.reminder.findMany({ where: { reportDate: date } });

  // Fetch email activity (2-day delayed data)
  const emailDate = new Date(date);
  emailDate.setDate(emailDate.getDate() - 2);
  const emailDateStr = emailDate.toISOString().split('T')[0];
  const emailActivities = await req.prisma.emailActivity.findMany({ where: { activityDate: emailDateStr } });
  const emailMap = new Map(emailActivities.map((e) => [e.userId, { emailsSent: e.emailsSent, emailsReceived: e.emailsReceived }]));

  const chatActivities = await req.prisma.chatActivity.findMany({ where: { activityDate: emailDateStr } });
  const chatMap = new Map(chatActivities.map((c) => [c.userId, c.messagesSent]));

  const reportedUserIds = new Set(reports.map((r) => r.userId));
  const remindedUserIds = new Set(reminders.filter((r) => r.reminderType === 'first').map((r) => r.userId));
  const escalatedUserIds = new Set(reminders.filter((r) => r.reminderType === 'escalation').map((r) => r.userId));

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
        ...member, ...activityData,
        reportId: report.id, submittedAt: report.submittedAt,
        activities: report.activities, thumbsUps: report.thumbsUps || [],
        thumbsUpCount: report.thumbsUps?.length || 0,
      });
    } else if (escalatedUserIds.has(member.id)) {
      ignoredReminder.push({
        ...member, ...activityData,
        reminderSentAt: reminders.find((r) => r.userId === member.id && r.reminderType === 'first')?.sentAt,
      });
    } else if (remindedUserIds.has(member.id)) {
      notReported.push({ ...member, ...activityData, reminded: true, reminderSentAt: reminders.find((r) => r.userId === member.id)?.sentAt });
    } else {
      notReported.push({ ...member, ...activityData, reminded: false });
    }
  }

  res.json({
    date, emailDataDate: emailDateStr,
    summary: { total: allMembers.length, reported: reported.length, notReported: notReported.length, ignoredReminder: ignoredReminder.length },
    reported, notReported, ignoredReminder,
  });
}));

// ── GET /api/dashboard/calendar-events?month=YYYY-MM ─────────────────────────
router.get('/calendar-events', authenticate, asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const [leaves, holidays, wfhList, users] = await Promise.all([
    req.prisma.leaveRequest.findMany({
      where: { status: 'approved', OR: [{ startDate: { startsWith: month } }, { endDate: { startsWith: month } }] },
      include: { user: { select: { id: true, name: true, department: true } }, leaveType: { select: { name: true } } },
    }),
    req.prisma.holiday.findMany({ where: { date: { startsWith: month } } }),
    req.prisma.wFHRequest.findMany({
      where: { status: 'approved', date: { startsWith: month } },
      include: { user: { select: { id: true, name: true, department: true } } },
    }),
    req.prisma.user.findMany({
      where: { isActive: true, isHibernated: false },
      select: { id: true, name: true, dateOfBirth: true, dateOfJoining: true, department: true },
    }),
  ]);

  const mm = month.slice(5, 7);
  const yyyy = month.slice(0, 4);

  const birthdays = users
    .filter(u => u.dateOfBirth && u.dateOfBirth.slice(5, 7) === mm)
    .map(u => ({ userId: u.id, name: u.name, department: u.department, date: `${yyyy}-${u.dateOfBirth.slice(5, 10)}` }));

  const anniversaries = users
    .filter(u => u.dateOfJoining && u.dateOfJoining.slice(5, 7) === mm)
    .map(u => ({
      userId: u.id, name: u.name, department: u.department,
      date: `${yyyy}-${u.dateOfJoining.slice(5, 10)}`,
      years: parseInt(yyyy) - parseInt(u.dateOfJoining.slice(0, 4)),
    }))
    .filter(a => a.years > 0);

  res.json({ leaves, holidays, wfh: wfhList, birthdays, anniversaries });
}));

module.exports = router;
