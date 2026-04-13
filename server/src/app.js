require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { initializeOllama } = require('./services/ollama/init');
const { withCache, getCacheStats } = require('./middleware/cache');
const { getAllBreakerStatus } = require('./utils/circuitBreaker');

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
const saturdayPolicyRoutes = require('./routes/saturdayPolicy');
const policyRoutes = require('./routes/policies');
const payrollRoutes = require('./routes/payroll');
const salaryAdvanceRoutes = require('./routes/salaryAdvance');
const expenseRoutes = require('./routes/expenses');
const announcementRoutes = require('./routes/announcements');
const letterRoutes = require('./routes/letters');
const assetRoutes = require('./routes/assets');
const lifecycleRoutes = require('./routes/lifecycle');
const assetLifecycleRoutes = require('./routes/assetLifecycle');
const analyticsRoutes = require('./routes/analytics');
const surveyRoutes = require('./routes/surveys');
const ticketRoutes = require('./routes/tickets');
const otpRoutes = require('./routes/otp');
const wikiRoutes = require('./routes/wiki');
const suggestionRoutes = require('./routes/suggestions');
const notificationRoutes = require('./routes/notifications');
const fileRoutes = require('./routes/files');
const insuranceRoutes = require('./routes/insurance');
const predictionsRoutes = require('./routes/predictions');
const errorReportRoutes = require('./routes/errorReports');
const branchRoutes = require('./routes/branches');
const confirmationRoutes = require('./routes/confirmation');
const companyContractsRoutes = require('./routes/companyContracts');
const contractSigningRoutes = require('./routes/contractSigning');
const renewalsRoutes = require('./routes/renewals');
const biometricRoutes = require('./routes/biometric');
const companyMasterRoutes = require('./routes/companyMaster');
const complianceRoutes = require('./routes/compliance');
const compOffRoutes = require('./routes/compOff');
const regularizationRoutes = require('./routes/regularization');
const recruitmentRoutes = require('./routes/recruitment');
const musterRoutes = require('./routes/muster');
const appraisalRoutes = require('./routes/appraisals');
const goalRoutes = require('./routes/goals');
const wfhRoutes = require('./routes/wfh');
const exitInterviewRoutes = require('./routes/exitInterviews');
const separationRoutes = require('./routes/separation');
const assetRequestRoutes = require('./routes/assetRequests');
const visitorRoutes = require('./routes/visitors');
const grievanceRoutes = require('./routes/grievances');
const skillRoutes = require('./routes/skills');
const pulseRoutes = require('./routes/pulse');
const internalRoutes = require('./routes/internal');
const credentialRoutes = require('./routes/credentials');
const departmentRoutes = require('./routes/departments');
const securityAuditRoutes = require('./routes/securityAudit');
const { errorHandler } = require('./middleware/errorHandler');
const { asyncHandler } = require('./utils/asyncHandler');

const app = express();

// Trust Vercel/Cloudflare proxy — required for express-rate-limit to correctly
// read client IPs from X-Forwarded-For header (avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

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

// ═══ Security: CORS — restrict to own domains only ═══
const allowedOrigins = [
  'https://eod.colorpapers.in',
  'https://cpipl-activity-report.vercel.app',
  'https://colorpapers.in',
  'https://zgts.in',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174');
}
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ═══ Security: Request body size limits ═══
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ═══ Security: Rate limiting ═══
const rateLimit = require('express-rate-limit');
// General API rate limit: 200 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});
// Strict rate limit for auth endpoints: 20 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a minute.' },
});
app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);

// ═══ Security: Block indexing, scraping, and caching ═══
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS — enforce HTTPS for 1 year, include subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // CSP — restrict script/style sources to self + Clerk
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com https://drive.google.com https://*.clerk.com; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com; frame-src https://*.clerk.accounts.dev https://challenges.cloudflare.com; object-src 'none'; base-uri 'self';");
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
  // API endpoints: Never cache — always return fresh data
  else if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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

