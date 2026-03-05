/**
 * Predictive Maintenance API Routes
 * Real implementation backed by Asset, AssetRepair, AssetHealthScore DB models
 */

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { badRequest, notFound } = require('../utils/httpErrors');
const { parseId } = require('../utils/validate');
const { calculateHealthScore, upsertHealthScore } = require('../services/healthScoring');

const router = express.Router();
router.use(authenticate);

// ─── Helper: Load asset with repairs ─────────────────────────────────────────
async function loadAssetWithRepairs(prisma, assetId) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      repairHistory: {
        orderBy: { createdAt: 'desc' },
      },
      healthScore: true,
      predictions: true,
      recommendations: {
        where: { status: 'pending' },
        orderBy: { priority: 'desc' },
      },
    },
  });
  if (!asset) throw notFound('Asset');
  return asset;
}

// ─── GET /api/predictions/asset/:assetId/health ───────────────────────────────
// Get (or recalculate) health score for a single asset
router.get('/asset/:assetId/health', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const asset   = await loadAssetWithRepairs(req.prisma, assetId);

  // Calculate fresh score (do not persist on GET — use PUT to force recalculate+save)
  const result = calculateHealthScore(asset, asset.repairHistory);

  // Map primaryRiskFactors string keys → { name, description } objects for UI
  const RISK_FACTOR_LABELS = {
    asset_age:      { name: 'Old Asset',         description: 'Asset age is reducing reliability' },
    poor_condition: { name: 'Poor Condition',     description: 'Asset condition requires attention' },
    repair_history: { name: 'Frequent Repairs',   description: 'High repair frequency indicates wear' },
    warranty_status:{ name: 'Warranty Expired',   description: 'No warranty coverage remaining' },
  };
  const riskFactors = (result.predictions.primaryRiskFactors || []).map(
    key => RISK_FACTOR_LABELS[key] || { name: key, description: 'Risk factor identified' }
  );

  // Confidence: based on data richness (more repairs = higher confidence)
  const confidence = Math.min(0.50 + (asset.repairHistory.length * 0.05), 0.95);

  res.json({
    asset: {
      id:            asset.id,
      name:          asset.name,
      type:          asset.type,
      serialNumber:  asset.serialNumber,
      assetTag:      asset.assetTag,
      condition:     asset.condition,
      status:        asset.status,
      purchaseDate:  asset.purchaseDate,
      warrantyExpiry:asset.warrantyExpiry,
      location:      asset.location,
      currentValue:  asset.currentValue,
    },
    // Flat structure — dashboard uses assetDetails.healthScore (number), .riskLevel, .trend
    healthScore:     result.overallHealthScore,
    riskLevel:       result.riskLevel,
    trend:           result.healthTrend,
    scoreBreakdown:  result.scoreBreakdown,
    predictions: {
      prob30:      Math.round(result.predictions.days30 * 100),
      prob60:      Math.round(result.predictions.days60 * 100),
      prob90:      Math.round(result.predictions.days90 * 100),
      confidence,
      riskFactors,
    },
    recommendations: result.recommendations,
    repairCount:     asset.repairHistory.length,
    activeRepair:    asset.repairHistory.find(r => !['completed', 'cancelled'].includes(r.status)) ?? null,
    lastUpdated:     asset.healthScore?.lastUpdated ?? result.calculatedAt,
  });
}));

// ─── PUT /api/predictions/asset/:assetId/health ───────────────────────────────
// Force recalculate + persist health score for an asset
router.put('/asset/:assetId/health', requireAdmin, asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const asset   = await loadAssetWithRepairs(req.prisma, assetId);
  const result  = await upsertHealthScore(req.prisma, asset, asset.repairHistory);

  res.json({
    message: 'Health score recalculated and saved',
    assetId,
    healthScore: result.overallHealthScore,
    riskLevel:   result.riskLevel,
    calculatedAt: result.calculatedAt,
  });
}));

