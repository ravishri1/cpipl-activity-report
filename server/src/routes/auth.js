const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Company domain for internal employees
const COMPANY_DOMAIN = 'colorpapers.in';

/**
 * POST /api/auth/clerk-sync
 * Called by frontend after Clerk sign-in.
 * Syncs the Clerk user with our Prisma DB:
 * - Internal @colorpapers.in users: auto-register if new
 * - External users: self-register after phone verification
 */
router.post('/clerk-sync', authenticate, async (req, res) => {
  try {
    const { clerkId, email, name, picture } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const isInternal = email.endsWith(`@${COMPANY_DOMAIN}`);

    // Check if user exists in our DB
    let user = await req.prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (isInternal) {
        // Internal employee — auto-register on first Clerk sign-in
        user = await req.prisma.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            password: '',
            role: 'member',
            department: 'General',
            googleId: clerkId,
            importedFromGoogle: true,
            isActive: true,
          },
        });
      } else {
        // External user — auto-register (freelancers, contractors, etc.)
        user = await req.prisma.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            password: '',
            role: 'member',
            department: 'External',
            googleId: clerkId,
            importedFromGoogle: false,
            isActive: true,
          },
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

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
  } catch (err) {
    console.error('Clerk sync error:', err);
    res.status(500).json({ error: 'Failed to sync user. Please try again.' });
  }
});

// GET /api/auth/me — Get current user info
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user.id) {
      return res.status(401).json({ error: 'User not found in system.' });
    }
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
