const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, requireEnum, parseId } = require('../utils/validate');
const { throwIfHasDependencies } = require('../utils/dependencyCheck');
const { getDriveClient, getOrCreateRootFolder, uploadFile } = require('../services/google/googleDrive');
const { sendEmail } = require('../services/notifications/emailService');

const router = express.Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const VALID_CATEGORIES = ['software', 'service', 'compliance', 'ip', 'misc'];
const VALID_STATUSES   = ['active', 'expired', 'pending', 'cancelled', 'renewed'];
const VALID_SIGNING_STATUSES = ['none', 'draft', 'sent', 'partially_signed', 'fully_signed', 'expired', 'cancelled'];
const VALID_TEMPLATE_TYPES = ['nda', 'service_agreement', 'vendor_contract', 'custom'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86_400_000);
}

function enrichContract(c) {
  const days = daysUntil(c.expiryDate);
  return {
    ...c,
    daysToExpiry: days,
    expiryAlert: days !== null && days <= 30 && days >= 0 ? 'warning' :
                 days !== null && days < 0             ? 'expired'  : null,
  };
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function nowStr() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

async function getOrCreateContractsFolder(drive) {
  const rootId = await getOrCreateRootFolder(drive);
  const res = await drive.files.list({
    q: `'${rootId}' in parents and name = 'Contracts' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
  });
  if (res.data.files.length > 0) return res.data.files[0].id;
  const folder = await drive.files.create({
    requestBody: { name: 'Contracts', parents: [rootId], mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return folder.data.id;
}

async function logSigningEvent(prisma, contractId, eventType, { performedBy, performedById, ipAddress, userAgent, notes } = {}) {
  return prisma.contractSigningEvent.create({
    data: { contractId, eventType, performedBy, performedById, ipAddress, userAgent, notes },
  });
}

function getBaseUrl() {
  return process.env.NODE_ENV === 'production' ? 'https://eod.colorpapers.in' : 'http://localhost:3000';
}

// ══════════════════════════════════════════════════════════════════════════════
//  CONTRACT TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /templates ───────────────────────────────────────────────────────────
router.get('/templates', requireAdmin, asyncHandler(async (req, res) => {
  const templates = await req.prisma.contractTemplate.findMany({
    where: { isActive: true },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
}));

// ── POST /templates ──────────────────────────────────────────────────────────
router.post('/templates', requireAdmin, asyncHandler(async (req, res) => {
  requireFields(req.body, 'name', 'type', 'content');
  requireEnum(req.body.type, VALID_TEMPLATE_TYPES, 'type');

  const template = await req.prisma.contractTemplate.create({
    data: {
      name: req.body.name,
      type: req.body.type,
      content: req.body.content,
      createdBy: req.user.id,
    },
  });
  res.status(201).json(template);
}));

// ── PUT /templates/:id ──────────────────────────────────────────────────────
router.put('/templates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.type) requireEnum(req.body.type, VALID_TEMPLATE_TYPES, 'type');
  const { name, type, content } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (type !== undefined) data.type = type;
  if (content !== undefined) data.content = content;

  const template = await req.prisma.contractTemplate.update({ where: { id }, data });
  res.json(template);
}));

// ── DELETE /templates/:id (soft) ─────────────────────────────────────────────
router.delete('/templates/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await req.prisma.contractTemplate.update({ where: { id }, data: { isActive: false } });
  res.json({ message: 'Template archived' });
}));

// ══════════════════════════════════════════════════════════════════════════════
//  CONTRACTS — existing CRUD (kept intact)
// ══════════════════════════════════════════════════════════════════════════════

// ── GET / ── list all contracts ──────────────────────────────────────────────
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { category, status, companyId, expiringSoon, signingStatus } = req.query;

  const where = {};
  if (category)  where.category  = category;
  if (status)    where.status    = status;
  if (companyId) where.companyId = parseId(companyId);
  if (signingStatus) where.signingStatus = signingStatus;

  if (expiringSoon) {
    const days = parseInt(expiringSoon, 10) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const today = new Date().toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    where.expiryDate = { gte: today, lte: cutoffStr };
    where.status = { in: ['active', 'pending'] };
  }

  const contracts = await req.prisma.companyContract.findMany({
    where,
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      template: { select: { id: true, name: true, type: true } },
      internalSigner: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  res.json(contracts.map(enrichContract));
}));

// ── GET /summary ─────────────────────────────────────────────────────────────
router.get('/summary', requireAdmin, asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const in7  = new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10);

  const [total, expired, expiring7, expiring30, byCategory, bySigningStatus] = await Promise.all([
    req.prisma.companyContract.count(),
    req.prisma.companyContract.count({ where: { expiryDate: { lt: today }, status: { not: 'cancelled' } } }),
    req.prisma.companyContract.count({ where: { expiryDate: { gte: today, lte: in7  }, status: { in: ['active','pending'] } } }),
    req.prisma.companyContract.count({ where: { expiryDate: { gte: today, lte: in30 }, status: { in: ['active','pending'] } } }),
    req.prisma.companyContract.groupBy({ by: ['category'], _count: { id: true } }),
    req.prisma.companyContract.groupBy({ by: ['signingStatus'], _count: { id: true } }),
  ]);

  res.json({
    total, expired, expiring7, expiring30,
    byCategory: Object.fromEntries(byCategory.map(r => [r.category, r._count.id])),
    bySigningStatus: Object.fromEntries(bySigningStatus.map(r => [r.signingStatus || 'none', r._count.id])),
  });
}));

// ── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const contract = await req.prisma.companyContract.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      creator: { select: { id: true, name: true } },
      template: { select: { id: true, name: true, type: true } },
      internalSigner: { select: { id: true, name: true } },
      signingEvents: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!contract) throw notFound('Contract');
  res.json(enrichContract(contract));
}));

// ── POST / ── create ─────────────────────────────────────────────────────────
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { category, name } = req.body;
  requireFields(req.body, 'category', 'name');
  requireEnum(category, VALID_CATEGORIES, 'category');
  if (req.body.status) requireEnum(req.body.status, VALID_STATUSES, 'status');

  const {
    companyId, subCategory, description, status,
    vendorName, vendorContact, vendorPAN, vendorGST,
    vendorBankName, vendorBankAccount, vendorIfsc,
    amount, paymentMode, paymentDate, paymentUTR,
    invoiceNumber, invoiceDate, invoiceFileUrl,
    startDate, expiryDate, renewalDate, lastServiceDate,
    licenseKey, seats,
    registrationNumber, ipClass, ipJurisdiction,
    notes,
  } = req.body;

  const contract = await req.prisma.companyContract.create({
    data: {
      category, name,
      companyId:  companyId  ? parseInt(companyId, 10)  : null,
      subCategory, description,
      status:     status     || 'active',
      vendorName, vendorContact, vendorPAN, vendorGST,
      vendorBankName, vendorBankAccount, vendorIfsc,
      amount:     amount     ? parseFloat(amount)        : null,
      paymentMode, paymentDate, paymentUTR,
      invoiceNumber, invoiceDate, invoiceFileUrl,
      startDate, expiryDate, renewalDate, lastServiceDate,
      licenseKey,
      seats:      seats      ? parseInt(seats, 10)       : null,
      registrationNumber, ipClass, ipJurisdiction,
      notes,
      createdBy: req.user.id,
    },
  });

  await logSigningEvent(req.prisma, contract.id, 'created', {
    performedBy: req.user.name, performedById: req.user.id,
  });

  res.status(201).json(enrichContract(contract));
}));

// ── PUT /:id ── update ───────────────────────────────────────────────────────
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (req.body.category) requireEnum(req.body.category, VALID_CATEGORIES, 'category');
  if (req.body.status)   requireEnum(req.body.status,   VALID_STATUSES,   'status');

  const {
    category, name, companyId, subCategory, description, status,
    vendorName, vendorContact, vendorPAN, vendorGST,
    vendorBankName, vendorBankAccount, vendorIfsc,
    amount, paymentMode, paymentDate, paymentUTR,
    invoiceNumber, invoiceDate, invoiceFileUrl,
    startDate, expiryDate, renewalDate, lastServiceDate,
    licenseKey, seats,
    registrationNumber, ipClass, ipJurisdiction,
    notes, externalSignerName, externalSignerEmail, externalSignerPhone,
  } = req.body;

  const data = {
    ...(category    !== undefined && { category }),
    ...(name        !== undefined && { name }),
    ...(companyId   !== undefined && { companyId: companyId ? parseInt(companyId, 10) : null }),
    ...(subCategory !== undefined && { subCategory }),
    ...(description !== undefined && { description }),
    ...(status      !== undefined && { status }),
    ...(vendorName  !== undefined && { vendorName }),
    ...(vendorContact !== undefined && { vendorContact }),
    ...(vendorPAN   !== undefined && { vendorPAN }),
    ...(vendorGST   !== undefined && { vendorGST }),
    ...(vendorBankName !== undefined && { vendorBankName }),
    ...(vendorBankAccount !== undefined && { vendorBankAccount }),
    ...(vendorIfsc  !== undefined && { vendorIfsc }),
    ...(amount      !== undefined && { amount: amount ? parseFloat(amount) : null }),
    ...(paymentMode !== undefined && { paymentMode }),
    ...(paymentDate !== undefined && { paymentDate }),
    ...(paymentUTR  !== undefined && { paymentUTR }),
    ...(invoiceNumber !== undefined && { invoiceNumber }),
    ...(invoiceDate !== undefined && { invoiceDate }),
    ...(invoiceFileUrl !== undefined && { invoiceFileUrl }),
    ...(startDate   !== undefined && { startDate }),
    ...(expiryDate  !== undefined && { expiryDate }),
    ...(renewalDate !== undefined && { renewalDate }),
    ...(lastServiceDate !== undefined && { lastServiceDate }),
    ...(licenseKey  !== undefined && { licenseKey }),
    ...(seats       !== undefined && { seats: seats ? parseInt(seats, 10) : null }),
    ...(registrationNumber !== undefined && { registrationNumber }),
    ...(ipClass     !== undefined && { ipClass }),
    ...(ipJurisdiction !== undefined && { ipJurisdiction }),
    ...(notes       !== undefined && { notes }),
    ...(externalSignerName  !== undefined && { externalSignerName }),
    ...(externalSignerEmail !== undefined && { externalSignerEmail }),
    ...(externalSignerPhone !== undefined && { externalSignerPhone }),
  };

  const contract = await req.prisma.companyContract.update({ where: { id }, data });
  res.json(enrichContract(contract));
}));

// ── DELETE /:id ──────────────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await throwIfHasDependencies(req.prisma, 'CompanyContract', id);
  await req.prisma.companyContract.delete({ where: { id } });
  res.json({ message: 'Contract deleted' });
}));

// ══════════════════════════════════════════════════════════════════════════════
//  SIGNING WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /:id/upload-contract ── upload contract PDF to Drive ────────────────
router.post('/:id/upload-contract', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!req.file) throw badRequest('No file uploaded');

  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');

  const drive = await getDriveClient();
  const contractsFolder = await getOrCreateContractsFolder(drive);
  const fileName = `${contract.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-original.pdf`;

  const result = await uploadFile(drive, contractsFolder, fileName, req.file.mimetype, req.file.buffer);

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      contractFileUrl: result.webViewLink,
      contractDriveFileId: result.fileId,
      signingStatus: contract.signingStatus === 'none' ? 'draft' : contract.signingStatus,
    },
  });

  res.json(enrichContract(updated));
}));

// ── POST /:id/generate-from-template ── render template → store HTML ─────────
router.post('/:id/generate-from-template', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { templateId } = req.body;
  requireFields(req.body, 'templateId');

  const [contract, template] = await Promise.all([
    req.prisma.companyContract.findUnique({
      where: { id },
      include: { company: { select: { name: true } } },
    }),
    req.prisma.contractTemplate.findUnique({ where: { id: parseInt(templateId, 10) } }),
  ]);

  if (!contract) throw notFound('Contract');
  if (!template) throw notFound('Template');

  // Replace placeholders
  let rendered = template.content;
  const replacements = {
    '{{contractName}}': contract.name || '',
    '{{vendorName}}': contract.vendorName || '',
    '{{vendorContact}}': contract.vendorContact || '',
    '{{companyName}}': contract.company?.name || 'Color Papers India Pvt. Ltd.',
    '{{date}}': todayStr(),
    '{{startDate}}': contract.startDate || '',
    '{{expiryDate}}': contract.expiryDate || '',
    '{{amount}}': contract.amount ? `₹${contract.amount.toLocaleString('en-IN')}` : '',
    '{{description}}': contract.description || '',
    '{{category}}': contract.category || '',
  };

  for (const [key, val] of Object.entries(replacements)) {
    rendered = rendered.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
  }

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      templateId: template.id,
      templateContent: rendered,
      signingStatus: 'draft',
    },
  });

  res.json(enrichContract(updated));
}));

// ── POST /:id/send-for-signing ── generate token & send email ────────────────
router.post('/:id/send-for-signing', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const { externalSignerName, externalSignerEmail, externalSignerPhone, expiryDays } = req.body;
  requireFields(req.body, 'externalSignerName', 'externalSignerEmail');

  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');
  if (!contract.contractFileUrl && !contract.templateContent) {
    throw badRequest('Upload a contract PDF or generate from template first');
  }

  const token = crypto.randomUUID();
  const days = parseInt(expiryDays, 10) || 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiry.toISOString().slice(0, 10),
      signingStatus: 'sent',
      sentAt: nowStr(),
      externalSignerName,
      externalSignerEmail,
      externalSignerPhone: externalSignerPhone || null,
    },
  });

  await logSigningEvent(req.prisma, id, 'sent', {
    performedBy: req.user.name,
    performedById: req.user.id,
    notes: `Sent to ${externalSignerEmail}`,
  });

  // Send email
  const signingUrl = `${getBaseUrl()}/sign/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Contract Signing Request</h2>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <p>Dear <strong>${externalSignerName}</strong>,</p>
        <p>You have a contract from <strong>Color Papers India Pvt. Ltd.</strong> that requires your signature:</p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Contract:</strong> ${contract.name}</p>
          ${contract.description ? `<p style="margin: 4px 0;"><strong>Description:</strong> ${contract.description}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Signing deadline:</strong> ${expiry.toISOString().slice(0, 10)}</p>
        </div>
        <p><strong>Steps to sign:</strong></p>
        <ol>
          <li>Click the button below to open the signing page</li>
          <li>Download and review the contract document</li>
          <li>Sign the document (digitally or physically)</li>
          <li>Upload the signed copy back through the page</li>
        </ol>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${signingUrl}" style="background: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Review & Sign Contract
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">This link expires on ${expiry.toISOString().slice(0, 10)}. If you have questions, please contact us.</p>
      </div>
      <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">
        Color Papers India Pvt. Ltd.
      </div>
    </div>
  `;

  try {
    await sendEmail(externalSignerEmail, `Contract for Signing: ${contract.name}`, html);
  } catch (e) {
    console.error('Failed to send contract signing email:', e.message);
  }

  res.json(enrichContract(updated));
}));

// ── POST /:id/resend ── regenerate token & resend ────────────────────────────
router.post('/:id/resend', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');
  if (!['sent', 'expired'].includes(contract.signingStatus)) {
    throw badRequest('Can only resend contracts in sent or expired status');
  }

  const token = crypto.randomUUID();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      signingToken: token,
      signingTokenExpiresAt: expiry.toISOString().slice(0, 10),
      signingStatus: 'sent',
      sentAt: nowStr(),
    },
  });

  await logSigningEvent(req.prisma, id, 'resent', {
    performedBy: req.user.name, performedById: req.user.id,
  });

  // Resend email
  const signingUrl = `${getBaseUrl()}/sign/${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Contract Signing Reminder</h2>
      </div>
      <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <p>Dear <strong>${contract.externalSignerName}</strong>,</p>
        <p>This is a reminder to sign the contract: <strong>${contract.name}</strong></p>
        <p>A new signing link has been generated for you:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${signingUrl}" style="background: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Review & Sign Contract
          </a>
        </div>
        <p style="color: #64748b; font-size: 13px;">This link expires on ${expiry.toISOString().slice(0, 10)}.</p>
      </div>
    </div>
  `;

  try {
    await sendEmail(contract.externalSignerEmail, `Reminder: Contract for Signing — ${contract.name}`, html);
  } catch (e) {
    console.error('Failed to resend contract email:', e.message);
  }

  res.json(enrichContract(updated));
}));

