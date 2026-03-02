const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, forbidden, notFound } = require('../utils/httpErrors');
const { normalizeName } = require('../utils/normalize');

const router = express.Router();

// Company domain for internal employees
const COMPANY_DOMAIN = 'colorpapers.in';

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
      },
    });
  }

  if (!user.isActive) throw forbidden('Account is deactivated. Contact admin.');

  // Update googleId (Clerk ID) if not set
  if (!user.googleId || user.googleId !== clerkId) {
    await req.prisma.user.update({
      where: { id: user.id },
      data: { googleId: clerkId },
    });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isInternal,
    },
  });
}));

// GET /api/auth/me — Get current user info
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  if (!req.user.id) throw notFound('User');
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, department: true },
  });
  if (!user) throw notFound('User');
  res.json(user);
}));

module.exports = router;
