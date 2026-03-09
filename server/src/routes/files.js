const express = require('express');
const multer = require('multer');
const { authenticate, requireAdmin, requireActiveEmployee } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const {
  getDriveClient, getOrCreateRootFolder, getOrCreateEmployeeFolder,
  uploadFile, deleteFile, ensureEmployeeFolder, getDirectImageUrl,
} = require('../services/google/googleDrive');
const { extractInvoiceData, extractMultipleInvoices } = require('../services/invoiceExtractor');
const { processProfilePhoto } = require('../services/photoProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB general limit
});

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB per receipt
});

const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const router = express.Router();
router.use(authenticate);
router.use(requireActiveEmployee);

// ─── 1. POST /api/files/upload — Upload file for self ───
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No file provided.');

  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, employeeId: true, driveFolderId: true },
  });

  const drive = await getDriveClient();
  const folderId = await ensureEmployeeFolder(drive, user, req.prisma);

  const result = await uploadFile(drive, folderId, req.file.originalname, req.file.mimetype, req.file.buffer);

  const driveFile = await req.prisma.driveFile.create({
    data: {
      userId: req.user.id,
      driveFileId: result.fileId,
      driveFolderId: folderId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      driveUrl: result.webViewLink,
      thumbnailUrl: result.thumbnailLink || null,
      category: req.body.category || 'other',
      description: req.body.description || null,
    },
  });

  res.status(201).json(driveFile);
}));

// ─── 2. POST /api/files/upload/:userId — Admin uploads file for employee ───
router.post('/upload/:userId', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No file provided.');
  const userId = parseId(req.params.userId);

  const user = await req.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, employeeId: true, driveFolderId: true },
  });
  if (!user) throw notFound('User');

  const drive = await getDriveClient();
  const folderId = await ensureEmployeeFolder(drive, user, req.prisma);

  const result = await uploadFile(drive, folderId, req.file.originalname, req.file.mimetype, req.file.buffer);

  const driveFile = await req.prisma.driveFile.create({
    data: {
      userId,
      driveFileId: result.fileId,
      driveFolderId: folderId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      driveUrl: result.webViewLink,
      thumbnailUrl: result.thumbnailLink || null,
      category: req.body.category || 'other',
      description: req.body.description || null,
    },
  });

  res.status(201).json(driveFile);
}));

// ─── 3. GET /api/files/my — List own files ───
router.get('/my', asyncHandler(async (req, res) => {
  const where = { userId: req.user.id };
  if (req.query.category && req.query.category !== 'all') {
    where.category = req.query.category;
  }

  const files = await req.prisma.driveFile.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
  });

  res.json(files);
}));

// ─── 4. GET /api/files/user/:userId — Admin lists employee files ───
router.get('/user/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);

  const user = await req.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound('User');

  const where = { userId };
  if (req.query.category && req.query.category !== 'all') {
    where.category = req.query.category;
  }

  const files = await req.prisma.driveFile.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
  });

  res.json(files);
}));

// ─── 5. DELETE /api/files/:fileId — Delete own file (or admin) ───
router.delete('/:fileId', asyncHandler(async (req, res) => {
  const fileId = parseId(req.params.fileId);

  const driveFile = await req.prisma.driveFile.findUnique({ where: { id: fileId } });
  if (!driveFile) throw notFound('File');

  // Only owner or admin can delete
  if (req.user.role !== 'admin' && req.user.role !== 'sub_admin' && req.user.role !== 'team_lead' && driveFile.userId !== req.user.id) {
    throw forbidden();
  }

  try {
    const drive = await getDriveClient();
    await deleteFile(drive, driveFile.driveFileId);
  } catch (err) {
    // File may already be deleted from Drive — still remove DB record
    console.warn('[FILES] Drive delete failed (may already be removed):', err.message);
  }

  await req.prisma.driveFile.delete({ where: { id: fileId } });

  res.json({ message: 'File deleted.' });
}));

