const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateAuthUrl, exchangeCodeForTokens, storeTokens } = require('../services/googleAuth');
const { fetchGoogleWorkspaceUsers } = require('../services/googleWorkspace');
const { fetchTodayCalendarEvents, fetchTodayTasks } = require('../services/googleCalendar');

const router = express.Router();

// ─── Per-User OAuth2 Flow (Calendar/Tasks) ───

// GET /api/google/auth-url - Get OAuth2 consent URL
router.get('/auth-url', authenticate, (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'Google OAuth2 not configured. Set GOOGLE_CLIENT_ID in .env' });
    }
    const url = generateAuthUrl(req.user.id);
    res.json({ url });
  } catch (err) {
    console.error('Auth URL error:', err);
    res.status(500).json({ error: 'Failed to generate auth URL.' });
  }
});

// GET /api/google/callback - OAuth2 callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state.');
    }

    const userId = parseInt(state);
    if (isNaN(userId)) {
      return res.status(400).send('Invalid state parameter.');
    }

    const tokens = await exchangeCodeForTokens(code);
    await storeTokens(userId, tokens, req.prisma);

    // Redirect to frontend settings page with success
    res.redirect('http://localhost:3000/submit-report?google=connected');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('http://localhost:3000/submit-report?google=error');
  }
});

// GET /api/google/status - Check if current user has Google connected
router.get('/status', authenticate, async (req, res) => {
  try {
    const token = await req.prisma.googleToken.findUnique({
      where: { userId: req.user.id },
      select: { scopes: true, expiresAt: true },
    });
    res.json({
      connected: !!token,
      scopes: token?.scopes || '',
      expiresAt: token?.expiresAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/google/disconnect - Remove Google tokens
router.delete('/disconnect', authenticate, async (req, res) => {
  try {
    await req.prisma.googleToken.deleteMany({ where: { userId: req.user.id } });
    res.json({ message: 'Google account disconnected.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Google Admin: Import Users ───

// GET /api/google/import-users - Fetch users from Google Workspace
router.get('/import-users', authenticate, requireAdmin, async (req, res) => {
  try {
    const domain = process.env.GOOGLE_WORKSPACE_DOMAIN;
    if (!domain) {
      return res.status(400).json({ error: 'GOOGLE_WORKSPACE_DOMAIN not configured in .env' });
    }

    const googleUsers = await fetchGoogleWorkspaceUsers(domain);

    // Cross-reference with existing users
    const existingEmails = new Set(
      (await req.prisma.user.findMany({ select: { email: true } }))
        .map((u) => u.email.toLowerCase())
    );

    const result = googleUsers.map((gu) => ({
      ...gu,
      alreadyExists: existingEmails.has(gu.email.toLowerCase()),
    }));

    res.json(result);
  } catch (err) {
    console.error('Import users error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch Google Workspace users.' });
  }
});

// POST /api/google/import-users - Create selected users in the system
router.post('/import-users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { users } = req.body; // array of { googleId, name, email, department }
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No users provided.' });
    }

    const created = [];
    for (const u of users) {
      // Skip if already exists
      const existing = await req.prisma.user.findUnique({ where: { email: u.email } });
      if (existing) continue;

      // Generate random password (user should reset on first login)
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const newUser = await req.prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashedPassword,
          role: 'member',
          department: u.department || 'General',
          googleId: u.googleId || null,
          importedFromGoogle: true,
        },
      });

      created.push({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        tempPassword,
      });
    }

    res.json({
      message: `${created.length} user(s) imported successfully.`,
      users: created,
    });
  } catch (err) {
    console.error('Import users create error:', err);
    res.status(500).json({ error: 'Failed to import users.' });
  }
});

// ─── Calendar & Tasks ───

// GET /api/google/calendar-events - Get today's calendar events
router.get('/calendar-events', authenticate, async (req, res) => {
  try {
    const events = await fetchTodayCalendarEvents(req.user.id, req.prisma);
    res.json(events);
  } catch (err) {
    console.error('Calendar events error:', err);
    res.status(400).json({ error: err.message || 'Failed to fetch calendar events.' });
  }
});

// GET /api/google/tasks - Get today's tasks
router.get('/tasks', authenticate, async (req, res) => {
  try {
    const tasks = await fetchTodayTasks(req.user.id, req.prisma);
    res.json(tasks);
  } catch (err) {
    console.error('Tasks error:', err);
    res.status(400).json({ error: err.message || 'Failed to fetch tasks.' });
  }
});

module.exports = router;
