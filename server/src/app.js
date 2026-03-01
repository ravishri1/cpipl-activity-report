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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clerkConfigured: !!process.env.CLERK_SECRET_KEY,
    dbConfigured: !!process.env.DATABASE_URL,
  });
});

// Debug auth — temporary endpoint to diagnose token issues
app.post('/api/debug-auth', async (req, res) => {
  const authHeader = req.headers.authorization;
  const hasToken = !!(authHeader && authHeader.startsWith('Bearer '));
  const result = {
    hasAuthHeader: hasToken,
    tokenLength: hasToken ? authHeader.split(' ')[1].length : 0,
    clerkKeySet: !!process.env.CLERK_SECRET_KEY,
  };

  if (hasToken && process.env.CLERK_SECRET_KEY) {
    try {
      const { createClerkClient } = require('@clerk/express');
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      const token = authHeader.split(' ')[1];
      const verified = await clerk.verifyToken(token);
      result.verifySuccess = true;
      result.userId = verified.sub;
      result.sessionId = verified.sid;
    } catch (err) {
      result.verifySuccess = false;
      result.verifyError = err.message;
      result.errorCode = err.code || err.status || 'unknown';
    }
  }

  res.json(result);
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
