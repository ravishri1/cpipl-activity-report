const { google } = require('googleapis');
const { getServiceAccountClient } = require('./googleAuth');

// Fetch all users from Google Workspace Admin Directory
async function fetchGoogleWorkspaceUsers(domain) {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error('GOOGLE_ADMIN_EMAIL not configured in .env');
  }

  const authClient = await getServiceAccountClient(adminEmail);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  const allUsers = [];
  let pageToken = null;

  do {
    const response = await admin.users.list({
      domain,
      maxResults: 200,
      orderBy: 'email',
      projection: 'basic',
      pageToken: pageToken || undefined,
    });

    const users = (response.data.users || []).map((u) => ({
      googleId: u.id,
      name: u.name?.fullName || `${u.name?.givenName || ''} ${u.name?.familyName || ''}`.trim(),
      email: u.primaryEmail,
      department: u.orgUnitPath?.replace(/^\//, '') || 'General',
      isActive: !u.suspended,
      photo: u.thumbnailPhotoUrl || null,
    }));

    allUsers.push(...users);
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return allUsers;
}

// Fetch email activity stats from Google Reports API
// Note: Reports API has a 2-day data delay
async function fetchEmailActivity(domain, date) {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error('GOOGLE_ADMIN_EMAIL not configured in .env');
  }

  const authClient = await getServiceAccountClient(adminEmail, [
    'https://www.googleapis.com/auth/admin.reports.audit.readonly',
  ]);
  const reports = google.admin({ version: 'reports_v1', auth: authClient });

  try {
    const response = await reports.userUsageReport.get({
      userKey: 'all',
      date, // YYYY-MM-DD, must be at least 2 days ago
      parameters: 'gmail:num_emails_sent,gmail:num_emails_received',
    });

    return (response.data.usageReports || []).map((report) => {
      const params = report.parameters || [];
      const sent = params.find((p) => p.name === 'gmail:num_emails_sent');
      const received = params.find((p) => p.name === 'gmail:num_emails_received');

      return {
        email: report.entity?.userEmail || '',
        emailsSent: sent?.intValue ? parseInt(sent.intValue) : 0,
        emailsReceived: received?.intValue ? parseInt(received.intValue) : 0,
      };
    });
  } catch (err) {
    console.error('Email activity fetch error:', err.message);
    return [];
  }
}

// Fetch and store email activity in the database
async function fetchAndStoreEmailActivity(prisma, date) {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
  if (!domain) return;

  try {
    const activities = await fetchEmailActivity(domain, date);
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

      await prisma.emailActivity.upsert({
        where: { userId_activityDate: { userId, activityDate: date } },
        update: {
          emailsSent: activity.emailsSent,
          emailsReceived: activity.emailsReceived,
        },
        create: {
          userId,
          activityDate: date,
          emailsSent: activity.emailsSent,
          emailsReceived: activity.emailsReceived,
        },
      });
    }

    console.log(`Email activity stored for ${date}: ${activities.length} records`);
  } catch (err) {
    console.error('fetchAndStoreEmailActivity error:', err.message);
  }
}

module.exports = {
  fetchGoogleWorkspaceUsers,
  fetchEmailActivity,
  fetchAndStoreEmailActivity,
};
