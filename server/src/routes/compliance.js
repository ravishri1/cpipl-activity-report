const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ──────────────────────────────────────────────────────────
// Helper: compute certificate status from expiry / frequency
// ──────────────────────────────────────────────────────────
function computeStatus(cert) {
  if (!cert.expiryDate || cert.renewalFrequency === 'LIFETIME') return 'LIFETIME';
  const today    = new Date();
  const expiry   = new Date(cert.expiryDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  if (daysLeft < 0)   return 'OVERDUE';
  if (daysLeft <= 30) return 'DUE_SOON';
  return 'VALID';
}

// ──────────────────────────────────────────────────────────
// Helper: compute nextDue from lastRenewed + frequency
// ──────────────────────────────────────────────────────────
function computeNextDue(lastRenewed, renewalFrequency) {
  if (!lastRenewed || renewalFrequency === 'LIFETIME' || renewalFrequency === 'NONE') return null;
  const d = new Date(lastRenewed);
  if (renewalFrequency === 'YEARLY')   d.setFullYear(d.getFullYear() + 1);
  if (renewalFrequency === '5_YEARLY') d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────
// Helper: enrich cert with computed status + daysLeft
// ──────────────────────────────────────────────────────────
function enrichCert(cert) {
  const status = computeStatus(cert);
  let daysLeft = null;
  if (cert.expiryDate && status !== 'LIFETIME') {
    daysLeft = Math.ceil((new Date(cert.expiryDate) - new Date()) / 86400000);
  }
  return { ...cert, status, daysLeft };
}

const CERT_INCLUDE = {
  companyRegistration: {
    include: { legalEntity: { select: { id: true, legalName: true, pan: true } } },
  },
};

// ══════════════════════════════════════════════════════════
// CERTIFICATES
// ══════════════════════════════════════════════════════════

// GET /api/compliance/certificates
// Query: ?registrationId=1 &type=FSSAI &status=DUE_SOON &activeOnly=true
router.get('/certificates', asyncHandler(async (req, res) => {
  const { registrationId, type, status, activeOnly } = req.query;

  const where = {};
  if (registrationId) where.companyRegistrationId = parseInt(registrationId);
  if (type)           where.certificateType        = type;
  if (activeOnly !== 'false') {
    where.companyRegistration = { isActive: true };
  }

  const certs = await req.prisma.complianceCertificate.findMany({
    where,
    include: CERT_INCLUDE,
    orderBy: [{ companyRegistrationId: 'asc' }, { certificateType: 'asc' }],
  });

  let enriched = certs.map(enrichCert);

  // Client-side status filter (computed field, can't filter in DB)
  if (status) enriched = enriched.filter(c => c.status === status);

  res.json(enriched);
}));

// GET /api/compliance/certificates/:id
router.get('/certificates/:id', asyncHandler(async (req, res) => {
  const id   = parseId(req.params.id);
  const cert = await req.prisma.complianceCertificate.findUnique({ where: { id }, include: CERT_INCLUDE });
  if (!cert) throw notFound('Certificate');
  res.json(enrichCert(cert));
}));

// POST /api/compliance/certificates
router.post('/certificates', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'companyRegistrationId', 'certificateType', 'certificateNo', 'renewalFrequency');
  requireEnum(req.body.certificateType, ['FSSAI', 'IEC', 'UDYAM', 'GST', 'TAN', 'PAN', 'LEI', 'OTHER'], 'certificateType');
  requireEnum(req.body.renewalFrequency, ['YEARLY', '5_YEARLY', 'LIFETIME', 'NONE'], 'renewalFrequency');

  const { companyRegistrationId, certificateType, certificateNo, issueDate, expiryDate, renewalFrequency, lastRenewed, reminderDays, documentUrl, notes } = req.body;

  const nextDue = computeNextDue(lastRenewed, renewalFrequency);

  const cert = await req.prisma.complianceCertificate.create({
    data: {
      companyRegistrationId: parseInt(companyRegistrationId),
      certificateType, certificateNo, issueDate, expiryDate,
      renewalFrequency, lastRenewed, nextDue,
      reminderDays: reminderDays ? parseInt(reminderDays) : 30,
      documentUrl, notes,
    },
    include: CERT_INCLUDE,
  });
  res.status(201).json(enrichCert(cert));
}));

