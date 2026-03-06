const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const { sendEmail } = require('../services/notifications/emailService');

const router = express.Router();
router.use(authenticate); // All routes require authentication

// ═══════════════════════════════════════════════════════════════════
// GET: Retrieve insurance card for current user
// ═══════════════════════════════════════════════════════════════════
router.get('/my', asyncHandler(async (req, res) => {
  const card = await req.prisma.insuranceCard.findUnique({
    where: { userId: req.user.id },
    include: {
      uploader: { select: { id: true, name: true, email: true } }
    }
  });

  if (!card) {
    return res.status(404).json({
      error: 'No insurance card uploaded yet',
      card: null
    });
  }

  // Update viewedAt if user is viewing for the first time
  if (!card.isViewed) {
    await req.prisma.insuranceCard.update({
      where: { id: card.id },
      data: { 
        isViewed: true,
        viewedAt: new Date().toISOString()
      }
    });
  }

  res.json(card);
}));

// ═══════════════════════════════════════════════════════════════════
// GET: Retrieve insurance card for specific employee (Admin only)
// ═══════════════════════════════════════════════════════════════════
router.get('/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  
  const card = await req.prisma.insuranceCard.findUnique({
    where: { userId },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true, employeeId: true } }
    }
  });

  if (!card) {
    return res.status(404).json({
      error: `No insurance card found for employee ID ${userId}`,
      card: null
    });
  }

  res.json(card);
}));

// ═══════════════════════════════════════════════════════════════════
// GET: List all insurance cards (Admin only) - with search/filter
// ═══════════════════════════════════════════════════════════════════
router.get('', requireAdmin, asyncHandler(async (req, res) => {
  const { search, cardType, isActive = true } = req.query;

  // Build filter
  const where = {
    isActive: isActive === 'true' || isActive === true
  };

  if (cardType && cardType !== 'all') {
    where.cardType = cardType;
  }

  // Search by employee name or employee ID
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  const cards = await req.prisma.insuranceCard.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, employeeId: true } },
      uploader: { select: { id: true, name: true } }
    },
    orderBy: { uploadedAt: 'desc' },
    take: 100
  });

  res.json({
    total: cards.length,
    cards
  });
}));

// ═══════════════════════════════════════════════════════════════════
// POST: Upload insurance card for an employee (Admin only)
// ═══════════════════════════════════════════════════════════════════
router.post('/upload/:userId', requireAdmin, asyncHandler(async (req, res) => {
  const userId = parseId(req.params.userId);
  requireFields(req.body, 'fileUrl', 'fileName', 'mimeType');

  const { 
    fileUrl, 
    fileName, 
    mimeType, 
    fileSize = 0,
    cardType = 'health',
    effectiveFrom,
    effectiveTo,
    providerName,
    policyNumber,
    coverageAmount,
    notes
  } = req.body;

  // Validate MIME type
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(mimeType)) {
    throw badRequest('Invalid file type. Only PDF and images (PNG, JPEG) are allowed');
  }

  // Validate file size (max 10MB)
  if (fileSize > 10 * 1024 * 1024) {
    throw badRequest('File size exceeds 10MB limit');
  }

  // Check if user exists
  const user = await req.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User');

  // Deactivate previous card if it exists
  const existingCard = await req.prisma.insuranceCard.findUnique({
    where: { userId }
  });

  let newCard;

  if (existingCard) {
    // Update existing card
    newCard = await req.prisma.insuranceCard.update({
      where: { id: existingCard.id },
      data: {
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        cardType,
        effectiveFrom,
        effectiveTo,
        providerName,
        policyNumber,
        coverageAmount: coverageAmount ? parseFloat(coverageAmount) : null,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString(),
        notifiedAt: null,
        isViewed: false,
        viewedAt: null,
        notes,
        isActive: true
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } }
      }
    });
  } else {
    // Create new card
    newCard = await req.prisma.insuranceCard.create({
      data: {
        userId,
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        cardType,
        effectiveFrom,
        effectiveTo,
        providerName,
        policyNumber,
        coverageAmount: coverageAmount ? parseFloat(coverageAmount) : null,
        uploadedBy: req.user.id,
        notes,
        isActive: true
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } }
      }
    });
  }

  // Send notification email to employee
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Insurance Card Has Been Uploaded',
      html: `
        <h2>Insurance Card Update</h2>
        <p>Dear ${user.name},</p>
        <p>Your company insurance card (${cardType.toUpperCase()}) has been uploaded to your HR portal.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Card Type: ${cardType}</li>
          ${providerName ? `<li>Provider: ${providerName}</li>` : ''}
          ${policyNumber ? `<li>Policy Number: ${policyNumber}</li>` : ''}
          ${effectiveFrom ? `<li>Effective From: ${effectiveFrom}</li>` : ''}
          ${effectiveTo ? `<li>Expires: ${effectiveTo}</li>` : ''}
        </ul>
        <p>You can view and download your insurance card from your HR portal under <strong>My Profile > Insurance Card</strong>.</p>
        <p>If you have any questions, please contact your HR team.</p>
        <p>Best regards,<br>HR Team</p>
      `
    });

    // Mark as notified
    await req.prisma.insuranceCard.update({
      where: { id: newCard.id },
      data: { notifiedAt: new Date().toISOString() }
    });
  } catch (emailError) {
    console.error('Failed to send insurance card notification email:', emailError);
    // Don't fail the upload if email fails
  }

  res.status(201).json({
    message: 'Insurance card uploaded and employee notified',
    card: newCard
  });
}));

