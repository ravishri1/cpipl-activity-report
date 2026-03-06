const { google } = require('googleapis');
const { getServiceAccountClient } = require('./googleAuth');

// Scopes required for creating/updating Workspace users (write access)
const ADMIN_WRITE_SCOPES = ['https://www.googleapis.com/auth/admin.directory.user'];

// ─────────────────────────────────────────────
// Helper: build an authenticated Admin Directory client with write access
// ─────────────────────────────────────────────
async function getAdminWriteClient() {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
  if (!adminEmail) throw new Error('GOOGLE_ADMIN_EMAIL not configured in .env');
  const authClient = await getServiceAccountClient(adminEmail, ADMIN_WRITE_SCOPES);
  return google.admin({ version: 'directory_v1', auth: authClient });
}

// ─────────────────────────────────────────────
// Helper: split a full name into givenName / familyName for the Directory API
// ─────────────────────────────────────────────
function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length === 1) return { givenName: parts[0] || 'Employee', familyName: '.' };
  return { givenName: parts[0], familyName: parts.slice(1).join(' ') };
}

// ─────────────────────────────────────────────
// Helper: generate a random secure temporary password (12 chars)
// Format: 8 random alphanumeric + Uppercase + digit + special
// ─────────────────────────────────────────────
function generateTempPassword() {
  const base = Math.random().toString(36).slice(-8); // 8 lowercase alphanum
  return `${base}A1!`; // append uppercase, digit, special — meets most policies
}

/**
 * Create a new Google Workspace user account.
 * Called when a new employee is added to the system.
 *
 * @param {string} fullName  Employee full name (e.g. "Rahul Sharma")
 * @param {string} email     Primary Workspace email (must be on the domain)
 * @returns {string}         The generated temporary password (show to admin once)
 */
async function createWorkspaceUser(fullName, email) {
  const admin = await getAdminWriteClient();
  const { givenName, familyName } = splitName(fullName);
  const tempPassword = generateTempPassword();

  await admin.users.insert({
    requestBody: {
      primaryEmail: email,
      name: { givenName, familyName },
      password: tempPassword,
      changePasswordAtNextLogin: true, // employee must reset on first login
    },
  });

  return tempPassword;
}

/**
 * Suspend a Google Workspace user account.
 * Called when an employee is deactivated in the HR system.
 * Suspended accounts cannot sign in but data is preserved.
 *
 * @param {string} email  Primary Workspace email to suspend
 */
async function suspendWorkspaceUser(email) {
  const admin = await getAdminWriteClient();
  await admin.users.update({
    userKey: email,
    requestBody: { suspended: true },
  });
}

/**
 * Unsuspend (re-activate) a Google Workspace user account.
 * Called when a previously deactivated employee is re-hired.
 *
 * @param {string} email  Primary Workspace email to unsuspend
 */
async function unsuspendWorkspaceUser(email) {
  const admin = await getAdminWriteClient();
  await admin.users.update({
    userKey: email,
    requestBody: { suspended: false },
  });
}

// Fetch all users from Google Workspace Admin Directory
async function fetchGoogleWorkspaceUsers(domain) {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
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
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
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
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
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
  createWorkspaceUser,
  suspendWorkspaceUser,
  unsuspendWorkspaceUser,
};
