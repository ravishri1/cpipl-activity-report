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
 * @param {string} fullName       Employee full name (e.g. "Rahul Sharma")
 * @param {string} email          Primary Workspace email (must be on the domain)
 * @param {object} [opts]         Optional: recoveryEmail, recoveryPhone
 * @returns {string}              The generated temporary password (show to admin once)
 */
async function createWorkspaceUser(fullName, email, opts = {}) {
  const admin = await getAdminWriteClient();
  const { givenName, familyName } = splitName(fullName);
  const tempPassword = generateTempPassword();

  const requestBody = {
    primaryEmail: email,
    name: { givenName, familyName },
    password: tempPassword,
    changePasswordAtNextLogin: true,
  };

  if (opts.recoveryEmail) requestBody.recoveryEmail = opts.recoveryEmail;
  if (opts.recoveryPhone) {
    // Workspace requires E.164 format: +91XXXXXXXXXX
    const phone = String(opts.recoveryPhone).replace(/\D/g, '');
    requestBody.recoveryPhone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
  }

  await admin.users.insert({ requestBody });

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

// ─────────────────────────────────────────────
// Generate unique Workspace email: firstname.lastinitial@domain
// Falls back to firstname.lastinitial1, ..., firstname.lastinitial9
// ─────────────────────────────────────────────
async function generateWorkspaceEmail(fullName, domain, prisma) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0].toLowerCase().replace(/[^a-z]/g, '');
  const lastInit = parts.length > 1
    ? parts[parts.length - 1][0].toLowerCase().replace(/[^a-z]/g, '')
    : '';
  const base = lastInit ? `${first}.${lastInit}` : first;
  if (!base) throw new Error(`Cannot derive email from name "${fullName}" — only special characters`);

  const candidates = [base, ...Array.from({ length: 9 }, (_, i) => `${base}${i + 1}`)];

  for (const username of candidates) {
    const email = `${username}@${domain}`;
    // Check EOD DB first
    const inDB = await prisma.user.findUnique({ where: { email } });
    if (inDB) continue;
    // Check Workspace
    try {
      const admin = await getAdminWriteClient();
      await admin.users.get({ userKey: email });
      continue; // user exists in Workspace — taken
    } catch (err) {
      const status = err.code || err.status || err.response?.status;
      if (status === 404) return email; // not found → available
      throw err; // unexpected error
    }
  }
  throw new Error(`Cannot generate unique email for "${fullName}" — all variants (${base}@${domain} .. ${base}9@${domain}) already taken`);
}

// ─────────────────────────────────────────────
// Push EOD profile fields → Google Workspace
// Only sends fields that are passed (undefined = skip)
// ─────────────────────────────────────────────
async function updateWorkspaceUser(email, { name, department, employeeId, managerEmail } = {}) {
  const admin = await getAdminWriteClient();
  const requestBody = {};

  if (name !== undefined) {
    const { givenName, familyName } = splitName(name);
    requestBody.name = { givenName, familyName };
  }
  if (department !== undefined) {
    requestBody.organizations = [{ department: department || '', primary: true }];
  }
  if (employeeId !== undefined) {
    requestBody.externalIds = employeeId
      ? [{ value: String(employeeId), type: 'organization' }]
      : [];
  }
  if (managerEmail !== undefined) {
    requestBody.relations = managerEmail
      ? [{ value: managerEmail, type: 'manager' }]
      : [];
  }
  if (Object.keys(requestBody).length === 0) return;
  await admin.users.update({ userKey: email, requestBody });
}

// ─────────────────────────────────────────────
// Push photo buffer → Google Workspace profile photo
// ─────────────────────────────────────────────
async function updateWorkspacePhoto(userEmail, imageBuffer) {
  const admin = await getAdminWriteClient();
  // Workspace API requires URL-safe base64 without padding
  const photoData = imageBuffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  await admin.users.photos.update({
    userKey: userEmail,
    requestBody: { photoData, mimeType: 'image/jpeg', width: 96, height: 96 },
  });
}

// ─────────────────────────────────────────────
// Pull name, department, phone, employeeId, manager from Workspace
// ─────────────────────────────────────────────
async function syncFromWorkspace(userEmail) {
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
  if (!adminEmail) throw new Error('GOOGLE_ADMIN_EMAIL not configured');
  const authClient = await getServiceAccountClient(adminEmail);
  const admin = google.admin({ version: 'directory_v1', auth: authClient });

  const res = await admin.users.get({ userKey: userEmail, projection: 'full' });
  const u = res.data;
  return {
    name: u.name?.fullName || `${u.name?.givenName || ''} ${u.name?.familyName || ''}`.trim() || null,
    department: u.organizations?.[0]?.department || null,
    phone: u.phones?.[0]?.value || null,
    photo: u.thumbnailPhotoUrl || null,
    employeeId: u.externalIds?.find((e) => e.type === 'organization')?.value || null,
    managerEmail: u.relations?.find((r) => r.type === 'manager')?.value || null,
  };
}

module.exports = {
  fetchGoogleWorkspaceUsers,
  fetchEmailActivity,
  fetchAndStoreEmailActivity,
  createWorkspaceUser,
  suspendWorkspaceUser,
  unsuspendWorkspaceUser,
  generateWorkspaceEmail,
  updateWorkspaceUser,
  updateWorkspacePhoto,
  syncFromWorkspace,
};
