const { google } = require('googleapis');
const { getServiceAccountClient } = require('./googleAuth');

/**
 * Fetch Google Chat activity stats from the Reports API
 * Note: Reports API has a 2-day data delay, same as email activity
 */
async function fetchChatActivity(domain, date) {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error('GOOGLE_ADMIN_EMAIL not configured in .env');
  }

  const authClient = await getServiceAccountClient(adminEmail);
  const reports = google.admin({ version: 'reports_v1', auth: authClient });

  try {
    const response = await reports.userUsageReport.get({
      userKey: 'all',
      date, // YYYY-MM-DD, must be at least 2 days ago
      parameters: 'chat:num_messages_sent',
    });

    return (response.data.usageReports || []).map((report) => {
      const params = report.parameters || [];
      const sent = params.find((p) => p.name === 'chat:num_messages_sent');

      return {
        email: report.entity?.userEmail || '',
        messagesSent: sent?.intValue ? parseInt(sent.intValue) : 0,
      };
    });
  } catch (err) {
    console.error('Chat activity fetch error:', err.message);
    return [];
  }
}

/**
 * Fetch and store chat activity in the database
 */
async function fetchAndStoreChatActivity(prisma, date) {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (!domain) return;

  try {
    const activities = await fetchChatActivity(domain, date);
    if (!activities.length) return;

    // Get all users to map email -> userId
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
    });
    const emailToId = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

    for (const activity of activities) {
      const userId = emailToId.get(activity.email.toLowerCase());
      if (!userId) continue;

      await prisma.chatActivity.upsert({
        where: { userId_activityDate: { userId, activityDate: date } },
        update: {
          messagesSent: activity.messagesSent,
        },
        create: {
          userId,
          activityDate: date,
          messagesSent: activity.messagesSent,
        },
      });
    }

    console.log(`Chat activity stored for ${date}: ${activities.length} records`);
  } catch (err) {
    console.error('fetchAndStoreChatActivity error:', err.message);
  }
}

module.exports = {
  fetchChatActivity,
  fetchAndStoreChatActivity,
};
