const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { getDriveClient, getOrCreateRootFolder, uploadFile } = require('../services/google/googleDrive');
const { sendEmail } = require('../services/notifications/emailService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowStr() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

async function validateToken(prisma, token) {
  if (!token || token.length < 10) throw notFound('Signing link');
  const contract = await prisma.companyContract.findUnique({
    where: { signingToken: token },
    include: { company: { select: { name: true } } },
  });
  if (!contract) throw notFound('This signing link is invalid or has expired');
  const today = new Date().toISOString().slice(0, 10);
  if (contract.signingTokenExpiresAt && contract.signingTokenExpiresAt < today) {
    throw notFound('This signing link has expired');
  }
  return contract;
}

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

// ── GET /:token ── get contract details for signing page ─────────────────────
router.get('/:token', asyncHandler(async (req, res) => {
  const contract = await validateToken(req.prisma, req.params.token);

  // Log view event
  await req.prisma.contractSigningEvent.create({
    data: {
      contractId: contract.id,
      eventType: 'viewed',
      performedBy: `External: ${contract.externalSignerEmail}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')?.slice(0, 200),
    },
  });

  res.json({
    contractName: contract.name,
    description: contract.description,
    companyName: contract.company?.name || 'Color Papers India Pvt. Ltd.',
    externalSignerName: contract.externalSignerName,
    externalSignerEmail: contract.externalSignerEmail,
    signingStatus: contract.signingStatus,
    sentAt: contract.sentAt,
    externalSignedAt: contract.externalSignedAt,
    hasContractFile: !!contract.contractFileUrl,
    hasTemplateContent: !!contract.templateContent,
    canUpload: contract.signingStatus === 'sent',
    expiresAt: contract.signingTokenExpiresAt,
  });
}));

// ── GET /:token/download ── download contract PDF from Drive ─────────────────
router.get('/:token/download', asyncHandler(async (req, res) => {
  const contract = await validateToken(req.prisma, req.params.token);

  // Log download
  await req.prisma.contractSigningEvent.create({
    data: {
      contractId: contract.id,
      eventType: 'downloaded',
      performedBy: `External: ${contract.externalSignerEmail}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')?.slice(0, 200),
    },
  });

  if (contract.contractDriveFileId) {
    // Stream file from Drive
    const drive = await getDriveClient();
    const fileRes = await drive.files.get(
      { fileId: contract.contractDriveFileId, alt: 'media' },
      { responseType: 'stream' },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${contract.name}.pdf"`);
    fileRes.data.pipe(res);
  } else if (contract.templateContent) {
    // Return rendered HTML as downloadable content
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${contract.name}.html"`);
    res.send(contract.templateContent);
  } else {
    throw notFound('Contract document not available');
  }
}));

// ── POST /:token/upload ── upload signed copy ────────────────────────────────
router.post('/:token/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const contract = await validateToken(req.prisma, req.params.token);

  if (contract.signingStatus !== 'sent') {
    throw badRequest('This contract has already been signed or is no longer accepting uploads');
  }

  if (!req.file) throw badRequest('No file uploaded');

  // Upload to Drive
  const drive = await getDriveClient();
  const contractsFolder = await getOrCreateContractsFolder(drive);
  const signerName = (contract.externalSignerName || 'external').replace(/[^a-zA-Z0-9-_ ]/g, '');
  const fileName = `${contract.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}-signed-by-${signerName}.pdf`;

  const result = await uploadFile(drive, contractsFolder, fileName, req.file.mimetype, req.file.buffer);

  // Update contract
  await req.prisma.companyContract.update({
    where: { id: contract.id },
    data: {
      signedFileUrl: result.webViewLink,
      signedDriveFileId: result.fileId,
      signingStatus: 'partially_signed',
      externalSignedAt: nowStr(),
    },
  });

  // Log event
  await req.prisma.contractSigningEvent.create({
    data: {
      contractId: contract.id,
      eventType: 'external_signed',
      performedBy: `External: ${contract.externalSignerEmail} (${contract.externalSignerName})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')?.slice(0, 200),
      notes: `Signed document uploaded: ${fileName}`,
    },
  });

  // Notify admin (contract creator)
  if (contract.createdBy) {
    const creator = await req.prisma.user.findUnique({
      where: { id: contract.createdBy },
      select: { email: true, name: true },
    });

    if (creator?.email) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #d97706; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Contract Signed — Counter-Signature Needed</h2>
          </div>
          <div style="padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <p>Hi <strong>${creator.name}</strong>,</p>
            <p><strong>${contract.externalSignerName}</strong> has signed the contract <strong>"${contract.name}"</strong>.</p>
            <p>Please log in to review and counter-sign the document to complete the contract.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://eod.colorpapers.in/admin/contracts" style="background: #1e40af; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                View Contract
              </a>
            </div>
          </div>
        </div>
      `;
      try {
        await sendEmail(creator.email, `Contract Signed by ${contract.externalSignerName}: ${contract.name}`, html);
      } catch (e) {
        console.error('Failed to send signed notification:', e.message);
      }
    }
  }

  res.json({ message: 'Signed document uploaded successfully. The internal team will review and counter-sign.' });
}));

module.exports = router;