// ─── 6. POST /api/files/extract-receipt — Extract single receipt ───
router.post('/extract-receipt', receiptUpload.single('receipt'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No receipt file provided.');
  if (!ALLOWED_RECEIPT_TYPES.includes(req.file.mimetype)) {
    throw badRequest('Only images (JPEG, PNG, WebP) and PDFs are supported.');
  }

  const extracted = await extractInvoiceData(req.file.buffer, req.file.mimetype, req.prisma);

  // Upload to Drive as receipt category
  let driveFile = null;
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, employeeId: true, driveFolderId: true },
    });
    const drive = await getDriveClient();
    const folderId = await ensureEmployeeFolder(drive, user, req.prisma);
    const result = await uploadFile(drive, folderId, req.file.originalname, req.file.mimetype, req.file.buffer);

    driveFile = await req.prisma.driveFile.create({
      data: {
        userId: req.user.id,
        driveFileId: result.fileId,
        driveFolderId: folderId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        driveUrl: result.webViewLink,
        thumbnailUrl: result.thumbnailLink || null,
        category: 'receipt',
        description: extracted.description || null,
      },
    });
  } catch (driveErr) {
    console.warn('[FILES] Drive upload for receipt failed:', driveErr.message);
  }

  res.json({ extracted, driveFile });
}));

// ─── 7. POST /api/files/extract-receipts — Batch extract up to 3 receipts ───
router.post('/extract-receipts', receiptUpload.array('receipts', 3), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) throw badRequest('No receipt files provided.');
  if (req.files.length > 3) throw badRequest('Maximum 3 receipts allowed per batch.');

  // Validate each file
  for (const file of req.files) {
    if (!ALLOWED_RECEIPT_TYPES.includes(file.mimetype)) {
      throw badRequest(`File "${file.originalname}" is not a supported format. Only images (JPEG, PNG, WebP) and PDFs are allowed.`);
    }
    if (file.size > 3 * 1024 * 1024) {
      throw badRequest(`File "${file.originalname}" exceeds the 3 MB limit.`);
    }
  }

  // Extract data from each receipt
  const extractions = await extractMultipleInvoices(req.files, req.prisma);

  // Upload each to Drive
  const user = await req.prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, employeeId: true, driveFolderId: true },
  });

  let drive, folderId;
  try {
    drive = await getDriveClient();
    folderId = await ensureEmployeeFolder(drive, user, req.prisma);
  } catch (err) {
    console.warn('[FILES] Drive init failed for batch:', err.message);
  }

  const results = [];
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const extraction = extractions[i];
    let driveFile = null;

    if (drive && folderId) {
      try {
        const uploadResult = await uploadFile(drive, folderId, file.originalname, file.mimetype, file.buffer);
        driveFile = await req.prisma.driveFile.create({
          data: {
            userId: req.user.id,
            driveFileId: uploadResult.fileId,
            driveFolderId: folderId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            driveUrl: uploadResult.webViewLink,
            thumbnailUrl: uploadResult.thumbnailLink || null,
            category: 'receipt',
            description: extraction.extracted?.description || null,
          },
        });
      } catch (uploadErr) {
        console.warn(`[FILES] Drive upload failed for "${file.originalname}":`, uploadErr.message);
      }
    }

    results.push({
      fileName: extraction.fileName,
      extracted: extraction.extracted,
      error: extraction.error,
      driveFile,
    });
  }

  res.json(results);
}));

// ─── 8. POST /api/files/bulk-photos — Bulk upload employee photos from zip ───
router.post('/bulk-photos', requireAdmin, upload.single('zip'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No zip file provided.');
  if (req.file.mimetype !== 'application/zip' && req.file.mimetype !== 'application/x-zip-compressed') {
    throw badRequest('Please upload a .zip file.');
  }

  const AdmZip = require('adm-zip');
  const zip = new AdmZip(req.file.buffer);
  const entries = zip.getEntries();

  const drive = await getDriveClient();
  const rootId = await getOrCreateRootFolder(drive);

  const summary = { uploaded: 0, skipped: 0, errors: [] };

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const fileName = entry.entryName.split('/').pop(); // handle nested folders in zip
    if (!fileName || !/\.(jpg|jpeg|png)$/i.test(fileName)) {
      summary.skipped++;
      continue;
    }

    // Parse employeeId from filename: "COLOR001.jpg" → "COLOR001"
    const employeeId = fileName.replace(/\.(jpg|jpeg|png)$/i, '');

    const user = await req.prisma.user.findFirst({
      where: { employeeId },
      select: { id: true, name: true, employeeId: true, driveFolderId: true, gender: true },
    });

    if (!user) {
      summary.errors.push(`No employee found for "${employeeId}"`);
      summary.skipped++;
      continue;
    }

    try {
      const rawBuffer = entry.getData();
      const rawMime   = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

      // Process photo: white background, headshot crop, AI cleanup
      const { buffer, mimeType } = await processProfilePhoto(
        rawBuffer, rawMime, { gender: user.gender ?? null }
      );
      const uploadName = fileName.replace(/\.(png)$/i, '.jpg'); // always JPEG after processing

      const folderId = await ensureEmployeeFolder(drive, user, req.prisma);
      const result = await uploadFile(drive, folderId, uploadName, mimeType, buffer);

      if (!result || !result.fileId) {
        throw new Error(`Upload returned invalid result: ${JSON.stringify(result)}`);
      }

      // Create DriveFile record
      await req.prisma.driveFile.create({
        data: {
          userId: user.id,
          driveFileId: result.fileId,
          driveFolderId: folderId,
          fileName:  uploadName,
          mimeType,
          fileSize:  buffer.length,
          driveUrl:  result.webViewLink,
          thumbnailUrl: result.thumbnailLink || null,
          category: 'photo',
          description: 'Profile photo (bulk upload)',
        },
      });

      // Update user's Drive profile photo with direct image URL
      const directUrl = getDirectImageUrl(result.fileId);
      await req.prisma.user.update({
        where: { id: user.id },
        data: { driveProfilePhotoUrl: directUrl },
      });

      summary.uploaded++;

      // Throttle: 200ms delay between uploads to respect Drive API quotas
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      console.error(`[BULK-PHOTOS] Error processing "${fileName}":`, err);
      summary.errors.push(`Failed to upload "${fileName}": ${err.message}`);
    }
  }

  res.json(summary);
}));

