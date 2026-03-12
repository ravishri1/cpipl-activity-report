const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, forbidden } = require('../utils/httpErrors');
const { normalizeName } = require('../utils/normalize');
const { generateAuthUrl, exchangeCodeForTokens, storeTokens } = require('../services/google/googleAuth');
const { fetchGoogleWorkspaceUsers } = require('../services/google/googleWorkspace');
const { fetchTodayCalendarEvents, fetchTodayTasks } = require('../services/google/googleCalendar');

const router = express.Router();

// ─── Per-User OAuth2 Flow (Calendar/Tasks) ───

// GET /api/google/auth-url
router.get('/auth-url', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) throw badRequest('Google OAuth2 not configured. Set GOOGLE_CLIENT_ID in .env');
  const url = generateAuthUrl(req.user.id);
  res.json({ url });
}));

// GET /api/google/callback — OAuth2 callback (no auth, uses redirects)
// Intentional try-catch: errors must redirect, not return JSON
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing authorization code or state.');
    const userId = parseInt(state);
    if (isNaN(userId)) return res.status(400).send('Invalid state parameter.');
    const tokens = await exchangeCodeForTokens(code);
    await storeTokens(userId, tokens, req.prisma);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/submit-report?google=connected`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/submit-report?google=error`);
  }
});

// GET /api/google/status
router.get('/status', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const token = await req.prisma.googleToken.findUnique({
    where: { userId: req.user.id },
    select: { scopes: true, expiresAt: true },
  });
  res.json({ connected: !!token, scopes: token?.scopes || '', expiresAt: token?.expiresAt || null });
}));

// DELETE /api/google/disconnect
router.delete('/disconnect', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  await req.prisma.googleToken.deleteMany({ where: { userId: req.user.id } });
  res.json({ message: 'Google account disconnected.' });
}));

// ─── Google Admin: Import Users ───

// GET /api/google/import-users — Restricted to me@colorpapers.in
router.get('/import-users', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  if (req.user.email !== 'me@colorpapers.in') throw forbidden('Only the primary admin can import Google Workspace users.');
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  if (!domain) throw badRequest('GOOGLE_WORKSPACE_DOMAIN not configured in .env');
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
  if (!adminEmail) throw badRequest('GOOGLE_ADMIN_EMAIL not configured in .env');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    throw badRequest('Google service account key not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env');
  }

  const googleUsers = await fetchGoogleWorkspaceUsers(domain);
  const existingEmails = new Set(
    (await req.prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase())
  );
  res.json(googleUsers.map(gu => ({ ...gu, alreadyExists: existingEmails.has(gu.email.toLowerCase()) })));
}));

// POST /api/google/import-users — Create selected users
router.post('/import-users', authenticate, requireActiveEmployee, requireAdmin, asyncHandler(async (req, res) => {
  if (req.user.email !== 'me@colorpapers.in') throw forbidden('Only the primary admin can import Google Workspace users.');
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL?.trim();
  if (!adminEmail) throw badRequest('GOOGLE_ADMIN_EMAIL not configured in .env');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    throw badRequest('Google service account key not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env');
  }
  const { users } = req.body;
  if (!users || !Array.isArray(users) || users.length === 0) throw badRequest('No users provided.');

  const created = [];
  for (const u of users) {
    const existing = await req.prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue;
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const newUser = await req.prisma.user.create({
      data: {
        name: normalizeName(u.name), email: u.email, password: hashedPassword,
        role: 'member', department: u.department || 'General',
        googleId: u.googleId || null, importedFromGoogle: true,
      },
    });
    created.push({ id: newUser.id, name: newUser.name, email: newUser.email, tempPassword });
  }
  res.json({ message: `${created.length} user(s) imported successfully.`, users: created });
}));

// ─── Calendar & Tasks ───

// GET /api/google/calendar-events
router.get('/calendar-events', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const events = await fetchTodayCalendarEvents(req.user.id, req.prisma);
  res.json(events);
}));

// GET /api/google/tasks
router.get('/tasks', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const tasks = await fetchTodayTasks(req.user.id, req.prisma);
  res.json(tasks);
}));

// ─── Combined Auto-Tasks ───

// GET /api/google/auto-tasks?date=YYYY-MM-DD
// Inner try-catches intentional: each source fails independently for partial results
router.get('/auto-tasks', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const result = { calendar: [], tasks: [], email: null, chat: null };

  try { result.calendar = await fetchTodayCalendarEvents(req.user.id, req.prisma); }
  catch (err) { result.calendarError = err.message; }

  try { result.tasks = await fetchTodayTasks(req.user.id, req.prisma); }
  catch (err) { result.tasksError = err.message; }

  const emailDate = new Date(date);
  emailDate.setDate(emailDate.getDate() - 2);
  const emailDateStr = emailDate.toISOString().split('T')[0];

  try {
    const emailActivity = await req.prisma.emailActivity.findUnique({
      where: { userId_activityDate: { userId: req.user.id, activityDate: emailDateStr } },
    });
    if (emailActivity) {
      result.email = { sent: emailActivity.emailsSent, received: emailActivity.emailsReceived, date: emailDateStr };
    }
  } catch (_) { /* ignore */ }

  try {
    const chatActivity = await req.prisma.chatActivity.findUnique({
      where: { userId_activityDate: { userId: req.user.id, activityDate: emailDateStr } },
    });
    if (chatActivity) {
      result.chat = { messagesSent: chatActivity.messagesSent, date: emailDateStr };
    }
  } catch (_) { /* ignore */ }

  res.json(result);
}));

module.exports = router;
