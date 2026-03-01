const { getAuth, clerkClient } = require('@clerk/express');

/**
 * Clerk-based authentication middleware.
 * Uses getAuth() (from clerkMiddleware) to read session state,
 * then looks up the user in our Prisma DB by email.
 */
async function authenticate(req, res, next) {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      return res.status(401).json({ error: 'Access denied. Not authenticated.' });
    }

    // Fetch Clerk user to get email
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return res.status(401).json({ error: 'No email found in Clerk account.' });
    }

    // Find user in our database
    const dbUser = await req.prisma.user.findUnique({ where: { email } });

    if (!dbUser) {
      // User might not be synced yet — set minimal info for sync endpoint
      req.user = { clerkId: auth.userId, email, name: clerkUser.fullName || clerkUser.firstName || '' };
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
    return res.status(401).json({ error: 'Authentication failed. Please try again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'team_lead') {
    return res.status(403).json({ error: 'Admin or Team Lead access required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
