const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { requireFields, parseId } = require('../utils/validate');
const {
  captureRepairMetrics,
  calculateVendorPerformanceScore,
  getVendorTrends,
  getVendorRanking
} = require('../services/vendorAnalytics');

const router = express.Router();
router.use(authenticate); // All routes require auth

// ═══════════════════════════════════════════════════════════════════
// 1. GET /api/vendor-metrics/vendor/:vendorId/metrics
// Retrieve detailed vendor metrics from all their repairs
// ═══════════════════════════════════════════════════════════════════
router.get('/vendor/:vendorId/metrics', asyncHandler(async (req, res) => {
  const vendorId = parseId(req.params.vendorId);

  // Verify vendor exists
  const vendor = await req.prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw notFound('Vendor');

  // Get all individual repair metrics
  const metrics = await req.prisma.vendorMetrics.findMany({
    where: { vendorId },
    include: {
      repair: {
        select: { id: true, assetId: true, sentOutDate: true, expectedReturnDate: true, status: true }
      },
      asset: {
        select: { id: true, name: true, assetTag: true }
      }
    },
    orderBy: { repair: { actualReturnDate: 'desc' } }
  });

  res.json({
    vendorId,
    vendorName: vendor.vendorName,
    totalRepairs: metrics.length,
    metrics
  });
}));

// ═══════════════════════════════════════════════════════════════════
// 2. GET /api/vendor-metrics/summary
// Get vendor performance scorecard with aggregated metrics
// ═══════════════════════════════════════════════════════════════════
router.get('/summary', asyncHandler(async (req, res) => {
  const { vendorId } = req.query;

  if (!vendorId) {
    // Return all vendors' performance scores (admin only)
    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') throw forbidden();

    const scores = await req.prisma.vendorPerformanceScore.findMany({
      include: {
        vendor: {
          select: { id: true, vendorName: true, category: true, status: true, vendorCode: true }
        }
      },
      orderBy: { trustScore: 'desc' }
    });

    return res.json({
      totalVendors: scores.length,
      scores
    });
  }

  // Get specific vendor score
  const id = parseId(vendorId);
  const score = await req.prisma.vendorPerformanceScore.findUnique({
    where: { vendorId: id },
    include: {
      vendor: {
        select: { id: true, vendorName: true, category: true, status: true, vendorCode: true, email: true, phone: true }
      }
    }
  });

  if (!score) throw notFound('Vendor performance score');

  res.json(score);
}));

// ═══════════════════════════════════════════════════════════════════
// 3. GET /api/vendor-metrics/repair/:repairId/metrics
// Get metrics specific to a completed repair
// ═══════════════════════════════════════════════════════════════════
router.get('/repair/:repairId/metrics', asyncHandler(async (req, res) => {
  const repairId = parseId(req.params.repairId);

  const metrics = await req.prisma.vendorMetrics.findUnique({
    where: { repairId },
    include: {
      repair: true,
      vendor: { select: { id: true, vendorName: true, category: true } },
      asset: { select: { id: true, name: true, assetTag: true } }
    }
  });

  if (!metrics) throw notFound('Repair metrics');

  res.json(metrics);
}));

// ═══════════════════════════════════════════════════════════════════
// 4. POST /api/vendor-metrics/vendor/:vendorId/evaluate
// Record/update vendor metrics from a completed repair (admin)
// ═══════════════════════════════════════════════════════════════════
router.post('/vendor/:vendorId/evaluate', requireAdmin, asyncHandler(async (req, res) => {
  const vendorId = parseId(req.params.vendorId);
  const { repairId, reworkRequired, customerSatisfaction, qualityScore, communicationScore, positiveNotes } = req.body;

  requireFields(req.body, 'repairId');

  // Verify repair exists and belongs to this vendor
  const repair = await req.prisma.assetRepair.findUnique({
    where: { id: repairId }
  });

  if (!repair) throw notFound('Repair');
  if (repair.vendorId !== vendorId) throw badRequest('Repair does not belong to this vendor');

  // Check if metrics already exist
  const existingMetrics = await req.prisma.vendorMetrics.findUnique({
    where: { repairId }
  });

  let metrics;
  if (existingMetrics) {
    // Update existing metrics
    metrics = await req.prisma.vendorMetrics.update({
      where: { repairId },
      data: {
        reworkRequired: reworkRequired ?? existingMetrics.reworkRequired,
        customerSatisfaction: customerSatisfaction ?? existingMetrics.customerSatisfaction,
        qualityScore: qualityScore ?? existingMetrics.qualityScore,
        communicationScore: communicationScore ?? existingMetrics.communicationScore,
        positiveNotes: positiveNotes ?? existingMetrics.positiveNotes
      }
    });
  } else {
    // Create new metrics record if repair is completed
    if (repair.status !== 'completed') throw badRequest('Repair must be completed before recording metrics');
    metrics = await captureRepairMetrics(repairId, req.prisma);
    
    // Update with provided feedback
    if (reworkRequired || customerSatisfaction || qualityScore || communicationScore || positiveNotes) {
      metrics = await req.prisma.vendorMetrics.update({
        where: { repairId },
        data: {
          reworkRequired: reworkRequired ?? false,
          customerSatisfaction,
          qualityScore,
          communicationScore,
          positiveNotes
        }
      });
    }
  }

  // Recalculate vendor performance score
  const performanceScore = await calculateVendorPerformanceScore(vendorId, req.prisma);

  res.json({
    message: 'Vendor metrics evaluated',
    metrics,
    performanceScore
  });
}));

