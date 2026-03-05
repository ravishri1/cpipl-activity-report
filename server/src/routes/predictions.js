const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound, forbidden } = require('../utils/httpErrors');
const { parseId, requireFields } = require('../utils/validate');
const healthScoring = require('../services/healthScoring');
const predictiveModeling = require('../services/predictiveModeling');

const router = express.Router();
router.use(authenticate); // All routes require authentication

/**
 * GET /api/predictions/asset/:assetId/health
 * Get comprehensive prediction data for a specific asset
 * Returns: Health score + Failure predictions + Maintenance recommendations
 */
router.get('/asset/:assetId/health', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);

  // Verify asset exists and user has permission
  const asset = await req.prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      handovers: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!asset) throw notFound('Asset');

  // Check permissions: admin can view all, users can only view assigned assets
  if (req.user.role !== 'admin' && asset.assignedTo !== req.user.id) {
    throw forbidden();
  }

  // Fetch all prediction data
  const [healthScore, predictionResult, recommendations] = await Promise.all([
    req.prisma.assetHealthScore.findUnique({
      where: { assetId },
    }),
    req.prisma.predictionResult.findUnique({
      where: { assetId },
    }),
    req.prisma.maintenanceRecommendation.findMany({
      where: { assetId },
      orderBy: { priority: 'desc' },
    }),
  ]);

  // If no data exists, calculate fresh predictions
  if (!healthScore) {
    await healthScoring.calculateAssetHealthScore(assetId, req.prisma);
  }

  if (!predictionResult) {
    await predictiveModeling.predictFailureRisk(assetId, req.prisma);
  }

  if (recommendations.length === 0) {
    await predictiveModeling.generateRecommendations(
      assetId,
      predictionResult,
      req.prisma
    );
  }

  // Re-fetch after generation if needed
  const [updatedHealth, updatedPrediction, updatedRecommendations] = await Promise.all([
    req.prisma.assetHealthScore.findUnique({ where: { assetId } }),
    req.prisma.predictionResult.findUnique({ where: { assetId } }),
    req.prisma.maintenanceRecommendation.findMany({
      where: { assetId },
      orderBy: { priority: 'desc' },
      include: { approver: { select: { id: true, name: true } } },
    }),
  ]);

  // Parse JSON strings
  const parsedPrediction = updatedPrediction ? {
    ...updatedPrediction,
    primaryRiskFactors: JSON.parse(updatedPrediction.primaryRiskFactors || '[]'),
  } : null;

  res.json({
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      serialNumber: asset.serialNumber,
      assignedTo: asset.assignee,
    },
    healthScore: updatedHealth,
    predictions: parsedPrediction,
    recommendations: updatedRecommendations,
    lastUpdated: {
      health: updatedHealth?.lastUpdated,
      prediction: updatedPrediction?.lastRecalculated,
      recommendations: updatedRecommendations.length > 0 
        ? updatedRecommendations[0].updatedAt 
        : null,
    },
  });
}));

/**
 * GET /api/predictions/at-risk
 * Get list of at-risk assets with failure probability > threshold
 * Query params:
 *   - limit: number (default: 20)
 *   - minProbability: number 0-100 (default: 60)
 *   - riskLevel: string (low/medium/high/critical)
 */
router.get('/at-risk', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const minProbability = Math.max(0, Math.min(100, parseInt(req.query.minProbability) || 60));
  const riskLevel = req.query.riskLevel;

  // Build filter
  const where = {
    failureProb30Days: { gte: minProbability },
  };

  // Get at-risk predictions
  const predictions = await req.prisma.predictionResult.findMany({
    where,
    include: {
      asset: {
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
    orderBy: { failureProb30Days: 'desc' },
    take: limit,
  });

  // Filter by health score risk level if specified
  let results = predictions;
  if (riskLevel) {
    const assetIds = predictions.map(p => p.assetId);
    const healthScores = await req.prisma.assetHealthScore.findMany({
      where: { assetId: { in: assetIds }, riskLevel },
    });
    const riskAssetIds = new Set(healthScores.map(h => h.assetId));
    results = predictions.filter(p => riskAssetIds.has(p.assetId));
  }

  // Parse risk factors
  const formatted = results.map(pred => ({
    ...pred,
    primaryRiskFactors: JSON.parse(pred.primaryRiskFactors || '[]'),
  }));

  res.json({
    count: formatted.length,
    threshold: minProbability,
    assets: formatted,
  });
}));

/**
 * POST /api/predictions/recalculate-all
 * Admin-only: Trigger recalculation of health scores and predictions for all assets
 * Optional: assetIds array to recalculate specific assets
 */