// ─── GET /api/predictions/at-risk ─────────────────────────────────────────────
// List all assets with their calculated health scores, sorted by risk
router.get('/at-risk', asyncHandler(async (req, res) => {
  const { riskLevel, sort = 'risk_desc', limit = '50' } = req.query;
  const take = Math.min(parseInt(limit) || 50, 200);

  // Fetch all non-retired assets with their data
  const assets = await req.prisma.asset.findMany({
    where: {
      status: { not: 'retired' },
    },
    include: {
      repairHistory: { orderBy: { createdAt: 'desc' } },
      healthScore: true,
    },
    take: 200, // calculate from up to 200 assets
  });

  // Calculate health scores for all
  const scored = assets.map(asset => {
    const result = calculateHealthScore(asset, asset.repairHistory);
    // Convert failure probabilities from decimal (0-1) to percentage (0-100)
    return {
      id:            asset.id,
      name:          asset.name,
      assetTag:      asset.assetTag,
      type:          asset.type,
      serialNumber:  asset.serialNumber,
      condition:     asset.condition,
      status:        asset.status,
      location:      asset.location,
      purchaseDate:  asset.purchaseDate,
      healthScore:   result.overallHealthScore,
      riskLevel:     result.riskLevel,
      healthTrend:   result.healthTrend,
      repairCount:   asset.repairHistory.length,
      prob30:        Math.round(result.predictions.days30 * 100),
      prob60:        Math.round(result.predictions.days60 * 100),
      prob90:        Math.round(result.predictions.days90 * 100),
      topRiskFactor: result.predictions.primaryRiskFactors[0] ?? null,
      lastAssessment: result.calculatedAt,
    };
  });

  // Filter by risk level if requested
  let filtered = riskLevel
    ? scored.filter(a => a.riskLevel === riskLevel)
    : scored.filter(a => a.riskLevel !== 'low'); // default: show non-low risk

  // Sort
  if (sort === 'risk_desc')   filtered.sort((a, b) => a.healthScore - b.healthScore);
  else if (sort === 'risk_asc')    filtered.sort((a, b) => b.healthScore - a.healthScore);
  else if (sort === 'failure_prob') filtered.sort((a, b) => b.prob30 - a.prob30);
  else if (sort === 'repair_count') filtered.sort((a, b) => b.repairCount - a.repairCount);
  else if (sort === 'age_desc') filtered.sort((a, b) => {
    const aDate = a.purchaseDate ? new Date(a.purchaseDate) : new Date();
    const bDate = b.purchaseDate ? new Date(b.purchaseDate) : new Date();
    return aDate - bDate; // oldest first
  });

  res.json(filtered.slice(0, take));
}));

// ─── GET /api/predictions/dashboard/summary ───────────────────────────────────
// Dashboard overview: counts, averages, risk distribution
router.get('/dashboard/summary', asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    where: { status: { not: 'retired' } },
    include: { repairHistory: { orderBy: { createdAt: 'desc' } } },
  });

  const scored = assets.map(asset => ({
    id:          asset.id,
    name:        asset.name,
    type:        asset.type,
    result:      calculateHealthScore(asset, asset.repairHistory),
  }));

  const riskDist = { critical: 0, high: 0, medium: 0, low: 0 };
  let totalScore  = 0;

  for (const s of scored) {
    riskDist[s.result.riskLevel]++;
    totalScore += s.result.overallHealthScore;
  }

  const criticalAssets = scored
    .filter(s => s.result.riskLevel === 'critical' || s.result.riskLevel === 'high')
    .sort((a, b) => a.result.overallHealthScore - b.result.overallHealthScore)
    .slice(0, 5)
    .map(s => ({
      id:          s.id,
      name:        s.name,
      type:        s.type,
      healthScore: s.result.overallHealthScore,
      riskLevel:   s.result.riskLevel,
      topRisk:     s.result.predictions.primaryRiskFactors[0] ?? null,
    }));

  res.json({
    totalAssets:     assets.length,
    atRiskCount:     riskDist.critical + riskDist.high + riskDist.medium,
    avgHealthScore:  assets.length ? Math.round(totalScore / assets.length) : 0,
    riskDistribution: riskDist,
    criticalAssets,
    lastCalculated: new Date().toISOString(),
  });
}));

// ─── POST /api/predictions/batch/calculate ────────────────────────────────────
// Recalculate + persist health scores for multiple (or all) assets
router.post('/batch/calculate', requireAdmin, asyncHandler(async (req, res) => {
  const { assetIds } = req.body; // optional — if omitted, recalculate ALL

  const where = assetIds?.length
    ? { id: { in: assetIds.map(Number) } }
    : { status: { not: 'retired' } };

  const assets = await req.prisma.asset.findMany({
    where,
    include: { repairHistory: { orderBy: { createdAt: 'desc' } } },
  });

  const results = [];
  for (const asset of assets) {
    try {
      const r = await upsertHealthScore(req.prisma, asset, asset.repairHistory);
      results.push({ assetId: asset.id, success: true,
        healthScore: r.overallHealthScore, riskLevel: r.riskLevel });
    } catch (err) {
      results.push({ assetId: asset.id, success: false, error: err.message });
    }
  }

  res.json({
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed:    results.filter(r => !r.success).length,
    results,
  });
}));

