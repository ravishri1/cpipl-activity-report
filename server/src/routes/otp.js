const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/send — Generate and "send" OTP for a phone number
// In production, integrate with SMS provider (MSG91, Twilio, etc.)
// For now, stores OTP in DB and returns it in response (dev mode)
router.post('/send', async (req, res) => {
  try {
    const { phone, purpose } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Validate Indian mobile: 10 digits starting with 6-9
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid Indian mobile number. Must be 10 digits starting with 6-9.' });
    }

    const validPurposes = ['mobile_verify', 'emergency_verify'];
    const otpPurpose = validPurposes.includes(purpose) ? purpose : 'mobile_verify';

    // Rate limit: max 5 OTPs per phone in last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentCount = await req.prisma.otpVerification.count({
      where: {
        phone: cleanPhone,
        createdAt: { gte: tenMinAgo },
      },
    });

    if (recentCount >= 5) {
      return res.status(429).json({ error: 'Too many OTP requests. Try again after 10 minutes.' });
    }

    // Delete old unverified OTPs for this phone/user
    await req.prisma.otpVerification.deleteMany({
      where: {
        userId: req.user.id,
        phone: cleanPhone,
        verified: false,
      },
    });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    await req.prisma.otpVerification.create({
      data: {
        userId: req.user.id,
        phone: cleanPhone,
        otp,
        purpose: otpPurpose,
        expiresAt,
      },
    });

    // TODO: In production, send OTP via SMS provider
    // await sendSMS(cleanPhone, `Your CPIPL verification OTP is: ${otp}`);

    // Dev mode: return OTP in response
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      message: 'OTP sent successfully.',
      phone: cleanPhone,
      expiresIn: '10 minutes',
      ...(isDev ? { otp } : {}), // Only show OTP in dev mode
    });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

// POST /api/otp/verify — Verify OTP and mark phone as verified
router.post('/verify', async (req, res) => {
  try {
    const { phone, otp, purpose } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone and OTP are required.' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const otpPurpose = purpose || 'mobile_verify';

    // Find matching unverified OTP
    const record = await req.prisma.otpVerification.findFirst({
      where: {
        userId: req.user.id,
        phone: cleanPhone,
        otp,
        purpose: otpPurpose,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // Mark OTP as verified
    await req.prisma.otpVerification.update({
      where: { id: record.id },
      data: { verified: true },
    });

    // If verifying primary mobile, update user profile
    if (otpPurpose === 'mobile_verify') {
      await req.prisma.user.update({
        where: { id: req.user.id },
        data: {
          phone: cleanPhone,
          phoneVerified: true,
        },
      });
    }

    res.json({
      message: 'Phone verified successfully.',
      phone: cleanPhone,
      purpose: otpPurpose,
      verified: true,
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
});

// GET /api/otp/status — Check verification status for a phone number
router.get('/status', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const verified = await req.prisma.otpVerification.findFirst({
      where: {
        userId: req.user.id,
        phone: cleanPhone,
        verified: true,
      },
    });

    res.json({
      phone: cleanPhone,
      verified: !!verified,
    });
  } catch (err) {
    console.error('OTP status error:', err);
    res.status(500).json({ error: 'Failed to check OTP status.' });
  }
});

module.exports = router;