// PUT /api/compliance/certificates/:id
router.put('/certificates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const existing = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!existing) throw notFound('Certificate');

  const { certificateNo, issueDate, expiryDate, renewalFrequency, lastRenewed, reminderDays, documentUrl, notes } = req.body;

  const freq   = renewalFrequency ?? existing.renewalFrequency;
  const lrDate = lastRenewed     ?? existing.lastRenewed;
  const nextDue = computeNextDue(lrDate, freq);

  const cert = await req.prisma.complianceCertificate.update({
    where: { id },
    data: {
      certificateNo:    certificateNo ?? existing.certificateNo,
      issueDate:        issueDate     ?? existing.issueDate,
      expiryDate:       expiryDate    ?? existing.expiryDate,
      renewalFrequency: freq,
      lastRenewed:      lrDate,
      nextDue,
      reminderDays:     reminderDays ? parseInt(reminderDays) : existing.reminderDays,
      documentUrl:      documentUrl  ?? existing.documentUrl,
      notes:            notes        ?? existing.notes,
    },
    include: CERT_INCLUDE,
  });
  res.json(enrichCert(cert));
}));

// DELETE /api/compliance/certificates/:id
router.delete('/certificates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const cert = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!cert) throw notFound('Certificate');
  await req.prisma.complianceCertificate.delete({ where: { id } });
  res.json({ message: 'Certificate deleted' });
}));

// POST /api/compliance/certificates/:id/renew
// Body: { newExpiryDate, notes }
router.post('/certificates/:id/renew', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const cert = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!cert) throw notFound('Certificate');
  if (cert.renewalFrequency === 'LIFETIME') throw badRequest('LIFETIME certificates do not need renewal');

  const today  = new Date().toISOString().slice(0, 10);
  const nextDue = computeNextDue(today, cert.renewalFrequency);
  const newExpiry = req.body.newExpiryDate ?? nextDue;

  const updated = await req.prisma.complianceCertificate.update({
    where: { id },
    data: { lastRenewed: today, nextDue, expiryDate: newExpiry, notes: req.body.notes ?? cert.notes },
    include: CERT_INCLUDE,
  });
  res.json({ ...enrichCert(updated), message: `Renewed. Next due: ${nextDue}` });
}));

// ══════════════════════════════════════════════════════════
// ALERT QUERIES
// ══════════════════════════════════════════════════════════

// GET /api/compliance/due-soon?days=30
router.get('/due-soon', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const certs = await req.prisma.complianceCertificate.findMany({
    where: {
      expiryDate: { gte: today, lte: futureStr },
      renewalFrequency: { not: 'LIFETIME' },
      companyRegistration: { isActive: true },
    },
    include: CERT_INCLUDE,
    orderBy: { expiryDate: 'asc' },
  });
  res.json(certs.map(enrichCert));
}));

// GET /api/compliance/overdue
router.get('/overdue', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const certs = await req.prisma.complianceCertificate.findMany({
    where: {
      expiryDate: { lt: today },
      renewalFrequency: { not: 'LIFETIME' },
      companyRegistration: { isActive: true },
    },
    include: CERT_INCLUDE,
    orderBy: { expiryDate: 'asc' },
  });
  res.json(certs.map(enrichCert));
}));

// GET /api/compliance/dashboard
// Returns grouped stats for the dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
  const today     = new Date().toISOString().slice(0, 10);
  const in30days  = new Date(); in30days.setDate(in30days.getDate() + 30);
  const in30str   = in30days.toISOString().slice(0, 10);

  const [total, overdue, dueSoon, lifetime] = await Promise.all([
    req.prisma.complianceCertificate.count({ where: { companyRegistration: { isActive: true } } }),
    req.prisma.complianceCertificate.count({ where: { expiryDate: { lt: today }, renewalFrequency: { not: 'LIFETIME' }, companyRegistration: { isActive: true } } }),
    req.prisma.complianceCertificate.count({ where: { expiryDate: { gte: today, lte: in30str }, renewalFrequency: { not: 'LIFETIME' }, companyRegistration: { isActive: true } } }),
    req.prisma.complianceCertificate.count({ where: { renewalFrequency: 'LIFETIME', companyRegistration: { isActive: true } } }),
  ]);
  const valid = total - overdue - dueSoon - lifetime;
  res.json({ total, overdue, dueSoon, valid, lifetime });
}));

module.exports = router;
