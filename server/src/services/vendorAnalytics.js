/**
 * Vendor Analytics Service
 * Calculates vendor performance metrics, trust scores, and tiering
 */

// ═══════════════════════════════════════════════════════════════════
// 1. INDIVIDUAL REPAIR METRICS (VendorMetrics)
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate and save vendor metrics for a completed repair
 * Called when a repair transitions to 'completed' status
 */
async function captureRepairMetrics(repairId, prisma) {
  const repair = await prisma.assetRepair.findUnique({
    where: { id: repairId },
    include: { asset: true, vendor: true }
  });

  if (!repair) throw new Error('Repair not found');
  if (repair.status !== 'completed') throw new Error('Repair not completed');

  // Calculate turnaround metrics
  const sentDate = new Date(repair.sentOutDate);
  const returnDate = repair.actualReturnDate ? new Date(repair.actualReturnDate) : new Date();
  const expectedDate = new Date(repair.expectedReturnDate);
  
  const daysInRepair = Math.ceil((returnDate - sentDate) / (1000 * 60 * 60 * 24));
  const daysOverdue = returnDate > expectedDate 
    ? Math.ceil((returnDate - expectedDate) / (1000 * 60 * 60 * 24))
    : 0;

  // Calculate cost variance
  const costVariance = repair.actualCost && repair.estimatedCost
    ? repair.actualCost - repair.estimatedCost
    : null;
  
  const costOverrunPercent = costVariance && repair.estimatedCost
    ? (costVariance / repair.estimatedCost) * 100
    : null;

  // Calculate overall service rating (average of quality scores)
  const qualityScores = [];
  if (repair.quality_score) qualityScores.push(repair.quality_score);
  if (repair.communication_score) qualityScores.push(repair.communication_score);
  if (repair.customer_satisfaction) qualityScores.push(repair.customer_satisfaction);
  
  const overallServiceRating = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
    : null;

  // Create VendorMetrics record
  const metrics = await prisma.vendorMetrics.create({
    data: {
      repairId,
      vendorId: repair.vendorId,
      assetId: repair.assetId,
      
      // Turnaround metrics
      daysInRepair,
      daysInProgress: null,  // Could be calculated if we had intermediate statuses
      daysOverdue,
      
      // Cost metrics
      estimatedCost: repair.estimatedCost,
      actualCost: repair.actualCost,
      costVariance,
      costOverrunPercent,
      
      // Quality metrics
      repairSuccessful: true,  // Default - will be updated if rework needed
      reworkRequired: false,
      customerSatisfaction: repair.customer_satisfaction || null,
      communicationScore: repair.communication_score || null,
      qualityScore: repair.quality_score || null,
      overallServiceRating,
      
      // Notes
      issues: repair.notes || null,
      positiveNotes: null
    }
  });

  return metrics;
}

// ═══════════════════════════════════════════════════════════════════
// 2. VENDOR AGGREGATED METRICS (VendorPerformanceScore)
// ═══════════════════════════════════════════════════════════════════

/**
 * Recalculate vendor performance score from all their repairs
 * Call this after any repair completion or update
 */