// ── PUT /:id/cancel-signing ──────────────────────────────────────────────────
router.put('/:id/cancel-signing', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      signingStatus: 'cancelled',
      signingToken: null,
      cancelledAt: nowStr(),
      cancellationReason: req.body.reason || null,
    },
  });

  await logSigningEvent(req.prisma, id, 'cancelled', {
    performedBy: req.user.name, performedById: req.user.id,
    notes: req.body.reason || 'Cancelled by admin',
  });

  res.json(enrichContract(updated));
}));

// ── POST /:id/upload-signed ── admin uploads signed copy on behalf ───────────
router.post('/:id/upload-signed', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!req.file) throw badRequest('No file uploaded');

  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');

  const drive = await getDriveClient();
  const contractsFolder = await getOrCreateContractsFolder(drive);
  const signerName = (contract.externalSignerName || 'external').replace(/[^a-zA-Z0-9-_ ]/g, '');
  const fileName = `${contract.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-signed-by-${signerName}.pdf`;

  const result = await uploadFile(drive, contractsFolder, fileName, req.file.mimetype, req.file.buffer);

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      signedFileUrl: result.webViewLink,
      signedDriveFileId: result.fileId,
      signingStatus: 'partially_signed',
      externalSignedAt: nowStr(),
    },
  });

  await logSigningEvent(req.prisma, id, 'external_signed', {
    performedBy: `Admin upload by ${req.user.name}`,
    performedById: req.user.id,
    notes: 'Signed copy uploaded by admin on behalf of external party',
  });

  res.json(enrichContract(updated));
}));

