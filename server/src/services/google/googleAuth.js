const { google } = require('googleapis');
const path = require('path');

// OAuth2 client for per-user flows (Calendar, Tasks)
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Generate consent URL for a user
function generateAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/tasks.readonly',
    ],
    state: String(userId),
  });
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Get an authenticated OAuth2 client for a specific user (from stored tokens)
async function getAuthedClientForUser(userId, prisma) {
  const tokenRecord = await prisma.googleToken.findUnique({
    where: { userId },
  });

  if (!tokenRecord) {
    throw new Error('Google account not connected. Please connect your Google account first.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date: tokenRecord.expiresAt.getTime(),
  });

  // Auto-refresh if expired
  if (tokenRecord.expiresAt < new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.googleToken.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token,
          expiresAt: new Date(credentials.expiry_date),
        },
      });
      oauth2Client.setCredentials(credentials);
    } catch (err) {
      // Token revoked or invalid - clean up
      await prisma.googleToken.delete({ where: { userId } });
      throw new Error('Google authorization expired. Please reconnect your Google account.');
    }
  }

  return oauth2Client;
}

// Service account client for admin-level operations (Admin SDK, Reports API)
async function getServiceAccountClient(subjectEmail) {
  let keyFile;

  // Support env var JSON string (for Vercel) or file path (for local dev)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (err) {
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON in environment variable');
    }
  } else {
    const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json');
    try {
      keyFile = require(keyPath);
    } catch (err) {
      throw new Error('Google service account key not found. Set GOOGLE_SERVICE_ACCOUNT_KEY env var or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env');
    }
  }

  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.reports.audit.readonly',
    ],
    subject: subjectEmail, // Impersonate admin for domain-wide delegation
  });

  await auth.authorize();
  return auth;
}

// Store OAuth tokens in database
async function storeTokens(userId, tokens, prisma) {
  const scopes = tokens.scope || '';
  const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);

  await prisma.googleToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt,
      scopes,
    },
    create: {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      expiresAt,
      scopes,
    },
  });
}

module.exports = {
  getOAuth2Client,
  generateAuthUrl,
  exchangeCodeForTokens,
  getAuthedClientForUser,
  getServiceAccountClient,
  storeTokens,
};
