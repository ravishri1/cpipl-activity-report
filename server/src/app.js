require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const googleRoutes = require('./routes/google');
const pointsRoutes = require('./routes/points');

const app = express();

// Use a single Prisma instance (important for serverless)
let prisma;
if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}
prisma = global.__prisma;

// Middleware
app.use(cors());
app.use(express.json());

// ═══ Security: Block indexing, scraping, and caching ═══
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/points', pointsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clerkConfigured: !!process.env.CLERK_SECRET_KEY,
    dbConfigured: !!process.env.DATABASE_URL,
  });
});

// ── TEMPORARY: DWD diagnostic (no auth, secret path) ── REMOVE AFTER FIX ──
app.get('/api/_dwd-diag-x7k9', async (req, res) => {
  const { google } = require('googleapis');
  const diag = {
    nodeVersion: process.version,
    GOOGLE_ADMIN_EMAIL: process.env.GOOGLE_ADMIN_EMAIL || '(not set)',
    GOOGLE_ADMIN_EMAIL_length: (process.env.GOOGLE_ADMIN_EMAIL || '').length,
    GOOGLE_ADMIN_EMAIL_charCodes: [...(process.env.GOOGLE_ADMIN_EMAIL || '')].map(c => c.charCodeAt(0)),
    GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN || '(not set)',
    GOOGLE_SERVICE_ACCOUNT_KEY_set: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    GOOGLE_SERVICE_ACCOUNT_KEY_length: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').length,
  };

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      diag.key_client_email = parsed.client_email;
      diag.key_project_id = parsed.project_id;
      diag.key_pk_length = parsed.private_key?.length;
      diag.key_pk_has_real_newlines = parsed.private_key?.includes('\n');
      diag.key_pk_has_escaped_newlines = parsed.private_key?.includes('\\n');
      diag.key_pk_first30 = parsed.private_key?.substring(0, 30);
      diag.key_pk_last30 = parsed.private_key?.substring(parsed.private_key.length - 30);
    } catch (e) {
      diag.key_parse_error = e.message;
    }
  }

  // Test actual DWD auth
  try {
    const keyFile = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      subject: process.env.GOOGLE_ADMIN_EMAIL,
    });
    await auth.authorize();
    diag.dwd_result = 'SUCCESS';
  } catch (e) {
    diag.dwd_result = 'FAILED';
    diag.dwd_error = e.message;
    diag.dwd_error_code = e.code;
    if (e.response?.data) diag.dwd_response = e.response.data;
  }

  res.json(diag);
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

module.exports = app;
