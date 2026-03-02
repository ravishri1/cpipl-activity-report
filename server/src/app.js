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
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const holidayRoutes = require('./routes/holidays');
const importRoutes = require('./routes/import');
const companyRoutes = require('./routes/companies');
const extractionRoutes = require('./routes/extraction');
const policyRoutes = require('./routes/policies');
const payrollRoutes = require('./routes/payroll');
const expenseRoutes = require('./routes/expenses');
const announcementRoutes = require('./routes/announcements');
const letterRoutes = require('./routes/letters');
const assetRoutes = require('./routes/assets');
const lifecycleRoutes = require('./routes/lifecycle');
const overtimeRoutes = require('./routes/overtime');
const analyticsRoutes = require('./routes/analytics');
const surveyRoutes = require('./routes/surveys');
const ticketRoutes = require('./routes/tickets');
const otpRoutes = require('./routes/otp');
const wikiRoutes = require('./routes/wiki');
const suggestionRoutes = require('./routes/suggestions');
const trainingRoutes = require('./routes/training');
const { errorHandler } = require('./middleware/errorHandler');

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
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/import', importRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/extraction', extractionRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/training', trainingRoutes);

// Global error handler (must be after all routes)
app.use(errorHandler);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clerkConfigured: !!process.env.CLERK_SECRET_KEY,
    dbConfigured: !!process.env.DATABASE_URL,
  });
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
