require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { clerkMiddleware } = require('@clerk/express');

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const googleRoutes = require('./routes/google');

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

// Clerk middleware — parses session JWT from Authorization header
// Makes auth state available via getAuth(req) in route handlers
app.use(clerkMiddleware());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clerkConfigured: !!process.env.CLERK_SECRET_KEY,
    dbConfigured: !!process.env.DATABASE_URL,
  });
});

// Debug auth — temporary endpoint to diagnose 401 issues
app.post('/api/debug-auth', (req, res) => {
  const { getAuth } = require('@clerk/express');
  try {
    const auth = getAuth(req);
    const authHeader = req.headers.authorization;
    res.json({
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : null,
      authUserId: auth?.userId || null,
      authSessionId: auth?.sessionId || null,
      clerkKeySet: !!process.env.CLERK_SECRET_KEY,
      clerkKeyPrefix: process.env.CLERK_SECRET_KEY ? process.env.CLERK_SECRET_KEY.substring(0, 10) + '...' : null,
    });
  } catch (err) {
    res.json({ error: err.message, stack: err.stack?.substring(0, 300) });
  }
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
