const express = require('express');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, HttpError } = require('../utils/httpErrors');
const { requireFields } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/otp/send — Generate and send OTP for a phone number
router.post('/send', asyncHandler(async (req, res) => {
  requireFields(req.body, 'phone');
  const cleanPhone = req.body.phone.replace(/[^0-9]/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) throw badRequest('Invalid Indian mobile number. Must be 10 digits starting with 6-9.');

  const validPurposes = ['mobile_verify', 'emergency_verify'];
  const otpPurpose = validPurposes.includes(req.body.purpose) ? req.body.purpose : 'mobile_verify';

  // Rate limit: max 5 OTPs per phone in last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCount = await req.prisma.otpVerification.count({
    where: { phone: cleanPhone, createdAt: { gte: tenMinAgo } },
  });
  if (recentCount >= 5) throw new HttpError(429, 'Too many OTP requests. Try again after 10 minutes.');

  // Delete old unverified OTPs for this phone/user
  await req.prisma.otpVerification.deleteMany({
    where: { userId: req.user.id, phone: cleanPhone, verified: false },
  });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await req.prisma.otpVerification.create({
    data: { userId: req.user.id, phone: cleanPhone, otp, purpose: otpPurpose, expiresAt },
  });

  // TODO: In production, send OTP via SMS provider
  const isDev = process.env.NODE_ENV !== 'production';
  res.json({
    message: 'OTP sent successfully.', phone: cleanPhone, expiresIn: '10 minutes',
    ...(isDev ? { otp } : {}),
  });
}));

// POST /api/otp/verify — Verify OTP and mark phone as verified
router.post('/verify', asyncHandler(async (req, res) => {
  requireFields(req.body, 'phone', 'otp');
  const cleanPhone = req.body.phone.replace(/[^0-9]/g, '');
  const otpPurpose = req.body.purpose || 'mobile_verify';

  const record = await req.prisma.otpVerification.findFirst({
    where: { userId: req.user.id, phone: cleanPhone, otp: req.body.otp, purpose: otpPurpose, verified: false, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw badRequest('Invalid or expired OTP.');

  await req.prisma.otpVerification.update({ where: { id: record.id }, data: { verified: true } });

  if (otpPurpose === 'mobile_verify') {
    await req.prisma.user.update({
      where: { id: req.user.id },
      data: { phone: cleanPhone, phoneVerified: true },
    });
  }

  res.json({ message: 'Phone verified successfully.', phone: cleanPhone, purpose: otpPurpose, verified: true });
}));

// GET /api/otp/status — Check verification status for a phone number
router.get('/status', asyncHandler(async (req, res) => {
  if (!req.query.phone) throw badRequest('Phone number is required.');
  const cleanPhone = req.query.phone.replace(/[^0-9]/g, '');

  const verified = await req.prisma.otpVerification.findFirst({
    where: { userId: req.user.id, phone: cleanPhone, verified: true },
  });
  res.json({ phone: cleanPhone, verified: !!verified });
}));

module.exports = router;
