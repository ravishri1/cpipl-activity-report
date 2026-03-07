const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

// ─── Status Helper ──────────────────────────────────────────────────────────

function computeStatus(cert) {
  if (!cert.expiryDate || cert.renewalFrequency === 'LIFETIME') return 'LIFETIME';
  const today = new Date();
  const expiry = new Date(cert.expiryDate);
  const daysLeft = Math.ceil((expiry - today) / 86400000);
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= cert.reminderDays) return 'DUE_SOON';
  return 'VALID';
}

function computeDaysLeft(cert) {
  if (!cert.expiryDate || cert.renewalFrequency === 'LIFETIME') return null;
  const today = new Date();
  const expiry = new Date(cert.expiryDate);
  return Math.ceil((expiry - today) / 86400000);
}

function addStatusToCert(cert) {
  return {
    ...cert,
    status: computeStatus(cert),
    daysLeft: computeDaysLeft(cert),
  };
}

// ─── GET /certificates ───────────────────────────────────────────────────────

router.get('/certificates', asyncHandler(async (req, res) => {
  const { registrationId, certificateType, status } = req.query;

  const where = {};
  if (registrationId) where.companyRegistrationId = parseId(registrationId);
  if (certificateType) where.certificateType = certificateType;

  const certs = await req.prisma.complianceCertificate.findMany({
    where,
    include: {
      companyRegistration: {
        select: {
          id: true,
          abbr: true,
          gstin: true,
          officeCity: true,
          state: true,
          isActive: true,
          legalEntity: { select: { id: true, legalName: true } },
        },
      },
    },
    orderBy: [{ expiryDate: 'asc' }, { certificateType: 'asc' }],
  });

  let result = certs.map(addStatusToCert);

  // Filter by computed status if requested
  if (status) {
    result = result.filter(c => c.status === status.toUpperCase());
  }

  res.json(result);
}));

// ─── GET /due-soon ────────────────────────────────────────────────────────────

router.get('/due-soon', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);

  const certs = await req.prisma.complianceCertificate.findMany({
    where: {
      renewalFrequency: { not: 'LIFETIME' },
      expiryDate: {
        gte: todayStr,
        lte: futureDateStr,
      },
    },
    include: {
      companyRegistration: {
        select: {
          id: true,
          abbr: true,
          gstin: true,
          officeCity: true,
          isActive: true,
          legalEntity: { select: { id: true, legalName: true } },
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
  });

  res.json(certs.map(addStatusToCert));
}));

// ─── GET /overdue ─────────────────────────────────────────────────────────────

router.get('/overdue', asyncHandler(async (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const certs = await req.prisma.complianceCertificate.findMany({
    where: {
      renewalFrequency: { not: 'LIFETIME' },
      expiryDate: { lt: todayStr },
    },
    include: {
      companyRegistration: {
        select: {
          id: true,
          abbr: true,
          gstin: true,
          officeCity: true,
          isActive: true,
          legalEntity: { select: { id: true, legalName: true } },
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
  });

  res.json(certs.map(addStatusToCert));
}));

// ─── POST /certificates ───────────────────────────────────────────────────────

router.post('/certificates', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'companyRegistrationId', 'certificateType', 'certificateNo', 'renewalFrequency');

  const {
    companyRegistrationId,
    certificateType,
    certificateNo,
    issueDate,
    expiryDate,
    renewalFrequency,
    lastRenewed,
    nextDue,
    reminderDays,
    documentUrl,
    notes,
  } = req.body;

  const validTypes = ['FSSAI', 'IEC', 'UDYAM', 'GST', 'TAN', 'PAN', 'LEI', 'OTHER'];
  const validFreqs = ['YEARLY', '5_YEARLY', 'LIFETIME', 'NONE'];

  if (!validTypes.includes(certificateType)) {
    throw badRequest(`certificateType must be one of: ${validTypes.join(', ')}`);
  }
  if (!validFreqs.includes(renewalFrequency)) {
    throw badRequest(`renewalFrequency must be one of: ${validFreqs.join(', ')}`);
  }

  const regId = parseId(companyRegistrationId);
  const reg = await req.prisma.companyRegistration.findUnique({ where: { id: regId } });
  if (!reg) throw notFound('CompanyRegistration');

  const cert = await req.prisma.complianceCertificate.create({
    data: {
      companyRegistrationId: regId,
      certificateType,
      certificateNo,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      renewalFrequency,
      lastRenewed: lastRenewed || null,
      nextDue: nextDue || null,
      reminderDays: reminderDays ? parseInt(reminderDays) : 30,
      documentUrl: documentUrl || null,
      notes: notes || null,
    },
    include: {
      companyRegistration: {
        select: { id: true, abbr: true, legalEntity: { select: { legalName: true } } },
      },
    },
  });

  res.status(201).json(addStatusToCert(cert));
}));

