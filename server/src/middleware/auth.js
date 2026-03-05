const jwt = require('jsonwebtoken');
const { createClerkClient, verifyToken } = require('@clerk/express');

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

// Authorized frontend origins for token validation
// Includes Clerk accounts URL (set as azp in dev mode tokens)
const authorizedParties = [
  'https://eod.colorpapers.in',
  'https://cpipl-activity-report.vercel.app',
  'https://cool-polecat-60.clerk.accounts.dev',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

/**
 * Clerk-based authentication middleware.
 * Uses networkless JWT verification with jwtKey (no JWKS fetch needed).
 * Falls back to network-based verification if jwtKey not set.
 */
async function authenticate(req, res, next) {
  // Test mode bypass for testing
  if (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test') {
    req.user = {
      id: 1,
      email: 'test@cpipl.com',
      name: 'Test User',
      role: 'admin',
      companyId: 1,
      department: 'Engineering',
      employmentStatus: 'active',
      isSeparated: false
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  if (!process.env.CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY missing — cannot verify tokens');
    return res.status(500).json({ error: 'Server configuration error. Contact admin.' });
  }

  try {
    const token = authHeader.split(' ')[1];

    // Try test JWT first (for development/testing)
    // Allow test JWTs if they contain userId and email fields
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key');
      if (decoded.userId && decoded.email) {
        // This is a test JWT token
        const testDbUser = await req.prisma.user.findUnique({ where: { email: decoded.email } });
        if (testDbUser) {
          const isSeparated = (testDbUser.employmentStatus || 'active') === 'separated';
          req.user = {
            id: testDbUser.id,
            email: testDbUser.email,
            role: testDbUser.role,
            name: testDbUser.name,
            department: testDbUser.department,
            companyId: testDbUser.companyId,
            employmentStatus: testDbUser.employmentStatus,
            isSeparated,
          };
          return next();
        }
      }
    } catch (testErr) {
      // Not a test JWT, fall through to Clerk verification
    }

    // Build verification options — networkless if jwtKey is available
    const verifyOptions = {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties,
      clockSkewInMs: 10000, // 10s tolerance for serverless clock drift
    };

    // Use CLERK_JWT_KEY for networkless verification (critical for Vercel serverless)
    if (process.env.CLERK_JWT_KEY) {
      verifyOptions.jwtKey = process.env.CLERK_JWT_KEY;
    }

    const verifiedToken = await verifyToken(token, verifyOptions);
    const clerkUserId = verifiedToken.sub;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    // Look up Clerk user to get email
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return res.status(401).json({ error: 'No email found in Clerk account.' });
    }

    // Find user in our database
    const dbUser = await req.prisma.user.findUnique({ where: { email } });

    if (!dbUser) {
      // User might not be synced yet — set minimal info for sync endpoint
      req.user = { clerkId: clerkUserId, email, name: clerkUser.fullName || clerkUser.firstName || '' };
      req.clerkUser = clerkUser;
      return next();
    }

    // Three-tier access control based on employmentStatus
    const empStatus = dbUser.employmentStatus || 'active';

    // Tier 3: Terminated / Absconding → completely blocked
    if (empStatus === 'terminated' || empStatus === 'absconding') {
      return res.status(403).json({ error: 'Account is suspended. Contact HR for assistance.' });
    }

    // Legacy isActive check (for manually deactivated accounts)
    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    // Hibernation check — inactive accounts locked until self/HR reactivates
    // Allow self-reactivation and clerk-sync endpoints through
    if (dbUser.isHibernated) {
      const url = req.originalUrl || req.url;
      if (url.includes('/self-reactivate') || url.includes('/clerk-sync')) {
        // Let the endpoint handle hibernation logic itself
        req.user = {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          name: dbUser.name,
          department: dbUser.department,
          isHibernated: true,
        };
        req.clerkUser = clerkUser;
        return next();
      }
      return res.status(403).json({
        error: 'Your account has been hibernated due to inactivity. Please contact HR to reactivate.',
        code: 'HIBERNATED',
      });
    }

    // Tier 2: Separated → limited access (set flag for route-level checks)
    const isSeparated = empStatus === 'separated';

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      department: dbUser.department,
      companyId: dbUser.companyId,
      employmentStatus: empStatus,
      isSeparated,
    };
    req.clerkUser = clerkUser;

    // Fire-and-forget: update last activity timestamp (throttled — only if >1hr old)
    if (!dbUser.lastActivityAt || (Date.now() - new Date(dbUser.lastActivityAt).getTime()) > 3600000) {
      req.prisma.user.update({
        where: { id: dbUser.id },
        data: { lastActivityAt: new Date() },
      }).catch(() => {}); // Silently ignore failures
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.', detail: err.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead') {
    return res.status(403).json({ error: 'Admin or Team Lead access required.' });
  }
  next();
}

function requireManagerOrAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'team_lead' && req.user.department) return next();
  return res.status(403).json({ error: 'Manager or admin access required.' });
}

/**
 * Blocks separated employees from accessing restricted features.
 * Separated users (resigned/retired) can only access: payslips, tickets, suggestions.
 * Place this AFTER authenticate on routes that should be restricted.
 */
function requireActiveEmployee(req, res, next) {
  if (req.user.isSeparated) {
    return res.status(403).json({ error: 'This feature is not available. Your employment has ended — limited access only.' });
  }
  next();
}

module.exports = { authenticate, authenticateToken: authenticate, requireAdmin, requireManagerOrAdmin, requireActiveEmployee };
