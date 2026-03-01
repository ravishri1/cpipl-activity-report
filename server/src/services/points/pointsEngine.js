/**
 * Points Engine — calculates and awards points for daily activities.
 * Idempotent: deletes old points for same user+date+source before recalculating.
 */

// Default point values (can be overridden via Settings table)
// Regular activities = minimal points (just for compliance)
// Major points come from peer appreciation for out-of-box work
const DEFAULT_POINTS = {
  report: 2,       // minimal - just for submitting EOD
  calendar: 1,     // minimal - attending meetings
  task: 1,         // minimal - listing tasks
  email: 1,        // minimal - emails
  chat: 1,         // minimal - chat messages
  thumbsup: 15,    // significant - team lead recognizes quality
  plan_tomorrow: 3, // bonus for setting future plans
};

async function getPointValues(prisma) {
  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: 'points_' } },
  });
  const values = { ...DEFAULT_POINTS };
  for (const s of settings) {
    const key = s.key.replace('points_', '');
    if (key in values) values[key] = parseInt(s.value) || values[key];
  }
  return values;
}

/**
 * Calculate and award points for a user on a given date.
 * Called after report submission/update.
 */
async function calculateAndAwardPoints(userId, date, prisma) {
  const pts = await getPointValues(prisma);
  const logs = [];

  // 1. Report submitted → +10 pts
  const report = await prisma.dailyReport.findUnique({
    where: { userId_reportDate: { userId, reportDate: date } },
    include: { tasks: true },
  });

  if (report) {
    logs.push({ source: 'report', points: pts.report, description: 'Daily report submitted' });

    // 2. Tasks in the report → +1 per task (minimal)
    if (report.tasks?.length > 0) {
      for (const task of report.tasks) {
        logs.push({
          source: 'task',
          points: pts.task,
          description: task.description.substring(0, 100),
        });
      }
    }

    // 3. Bonus for future planning (planTomorrow filled with substance)
    if (report.planTomorrow && report.planTomorrow.trim().length >= 20) {
      logs.push({
        source: 'report',
        points: pts.plan_tomorrow || 3,
        description: 'Future planning bonus',
      });
    }
  }

  // 4. Calendar events for that day → +1 per event (minimal)
  const calendarEvents = await getCalendarEventsCount(userId, date, prisma);
  for (let i = 0; i < calendarEvents; i++) {
    logs.push({ source: 'calendar', points: pts.calendar, description: 'Calendar event attended' });
  }

  // 5. Email activity → +1 per email sent (minimal)
  const emailActivity = await prisma.emailActivity.findUnique({
    where: { userId_activityDate: { userId, activityDate: date } },
  });
  if (emailActivity && emailActivity.emailsSent > 0) {
    logs.push({
      source: 'email',
      points: Math.min(emailActivity.emailsSent, 50) * pts.email, // cap at 50
      description: `${emailActivity.emailsSent} emails sent`,
    });
  }

  // 6. Chat activity → +1 per message sent (minimal)
  const chatActivity = await prisma.chatActivity.findUnique({
    where: { userId_activityDate: { userId, activityDate: date } },
  });
  if (chatActivity && chatActivity.messagesSent > 0) {
    logs.push({
      source: 'chat',
      points: Math.min(chatActivity.messagesSent, 50) * pts.chat, // cap at 50
      description: `${chatActivity.messagesSent} chat messages sent`,
    });
  }

  // Idempotent: delete old points for auto-calculated sources on this date
  // Keep: thumbsup, appreciation, appreciation_penalty (manually managed)
  await prisma.pointLog.deleteMany({
    where: { userId, date, source: { notIn: ['thumbsup', 'appreciation', 'appreciation_penalty'] } },
  });

  // Insert new point logs
  if (logs.length > 0) {
    await prisma.pointLog.createMany({
      data: logs.map((l) => ({ userId, date, ...l })),
    });
  }

  // Recalculate cached totalPoints
  await recalcTotalPoints(userId, prisma);

  return logs;
}

/**
 * Get calendar event count for a user on a date.
 * Uses stored data or returns 0 if Google not connected.
 */
