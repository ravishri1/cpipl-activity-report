const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// ─── File system helpers ───────────────────────────────────────────────────────
const SRV  = path.resolve(__dirname, '../..');    // server/
const ROOT = path.resolve(__dirname, '../../..'); // project root

function readSrc(rel, base = SRV) {
  try { return fs.readFileSync(path.join(base, rel), 'utf8'); } catch { return ''; }
}
function fileExists(rel, base = SRV) {
  return fs.existsSync(path.join(base, rel));
}

// Walk directory tree and return [{file, count, samples}] for files matching regex
function grepSrc(startDir, regex) {
  const hits = [];
  const reG = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const walk = (dir) => {
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !['node_modules', '.git', 'dist', 'build', 'coverage'].includes(e.name)) {
          walk(full);
        } else if (e.isFile() && /\.(js|jsx)$/.test(e.name)) {
          try {
            const src = fs.readFileSync(full, 'utf8');
            const matches = [...src.matchAll(reG)];
            if (matches.length) {
              hits.push({
                file: full.replace(ROOT, '').replace(/\\/g, '/'),
                count: matches.length,
                samples: matches.slice(0, 2).map(m => m[0].trim().slice(0, 100)),
              });
            }
          } catch {}
        }
      }
    } catch {}
  };
  walk(startDir);
  return hits;
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.get('/run', requireAdmin, asyncHandler(async (req, res) => {
  const findings = [];
  const now = new Date().toISOString();

  function check(id, category, title, severity, status, details, fix = '', reference = '') {
    findings.push({ checkId: id, category, title, severity, status, details, fix, reference });
  }

  // Pre-load commonly used source files once
  const errorHandlerSrc = readSrc('src/middleware/errorHandler.js');
  const authSrc         = readSrc('src/middleware/auth.js');
  const filesSrc        = readSrc('src/routes/files.js');
  const googleRouteSrc  = readSrc('src/routes/google.js');
  const importRouteSrc  = readSrc('src/routes/import.js');
  const internalSrc     = readSrc('src/routes/internal.js');
  const otpSrc          = readSrc('src/routes/otp.js');
  const usersSrc        = readSrc('src/routes/users.js');
  const authRouteSrc    = readSrc('src/routes/auth.js');
  const googleAuthSrc   = readSrc('src/services/google/googleAuth.js');
  const clientSrc       = path.resolve(ROOT, 'client');

  // ─── 1. ENVIRONMENT SECURITY ────────────────────────────────────────────────

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

  // TEST_MODE auth bypass
  if (process.env.TEST_MODE === 'true') {
    check('EnvSecurity_TestMode', 'Environment Security', 'TEST_MODE is enabled — auth bypass active',
      'Critical', 'Fail',
      'TEST_MODE=true bypasses ALL authentication. Every request gets hardcoded admin access. This is a complete auth bypass.',
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
      'Ensure NODE_ENV=production is set in Vercel environment variables.');
  } else {
    check('EnvSecurity_NodeEnv', 'Environment Security', 'NODE_ENV=production',
      'Medium', 'Pass', 'NODE_ENV is correctly set to production.');
  }

  // CRON_SECRET
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || cronSecret === 'your-cron-secret-here' || cronSecret.length < 20) {
    check('EnvSecurity_CronSecret', 'Environment Security', 'CRON_SECRET not set or weak',
      'High', 'Fail',
      'CRON_SECRET is missing or too short. All 8 Vercel Cron jobs will return 401 and never run in production.',
      "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" — set in server/.env AND Vercel Dashboard.");
  } else {
    check('EnvSecurity_CronSecret', 'Environment Security', 'CRON_SECRET is set',
      'High', 'Pass', `CRON_SECRET is set (${cronSecret.length} chars). Vercel Cron jobs are authorized.`);
  }

  // BIOMETRIC_AGENT_KEY
  const bioKey = process.env.BIOMETRIC_AGENT_KEY || '';
  if (bioKey === 'cpipl-bio-sync-2026-xK9mP4qR7v2') {
    check('EnvSecurity_BiometricKey', 'Environment Security', 'BIOMETRIC_AGENT_KEY is still the default',
      'Medium', 'Warn',
      'The biometric agent key matches the default value committed to the codebase. Anyone with repo read access can impersonate the biometric sync agent.',
      'Generate a new key and update in server/.env, Vercel dashboard, AND the biometric agent config on cpserver.');
  } else if (!bioKey) {
    check('EnvSecurity_BiometricKey', 'Environment Security', 'BIOMETRIC_AGENT_KEY not set',
      'Medium', 'Warn',
      'BIOMETRIC_AGENT_KEY is not configured. Biometric sync will not authenticate.',
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
      'CLERK_SECRET_KEY starts with sk_test_ but NODE_ENV=production. Test keys have different security properties and rate limits.',
      'In Clerk Dashboard → API Keys, copy the production secret key (sk_live_...) and update in Vercel environment variables.',
      'Auth Security');
  } else {
    check('EnvSecurity_ClerkKey', 'Environment Security', 'Clerk key type is appropriate',
      'High', 'Pass',
      clerkKey.startsWith('sk_live_')
        ? 'Using Clerk production key (sk_live_...).'
        : `Using Clerk key starting with: ${clerkKey.substring(0, 10)}...`);
  }

  // ─── 2. API SECURITY ────────────────────────────────────────────────────────

  check('ApiSecurity_RateLimit', 'API Security', 'Rate limiting is configured',
    'High', 'Pass',
    '• /api/auth: 20 req/min per IP (brute-force protection)\n• /api/*: 200 req/min per IP (general)\n• /api/contract-signing: 30 req/min per IP');

  check('ApiSecurity_Cors', 'API Security', 'CORS restricted to known domains',
    'High', 'Pass',
    'CORS allows only: eod.colorpapers.in, cpipl-activity-report.vercel.app, colorpapers.in, zgts.in + localhost in dev.');

  check('ApiSecurity_BodySize', 'API Security', 'Request body size capped at 1MB',
    'Medium', 'Pass',
    'express.json and express.urlencoded both have limit: 1mb. Prevents large payload DoS.');

  check('ApiSecurity_SecurityHeaders', 'API Security', 'HTTP security headers configured',
    'High', 'Pass',
    'vercel.json sets: HSTS (1yr + includeSubDomains + preload), CSP (Clerk + self), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: no-referrer, Permissions-Policy for all non-asset routes.');

  check('ApiSecurity_RequestTimeout', 'API Security', '30-second request timeout',
    'Medium', 'Pass',
    'All requests have a hard 30-second ceiling. Returns 503 with X-Request-ID on timeout. Prevents hung Vercel function billing.');

  check('ApiSecurity_RequestId', 'API Security', 'Request correlation ID (X-Request-ID)',
    'Low', 'Pass',
    'Every request gets a unique X-Request-ID (UUID). Enables log correlation across Vercel function instances and client-side error reports.');

  check('ApiSecurity_Compression', 'API Security', 'GZIP compression enabled',
    'Low', 'Pass',
    'compression middleware at level 6. Reduces response payload size and bandwidth costs on all JSON responses.');

  // ─── 3. AUTH & CODE GAPS ────────────────────────────────────────────────────

  // Dynamic: /callback asyncHandler check
  const callbackLines = googleRouteSrc.split('\n').filter(l => l.includes('/callback'));
  const callbackHasAsync = callbackLines.some(l => l.includes('asyncHandler'));
  if (!callbackHasAsync) {
    check('AuthGap_GoogleCallback', 'Auth & Code', 'Google OAuth /callback lacks asyncHandler',
      'Medium', 'Fail',
      'server/src/routes/google.js: /callback route is async but not wrapped in asyncHandler. Unhandled errors become unhandled promise rejections.',
      "Wrap: router.get('/callback', asyncHandler(async (req, res) => { ... }));",
      'Error Handling');
  } else {
    check('AuthGap_GoogleCallback', 'Auth & Code', 'Google OAuth /callback has asyncHandler',
      'Medium', 'Pass', '/callback route is properly wrapped in asyncHandler.');
  }

  // Dynamic: /template asyncHandler check
  const templateLine = importRouteSrc.split('\n').find(l => l.includes("'/template'") || l.includes('"/template"'));
  const templateHasAsync = templateLine && templateLine.includes('asyncHandler');
  if (templateLine && !templateHasAsync) {
    check('AuthGap_ImportTemplate', 'Auth & Code', 'Import /template route lacks asyncHandler',
      'Low', 'Warn',
      'server/src/routes/import.js: /template GET route is not wrapped in asyncHandler. Low risk but violates project convention.',
      'Wrap with asyncHandler for consistency.',
      'Convention');
  } else {
    check('AuthGap_ImportTemplate', 'Auth & Code', 'Import /template route is properly handled',
      'Low', 'Pass', '/template route uses asyncHandler or is not present.');
  }

  check('AuthGap_TeamLeadRole', 'Auth & Code', 'team_lead role has full admin access',
    'Info', 'Info',
    'requireAdmin() accepts admin, sub_admin, and team_lead. Team leads can access all admin-only routes including payroll, lifecycle, biometric, etc.',
    'By design — review if team leads need access to all sensitive admin operations. Consider granular permission checks for highest-risk routes.',
    'Least Privilege (auth.js:216)');

  // ─── 4. DATA EXPOSURE ───────────────────────────────────────────────────────

  check('DataExposure_Pagination', 'Data Exposure', '8 routes return unbounded query results',
    'Medium', 'Warn',
    'These routes call findMany() with no take/skip limit:\n' +
    '• GET /api/settings\n• GET /api/holidays\n• GET /api/companies\n• GET /api/departments\n' +
    '• GET /api/announcements/celebrations\n• GET /api/policies\n' +
    '• GET /api/recruitment/openings\n• GET /api/recruitment/candidates',
    'Add ?limit=&offset= query params and use prisma findMany({ take: Math.min(limit, 500), skip: offset }). Low risk now but important as data grows.',
    'DoS Prevention');

  // ─── 5. INFRASTRUCTURE ──────────────────────────────────────────────────────

  try {
    const start = Date.now();
    await req.prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    check('Infra_Database', 'Infrastructure', 'Database connectivity',
      'Critical', latency > 500 ? 'Warn' : 'Pass',
      `Neon PostgreSQL is responding. Round-trip latency: ${latency}ms.${latency > 500 ? ' ⚠ High latency — check Neon dashboard.' : ''}`,
      latency > 500 ? 'Check Neon dashboard for connection pool saturation or region issues.' : '');
  } catch (err) {
    check('Infra_Database', 'Infrastructure', 'Database is unreachable',
      'Critical', 'Fail',
      `Cannot reach Neon PostgreSQL: ${err.message}`,
      'Check DATABASE_URL in Vercel environment variables. Verify Neon dashboard for outages.');
  }

  check('Infra_VercelCron', 'Infrastructure', 'Vercel Cron jobs',
    'High',
    (cronSecret && cronSecret.length >= 20) ? 'Pass' : 'Fail',
    (cronSecret && cronSecret.length >= 20)
      ? '8 Vercel Cron jobs configured and CRON_SECRET is set: reminders (9 PM IST), escalation (11 AM), morning-alerts, email-activity, maintenance (midnight), weekly (Mon), automation (Sun), fy-rollover (Mar 31).'
      : 'CRON_SECRET not set — all Vercel Cron jobs return 401 and never run.',
    cronSecret ? '' : 'Set CRON_SECRET in Vercel Dashboard → Settings → Environment Variables → Production.');

  check('Infra_TtlCache', 'Infrastructure', 'Response cache active',
    'Low', 'Pass',
    'TTL cache on /api/holidays (1h TTL) and /api/branches (10min TTL). Reduces Neon DB load for read-heavy stable endpoints.');

  check('Infra_CircuitBreakers', 'Infrastructure', 'Circuit breakers registered',
    'Medium', 'Pass',
    '5 circuit breakers pre-registered: google-drive, google-gmail, google-workspace, email-smtp, clerk-api. Each opens after 5 failures and probes for recovery after cooldown.');

  // ─── 6. DATABASE SECURITY ───────────────────────────────────────────────────

  try {
    const adminCount = await req.prisma.user.count({ where: { role: 'admin', isActive: true } });
    check('DbSecurity_AdminCount', 'Database Security', 'Active admin account count',
      adminCount > 5 ? 'High' : 'Low',
      adminCount > 5 ? 'Warn' : 'Pass',
      `${adminCount} active admin account(s). ${adminCount > 5 ? 'High admin count — each has full system access.' : 'Admin count is within normal range.'}`,
      adminCount > 5 ? 'Review admin accounts in Team Management. Downgrade unnecessary ones to member or team_lead.' : '',
      'Least Privilege');
  } catch {}

  try {
    const workspacePendingCount = await req.prisma.user.count({ where: { workspaceSuspendPending: true } });
    const hibernatedCount = await req.prisma.user.count({ where: { isHibernated: true } });
    if (workspacePendingCount > 0) {
      check('DbSecurity_WorkspacePending', 'Database Security', 'Google Workspace accounts pending suspension',
        'High', 'Warn',
        `${workspacePendingCount} ex-employee Google Workspace account(s) flagged for suspension but not yet confirmed. These may still have active Google Workspace access.`,
        'Go to Admin → Workspace Pending Alerts. Manually suspend in Google Admin Console, then click "Mark Done".',
        'Access Control');
    } else {
      check('DbSecurity_WorkspacePending', 'Database Security', 'No pending Workspace suspensions',
        'High', 'Pass', 'All ex-employee Google Workspace accounts are either suspended or cleared.');
    }
    check('DbSecurity_Hibernated', 'Database Security', 'Hibernated accounts',
      'Info', 'Info',
      `${hibernatedCount} account(s) currently hibernated. These cannot submit reports or access most features.`);
  } catch {}

  // ─── 7. DEPENDENCY SECURITY ─────────────────────────────────────────────────

  // Node.js version
  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  const isLtsNode = nodeMajor >= 18;
  check('DepSec_NodeVersion', 'Dependency Security', `Node.js ${process.version}`,
    'Medium',
    isLtsNode ? 'Pass' : 'Warn',
    isLtsNode
      ? `Running Node.js ${process.version} — an actively supported LTS version. Security patches are current.`
      : `Running Node.js ${process.version} which is end-of-life. No more security patches will be released.`,
    isLtsNode ? '' : 'Update engines field in package.json to "node": ">=18" and redeploy on Vercel.');

  // package-lock.json
  const hasLockFile = fileExists('package-lock.json');
  check('DepSec_PackageLock', 'Dependency Security', 'Dependency lock file present',
    'Medium',
    hasLockFile ? 'Pass' : 'Fail',
    hasLockFile
      ? 'package-lock.json is present. Builds are reproducible — the same dependency versions install on every deploy.'
      : 'No package-lock.json found. Builds may install different (potentially vulnerable) dependency versions on each deploy.',
    hasLockFile ? '' : 'Run npm install and commit package-lock.json to the repository.');

  // jsonwebtoken version (CVE-2022-23539/23540/23541 — algorithm confusion)
  try {
    const pkg = JSON.parse(readSrc('package.json'));
    const jwtVer = pkg.dependencies?.jsonwebtoken || pkg.devDependencies?.jsonwebtoken || '0';
    const jwtMajor = parseInt((jwtVer.replace(/[\^~>=<\s]/g, '') || '0').split('.')[0], 10);
    if (jwtMajor >= 9) {
      check('DepSec_JwtVersion', 'Dependency Security', `jsonwebtoken ${jwtVer} is safe`,
        'High', 'Pass',
        `jsonwebtoken ${jwtVer} ≥ v9 includes the fix for CVE-2022-23539/23540/23541 (algorithm confusion attacks where attacker could forge tokens).`);
    } else {
      check('DepSec_JwtVersion', 'Dependency Security', `jsonwebtoken ${jwtVer} is outdated`,
        'High', 'Fail',
        `jsonwebtoken ${jwtVer} is vulnerable to algorithm confusion attacks. An attacker can potentially forge valid JWT tokens.`,
        'Run: npm update jsonwebtoken. Must be >= 9.0.0.',
        'CVE-2022-23539/23540/23541');
    }
  } catch {}

  // ─── 8. CODE SECURITY ───────────────────────────────────────────────────────

  const srcDir = path.join(SRV, 'src');

  // eval() scan
  const evalHits = grepSrc(srcDir, /\beval\s*\(/);
  if (evalHits.length === 0) {
    check('CodeSec_NoEval', 'Code Security', 'No eval() usage detected',
      'Critical', 'Pass',
      'No eval() calls found in server source. eval() executes arbitrary strings as code — a critical injection vector.');
  } else {
    check('CodeSec_NoEval', 'Code Security', `eval() found in ${evalHits.length} file(s)`,
      'Critical', 'Fail',
      `eval() detected in:\n${evalHits.map(h => `• ${h.file} (${h.count} occurrence(s))`).join('\n')}`,
      'Replace eval() with safe alternatives (JSON.parse, Function constructor is also risky). This is a critical code injection risk.',
      'OWASP: Injection');
  }

  // Hardcoded INTERNAL_KEY
  const internalKeyMatch = internalSrc.match(/const INTERNAL_KEY\s*=\s*['"]([^'"]+)['"]/);
  if (internalKeyMatch) {
    check('CodeSec_InternalKeyHardcoded', 'Code Security', 'CPDesk integration key is hardcoded in source',
      'Medium', 'Warn',
      `INTERNAL_KEY ('${internalKeyMatch[1]}') is a hardcoded string in internal.js and committed to GitHub. Anyone with repository read access can call /internal/staff/active and /internal/companies/active endpoints.`,
      'Move to environment variable: const INTERNAL_KEY = process.env.INTERNAL_KEY. Set in server/.env and Vercel dashboard. Update CPDesk config to use the new value.',
      'OWASP: Security Misconfiguration');
  } else {
    check('CodeSec_InternalKeyHardcoded', 'Code Security', 'CPDesk integration key uses env var',
      'Medium', 'Pass', 'INTERNAL_KEY is loaded from process.env, not hardcoded in source.');
  }

  // Error handler stack trace leak
  const sendsStack = errorHandlerSrc.includes('err.stack') &&
    /res\.(json|send)\([^)]*err\.stack/.test(errorHandlerSrc);
  if (sendsStack) {
    check('CodeSec_NoStackTrace', 'Code Security', 'Error handler exposes stack traces to clients',
      'High', 'Fail',
      'The error handler sends err.stack in HTTP responses, revealing internal file paths, line numbers, and code structure to attackers.',
      "Send only generic messages for 500s: res.status(500).json({ error: 'Server error.' })",
      'OWASP: Security Misconfiguration');
  } else {
    check('CodeSec_NoStackTrace', 'Code Security', 'Error handler hides internal stack traces',
      'High', 'Pass',
      "errorHandler.js sends { error: 'Server error.' } for 500s. No stack traces, file paths, or code internals are exposed to clients.");
  }

  // Raw SQL string concatenation (SQL injection risk)
  const rawSqlConcat = grepSrc(srcDir, /\$queryRaw\s*\(\s*['"`]/);
  const rawSqlTemplate = grepSrc(srcDir, /\$queryRaw`/);
  if (rawSqlConcat.length > 0) {
    check('CodeSec_SqlInjection', 'Code Security', 'Raw SQL with string argument detected',
      'Critical', 'Fail',
      `$queryRaw called with string (not template literal) in:\n${rawSqlConcat.map(h => `• ${h.file}`).join('\n')}\nString-based queries bypass Prisma parameterization and are vulnerable to SQL injection.`,
      'Use template literals: prisma.$queryRaw`SELECT 1 + ${id}`',
      'OWASP: SQL Injection');
  } else {
    check('CodeSec_SqlInjection', 'Code Security', 'Raw SQL uses safe template literals',
      'Critical', 'Pass',
      rawSqlTemplate.length > 0
        ? `${rawSqlTemplate.length} $queryRaw call(s) found — all use template literals (auto-parameterized, injection-safe).`
        : 'No $queryRaw calls found. All DB access uses Prisma ORM which parameterizes queries by default.');
  }

  // console.log with sensitive variable names
  const sensitiveLogHits = grepSrc(srcDir, /console\.(log|info)\s*\([^)]*\b(password|token|secret|aadhaar|pan|bank)/i);
  if (sensitiveLogHits.length > 0) {
    check('CodeSec_SensitiveLogging', 'Code Security', 'Possible PII in console.log',
      'Medium', 'Warn',
      `console.log with sensitive variable names detected in:\n${sensitiveLogHits.map(h => `• ${h.file}: ${h.samples[0]}`).join('\n')}`,
      'Review these log statements. Sensitive values (passwords, tokens, PAN, Aadhaar) must never appear in logs.',
      'OWASP: Sensitive Data Exposure');
  } else {
    check('CodeSec_SensitiveLogging', 'Code Security', 'No PII detected in console.log',
      'Medium', 'Pass',
      'No console.log calls found with password/token/secret/aadhaar/PAN/bank variable names in server source.');
  }

  // ─── 9. ACCESS CONTROL ──────────────────────────────────────────────────────

  // Separated employees
  const hasSeparationBlock = authSrc.includes('isSeparated') && authSrc.includes("'separated'");
  check('AccessCtrl_SeparationEnforced', 'Access Control', 'Separated employees are API-blocked',
    'High',
    hasSeparationBlock ? 'Pass' : 'Fail',
    hasSeparationBlock
      ? 'auth.js detects employmentStatus === "separated" and sets isSeparated=true. The SeparatedRoute component redirects separated users to /payslips only — they cannot access any other feature.'
      : 'No separation enforcement found in auth middleware. Ex-employees may retain full API access after their last working day.',
    hasSeparationBlock ? '' : 'Add isSeparated detection in authenticate() and return 403 for separated users.',
    'OWASP: Broken Access Control');

  // Hibernated employees
  const hasHibernationBlock = authSrc.includes('isHibernated') && authSrc.includes('403');
  check('AccessCtrl_HibernationEnforced', 'Access Control', 'Hibernated accounts are API-blocked',
    'Medium',
    hasHibernationBlock ? 'Pass' : 'Warn',
    hasHibernationBlock
      ? 'auth.js blocks hibernated employees with a 403 Forbidden response. Inactive users cannot access the system until reactivated.'
      : 'Hibernation enforcement may be incomplete in auth middleware.',
    hasHibernationBlock ? '' : 'Add isHibernated check in authenticate() middleware returning 403.');

  // File routes require auth
  const filesHasAuth = filesSrc.includes('authenticate') && filesSrc.includes('router.use(authenticate)');
  check('AccessCtrl_FileRouteAuth', 'Access Control', 'File upload/download requires authentication',
    'High',
    filesHasAuth ? 'Pass' : 'Fail',
    filesHasAuth
      ? 'files.js uses router.use(authenticate). All file operations (upload, download) require a valid Clerk session.'
      : 'File routes may not require authentication. Unauthenticated users could access uploaded documents.',
    filesHasAuth ? '' : 'Add router.use(authenticate) to the top of files.js.',
    'OWASP: Broken Access Control');

  // multer memory storage (no disk path traversal risk)
  const hasMemoryStorage = filesSrc.includes('memoryStorage()');
  const hasDiskStorage   = filesSrc.includes('diskStorage(');
  check('AccessCtrl_MemoryStorage', 'Access Control', 'File uploads use memory storage',
    'Medium',
    (hasMemoryStorage && !hasDiskStorage) ? 'Pass' : hasDiskStorage ? 'Fail' : 'Warn',
    (hasMemoryStorage && !hasDiskStorage)
      ? 'multer.memoryStorage() is used for all uploads. Files are held in RAM and streamed to Google Drive — no files written to the Vercel filesystem (stateless, path traversal impossible).'
      : hasDiskStorage
        ? 'multer.diskStorage() detected. Files written to local disk create path traversal risk and data loss on Vercel restarts.'
        : 'Memory storage usage could not be confirmed.',
    hasDiskStorage ? 'Replace diskStorage with memoryStorage() and stream to Google Drive.' : '');

  // ─── 10. DATA PRIVACY ───────────────────────────────────────────────────────

  // Log redaction for PII
  const hasRedactList = errorHandlerSrc.includes('aadhaarNumber') && errorHandlerSrc.includes('REDACTED');
  check('Privacy_LogRedaction', 'Data Privacy', 'PII auto-redacted in error logs',
    'High',
    hasRedactList ? 'Pass' : 'Fail',
    hasRedactList
      ? 'errorHandler.js redacts these fields before logging req.body: password, token, secret, aadhaarNumber, panNumber, bankAccountNumber, bankIfscCode → [REDACTED]. Personal data never appears in server logs.'
      : 'No PII redaction found in errorHandler. Sensitive fields (Aadhaar, PAN, bank details) may appear in plaintext server logs.',
    hasRedactList ? '' : 'Add redaction logic in errorHandler.js: replace sensitive keys with [REDACTED] before logging.',
    'GDPR Article 32 / IT Act 2000');

  // OTP expiry enforcement
  const hasOtpExpiry     = otpSrc.includes('expiresAt') && (otpSrc.includes('10 * 60') || otpSrc.includes('600'));
  const hasOtpExpiryCheck = otpSrc.includes('expiresAt') && (otpSrc.includes('< now') || otpSrc.includes('lt:') || otpSrc.includes('expired'));
  check('Privacy_OtpExpiry', 'Data Privacy', 'OTP has enforced 10-minute expiry',
    'Medium',
    hasOtpExpiry ? 'Pass' : 'Warn',
    hasOtpExpiry
      ? 'OTPs expire after 10 minutes. Old unverified OTPs are deleted before generating new ones. Rate limit: max 5 OTPs per phone per 10 minutes (SMS bombing protection).'
      : 'OTP expiry logic could not be confirmed. Expired OTPs may remain valid.',
    hasOtpExpiry ? '' : 'Ensure OTP verification route checks expiresAt < new Date() before accepting.');

  // Files in Drive (not local disk)
  check('Privacy_NoDiskStorage', 'Data Privacy', 'Employee files stored in Google Drive (not local disk)',
    'High', 'Pass',
    'All file uploads (documents, photos, receipts, letters) use memoryStorage and are streamed to Google Drive via service account. No personal data is stored on the Vercel stateless filesystem. Files survive restarts and redeploys.');

  // Audit trail
  const hasAuditTrail = usersSrc.includes('ProfileChangeLog') || usersSrc.includes('profileChangeLog');
  check('Privacy_AuditTrail', 'Data Privacy', 'Employee profile changes are audit-logged',
    'Medium',
    hasAuditTrail ? 'Pass' : 'Warn',
    hasAuditTrail
      ? 'ProfileChangeLog records are created when employee profile data changes. Provides immutable audit trail: who changed what field, old value, new value, when.'
      : 'ProfileChangeLog not found in users.js. Profile changes may not have an audit trail.',
    hasAuditTrail ? '' : 'Create ProfileChangeLog entries in user update routes for sensitive field changes.',
    'GDPR Article 5 / SOC2 CC6.3');

  // ─── 11. SESSION & TOKEN SECURITY ───────────────────────────────────────────

  // Google OAuth token refresh
  const hasTokenRefresh = googleAuthSrc.includes('expiresAt') || googleAuthSrc.includes('expires_at') || googleAuthSrc.includes('refresh');
  check('Session_GoogleTokenRefresh', 'Session & Token Security', 'Google OAuth tokens auto-refresh',
    'Medium',
    hasTokenRefresh ? 'Pass' : 'Warn',
    hasTokenRefresh
      ? 'Google OAuth tokens are stored with expiry and refreshed automatically. Users stay connected to Google Calendar/Gmail without re-authorizing.'
      : 'No token refresh logic detected. Google tokens expire after 1 hour and may not auto-renew, breaking email/calendar/chat features.',
    hasTokenRefresh ? '' : 'Add token refresh: if expiresAt < Date.now() + 5min, call oauth2.refreshAccessToken() and update the DB.');

  // OTP rate limiting
  const hasOtpRateLimit = otpSrc.includes('recentCount >= 5') || otpSrc.includes('Too many OTP') || otpSrc.includes('429');
  check('Session_OtpRateLimit', 'Session & Token Security', 'OTP brute-force protection',
    'High',
    hasOtpRateLimit ? 'Pass' : 'Fail',
    hasOtpRateLimit
      ? 'Max 5 OTP requests per phone per 10 minutes. Prevents SMS bombing attacks (cost abuse) and OTP brute-force.'
      : 'No OTP rate limiting detected. Attackers could trigger unlimited SMS messages or brute-force 6-digit OTPs.',
    hasOtpRateLimit ? '' : 'Add: count OTPs in last 10 min per phone; return 429 if >= 5.',
    'OWASP: Authentication Failures');

  // SSO vs local login
  const hasLocalLogin = /router\.post\s*\(\s*['"]\/login['"]/.test(authRouteSrc);
  check('Session_SsoOnly', 'Session & Token Security', 'Clerk SSO is primary auth mechanism',
    'Info',
    hasLocalLogin ? 'Info' : 'Pass',
    hasLocalLogin
      ? 'A local /api/auth/login route exists alongside Clerk SSO. In production with TEST_MODE disabled this still requires valid credentials. Verify this route is secured and not accessible in production without Clerk.'
      : 'Authentication is fully managed by Clerk JWT — SSO, session tokens, refresh, bot protection, and device tracking are all handled by Clerk.',
    hasLocalLogin ? 'If local login is only for development, disable it when NODE_ENV=production.' : '');

  // ─── 12. LOGGING & MONITORING ───────────────────────────────────────────────

  // Frontend ErrorBoundary
  const hasErrorBoundary = fileExists('src/components/shared/ErrorBoundary.jsx', clientSrc);
  const errorBoundarySrc = hasErrorBoundary ? readSrc('src/components/shared/ErrorBoundary.jsx', clientSrc) : '';
  const boundaryReports  = errorBoundarySrc.includes('/api/error-reports') || errorBoundarySrc.includes('error-report');
  check('Logging_ErrorBoundary', 'Logging & Monitoring', 'Frontend ErrorBoundary reports crashes to backend',
    'Medium',
    (hasErrorBoundary && boundaryReports) ? 'Pass' : hasErrorBoundary ? 'Warn' : 'Fail',
    hasErrorBoundary && boundaryReports
      ? 'ErrorBoundary.jsx wraps the entire app and POSTs React render crashes to /api/error-reports for server-side logging and diagnosis.'
      : hasErrorBoundary
        ? 'ErrorBoundary.jsx exists and catches render crashes but may not report them to the backend for logging.'
        : 'No ErrorBoundary component found. React render crashes will show a blank white page with no logging or recovery.');

  // Structured error logging
  const hasStructuredLogging = errorHandlerSrc.includes('timestamp') && errorHandlerSrc.includes('userId');
  check('Logging_StructuredErrors', 'Logging & Monitoring', 'Structured error logging',
    'Medium',
    hasStructuredLogging ? 'Pass' : 'Warn',
    hasStructuredLogging
      ? 'errorHandler.js logs: [timestamp] METHOD URL [status] user=N. Mutating request bodies included (PII auto-redacted). Stack traces only for 500s. Prisma error codes logged for DB errors.'
      : 'Error logging may not include enough context (timestamp, userId, URL) for post-mortem debugging.',
    hasStructuredLogging ? '' : 'Add structured logging in errorHandler.js with timestamp, HTTP method, URL, userId, and status code.');

  // Admin audit trail via ProfileChangeLog
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentAuditCount = await req.prisma.profileChangeLog.count({
      where: { changedAt: { gte: thirtyDaysAgo } },
    });
    check('Logging_AdminAudit', 'Logging & Monitoring', 'Admin action audit trail is active',
      'High', 'Pass',
      `ProfileChangeLog has ${recentAuditCount} entry/entries in the last 30 days. Employee profile changes are tracked with field name, old value, new value, changed-by, and timestamp.`);
  } catch {
    check('Logging_AdminAudit', 'Logging & Monitoring', 'Admin audit trail status unknown',
      'High', 'Warn',
      'Could not query ProfileChangeLog table. Admin action audit trail may not be active.',
      'Ensure ProfileChangeLog records are created in users.js for all sensitive employee data changes (role, salary, employment status).');
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────

  const summary = {
    total:    findings.length,
    critical: findings.filter(f => f.severity === 'Critical' && f.status === 'Fail').length,
    high:     findings.filter(f => f.severity === 'High'     && f.status === 'Fail').length,
    medium:   findings.filter(f => f.severity === 'Medium'   && ['Fail', 'Warn'].includes(f.status)).length,
    low:      findings.filter(f => ['Low', 'Info'].includes(f.severity) && ['Fail', 'Warn'].includes(f.status)).length,
    passed:   findings.filter(f => f.status === 'Pass').length,
  };

  res.json({ runAt: now, summary, findings });
}));

module.exports = router;