// ═══ Observability: Request ID injection ═══
// Each request gets a unique X-Request-ID header (passed through from upstream
// load-balancer if present, otherwise generated). This enables log correlation
// across distributed Vercel function instances without a central trace store.
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// ═══ Fault Tolerance: Request timeout — 30 seconds hard ceiling ═══
// Prevents runaway DB queries or external service calls from holding a
// serverless function open indefinitely (and burning Vercel compute credits).
// Self-healing: after 30 s the response is forcibly closed; the next
// identical request gets a fresh function invocation with a clean state.
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.error(`[TIMEOUT] ${req.method} ${req.originalUrl} exceeded 30 s (requestId: ${req.requestId})`);
      res.status(503).json({ error: 'Request timed out. Please try again.' });
    }
  }, 30_000);
  // Clear on both normal finish and premature client disconnect
  const cleanup = () => clearTimeout(timer);
  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
});

// Make prisma available to routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// ═══ Agent endpoints (unauthenticated — agent key only) ═══
// These are mounted BEFORE all other routes to ensure no auth middleware can intercept them.
// The local biometric sync agent on cpserver uses these to communicate with the cloud app.

// Track consecutive agent auth failures (in-memory, resets on success or server restart)
const agentAuthFailures = { count: 0, lastAlertAt: null };
const ALERT_EMAIL = 'jyoti.naik@colorpapers.in';
const MAX_FAILURES_BEFORE_ALERT = 3;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between alerts

