const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, forbidden, notFound } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const { normalizeName } = require('../utils/normalize');
const { generateAuthUrl, exchangeCodeForTokens, storeTokens } = require('../services/google/googleAuth');
const { fetchGoogleWorkspaceUsers, syncFromWorkspace } = require('../services/google/googleWorkspace');
const { fetchTodayCalendarEvents, fetchTodayTasks, upsertGoogleTask } = require('../services/google/googleCalendar');
const { buildEmailSummary, filterHandledThreads } = require('../services/google/googleGmail');
const { getAuthedClientForUser } = require('../services/google/googleAuth');

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
  // Derive client URL: explicit env var > production default > localhost fallback
  const clientUrl = process.env.CLIENT_URL?.trim()
    || (process.env.VERCEL ? 'https://eod.colorpapers.in' : 'http://localhost:3000');

  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing authorization code or state.');
    const userId = parseInt(state);
    if (isNaN(userId)) return res.status(400).send('Invalid state parameter.');
    const tokens = await exchangeCodeForTokens(code);
    await storeTokens(userId, tokens, req.prisma);
    res.redirect(`${clientUrl}/submit-report?google=connected`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${clientUrl}/submit-report?google=error`);
  }
});

// GET /api/google/status
router.get('/status', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const token = await req.prisma.googleToken.findUnique({
    where: { userId: req.user.id },
    select: { scopes: true, expiresAt: true },
  });
  const scopes = token?.scopes || '';
  const hasGmailScope = scopes.includes('gmail.readonly');
  const hasTasksWriteScope = scopes.includes('/auth/tasks') && !scopes.includes('tasks.readonly');
  const hasDriveScope = scopes.includes('drive.file') || scopes.includes('/auth/drive');
  res.json({
    connected: !!token,
    scopes,
    expiresAt: token?.expiresAt || null,
    hasGmailScope,
    hasTasksWriteScope,
    hasDriveScope,
    needsReconnect: !!token && (!hasGmailScope || !hasDriveScope),
  });
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
        role: 'member', department: u.department || '',
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
  const result = { calendar: [], tasks: [], email: null, chat: null, emailDetails: null };

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

  // ─── NEW: Live Gmail email details (if user has gmail scope) ───
  try {
    const tokenRecord = await req.prisma.googleToken.findUnique({
      where: { userId: req.user.id },
      select: { scopes: true },
    });
    if (tokenRecord?.scopes?.includes('gmail.readonly')) {
      let emailSummary = await buildEmailSummary(req.user.id, req.prisma, date);

      // Filter out handled threads (DB-backed closure)
      const handledThreads = await req.prisma.emailHandledThread.findMany({
        where: { userId: req.user.id, date },
        select: { threadId: true },
      });
      if (handledThreads.length > 0) {
        const handledSet = new Set(handledThreads.map(h => h.threadId));
        emailSummary = filterHandledThreads(emailSummary, handledSet);
      }

      result.emailDetails = emailSummary;
    }
  } catch (err) { result.emailDetailsError = err.message; }

  res.json(result);
}));

// ─── Mark Threads as Handled (DB-backed closure) ───

// POST /api/google/mark-handled
router.post('/mark-handled', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const { threadIds, action } = req.body;
  if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) throw badRequest('No threadIds provided.');
  if (!action) throw badRequest('Action is required (added_to_report, pushed_to_task, marked_handled).');

  const date = new Date().toISOString().split('T')[0];
  let marked = 0;

  for (const threadId of threadIds) {
    try {
      await req.prisma.emailHandledThread.upsert({
        where: { userId_threadId_date: { userId: req.user.id, threadId, date } },
        update: { action },
        create: { userId: req.user.id, threadId, date, action },
      });
      marked++;
    } catch { /* skip duplicate or error */ }
  }

  res.json({ marked });
}));

// ─── Push Unreplied Threads to Google Tasks (Upsert) ───

// POST /api/google/push-to-tasks
router.post('/push-to-tasks', authenticate, requireActiveEmployee, asyncHandler(async (req, res) => {
  const { threads } = req.body;
  if (!threads || !Array.isArray(threads) || threads.length === 0) throw badRequest('No threads provided.');

  const oauth2Client = await getAuthedClientForUser(req.user.id, req.prisma);
  const date = new Date().toISOString().split('T')[0];
  let created = 0, updated = 0, failed = 0;

  for (const t of threads) {
    try {
      const result = await upsertGoogleTask(oauth2Client, {
        category: t.category,
        company: t.company,
        threadId: t.threadId,
        subject: t.subject,
        emailCount: t.emailCount || 0,
        sentCount: t.sentCount || 0,
        receivedCount: t.receivedCount || 0,
      });
      if (result.action === 'created') created++;
      else updated++;

      // Mark as handled in DB
      try {
        await req.prisma.emailHandledThread.upsert({
          where: { userId_threadId_date: { userId: req.user.id, threadId: t.threadId, date } },
          update: { action: 'pushed_to_task' },
          create: { userId: req.user.id, threadId: t.threadId, date, action: 'pushed_to_task' },
        });
      } catch { /* ignore */ }
    } catch (err) {
      console.error(`Push-to-tasks failed for thread ${t.threadId}:`, err.message);
      failed++;
    }
  }

  res.json({ created, updated, failed });
}));

// ─── Sync from Google Workspace → EOD profile ───

// POST /api/google/sync-from-workspace/:userId — Admin only
router.post('/sync-from-workspace/:userId', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  const user = await req.prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw notFound('User');

  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  if (!domain || !user.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
    throw badRequest('This user does not have a Workspace (@colorpapers.in) email.');
  }

  const ws = await syncFromWorkspace(user.email);

  const updateData = {};
  if (ws.name && ws.name !== user.name) updateData.name = ws.name;
  if (ws.department) updateData.department = ws.department;
  if (ws.phone) updateData.phone = ws.phone;
  if (ws.employeeId) updateData.employeeId = ws.employeeId;
  if (ws.managerEmail) {
    const mgr = await req.prisma.user.findUnique({ where: { email: ws.managerEmail }, select: { id: true } });
    if (mgr) updateData.reportingManagerId = mgr.id;
  }

  if (Object.keys(updateData).length === 0) {
    return res.json({ message: 'Already in sync — no changes needed.', synced: {} });
  }

  await req.prisma.user.update({ where: { id: userId }, data: updateData });
  res.json({ message: 'Profile synced from Google Workspace.', synced: updateData });
}));

module.exports = router;