// ── POST /:id/counter-sign ── internal counter-sign ──────────────────────────
router.post('/:id/counter-sign', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const contract = await req.prisma.companyContract.findUnique({ where: { id } });
  if (!contract) throw notFound('Contract');
  if (contract.signingStatus !== 'partially_signed') {
    throw badRequest('Contract must be externally signed before counter-signing');
  }

  let counterSignedFileUrl = contract.counterSignedFileUrl;
  let counterSignedDriveFileId = contract.counterSignedDriveFileId;

  if (req.file) {
    const drive = await getDriveClient();
    const contractsFolder = await getOrCreateContractsFolder(drive);
    const fileName = `${contract.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-counter-signed-final.pdf`;
    const result = await uploadFile(drive, contractsFolder, fileName, req.file.mimetype, req.file.buffer);
    counterSignedFileUrl = result.webViewLink;
    counterSignedDriveFileId = result.fileId;
  }

  const updated = await req.prisma.companyContract.update({
    where: { id },
    data: {
      signingStatus: 'fully_signed',
      counterSignedAt: nowStr(),
      completedAt: nowStr(),
      internalSignerId: req.user.id,
      counterSignedFileUrl,
      counterSignedDriveFileId,
      signingToken: null,
    },
  });

  await logSigningEvent(req.prisma, id, 'counter_signed', {
    performedBy: req.user.name, performedById: req.user.id,
  });
  await logSigningEvent(req.prisma, id, 'completed', {
    performedBy: 'System', notes: 'Contract fully executed',
  });

  // Notify external party
  if (contract.externalSignerEmail) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #059669; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Contract Fully Executed</h2>
        </div>
        <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
          <p>Dear <strong>${contract.externalSignerName}</strong>,</p>
          <p>The contract <strong>"${contract.name}"</strong> has been fully signed by all parties.</p>
          <p>Both your signature and the internal counter-signature are now on record.</p>
          <p style="color: #64748b; font-size: 13px;">If you need a copy of the fully executed contract, please contact us.</p>
        </div>
      </div>
    `;
    try {
      await sendEmail(contract.externalSignerEmail, `Contract Fully Executed: ${contract.name}`, html);
    } catch (e) {
      console.error('Failed to send completion email:', e.message);
    }
  }

  res.json(enrichContract(updated));
}));

// ── GET /:id/signing-events ── audit trail ───────────────────────────────────
router.get('/:id/signing-events', requireAdmin, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const events = await req.prisma.contractSigningEvent.findMany({
    where: { contractId: id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(events);
}));

module.exports = router;