router.post('/recalculate-all', requireAdmin, asyncHandler(async (req, res) => {
  const { assetIds } = req.body;

  // If specific assets provided, validate they exist
  if (assetIds && Array.isArray(assetIds)) {
    const assets = await req.prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true },
    });
    if (assets.length !== assetIds.length) {
      throw badRequest('Some asset IDs not found');
    }
  }

  // Start background recalculation
  res.status(202).json({
    status: 'calculation_started',
    message: 'Health score and prediction recalculation started in background',
    timestamp: new Date(),
    assetsRequested: assetIds?.length || 'all',
  });

  // Run in background (don't await)
  setImmediate(async () => {
    try {
      if (assetIds && assetIds.length > 0) {
        // Recalculate specific assets
        const results = {
          successful: 0,
          failed: 0,
          errors: [],
        };

        for (const id of assetIds) {
          try {
            await healthScoring.calculateAssetHealthScore(id, req.prisma);
            const prediction = await req.prisma.predictionResult.findUnique({
              where: { assetId: id },
            });
            await predictiveModeling.generateRecommendations(id, prediction, req.prisma);
            results.successful++;
          } catch (error) {
            results.failed++;
            results.errors.push({ assetId: id, error: error.message });
          }
        }

        console.log('[Predictions] Batch recalculation complete:', results);
      } else {
        // Recalculate all assets
        const result = await healthScoring.batchRecalculateHealthScores(req.prisma);
        console.log('[Predictions] Full recalculation complete:', result);
      }
    } catch (error) {
      console.error('[Predictions] Background recalculation failed:', error);
    }
  });
}));

/**
 * GET /api/predictions/recommendations
 * Get list of maintenance recommendations with filtering/sorting
 * Query params:
 *   - status: string (pending/approved/in_progress/completed)
 *   - urgency: string (low/medium/high/critical)
 *   - assetId: number
 *   - limit: number (default: 20)
 *   - sort: string (priority/urgency/createdAt, default: priority)
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const { status, urgency, assetId } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const sortField = req.query.sort || 'priority';

  // Build filter
  const where = {};
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;
  if (assetId) where.assetId = parseInt(assetId);

  // Determine sort order
  const orderBy = {};
  if (sortField === 'priority') orderBy.priority = 'desc';
  else if (sortField === 'urgency') orderBy.urgency = 'desc';
  else orderBy.createdAt = 'desc';

  const recommendations = await req.prisma.maintenanceRecommendation.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, type: true } },
      approver: { select: { id: true, name: true } },
    },
    orderBy,
    take: limit,
  });

  // For non-admin users, filter to their assigned assets
  let filtered = recommendations;
  if (req.user.role !== 'admin') {
    filtered = recommendations.filter(
      rec => rec.asset.id === req.user.id || rec.approvedBy === req.user.id
    );
  }

  res.json({
    count: filtered.length,
    filters: { status, urgency, assetId },
    recommendations: filtered,
  });
}));

/**
 * PUT /api/predictions/recommendation/:recommendationId
 * Update recommendation status (admin/team_lead only)
 * Body: { status, approvedBy }
 */
router.put('/recommendation/:recommendationId', asyncHandler(async (req, res) => {
  const recommendationId = parseId(req.params.recommendationId);
  const { status } = req.body;

  // Only admin/team_lead can update
  if (req.user.role === 'member') {
    throw forbidden();
  }

  // Validate status
  const validStatuses = ['pending', 'approved', 'in_progress', 'completed'];
  if (status && !validStatuses.includes(status)) {
    throw badRequest('Invalid status. Must be: ' + validStatuses.join(', '));
  }

  const recommendation = await req.prisma.maintenanceRecommendation.findUnique({
    where: { id: recommendationId },
  });

  if (!recommendation) throw notFound('Recommendation');

  // Build update data
  const updateData = {};
  if (status) {
    updateData.status = status;
    if (status === 'approved') {
      updateData.approvedBy = req.user.id;
      updateData.approvedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }
  }

  const updated = await req.prisma.maintenanceRecommendation.update({
    where: { id: recommendationId },
    data: updateData,
    include: {
      asset: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
    },
  });

  res.json({
    message: 'Recommendation updated',
    recommendation: updated,
  });
}));

/**
 * GET /api/predictions/asset/:assetId/health/trend
 * Get historical health trend for an asset
 * Query params:
 *   - months: number (default: 6)
 */
router.get('/asset/:assetId/health/trend', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const months = Math.min(parseInt(req.query.months) || 6, 24);

  // Check asset access permission
  const asset = await req.prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) throw notFound('Asset');

  if (req.user.role !== 'admin' && asset.assignedTo !== req.user.id) {
    throw forbidden();
  }

  // Get health trend
  const trend = await healthScoring.getHealthTrend(assetId, req.prisma, months);

  if (!trend) {
    throw notFound('Health data - asset has no health score yet');
  }

  res.json({
    assetId,
    trend,
    periodMonths: months,
  });
}));

module.exports = router;
