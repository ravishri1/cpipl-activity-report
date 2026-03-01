const { createClerkClient } = require('@clerk/express');

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

/**
 * Clerk-based authentication middleware.
 * Verifies Clerk session token from Authorization header,
 * then looks up the user in our Prisma DB by email.
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

    // Verify Clerk session token
    const verifiedToken = await clerk.verifyToken(token);
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

module.exports = { authenticate, requireAdmin };