async function calculateVendorPerformanceScore(vendorId, prisma) {
  // Get all metrics for this vendor
  const allMetrics = await prisma.vendorMetrics.findMany({
    where: { vendorId }
  });

  if (allMetrics.length === 0) {
    // No repairs yet, create default score
    return await prisma.vendorPerformanceScore.upsert({
      where: { vendorId },
      create: {
        vendorId,
        trustScore: 50,  // Neutral score
        vendorTier: 'bronze'
      },
      update: {}
    });
  }

  // ── Repair Success Statistics ──
  const totalRepairs = allMetrics.length;
  const successfulRepairs = allMetrics.filter(m => m.repairSuccessful).length;
  const successRate = (successfulRepairs / totalRepairs) * 100;
  const reworkCount = allMetrics.filter(m => m.reworkRequired).length;

  // ── Turnaround Time Analytics ──
  const avgDaysInRepair = allMetrics.reduce((sum, m) => sum + m.daysInRepair, 0) / totalRepairs;
  const onTimeRepairs = allMetrics.filter(m => m.daysOverdue === 0).length;
  const onTimeDeliveryRate = (onTimeRepairs / totalRepairs) * 100;
  const lateDeliveryCount = totalRepairs - onTimeRepairs;
  const avgDaysOverdue = allMetrics
    .filter(m => m.daysOverdue > 0)
    .reduce((sum, m) => sum + m.daysOverdue, 0) / Math.max(lateDeliveryCount, 1);

  // ── Cost Analytics ──
  const metricsWithCost = allMetrics.filter(m => m.actualCost && m.estimatedCost);
  const avgEstimatedCost = metricsWithCost.length > 0
    ? metricsWithCost.reduce((sum, m) => sum + m.estimatedCost, 0) / metricsWithCost.length
    : 0;
  
  const avgActualCost = metricsWithCost.length > 0
    ? metricsWithCost.reduce((sum, m) => sum + m.actualCost, 0) / metricsWithCost.length
    : 0;
  
  const avgCostVariance = metricsWithCost.length > 0
    ? avgActualCost - avgEstimatedCost
    : 0;
  
  const costAccuracyPercent = avgEstimatedCost > 0
    ? Math.max(0, 100 - Math.abs(avgCostVariance / avgEstimatedCost) * 100)
    : 100;
  
  const overBudgetRepairs = allMetrics.filter(m => m.costOverrunPercent > 0).length;
  const costOverrunRate = (overBudgetRepairs / metricsWithCost.length) * 100;

  // ── Quality Metrics ──
  const metricsWithQuality = allMetrics.filter(m => m.overallServiceRating);
  const avgCommunicationScore = allMetrics
    .filter(m => m.communicationScore)
    .reduce((sum, m) => sum + m.communicationScore, 0) / Math.max(
      allMetrics.filter(m => m.communicationScore).length, 1
    );
  
  const avgQualityScore = allMetrics
    .filter(m => m.qualityScore)
    .reduce((sum, m) => sum + m.qualityScore, 0) / Math.max(
      allMetrics.filter(m => m.qualityScore).length, 1
    );
  
  const avgSatisfactionScore = allMetrics
    .filter(m => m.customerSatisfaction)
    .reduce((sum, m) => sum + m.customerSatisfaction, 0) / Math.max(
      allMetrics.filter(m => m.customerSatisfaction).length, 1
    );
  
  const overallVendorRating = metricsWithQuality.length > 0
    ? metricsWithQuality.reduce((sum, m) => sum + m.overallServiceRating, 0) / metricsWithQuality.length
    : 50;

  // ── TRUST SCORE CALCULATION ──
  // Weighted composite of all metrics (0-100)
  const trustScore = calculateTrustScore({
    successRate,
    onTimeDeliveryRate,
    costAccuracyPercent,
    costOverrunRate,
    avgCommunicationScore,
    avgQualityScore,
    avgSatisfactionScore,
    overallVendorRating
  });

  // ── VENDOR TIER ASSIGNMENT ──
  const vendorTier = assignVendorTier(trustScore, onTimeDeliveryRate, successRate);

  // ── Update or Create Score ──
  const performanceScore = await prisma.vendorPerformanceScore.upsert({
    where: { vendorId },
    create: {
      vendorId,
      totalRepairs,
      successfulRepairs,
      successRate,
      reworkCount,
      avgDaysInRepair,
      onTimeDeliveryRate,
      avgDaysOverdue: isNaN(avgDaysOverdue) ? 0 : avgDaysOverdue,
      lateDeliveryCount,
      avgEstimatedCost,
      avgActualCost,
      avgCostVariance,
      costAccuracyPercent,
      costOverrunRate,
      avgCommunicationScore: isNaN(avgCommunicationScore) ? 0 : avgCommunicationScore,
      avgQualityScore: isNaN(avgQualityScore) ? 0 : avgQualityScore,
      avgSatisfactionScore: isNaN(avgSatisfactionScore) ? 0 : avgSatisfactionScore,
      overallVendorRating: isNaN(overallVendorRating) ? 50 : overallVendorRating,
      trustScore,
      vendorTier
    },
    update: {
      totalRepairs,
      successfulRepairs,
      successRate,
      reworkCount,
      avgDaysInRepair,
      onTimeDeliveryRate,
      avgDaysOverdue: isNaN(avgDaysOverdue) ? 0 : avgDaysOverdue,
      lateDeliveryCount,
      avgEstimatedCost,
      avgActualCost,
      avgCostVariance,
      costAccuracyPercent,
      costOverrunRate,
      avgCommunicationScore: isNaN(avgCommunicationScore) ? 0 : avgCommunicationScore,
      avgQualityScore: isNaN(avgQualityScore) ? 0 : avgQualityScore,
      avgSatisfactionScore: isNaN(avgSatisfactionScore) ? 0 : avgSatisfactionScore,
      overallVendorRating: isNaN(overallVendorRating) ? 50 : overallVendorRating,
      trustScore,
      vendorTier
    }
  });

  return performanceScore;
}

// ═══════════════════════════════════════════════════════════════════
// 3. TRUST SCORE ALGORITHM
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate trust score (0-100) based on weighted metrics
 * Weights:
 * - Success rate: 25%
 * - On-time delivery: 25%
 * - Cost accuracy: 20%
 * - Quality/satisfaction: 20%
 * - Communication: 10%
 */
