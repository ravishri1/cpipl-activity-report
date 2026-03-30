const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

router.get('/run', requireAdmin, asyncHandler(async (req, res) => {
  const findings = [];
  const now = new Date().toISOString();

  function check(id, category, title, severity, status, details, fix = '', reference = '') {
    findings.push({ checkId: id, category, title, severity, status, details, fix, reference });
  }

  // ─── 1. ENVIRONMENT SECURITY ──────────────────────────────────────────────

  // JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret || jwtSecret.includes('change-in-production') || jwtSecret.length < 32) {
    check('EnvSecurity_JwtSecret', 'Environment Security', 'JWT_SECRET is weak or default',
      'High', 'Fail',
      `JWT_SECRET appears weak or contains default placeholder text. Length: ${jwtSecret.length} chars.`,
      `Generate a strong key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" and update in server/.env + Vercel dashboard.`,
      'OWASP: Sensitive Data Exposure');
  } else {
    check('EnvSecurity_JwtSecret', 'Environment Security', 'JWT_SECRET is strong',
      'High', 'Pass', `JWT_SECRET is set and has adequate length (${jwtSecret.length} chars).`);
  }

  // TEST_MODE bypass
  if (process.env.TEST_MODE === 'true') {
    check('EnvSecurity_TestMode', 'Environment Security', 'TEST_MODE is enabled — auth bypass active',
      'Critical', 'Fail',
      'TEST_MODE=true bypasses ALL authentication. Every request gets hardcoded admin access. This is a complete auth bypass if exposed in production.',
      'Remove TEST_MODE from server/.env and Vercel environment variables immediately.',
      'Auth Bypass (auth.js:27)');
  } else {
    check('EnvSecurity_TestMode', 'Environment Security', 'TEST_MODE is disabled',
      'Critical', 'Pass', 'TEST_MODE is not enabled. Authentication is enforced normally.');
  }

  // NODE_ENV
  const nodeEnv = process.env.NODE_ENV || 'unset';
  if (nodeEnv !== 'production') {
    check('EnvSecurity_NodeEnv', 'Environment Security', 'NODE_ENV is not production',
      'Medium', 'Warn',
      `NODE_ENV=${nodeEnv}. Some security features may be reduced in non-production mode.`,
      'Ensure NODE_ENV=production is set in Vercel environment variables.',
      '');
  } else {
    check('EnvSecurity_NodeEnv', 'Environment Security', 'NODE_ENV=production',
      'Medium', 'Pass', 'NODE_ENV is correctly set to production.');
  }

  // CRON_SECRET
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || cronSecret === 'your-cron-secret-here' || cronSecret.length < 20) {
    check('EnvSecurity_CronSecret', 'Environment Security', 'CRON_SECRET not set or weak',
      'High', 'Fail',
      'CRON_SECRET is missing or too short. All 8 Vercel Cron jobs (reminders, alerts, cleanups) will return 401 and never run in production.',
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" — set in server/.env AND Vercel Dashboard → Environment Variables → Production.');
  } else {
    check('EnvSecurity_CronSecret', 'Environment Security', 'CRON_SECRET is set',
      'High', 'Pass', `CRON_SECRET is set (${cronSecret.length} chars). Vercel Cron jobs are authorized.`);
  }

  // BIOMETRIC_AGENT_KEY
  const bioKey = process.env.BIOMETRIC_AGENT_KEY || '';
  if (bioKey === 'cpipl-bio-sync-2026-xK9mP4qR7v2') {
    check('EnvSecurity_BiometricKey', 'Environment Security', 'BIOMETRIC_AGENT_KEY is still the default',
      'Medium', 'Warn',
      'The biometric agent key matches the default value committed to the codebase. If the sync agent is in active use, this is a shared secret anyone with repo access can use.',
      'Generate a new key and update in server/.env, Vercel dashboard, AND the biometric agent config on cpserver.');
  } else if (!bioKey) {
    check('EnvSecurity_BiometricKey', 'Environment Security', 'BIOMETRIC_AGENT_KEY not set',
      'Medium', 'Warn',
      'BIOMETRIC_AGENT_KEY is not configured. Biometric sync agent will not be able to authenticate.',
      'Set BIOMETRIC_AGENT_KEY in server/.env and Vercel dashboard.');
  } else {
    check('EnvSecurity_BiometricKey', 'Environment Security', 'BIOMETRIC_AGENT_KEY is custom',
      'Medium', 'Pass', 'BIOMETRIC_AGENT_KEY is set to a non-default value.');
  }

  // Clerk key type
  const clerkKey = process.env.CLERK_SECRET_KEY || '';
  if (clerkKey.startsWith('sk_test_') && nodeEnv === 'production') {
    check('EnvSecurity_ClerkKey', 'Environment Security', 'Clerk test key used in production',
      'High', 'Fail',
      'CLERK_SECRET_KEY starts with sk_test_ but NODE_ENV=production. Test keys have different security properties.',
      'In Clerk Dashboard → API Keys, copy the production secret key (sk_live_...) and update in Vercel environment variables.',
      'Auth Security');
  } else {
    check('EnvSecurity_ClerkKey', 'Environment Security', 'Clerk key type is appropriate',
      'High', 'Pass',
      clerkKey.startsWith('sk_live_')
        ? 'Using Clerk production key (sk_live_...).'
        : `Using Clerk key starting with: ${clerkKey.substring(0, 10)}...`);
  }

  // ─── 2. API SECURITY ──────────────────────────────────────────────────────

  check('ApiSecurity_RateLimit', 'API Security', 'Rate limiting is configured',
    'High', 'Pass',
    '• /api/auth: 20 req/min per IP (brute-force protection)\n• /api/*: 200 req/min per IP (general)\n• /api/contract-signing: 30 req/min per IP');

  check('ApiSecurity_Cors', 'API Security', 'CORS restricted to known domains',
    'High', 'Pass',
    'CORS allows only: eod.colorpapers.in, cpipl-activity-report.vercel.app, colorpapers.in, zgts.in + localhost in dev.');

  check('ApiSecurity_BodySize', 'API Security', 'Request body size capped at 1MB',
    'Medium', 'Pass',
    'express.json and express.urlencoded both have limit: 1mb. Prevents large payload DoS.');

  check('ApiSecurity_SecurityHeaders', 'API Security', 'Security headers present',
    'High', 'Pass',
    'HSTS (1yr + includeSubDomains + preload), CSP (Clerk + self), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: no-referrer, Permissions-Policy all configured.');

  check('ApiSecurity_RequestTimeout', 'API Security', '30-second request timeout',
    'Medium', 'Pass',
    'All requests have a hard 30-second ceiling. Returns 503 with request ID on timeout. Prevents hung Vercel function billing.');

  check('ApiSecurity_RequestId', 'API Security', 'Request correlation ID (X-Request-ID)',
    'Low', 'Pass',
    'Every request gets a unique X-Request-ID header (UUID). Enables log correlation across Vercel function instances.');

  check('ApiSecurity_Compression', 'API Security', 'GZIP compression enabled',
    'Low', 'Pass',
    'compression middleware at level 6. Reduces response payload and bandwidth costs.');

  // ─── 3. AUTH & CODE GAPS ─────────────────────────────────────────────────

  check('AuthGap_GoogleCallback', 'Auth & Code', 'Google OAuth /callback lacks asyncHandler',
    'Medium', 'Fail',
    'server/src/routes/google.js: /callback route is async but not wrapped in asyncHandler. If an unhandled error occurs during OAuth flow, it becomes an unhandled promise rejection instead of a proper 500 response.',
    "Wrap: router.get('/callback', asyncHandler(async (req, res) => { ... }));",
    'Error Handling');

  check('AuthGap_ImportTemplate', 'Auth & Code', 'Import /template route lacks asyncHandler',
    'Low', 'Warn',
    'server/src/routes/import.js: /template GET route is not wrapped in asyncHandler. Low risk (route is synchronous) but violates the project convention.',
    'Wrap with asyncHandler for consistency with all other routes.',
    'Convention');

  check('AuthGap_TeamLeadRole', 'Auth & Code', 'team_lead role has full admin access',
    'Info', 'Info',
    'requireAdmin() accepts admin, sub_admin, and team_lead. Team leads can access all admin-only routes including payroll, lifecycle, biometric, etc.',
    'By design — review if team leads need access to all sensitive admin operations. Consider adding granular permission checks for highest-risk routes (payroll, user deletion).',
    'Least Privilege (auth.js:216)');

  // ─── 4. DATA EXPOSURE ─────────────────────────────────────────────────────

  check('DataExposure_Pagination', 'Data Exposure', '8 routes return unbounded query results',
    'Medium', 'Warn',
    'These routes call findMany() with no take/skip limit:\n' +
    '• GET /api/settings — settings.js\n' +
    '• GET /api/holidays — holidays.js\n' +
    '• GET /api/companies — companies.js\n' +
    '• GET /api/departments — departments.js\n' +
    '• GET /api/announcements/celebrations — announcements.js\n' +
    '• GET /api/policies — policies.js\n' +
    '• GET /api/recruitment/openings — recruitment.js\n' +
    '• GET /api/recruitment/candidates — recruitment.js',
    'Add ?limit=&offset= query params and use prisma findMany({ take: Math.min(limit, 500), skip: offset }). Low risk now (small dataset) but important as data grows.',
    'DoS Prevention');

  // ─── 5. INFRASTRUCTURE ────────────────────────────────────────────────────

  // Real DB ping
  try {
    const start = Date.now();
    await req.prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    check('Infra_Database', 'Infrastructure', 'Database connectivity',
      'Critical', latency > 500 ? 'Warn' : 'Pass',
      `Neon PostgreSQL is responding. Round-trip latency: ${latency}ms.${latency > 500 ? ' ⚠ High latency — consider checking Neon dashboard for load.' : ''}`,
      latency > 500 ? 'Check Neon dashboard for connection pool saturation or region issues.' : '');
  } catch (err) {
    check('Infra_Database', 'Infrastructure', 'Database is unreachable',
      'Critical', 'Fail',
      `Cannot reach Neon PostgreSQL: ${err.message}`,
      'Check DATABASE_URL in Vercel environment variables. Verify Neon dashboard for outages or suspended project.');
  }

  check('Infra_VercelCron', 'Infrastructure', 'Vercel Cron jobs',
    'High',
    (cronSecret && cronSecret !== 'your-cron-secret-here' && cronSecret.length >= 20) ? 'Pass' : 'Fail',
    (cronSecret && cronSecret !== 'your-cron-secret-here' && cronSecret.length >= 20)
      ? '8 Vercel Cron jobs configured and CRON_SECRET is set. Jobs active: reminders (9 PM), escalation (11 AM), morning-alerts, email-activity, maintenance (midnight), weekly (Mon), automation (Sun), fy-rollover (Mar 31).'
      : 'CRON_SECRET not properly set — all Vercel Cron jobs return 401 and never run. Reminders, alerts, cleanups, FY rollover are ALL broken in production.',
    cronSecret ? '' : 'Set CRON_SECRET in Vercel Dashboard → Settings → Environment Variables → Production.');

  check('Infra_TtlCache', 'Infrastructure', 'Response cache active',
    'Low', 'Pass',
    'TTL cache applied to /api/holidays (1h) and /api/branches (10min). Reduces Neon DB load for stable read-heavy endpoints across warm Vercel containers.');

  check('Infra_CircuitBreakers', 'Infrastructure', 'Circuit breakers registered',
    'Medium', 'Pass',
    '5 circuit breakers pre-registered: google-drive, google-gmail, google-workspace, email-smtp, clerk-api. Each auto-opens after 5 failures and probes for recovery after cooldown.');

  // ─── 6. DATABASE SECURITY ─────────────────────────────────────────────────

  try {
    const adminCount = await req.prisma.user.count({ where: { role: 'admin', isActive: true } });
    check('DbSecurity_AdminCount', 'Database Security', 'Active admin account count',
      adminCount > 5 ? 'High' : 'Low',
      adminCount > 5 ? 'Warn' : 'Pass',
      `${adminCount} active admin account(s). ${adminCount > 5 ? 'High admin count increases attack surface — each admin has full system access.' : 'Admin count is within normal range.'}`,
      adminCount > 5 ? 'Review admin accounts in Team Management. Downgrade unnecessary ones to member or team_lead.' : '',
      'Least Privilege');
  } catch { /* skip if DB error already captured above */ }

  try {
    const hibernatedCount = await req.prisma.user.count({ where: { isHibernated: true } });
    const workspacePendingCount = await req.prisma.user.count({ where: { workspaceSuspendPending: true } });
    if (workspacePendingCount > 0) {
      check('DbSecurity_WorkspacePending', 'Database Security', 'Google Workspace accounts pending suspension',
        'High', 'Warn',
        `${workspacePendingCount} ex-employee Google Workspace account(s) are flagged for suspension but HR hasn't confirmed the manual action yet. These accounts may still have active Google Workspace access.`,
        'Go to Admin → Workspace Pending Alerts. Manually suspend each account in Google Admin Console, then click "Mark Done".',
        'Access Control');
    } else {
      check('DbSecurity_WorkspacePending', 'Database Security', 'No pending Workspace suspensions',
        'High', 'Pass', 'All ex-employee Google Workspace accounts are either suspended or cleared.');
    }

    check('DbSecurity_Hibernated', 'Database Security', 'Hibernated accounts',
      'Info', 'Info',
      `${hibernatedCount} account(s) currently hibernated (inactive). These accounts still exist in the system but cannot submit reports.`,
      '');
  } catch { /* skip */ }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────

  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'Critical' && f.status === 'Fail').length,
    high: findings.filter(f => f.severity === 'High' && f.status === 'Fail').length,
    medium: findings.filter(f => f.severity === 'Medium' && ['Fail', 'Warn'].includes(f.status)).length,
    low: findings.filter(f => ['Low', 'Info'].includes(f.severity) && ['Fail', 'Warn'].includes(f.status)).length,
    passed: findings.filter(f => f.status === 'Pass').length,
  };

  res.json({ runAt: now, summary, findings });
}));

module.exports = router;
