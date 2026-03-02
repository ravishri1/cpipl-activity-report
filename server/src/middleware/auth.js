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
  'http://localhost:5173',
].filter(Boolean);

/**
 * Clerk-based authentication middleware.
 * Uses networkless JWT verification with jwtKey (no JWKS fetch needed).
 * Falls back to network-based verification if jwtKey not set.
 */
async function authenticate(req, res, next) {
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

    if (!dbUser.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      department: dbUser.department,
    };
    req.clerkUser = clerkUser;
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

module.exports = { authenticate, requireAdmin, requireManagerOrAdmin };