// ─── POST /api/predictions/recalculate-all ────────────────────────────────────
// Alias for batch/calculate — recalculates ALL assets (called from dashboard UI)
router.post('/recalculate-all', requireAdmin, asyncHandler(async (req, res) => {
  const assets = await req.prisma.asset.findMany({
    where: { status: { not: 'retired' } },
    include: { repairHistory: { orderBy: { createdAt: 'desc' } } },
  });

  const results = [];
  for (const asset of assets) {
    try {
      const r = await upsertHealthScore(req.prisma, asset, asset.repairHistory);
      results.push({ assetId: asset.id, success: true,
        healthScore: r.overallHealthScore, riskLevel: r.riskLevel });
    } catch (err) {
      results.push({ assetId: asset.id, success: false, error: err.message });
    }
  }

  res.json({
    message:   `Recalculated health scores for ${results.filter(r => r.success).length} assets`,
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed:    results.filter(r => !r.success).length,
  });
}));

// ─── GET /api/predictions/recommendations ────────────────────────────────────
// List all recommendations (with optional status/urgency filter)
router.get('/recommendations', asyncHandler(async (req, res) => {
  const { status = 'pending', urgency, limit = '20' } = req.query;
  const take = Math.min(parseInt(limit) || 20, 100);

  const where = {};
  if (status)  where.status  = status;
  if (urgency) where.urgency = urgency;

  const recs = await req.prisma.maintenanceRecommendation.findMany({
    where,
    include: {
      asset: { select: { id: true, name: true, type: true, serialNumber: true, condition: true } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take,
  });

  res.json(recs);
}));

// ─── PUT /api/predictions/recommendations/:id/status ─────────────────────────
// Update recommendation status (pending → in_progress → completed → dismissed)
router.put('/recommendations/:id/status', requireAdmin, asyncHandler(async (req, res) => {
  const id     = parseId(req.params.id);
  const { status, notes } = req.body;

  const valid = ['pending', 'in_progress', 'completed', 'dismissed'];
  if (!valid.includes(status)) throw badRequest(`Invalid status. Use: ${valid.join(', ')}`);

  const rec = await req.prisma.maintenanceRecommendation.update({
    where: { id },
    data:  { status, ...(notes ? { reasoning: notes } : {}) },
    include: { asset: { select: { id: true, name: true } } },
  });

  res.json(rec);
}));

// ─── GET /api/predictions/insights/:assetId/trend ────────────────────────────
// Get health trend over time (based on repair events)
router.get('/insights/:assetId/trend', asyncHandler(async (req, res) => {
  const assetId = parseId(req.params.assetId);
  const months  = Math.min(parseInt(req.query.months) || 12, 24);
  const asset   = await loadAssetWithRepairs(req.prisma, assetId);

  // Build monthly snapshots by replaying repair history
  const now        = new Date();
  const dataPoints = [];

  for (let m = months - 1; m >= 0; m--) {
    const pointDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const pointDateStr = pointDate.toISOString().slice(0, 10);

    // Repairs that existed at this point in time
    const repairsAtPoint = asset.repairHistory.filter(r =>
      r.createdAt && new Date(r.createdAt) <= pointDate
    );

    // Simulate asset state at that point
    const assetAtPoint = {
      ...asset,
      // Condition degradation over time (simple approximation)
      condition: asset.condition,
    };

    const snapshot = calculateHealthScore(assetAtPoint, repairsAtPoint);

    dataPoints.push({
      date:        pointDateStr,
      month:       m,
      score:       snapshot.overallHealthScore,
      riskLevel:   snapshot.riskLevel,
      repairCount: repairsAtPoint.filter(r => r.status === 'completed').length,
    });
  }

  const scores  = dataPoints.map(d => d.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Trend: compare first half vs second half average
  const mid       = Math.floor(dataPoints.length / 2);
  const firstHalf = dataPoints.slice(0, mid).reduce((s, d) => s + d.score, 0) / mid;
  const lastHalf  = dataPoints.slice(mid).reduce((s, d) => s + d.score, 0) / (dataPoints.length - mid);
  const trend     = lastHalf > firstHalf + 5 ? 'improving'
                  : lastHalf < firstHalf - 5 ? 'declining'
                  : 'stable';

  res.json({
    assetId,
    data:     dataPoints,
    minScore,
    maxScore,
    avgScore,
    trend,
  });
}));

module.exports = router;
