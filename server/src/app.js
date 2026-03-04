require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { initializeOllama } = require('./services/ollama/init');

const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const googleRoutes = require('./routes/google');
const pointsRoutes = require('./routes/points');
const attendanceRoutes = require('./routes/attendance');
const shiftsRoutes = require('./routes/shifts');
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
const assetLifecycleRoutes = require('./routes/assetLifecycle');
const overtimeRoutes = require('./routes/overtime');
const analyticsRoutes = require('./routes/analytics');
const surveyRoutes = require('./routes/surveys');
const ticketRoutes = require('./routes/tickets');
const otpRoutes = require('./routes/otp');
const wikiRoutes = require('./routes/wiki');
const suggestionRoutes = require('./routes/suggestions');
const trainingRoutes = require('./routes/training');
const notificationRoutes = require('./routes/notifications');
const fileRoutes = require('./routes/files');
const insuranceRoutes = require('./routes/insurance');
const procurementRoutes = require('./routes/procurement');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Use a single Prisma instance (important for serverless)
let prisma;
if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}
prisma = global.__prisma;

// Initialize Ollama (free, local AI inference)
if (process.env.NODE_ENV !== 'test') {
  initializeOllama().catch(err => {
    console.error('[App] Ollama initialization warning (non-critical):', err.message);
  });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══ Security: Block indexing, scraping, and caching ═══
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ═══ Performance: Caching Headers (Phase 1 Optimization) ═══
app.use((req, res, next) => {
  // Static assets: Cache for 1 year (immutable, content-hashed by Vite)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|svg)$/i)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
  }
  // HTML: No-cache, always revalidate for latest version
  else if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, public, must-revalidate, max-age=0');
    next();
  }
  // API endpoints: 5-minute cache for GET requests (safe/idempotent)
  else if (req.method === 'GET' && req.path.startsWith('/api/')) {
    // Exclude sensitive endpoints from caching
    const noCacheEndpoints = ['/api/auth', '/api/users/me', '/api/dashboard'];
    if (noCacheEndpoints.some(ep => req.path.startsWith(ep))) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
    next();
  }
  // Other requests: No cache by default
  else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  }
});

// ═══ Performance: Enable GZIP compression ═══
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    // Don't compress small responses
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6, // Balance between CPU and compression ratio
}));

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
app.use('/api/shifts', shiftsRoutes);
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
app.use('/api/asset-lifecycle', assetLifecycleRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/procurement', procurementRoutes);

// Global error handler (must be after all routes)
app.use(errorHandler);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const ollama = require('./services/ollama');
    const ollamaAvailable = await ollama.ollamaClient.isAvailable();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      clerkConfigured: !!process.env.CLERK_SECRET_KEY,
      dbConfigured: !!process.env.DATABASE_URL,
      ollamaConfigured: process.env.OLLAMA_ENABLED !== 'false',
      ollamaAvailable,
    });
  } catch (error) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      clerkConfigured: !!process.env.CLERK_SECRET_KEY,
      dbConfigured: !!process.env.DATABASE_URL,
      ollamaConfigured: process.env.OLLAMA_ENABLED !== 'false',
      ollamaAvailable: false,
      ollamaError: error.message,
    });
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