// ═══════════════════════════════════════════════════════════════════
// 5. GET /api/vendor-metrics/rankings
// Get all vendors ranked by trust score in their categories (admin)
// ═══════════════════════════════════════════════════════════════════
router.get('/rankings', requireAdmin, asyncHandler(async (req, res) => {
  const { category, limit = 20 } = req.query;

  let where = {};
  if (category) {
    where.vendor = { category };
  }

  const scores = await req.prisma.vendorPerformanceScore.findMany({
    where,
    include: {
      vendor: {
        select: { id: true, vendorName: true, category: true, status: true, vendorCode: true }
      }
    },
    orderBy: { trustScore: 'desc' },
    take: parseInt(limit)
  });

  // Add ranking info
  const rankings = scores.map((score, index) => ({
    ...score,
    rank: index + 1,
    topPerformer: index < 3
  }));

  // Group by vendor tier
  const byTier = {
    platinum: rankings.filter(r => r.vendorTier === 'platinum'),
    gold: rankings.filter(r => r.vendorTier === 'gold'),
    silver: rankings.filter(r => r.vendorTier === 'silver'),
    bronze: rankings.filter(r => r.vendorTier === 'bronze')
  };

  res.json({
    total: rankings.length,
    byTier,
    rankings
  });
}));

// ═══════════════════════════════════════════════════════════════════
// 6. GET /api/vendor-metrics/vendor/:vendorId/trends
// Get historical trend analysis for a vendor
// ═══════════════════════════════════════════════════════════════════
router.get('/vendor/:vendorId/trends', asyncHandler(async (req, res) => {
  const vendorId = parseId(req.params.vendorId);
  const { timeWindowDays = 90 } = req.query;

  // Verify vendor exists
  const vendor = await req.prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) throw notFound('Vendor');

  const trends = await getVendorTrends(vendorId, req.prisma, parseInt(timeWindowDays));

  res.json({
    vendorId,
    vendorName: vendor.vendorName,
    timeWindowDays: parseInt(timeWindowDays),
    trends
  });
}));

// ═══════════════════════════════════════════════════════════════════
// 7. POST /api/vendor-metrics/vendor/:vendorId/feedback
// Record manual satisfaction feedback for a vendor
// ═══════════════════════════════════════════════════════════════════
router.post('/vendor/:vendorId/feedback', requireAdmin, asyncHandler(async (req, res) => {
  const vendorId = parseId(req.params.vendorId);
  const { repairId, satisfactionRating, notes } = req.body;

  requireFields(req.body, 'repairId', 'satisfactionRating');

  if (satisfactionRating < 1 || satisfactionRating > 5) {
    throw badRequest('Satisfaction rating must be between 1 and 5');
  }

  // Verify repair exists and belongs to this vendor
  const repair = await req.prisma.assetRepair.findUnique({
    where: { id: repairId }
  });

  if (!repair) throw notFound('Repair');
  if (repair.vendorId !== vendorId) throw badRequest('Repair does not belong to this vendor');

  // Update metrics with feedback
  const metrics = await req.prisma.vendorMetrics.update({
    where: { repairId },
    data: {
      customerSatisfaction: satisfactionRating,
      positiveNotes: notes || null
    }
  });

  // Recalculate vendor performance score
  const performanceScore = await calculateVendorPerformanceScore(vendorId, req.prisma);

  res.json({
    message: 'Feedback recorded',
    metrics,
    performanceScore
  });
}));

// ═══════════════════════════════════════════════════════════════════
// 8. BONUS: GET /api/vendor-metrics/vendor/:vendorId/ranking
// Get this vendor's rank vs peers in same category
// ═══════════════════════════════════════════════════════════════════
router.get('/vendor/:vendorId/ranking', asyncHandler(async (req, res) => {
  const vendorId = parseId(req.params.vendorId);
  const ranking = await getVendorRanking(vendorId, req.prisma);
  res.json(ranking);
}));

module.exports = router;