async function checkAgentKey(req, res) {
  const expectedKey = (process.env.BIOMETRIC_AGENT_KEY || '').trim();
  const agentKey = (req.body?.agentKey || req.headers['x-agent-key'] || '').trim();

  // Misconfiguration: key not set in env
  if (!expectedKey) {
    console.error('[BIOMETRIC] BIOMETRIC_AGENT_KEY not set in environment! Sync will always fail.');
    res.status(503).json({ error: 'Server misconfiguration: BIOMETRIC_AGENT_KEY not set. Contact admin.' });
    return false;
  }

  if (agentKey === expectedKey) {
    agentAuthFailures.count = 0; // reset on success
    return true;
  }

  // Auth failed — track and alert
  agentAuthFailures.count += 1;
  const received = agentKey ? `${String(agentKey).slice(0, 4)}****` : '(none)';
  console.error(`[BIOMETRIC] Auth failure #${agentAuthFailures.count} — received key: ${received}`);

  // Send email alert after threshold, with cooldown
  if (agentAuthFailures.count >= MAX_FAILURES_BEFORE_ALERT) {
    const now = Date.now();
    if (!agentAuthFailures.lastAlertAt || (now - agentAuthFailures.lastAlertAt) > ALERT_COOLDOWN_MS) {
      agentAuthFailures.lastAlertAt = now;
      try {
        const { sendEmail } = require('./services/notifications/emailService');
        await sendEmail(
          ALERT_EMAIL,
          `⚠️ Biometric Sync Failing — Invalid Agent Key (${agentAuthFailures.count} failures)`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#dc2626;color:white;padding:20px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0">⚠️ Biometric Sync Authentication Failure</h2>
            </div>
            <div style="background:#fff;padding:20px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;">
              <p>The biometric sync agent on <strong>CPSERVER</strong> is failing to authenticate.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;width:40%">Failures so far</td><td style="padding:8px">${agentAuthFailures.count}</td></tr>
                <tr><td style="padding:8px;background:#f9fafb;font-weight:bold">Key received</td><td style="padding:8px;font-family:monospace">${received}</td></tr>
                <tr><td style="padding:8px;background:#f9fafb;font-weight:bold">Time</td><td style="padding:8px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
              <p style="color:#6b7280;font-size:13px;margin-top:16px"><strong>Action needed:</strong> Check that <code>BIOMETRIC_AGENT_KEY</code> in <code>esslSqlSync.js</code> on CPSERVER matches the value set in Vercel environment variables.</p>
              <p style="color:#6b7280;font-size:13px">Correct key starts with: <strong>${String(expectedKey).slice(0, 6)}****</strong></p>
            </div>
          </div>`
        );
        console.log(`[BIOMETRIC] Alert email sent to ${ALERT_EMAIL}`);
      } catch (mailErr) {
        console.error('[BIOMETRIC] Failed to send alert email:', mailErr.message);
      }
    }
  }

  res.status(401).json({
    error: 'Invalid agent key',
    hint: `Key received: ${received} — ensure BIOMETRIC_AGENT_KEY in esslSqlSync.js matches Vercel env var (starts with: ${String(expectedKey).slice(0, 6)}****)`,
    failures: agentAuthFailures.count,
  });
  return false;
}

// GET /api/agent/key-check — agent self-test endpoint
app.get('/api/agent/key-check', asyncHandler(async (req, res) => {
  const expectedKey = (process.env.BIOMETRIC_AGENT_KEY || '').trim();
  const agentKey = (req.headers['x-agent-key'] || '').trim();
  if (!expectedKey) return res.status(503).json({ ok: false, error: 'BIOMETRIC_AGENT_KEY not configured on server' });
  if (agentKey === expectedKey) {
    agentAuthFailures.count = 0;
    return res.json({ ok: true, message: 'Agent key is valid ✓' });
  }
  return res.status(401).json({ ok: false, error: 'Key mismatch', hint: `Expected key starts with: ${String(expectedKey).slice(0, 6)}****` });
}));

app.get('/api/agent/devices', asyncHandler(async (req, res) => {
  if (!await checkAgentKey(req, res)) return;
  const devices = await req.prisma.biometricDevice.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json(devices);
}));

app.post('/api/agent/sync', asyncHandler(async (req, res) => {
  if (!await checkAgentKey(req, res)) return;

  const { devices: deviceData } = req.body;
  if (!Array.isArray(deviceData) || deviceData.length === 0) {
    return res.json({ message: 'No device data received', results: [] });
  }

  const { processAndStorePunches } = require('./services/biometric/biometricSyncService');
  const results = [];
  for (const dd of deviceData) {
    const { deviceSerial, punches = [] } = dd;
    if (!deviceSerial) continue;

    const device = await req.prisma.biometricDevice.findUnique({
      where: { serialNumber: deviceSerial },
    });
    if (!device) {
      results.push({ device: deviceSerial, status: 'skipped', reason: 'Unknown device serial' });
      continue;
    }

    if (punches.length === 0) {
      await req.prisma.biometricDevice.update({
        where: { id: device.id },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncMessage: '0 new punches' },
      });
      results.push({ device: device.name, status: 'success', inserted: 0, matched: 0, processed: 0 });
      continue;
    }

    const result = await processAndStorePunches(req.prisma, device, punches);
    await req.prisma.biometricDevice.update({
      where: { id: device.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncMessage: `${result.inserted} new, ${result.matched} matched, ${result.processed} processed`,
      },
    });
    results.push({ device: device.name, status: 'success', ...result });
  }
  res.json({ received: deviceData.length, results });
}));

app.post('/api/agent/sync-single', asyncHandler(async (req, res) => {
  if (!await checkAgentKey(req, res)) return;

  const { deviceSerial, punches } = req.body;
  if (!deviceSerial) return res.status(400).json({ error: 'deviceSerial required' });
  if (!Array.isArray(punches) || punches.length === 0) {
    return res.json({ received: 0, inserted: 0, matched: 0, processed: 0 });
  }

  const device = await req.prisma.biometricDevice.findUnique({
    where: { serialNumber: deviceSerial },
  });
  if (!device) return res.status(400).json({ error: `Unknown device: ${deviceSerial}` });

  const { processAndStorePunches } = require('./services/biometric/biometricSyncService');
  const result = await processAndStorePunches(req.prisma, device, punches);

  await req.prisma.biometricDevice.update({
    where: { id: device.id },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
      lastSyncMessage: `${result.inserted} new, ${result.matched} matched, ${result.processed} processed`,
    },
  });
  res.json({ received: punches.length, ...result });
}));

// ═══ Performance: TTL cache for stable read-heavy endpoints ═══
// Pattern: per-instance Map cache with TTL expiry (see middleware/cache.js).
// Branches and holidays are fetched on every page load but change very rarely.
// This eliminates redundant DB round-trips for warm Vercel function containers.
// Cache is busted automatically by TTL; also invalidated via invalidateCache()
// in write handlers (branches route calls invalidateCache('/api/branches')).
app.use('/api/holidays', withCache(3600));   // 1-hour TTL — holidays change at most once a year
app.use('/api/branches', withCache(600));    // 10-min TTL — branches rarely change

// Public contract signing routes (no auth — token-based access)
const signingLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many requests.' } });
app.use('/api/contract-signing', signingLimiter, contractSigningRoutes);

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
app.use('/api/saturday-policy', saturdayPolicyRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/salary-advances', salaryAdvanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/asset-lifecycle', assetLifecycleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/wiki', wikiRoutes);
app.use('/api/suggestions', suggestionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/error-reports', errorReportRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/confirmation', confirmationRoutes);
app.use('/api/company-contracts', companyContractsRoutes);
app.use('/api/renewals', renewalsRoutes);
app.use('/api/biometric', biometricRoutes);
app.use('/api/company-master', companyMasterRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/comp-off', compOffRoutes);
app.use('/api/regularization', regularizationRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/muster', musterRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/security-audit', securityAuditRoutes);
app.use('/api/appraisals', appraisalRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/wfh', wfhRoutes);
app.use('/api/exit-interviews', exitInterviewRoutes);
app.use('/api/separation', separationRoutes);
app.use('/api/asset-requests', assetRequestRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/grievances', grievanceRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/pulse', pulseRoutes);

// ═══ Health check — real DB ping + circuit breaker status ═══
// Pattern: Active health probe that distinguishes "process is up" from
// "system is actually functional". Includes DB latency and circuit breaker
// states so monitoring dashboards can detect partial degradation early.
// Self-healing signal: if DB latency > 500 ms or breaker is OPEN, the
// overall status becomes "degraded" — allowing load balancers / uptime
// monitors to route traffic away or page on-call.
app.get('/api/health', asyncHandler(async (req, res) => {
  const startMs = Date.now();
  let dbStatus = 'ok', dbLatencyMs = null, dbError = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startMs;
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }

  let ollamaAvailable = false;
  try {
    const ollama = require('./services/ollama');
    ollamaAvailable = await ollama.ollamaClient.isAvailable();
  } catch { /* non-critical */ }

  const circuitBreakers = getAllBreakerStatus();
  const anyBreakerOpen = Object.values(circuitBreakers).some(b => b.state === 'OPEN');
  const overallStatus = dbStatus === 'error' ? 'error'
    : dbLatencyMs > 500 || anyBreakerOpen ? 'degraded'
    : 'ok';

  const mem = process.memoryUsage();

  res.status(overallStatus === 'error' ? 503 : 200).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    uptime: Math.round(process.uptime()),
    db: { status: dbStatus, latencyMs: dbLatencyMs, ...(dbError && { error: dbError }) },
    circuitBreakers,
    cache: getCacheStats(),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    },
    env: {
      clerkConfigured: !!process.env.CLERK_SECRET_KEY,
      dbConfigured: !!process.env.DATABASE_URL,
      ollamaConfigured: process.env.OLLAMA_ENABLED !== 'false',
      ollamaAvailable,
    },
  });
}));

// 404 handler for unmatched /api/* routes — returns JSON instead of hanging
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler (must be after all routes)
app.use(errorHandler);

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