// ═══════════════════════════════════════════════════════════════════
// PUT: Update insurance card details (Admin only)
// ═══════════════════════════════════════════════════════════════════
router.put('/:cardId', requireAdmin, asyncHandler(async (req, res) => {
  const cardId = parseId(req.params.cardId);
  
  const card = await req.prisma.insuranceCard.findUnique({
    where: { id: cardId }
  });
  if (!card) throw notFound('Insurance Card');

  const {
    cardType,
    effectiveFrom,
    effectiveTo,
    providerName,
    policyNumber,
    coverageAmount,
    notes,
    isActive
  } = req.body;

  const updatedCard = await req.prisma.insuranceCard.update({
    where: { id: cardId },
    data: {
      ...(cardType && { cardType }),
      ...(effectiveFrom && { effectiveFrom }),
      ...(effectiveTo && { effectiveTo }),
      ...(providerName && { providerName }),
      ...(policyNumber && { policyNumber }),
      ...(coverageAmount && { coverageAmount: parseFloat(coverageAmount) }),
      ...(notes && { notes }),
      ...(isActive !== undefined && { isActive })
    },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true } }
    }
  });

  res.json({
    message: 'Insurance card updated',
    card: updatedCard
  });
}));

// ═══════════════════════════════════════════════════════════════════
// DELETE: Delete insurance card (Admin only)
// ═══════════════════════════════════════════════════════════════════
router.delete('/:cardId', requireAdmin, asyncHandler(async (req, res) => {
  const cardId = parseId(req.params.cardId);

  const card = await req.prisma.insuranceCard.findUnique({
    where: { id: cardId }
  });
  if (!card) throw notFound('Insurance Card');

  const user = await req.prisma.user.findUnique({
    where: { id: card.userId }
  });

  await req.prisma.insuranceCard.delete({
    where: { id: cardId }
  });

  // Send notification email about card removal
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Insurance Card Has Been Removed',
      html: `
        <h2>Insurance Card Removal</h2>
        <p>Dear ${user.name},</p>
        <p>Your insurance card (${card.cardType.toUpperCase()}) has been removed from your HR portal.</p>
        <p>If you believe this is an error or have questions, please contact your HR team.</p>
        <p>Best regards,<br>HR Team</p>
      `
    });
  } catch (emailError) {
    console.error('Failed to send insurance card removal email:', emailError);
  }

  res.json({
    message: 'Insurance card deleted successfully',
    cardId: cardId
  });
}));

// ═══════════════════════════════════════════════════════════════════
// POST: Mark insurance card as viewed (User marks as read)
// ═══════════════════════════════════════════════════════════════════
router.post('/mark-viewed', authenticate, asyncHandler(async (req, res) => {
  const card = await req.prisma.insuranceCard.findUnique({
    where: { userId: req.user.id }
  });

  if (!card) {
    throw notFound('Insurance Card');
  }

  const updatedCard = await req.prisma.insuranceCard.update({
    where: { id: card.id },
    data: {
      isViewed: true,
      viewedAt: new Date().toISOString()
    }
  });

  res.json({
    message: 'Insurance card marked as viewed',
    card: updatedCard
  });
}));

// ═══════════════════════════════════════════════════════════════════
// GET: Check if new card available (for notification badge)
// ═══════════════════════════════════════════════════════════════════
router.get('/status/unviewed', authenticate, asyncHandler(async (req, res) => {
  const card = await req.prisma.insuranceCard.findUnique({
    where: { userId: req.user.id }
  });

  const hasNewCard = card && !card.isViewed;

  res.json({
    hasNewCard,
    notifiedAt: card?.notifiedAt,
    uploadedAt: card?.uploadedAt
  });
}));

module.exports = router;