// ─── PUT /certificates/:id ────────────────────────────────────────────────────

router.put('/certificates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const existing = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!existing) throw notFound('ComplianceCertificate');

  const {
    certificateType,
    certificateNo,
    issueDate,
    expiryDate,
    renewalFrequency,
    lastRenewed,
    nextDue,
    reminderDays,
    documentUrl,
    notes,
  } = req.body;

  const validTypes = ['FSSAI', 'IEC', 'UDYAM', 'GST', 'TAN', 'PAN', 'LEI', 'OTHER'];
  const validFreqs = ['YEARLY', '5_YEARLY', 'LIFETIME', 'NONE'];

  if (certificateType && !validTypes.includes(certificateType)) {
    throw badRequest(`certificateType must be one of: ${validTypes.join(', ')}`);
  }
  if (renewalFrequency && !validFreqs.includes(renewalFrequency)) {
    throw badRequest(`renewalFrequency must be one of: ${validFreqs.join(', ')}`);
  }

  const updateData = {};
  if (certificateType !== undefined) updateData.certificateType = certificateType;
  if (certificateNo !== undefined) updateData.certificateNo = certificateNo;
  if (issueDate !== undefined) updateData.issueDate = issueDate || null;
  if (expiryDate !== undefined) updateData.expiryDate = expiryDate || null;
  if (renewalFrequency !== undefined) updateData.renewalFrequency = renewalFrequency;
  if (lastRenewed !== undefined) updateData.lastRenewed = lastRenewed || null;
  if (nextDue !== undefined) updateData.nextDue = nextDue || null;
  if (reminderDays !== undefined) updateData.reminderDays = parseInt(reminderDays);
  if (documentUrl !== undefined) updateData.documentUrl = documentUrl || null;
  if (notes !== undefined) updateData.notes = notes || null;

  const cert = await req.prisma.complianceCertificate.update({
    where: { id },
    data: updateData,
    include: {
      companyRegistration: {
        select: { id: true, abbr: true, legalEntity: { select: { legalName: true } } },
      },
    },
  });

  res.json(addStatusToCert(cert));
}));

// ─── DELETE /certificates/:id ─────────────────────────────────────────────────

router.delete('/certificates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const existing = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!existing) throw notFound('ComplianceCertificate');

  await req.prisma.complianceCertificate.delete({ where: { id } });

  res.json({ success: true, message: 'Certificate deleted.' });
}));

// ─── POST /certificates/:id/renew ─────────────────────────────────────────────

router.post('/certificates/:id/renew', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const cert = await req.prisma.complianceCertificate.findUnique({ where: { id } });
  if (!cert) throw notFound('ComplianceCertificate');

  const { renewedDate, newExpiryDate } = req.body;
  if (!renewedDate) throw badRequest('renewedDate is required');

  // Compute nextDue based on renewalFrequency if not provided
  let nextDue = newExpiryDate || null;
  if (!nextDue && cert.renewalFrequency !== 'LIFETIME' && cert.renewalFrequency !== 'NONE') {
    const d = new Date(renewedDate);
    if (cert.renewalFrequency === 'YEARLY') {
      d.setFullYear(d.getFullYear() + 1);
    } else if (cert.renewalFrequency === '5_YEARLY') {
      d.setFullYear(d.getFullYear() + 5);
    }
    nextDue = d.toISOString().slice(0, 10);
  }

  const updated = await req.prisma.complianceCertificate.update({
    where: { id },
    data: {
      lastRenewed: renewedDate,
      expiryDate: nextDue,
      nextDue,
    },
    include: {
      companyRegistration: {
        select: {
          id: true,
          abbr: true,
          legalEntity: { select: { legalName: true } },
        },
      },
    },
  });

  res.json(addStatusToCert(updated));
}));

module.exports = router;