// ─── 9. POST /api/files/upload-profile-photo — Upload single profile photo ───
router.post('/upload-profile-photo', upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('No photo provided.');
  if (!req.file.mimetype.startsWith('image/')) throw badRequest('Only image files are allowed.');

  // Admin can upload for another user
  const targetUserId = (req.user.role === 'admin' || req.user.role === 'sub_admin' || req.user.role === 'team_lead')
    ? (req.body.userId ? parseId(req.body.userId) : req.user.id)
    : req.user.id;

  const user = await req.prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, employeeId: true, driveFolderId: true, gender: true },
  });
  if (!user) throw notFound('User');

  // Process photo: white background, headshot crop, AI cleanup (glasses/cap for males)
  const { buffer: processedBuf, mimeType: processedMime } = await processProfilePhoto(
    req.file.buffer, req.file.mimetype, { gender: user.gender ?? null }
  );
  // Always upload as JPEG after processing
  const uploadName = req.file.originalname.replace(/\.(png|webp|gif|bmp)$/i, '.jpg');

  const drive = await getDriveClient();
  const folderId = await ensureEmployeeFolder(drive, user, req.prisma);
  const result = await uploadFile(drive, folderId, uploadName, processedMime, processedBuf);

  const driveFile = await req.prisma.driveFile.create({
    data: {
      userId: targetUserId,
      driveFileId: result.fileId,
      driveFolderId: folderId,
      fileName:  uploadName,
      mimeType:  processedMime,
      fileSize:  processedBuf.length,
      driveUrl:  result.webViewLink,
      thumbnailUrl: result.thumbnailLink || null,
      category: 'photo',
      description: 'Profile photo',
    },
  });

  // Update user's Drive profile photo with direct image URL
  const directPhotoUrl = getDirectImageUrl(result.fileId);
  await req.prisma.user.update({
    where: { id: targetUserId },
    data: { driveProfilePhotoUrl: directPhotoUrl },
  });

  res.json({ driveProfilePhotoUrl: directPhotoUrl, driveFile });
}));

// ─── 10. POST /api/files/fix-photo-urls — Migrate old webViewLink URLs to direct image URLs ───
router.post('/fix-photo-urls', requireAdmin, asyncHandler(async (req, res) => {
  // Find all users with old-format Drive photo URLs (webViewLink)
  const users = await req.prisma.user.findMany({
    where: {
      driveProfilePhotoUrl: { not: null },
    },
    select: { id: true, driveProfilePhotoUrl: true },
  });

  let fixed = 0;
  for (const u of users) {
    if (u.driveProfilePhotoUrl && u.driveProfilePhotoUrl.includes('drive.google.com/file/d/')) {
      const match = u.driveProfilePhotoUrl.match(/\/file\/d\/([^/]+)\//);
      if (match) {
        await req.prisma.user.update({
          where: { id: u.id },
          data: { driveProfilePhotoUrl: getDirectImageUrl(match[1]) },
        });
        fixed++;
      }
    }
  }

  res.json({ message: `Fixed ${fixed} photo URLs out of ${users.length} total.` });
}));

module.exports = router;
