const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, forbidden, notFound } = require('../utils/httpErrors');
const { normalizeName } = require('../utils/normalize');

const router = express.Router();

// Company domain for internal employees
const COMPANY_DOMAIN = 'colorpapers.in';

/**
 * POST /api/auth/login
 * TEST-ONLY endpoint for development/testing.
 * Uses hardcoded passwords for seed users. Production uses Clerk.
 * Only allows specific test emails (prevents abuse).
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw badRequest('Email and password required');
  
  // Only allow test user accounts (hardcoded seed data)
  const testAccounts = {
    'admin@cpipl.com': 'password123',
    'teamlead@cpipl.com': 'password123',
    'rahul@cpipl.com': 'password123',
  };
  
  if (!testAccounts[email]) {
    throw forbidden('Login endpoint only available for test accounts. Use Clerk for other accounts.');
  }

  if (testAccounts[email] !== password) {
    throw badRequest('Invalid credentials');
  }

  // Find user in database
  const user = await req.prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound('User');

  // Generate test JWT token
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      userId: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET || 'test-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  });
}));

/**
 * POST /api/auth/clerk-sync
 * Called by frontend after Clerk sign-in.
 * Syncs the Clerk user with our Prisma DB.
 */
router.post('/clerk-sync', authenticate, asyncHandler(async (req, res) => {
  const { clerkId, email, name, picture } = req.body;
  if (!email) throw badRequest('Email is required.');

  const isInternal = email.endsWith(`@${COMPANY_DOMAIN}`);

  // Check if user exists in our DB
  let user = await req.prisma.user.findUnique({ where: { email } });

  if (!user) {
    // Auto-register new users (internal or external)
    user = await req.prisma.user.create({
      data: {
        name: normalizeName(name || email.split('@')[0]),
        email,
        password: '',
        role: 'member',
        department: isInternal ? 'General' : 'External',
        googleId: clerkId,
        importedFromGoogle: isInternal,
        isActive: true,
        lastActivityAt: new Date(),
      },
    });
  }

  // Three-tier employment status check
  const empStatus = user.employmentStatus || 'active';
  if (empStatus === 'terminated' || empStatus === 'absconding') {
    throw forbidden('Account is suspended. Contact HR for assistance.');
  }
  if (!user.isActive) throw forbidden('Account is deactivated. Contact admin.');

  // Hibernation check — inactive accounts locked until self or HR reactivates
  if (user.isHibernated) {
    // Check self-reactivation remaining
    const currentMonth = new Date().toISOString().slice(0, 7);
    let usedCount = user.selfReactivationCount || 0;
    if (user.selfReactivationMonth !== currentMonth) usedCount = 0;
    const canSelfReactivate = usedCount < 3;

    return res.status(403).json({
      error: canSelfReactivate
        ? 'Your account has been hibernated due to inactivity. You can reactivate it yourself or contact HR.'
        : 'Your account has been hibernated due to inactivity. You have used all 3 self-reactivations this month. Please contact HR.',
      code: 'HIBERNATED',
      canSelfReactivate,
      remainingReactivations: Math.max(0, 3 - usedCount),
    });
  }

  // Update googleId (Clerk ID) if not set
  if (!user.googleId || user.googleId !== clerkId) {
    await req.prisma.user.update({
      where: { id: user.id },
      data: { googleId: clerkId },
    });
  }

  const isSeparated = empStatus === 'separated';

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      companyId: user.companyId,
      employmentStatus: empStatus,
      isSeparated,
      isInternal,
      driveProfilePhotoUrl: user.driveProfilePhotoUrl || null,
    },
  });
}));

// GET /api/auth/me — Get current user info
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  if (!req.user.id) throw notFound('User');
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, department: true, companyId: true, employmentStatus: true },
  });
  if (!user) throw notFound('User');
  res.json(user);
}));

/**
 * POST /api/auth/self-reactivate
 * Allows a hibernated user to reactivate their own account (max 3 times/month).
 * Uses Clerk token for identity but bypasses the normal hibernation block.
 */
router.post('/self-reactivate', authenticate, asyncHandler(async (req, res) => {
  // Auth middleware allows hibernated users through for this route (sets req.user.isHibernated)
  const email = req.user?.email || req.body.email;
  if (!email) throw badRequest('Email required.');

  const user = await req.prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, isHibernated: true, selfReactivationCount: true, selfReactivationMonth: true },
  });
  if (!user) throw notFound('User');
  if (!user.isHibernated) throw badRequest('Account is not hibernated.');

  const currentMonth = new Date().toISOString().slice(0, 7);
  let count = user.selfReactivationCount || 0;
  if (user.selfReactivationMonth !== currentMonth) count = 0;

  if (count >= 3) {
    throw badRequest('You have used all 3 self-reactivations this month. Please contact HR.');
  }

  await req.prisma.user.update({
    where: { id: user.id },
    data: {
      isHibernated: false,
      lastActivityAt: new Date(),
      selfReactivationCount: count + 1,
      selfReactivationMonth: currentMonth,
    },
  });

  res.json({
    message: 'Account reactivated successfully.',
    remainingReactivations: 3 - (count + 1),
  });
}));

module.exports = router;