function calculateTrustScore(metrics) {
  const {
    successRate,           // 0-100
    onTimeDeliveryRate,   // 0-100
    costAccuracyPercent,  // 0-100
    costOverrunRate,      // 0-100 (penalizing factor)
    avgCommunicationScore, // 1-5
    avgQualityScore,      // 1-5
    avgSatisfactionScore, // 1-5
    overallVendorRating   // 1-5 (already averaged)
  } = metrics;

  // Normalize communication/quality scores (1-5) to 0-100
  const commScore = (avgCommunicationScore / 5) * 100;
  const qualScore = (avgQualityScore / 5) * 100;
  const satScore = (avgSatisfactionScore / 5) * 100;
  const overallScore = (overallVendorRating / 5) * 100;

  // Calculate quality dimension (average of scores)
  const qualityDimension = (commScore + qualScore + satScore) / 3;

  // Calculate cost dimension (accuracy minus overrun penalty)
  const costDimension = costAccuracyPercent - (costOverrunRate * 0.5);

  // Weighted composite
  const trustScore = 
    (successRate * 0.25) +
    (onTimeDeliveryRate * 0.25) +
    (costDimension * 0.20) +
    (qualityDimension * 0.20) +
    (commScore * 0.10);

  // Cap between 0-100
  return Math.max(0, Math.min(100, trustScore));
}

// ═══════════════════════════════════════════════════════════════════
// 4. VENDOR TIER ASSIGNMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Assign vendor tier based on performance metrics
 * Tiers: bronze, silver, gold, platinum
 */
function assignVendorTier(trustScore, onTimeRate, successRate) {
  // Platinum: 85+ trust, 95%+ on-time, 99%+ success
  if (trustScore >= 85 && onTimeRate >= 95 && successRate >= 99) {
    return 'platinum';
  }
  
  // Gold: 75+ trust, 90%+ on-time, 95%+ success
  if (trustScore >= 75 && onTimeRate >= 90 && successRate >= 95) {
    return 'gold';
  }
  
  // Silver: 60+ trust, 80%+ on-time, 85%+ success
  if (trustScore >= 60 && onTimeRate >= 80 && successRate >= 85) {
    return 'silver';
  }
  
  // Bronze: default
  return 'bronze';
}

// ═══════════════════════════════════════════════════════════════════
// 5. TREND ANALYSIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get historical trend of vendor performance
 * Returns performance metrics grouped by time period
 */
async function getVendorTrends(vendorId, prisma, timeWindowDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  const metrics = await prisma.vendorMetrics.findMany({
    where: {
      vendorId,
      repair: {
        actualReturnDate: {
          gte: cutoffDate.toISOString().split('T')[0]
        }
      }
    },
    include: { repair: true },
    orderBy: { repair: { actualReturnDate: 'asc' } }
  });

  // Group by month
  const trends = {};
  metrics.forEach(metric => {
    const date = new Date(metric.repair.actualReturnDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!trends[monthKey]) {
      trends[monthKey] = [];
    }
    trends[monthKey].push(metric);
  });

  // Calculate metrics for each month
  const trendData = [];
  Object.entries(trends).forEach(([month, monthMetrics]) => {
    const successful = monthMetrics.filter(m => m.repairSuccessful).length;
    const onTime = monthMetrics.filter(m => m.daysOverdue === 0).length;
    const avgCost = monthMetrics.filter(m => m.actualCost).length > 0
      ? monthMetrics.reduce((sum, m) => sum + m.actualCost, 0) / monthMetrics.length
      : 0;

    trendData.push({
      month,
      totalRepairs: monthMetrics.length,
      successRate: (successful / monthMetrics.length) * 100,
      onTimeRate: (onTime / monthMetrics.length) * 100,
      avgTurnaroundDays: monthMetrics.reduce((sum, m) => sum + m.daysInRepair, 0) / monthMetrics.length,
      avgCost
    });
  });

  return trendData;
}

/**
 * Get vendor ranking vs peers in same category
 */
async function getVendorRanking(vendorId, prisma) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { performanceScore: true }
  });

  if (!vendor) throw new Error('Vendor not found');

  // Get all vendors in same category
  const peersInCategory = await prisma.vendorPerformanceScore.findMany({
    where: {
      vendor: {
        category: vendor.category
      }
    },
    include: { vendor: true },
    orderBy: { trustScore: 'desc' }
  });

  const vendorRank = peersInCategory.findIndex(p => p.vendorId === vendorId) + 1;
  const totalInCategory = peersInCategory.length;

  return {
    vendorId,
    vendorName: vendor.name,
    category: vendor.category,
    rank: vendorRank,
    totalInCategory,
    percentile: ((totalInCategory - vendorRank + 1) / totalInCategory) * 100,
    trustScore: vendor.performanceScore?.trustScore || 0,
    vendorTier: vendor.performanceScore?.vendorTier || 'bronze',
    topPerformer: vendorRank <= 3
  };
}

module.exports = {
  captureRepairMetrics,
  calculateVendorPerformanceScore,
  calculateTrustScore,
  assignVendorTier,
  getVendorTrends,
  getVendorRanking
};