async function getCalendarEventsCount(userId, date, prisma) {
  try {
    const { fetchTodayCalendarEvents } = require('../google/googleCalendar');
    const events = await fetchTodayCalendarEvents(userId, prisma, date);
    return Array.isArray(events) ? events.length : 0;
  } catch {
    return 0; // Google not connected or error
  }
}

/**
 * Award thumbs-up points (+10) from a team lead.
 */
async function awardThumbsUp(reportId, givenByUserId, prisma) {
  const pts = await getPointValues(prisma);

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { userId: true, reportDate: true },
  });
  if (!report) throw new Error('Report not found');

  // Create ThumbsUp record (unique per reportId + givenByUserId)
  const thumbsUp = await prisma.thumbsUp.create({
    data: { reportId, givenByUserId, receiverUserId: report.userId },
  });

  // Add point log
  await prisma.pointLog.create({
    data: {
      userId: report.userId,
      date: report.reportDate,
      source: 'thumbsup',
      points: pts.thumbsup,
      description: `Thumbs up from team lead`,
      givenBy: givenByUserId,
    },
  });

  await recalcTotalPoints(report.userId, prisma);
  return thumbsUp;
}

/**
 * Remove thumbs-up and its points.
 */
async function removeThumbsUp(reportId, givenByUserId, prisma) {
  const thumbsUp = await prisma.thumbsUp.findUnique({
    where: { reportId_givenByUserId: { reportId, givenByUserId } },
  });
  if (!thumbsUp) throw new Error('Thumbs up not found');

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { userId: true, reportDate: true },
  });

  // Delete thumbs up
  await prisma.thumbsUp.delete({
    where: { reportId_givenByUserId: { reportId, givenByUserId } },
  });

  // Delete associated point log
  await prisma.pointLog.deleteMany({
    where: {
      userId: report.userId,
      date: report.reportDate,
      source: 'thumbsup',
      givenBy: givenByUserId,
    },
  });

  await recalcTotalPoints(report.userId, prisma);
}

/**
 * Recalculate and cache user's total points.
 */
async function recalcTotalPoints(userId, prisma) {
  const result = await prisma.pointLog.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { totalPoints: result._sum.points || 0 },
  });
}

/**
 * Get leaderboard for a given period.
 */
async function getLeaderboard(period, prisma) {
  const dateFilter = getDateFilter(period);

  const pointsByUser = await prisma.pointLog.groupBy({
    by: ['userId'],
    where: dateFilter ? { date: dateFilter } : {},
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
  });

  // Get user details
  const userIds = pointsByUser.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true },
    select: { id: true, name: true, email: true, department: true, totalPoints: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return pointsByUser
    .filter((p) => userMap.has(p.userId))
    .map((p, idx) => ({
      rank: idx + 1,
      user: userMap.get(p.userId),
      points: p._sum.points || 0,
    }));
}

/**
 * Get detailed point breakdown for a user.
 */
async function getUserPoints(userId, period, prisma) {
  const dateFilter = getDateFilter(period);
  const where = { userId };
  if (dateFilter) where.date = dateFilter;

  // Get totals by source
  const bySource = await prisma.pointLog.groupBy({
    by: ['source'],
    where,
    _sum: { points: true },
  });

  // Get recent logs
  const recentLogs = await prisma.pointLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const total = bySource.reduce((sum, s) => sum + (s._sum.points || 0), 0);

  return {
    total,
    breakdown: Object.fromEntries(bySource.map((s) => [s.source, s._sum.points || 0])),
    recentLogs,
  };
}

function getDateFilter(period) {
  const now = new Date();
  if (period === 'weekly') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { gte: weekAgo.toISOString().split('T')[0] };
  }
  if (period === 'monthly') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return { gte: monthAgo.toISOString().split('T')[0] };
  }
  return null; // alltime
}

module.exports = {
  calculateAndAwardPoints,
  awardThumbsUp,
  removeThumbsUp,
  recalcTotalPoints,
  getLeaderboard,
  getUserPoints,
  getPointValues,
};
