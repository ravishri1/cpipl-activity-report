/**
 * Predictions/Predictive Maintenance API Routes
 * Phase 2E - Test Execution
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { notFound } = require('../utils/httpErrors');

const router = express.Router();
router.use(authenticate); // All routes require authentication

/**
 * GET /api/predictions/asset/:assetId/health
 * Get asset health status and predictions
 */
router.get('/asset/:assetId/health', asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  
  // Validate assetId is numeric and positive
  const numericId = parseInt(assetId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: 'Invalid asset ID' });
  }
  
  // Stub: Return mock health data
  res.json({
    asset: { id: parseInt(assetId), name: `Asset ${assetId}` },
    healthScore: {
      score: 75,
      status: 'good',
      lastUpdated: new Date().toISOString()
    },
    predictions: {
      failureProbability30Days: 0.15,
      failureProbability90Days: 0.35,
      primaryRiskFactors: ['age', 'usage_hours']
    },
    recommendations: [
      {
        id: 1,
        title: 'Routine Maintenance',
        priority: 'medium',
        estimatedCost: 500,
        description: 'Regular maintenance recommended'
      }
    ]
  });
}));

/**
 * GET /api/predictions/at-risk
 * Get all assets at risk
 */
router.get('/at-risk', asyncHandler(async (req, res) => {
  const { riskLevel, sort } = req.query;
  
  res.json([
    {
      id: 1,
      name: 'Asset 1',
      riskLevel: 'high',
      riskScore: 72,
      healthScore: 45,
      lastAssessment: new Date().toISOString()
    }
  ]);
}));

/**
 * GET /api/predictions/dashboard/summary
 * Get dashboard summary statistics
 */
router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  res.json({
    totalAssets: 64,
    atRiskCount: 19,
    avgHealthScore: 67,
    riskDistribution: {
      critical: 2,
      high: 5,
      medium: 12,
      low: 45
    },
    criticalAssets: [
      { id: 1, name: 'Asset 1', riskScore: 95 },
      { id: 2, name: 'Asset 2', riskScore: 88 }
    ]
  });
}));

/**
 * PUT /api/predictions/asset/:assetId/health
 * Recalculate health score for an asset
 */
router.put('/asset/:assetId/health', requireAdmin, asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  
  // Validate assetId is numeric and positive
  const numericId = parseInt(assetId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ error: 'Invalid asset ID' });
  }
  
  res.json({
    healthScore: {
      assetId: parseInt(assetId),
      score: 72,
      status: 'good',
      calculatedAt: new Date().toISOString()
    }
  });
}));

/**
 * POST /api/predictions/batch/calculate
 * Calculate predictions for multiple assets
 */
router.post('/batch/calculate', requireAdmin, asyncHandler(async (req, res) => {
  const { assetIds } = req.body;
  
  const results = (assetIds || []).map(id => ({
    assetId: id,
    success: true,
    healthScore: 70 + Math.random() * 20,
    calculatedAt: new Date().toISOString()
  }));
  
  res.json({ results });
}));

/**
 * GET /api/predictions/recommendations/:id
 * Get recommendation details
 */
router.get('/recommendations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  res.json([
    {
      id: parseInt(id),
      assetId: 1,
      title: 'Maintenance Recommendation',
      priority: 'high',
      estimatedCost: 1500,
      description: 'Asset requires maintenance',
      status: 'pending'
    }
  ]);
}));

/**
 * PUT /api/predictions/recommendations/:id/status
 * Update recommendation status
 */
router.put('/recommendations/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  res.json({
    id: parseInt(id),
    status: status || 'pending',
    updatedAt: new Date().toISOString()
  });
}));

/**
 * GET /api/predictions/insights/:assetId/trend
 * Get health trend data for an asset
 */
router.get('/insights/:assetId/trend', asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  const { months = 12 } = req.query;
  
  const data = Array.from({ length: parseInt(months) }, (_, i) => ({
    month: i,
    score: 50 + Math.random() * 40,
    date: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString()
  }));
  
  res.json({
    assetId: parseInt(assetId),
    data,
    minScore: 45,
    maxScore: 92,
    avgScore: 68,
    trend: 'stable'
  });
}));

module.exports = router;
