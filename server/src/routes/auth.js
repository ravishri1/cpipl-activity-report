const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Google OAuth2 client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Company domain for internal employees
const COMPANY_DOMAIN = 'colorpapers.in';

// POST /api/auth/google-login — Sign in with Google (primary login)
router.post('/google-login', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Could not get email from Google account.' });
    }

    const isInternal = email.endsWith(`@${COMPANY_DOMAIN}`);

    // Find user by email
    let user = await req.prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (isInternal) {
        // Internal @colorpapers.in employee — auto-register (verified by Google Workspace)
        user = await req.prisma.user.create({
          data: {
            name: name || email.split('@')[0],
            email,
            password: '',
            role: 'member',
            department: 'General',
            googleId,
            importedFromGoogle: true,
            isActive: true,
          },
        });
      } else {
        // External user — must be pre-added by admin
        return res.status(403).json({
          error: 'Access denied. Your email is not registered. Ask the admin to add you as an external employee.',
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    // Update googleId if not set yet
    if (!user.googleId) {
      await req.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
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
        isInternal,
      },
    });
  } catch (err) {
    console.error('Google login error:', err);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Google sign-in expired. Please try again.' });
    }
    res.status(500).json({ error: 'Google authentication failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, department: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
