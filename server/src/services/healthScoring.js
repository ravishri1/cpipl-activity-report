/**
 * Health Scoring Service
 * Calculates comprehensive asset health scores based on multiple factors
 */

const { parseISO, differenceInMonths, differenceInDays } = require('date-fns');

/**
 * Calculate age score (0-100)
 * Newer assets = higher scores, degrading over time
 * Reference: Laptop/Phone expected life = 4-5 years
 */
function calculateAgeScore(purchaseDate) {
  if (!purchaseDate) return 50; // Default mid-range if no date

  try {
    const now = new Date();
    const purchase = parseISO(purchaseDate);
    const ageMonths = differenceInMonths(now, purchase);

    // Scoring curve: 100 at 0 months, 50 at 36 months (3 years), 10 at 60+ months (5 years)
    if (ageMonths <= 0) return 100;
    if (ageMonths >= 60) return 10;
    
    // Linear interpolation
    return Math.max(10, 100 - (ageMonths / 60) * 90);
  } catch (error) {
    console.error('Error calculating age score:', error);
    return 50;
  }
}

/**
 * Calculate usage intensity score (0-100)
 * Based on frequency of repairs - more repairs = lower score
 */
function calculateUsageIntensityScore(repairCount) {
  // Scoring: 0 repairs = 100, 1-2 repairs = 80-90, 3-5 = 60-75, 6-10 = 30-50, 10+ = 10
  if (repairCount === 0) return 100;
  if (repairCount === 1) return 90;
  if (repairCount === 2) return 80;
  if (repairCount <= 5) return Math.max(60, 100 - (repairCount - 2) * 5);
  if (repairCount <= 10) return Math.max(30, 100 - (repairCount * 8));
  return 10;
}

/**
 * Calculate repair history score (0-100)
 * Based on success rate and turnaround time of repairs
 */
function calculateRepairHistoryScore(repairs) {
  if (!repairs || repairs.length === 0) return 75; // Default for no repair history

  let successCount = 0;
  let totalTurnaroundDays = 0;

  repairs.forEach(repair => {
    // Count successful repairs (completed without being repeated immediately)
    if (repair.status === 'completed') {
      successCount++;
    }
    
    // Calculate turnaround time if available
    if (repair.sentOutDate && repair.actualReturnDate) {
      const sentOut = parseISO(repair.sentOutDate);
      const returned = parseISO(repair.actualReturnDate);
      totalTurnaroundDays += differenceInDays(returned, sentOut);
    }
  });

  // Success rate component (50% weight)
  const successRate = repairs.length > 0 ? (successCount / repairs.length) * 100 : 0;
  const successScore = successRate * 0.5;

  // Turnaround time component (50% weight)
  // Target: 3-5 days, acceptable up to 7 days
  let turnaroundScore = 50; // Default mid-range
  if (repairs.length > 0) {
    const avgTurnaroundDays = totalTurnaroundDays / repairs.length;
    if (avgTurnaroundDays <= 3) turnaroundScore = 100;
    else if (avgTurnaroundDays <= 7) turnaroundScore = 100 - ((avgTurnaroundDays - 3) / 4) * 30;
    else turnaroundScore = Math.max(30, 70 - ((avgTurnaroundDays - 7) / 7) * 50);
  }

  const turnaroundComponentScore = turnaroundScore * 0.5;

  return Math.min(100, successScore + turnaroundComponentScore);
}

/**
 * Calculate turnaround/vendor score (0-100)
 * Based on vendor performance metrics
 */
function calculateTurnaroundScore(vendorMetrics) {
  if (!vendorMetrics) return 50; // Default if no vendor metrics

  // On-time delivery rate (40% weight)
  const onTimeScore = (vendorMetrics.onTimeDeliveryRate || 0) * 0.4;

  // Success rate (30% weight)
  const successScore = (vendorMetrics.successRate || 0) * 0.3;

  // Quality/satisfaction (30% weight)
  const qualityScore = (vendorMetrics.avgSatisfactionScore || 3) / 5 * 100 * 0.3;

  const totalScore = onTimeScore + successScore + qualityScore;
  return Math.min(100, Math.max(0, totalScore));
}

/**
 * Calculate overall health score (0-100) with weighted components
 */
function calculateOverallHealthScore(ageScore, usageScore, repairScore, turnaroundScore) {
  // Weights
  const weights = {
    age: 0.25,           // 25% - asset age
    usage: 0.25,         // 25% - usage/repair frequency
    repairHistory: 0.25, // 25% - repair quality
    turnaround: 0.25,    // 25% - vendor performance
  };

  const overall =
    ageScore * weights.age +
    usageScore * weights.usage +
    repairScore * weights.repairHistory +
    turnaroundScore * weights.turnaround;

  return Math.max(0, Math.min(100, overall));
}

/**
 * Determine risk level based on health score
 */
function getRiskLevel(healthScore) {
  if (healthScore >= 80) return 'low';
  if (healthScore >= 60) return 'medium';
  if (healthScore >= 40) return 'high';
  return 'critical';
}

/**
 * Determine health trend by comparing with previous score
 */
function getHealthTrend(currentScore, previousScore) {
  if (!previousScore) return 'stable';
  const diff = currentScore - previousScore;
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * Calculate comprehensive health score for an asset
 * Called by API endpoints and cron jobs
 */
async function calculateAssetHealthScore(assetId, prisma) {
  try {
    // Fetch asset with related data
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        repairHistory: {
          orderBy: { sentOutDate: 'desc' },
        },
        handovers: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!asset) {
      throw new Error(`Asset with ID ${assetId} not found`);
    }

    // Fetch vendor metrics if asset has associated vendor repairs
    let vendorMetrics = null;
    if (asset.repairHistory && asset.repairHistory.length > 0) {
      // Get the most common vendor's metrics
      const vendorId = asset.repairHistory[0].vendor; // Simplified - use latest
      if (vendorId) {
        vendorMetrics = await prisma.vendorMetrics.findFirst({
          where: { vendorId: parseInt(vendorId) },
        });
      }
    }

    // Calculate component scores
    const ageScore = calculateAgeScore(asset.purchaseDate);
    const usageScore = calculateUsageIntensityScore(asset.repairHistory?.length || 0);
    const repairScore = calculateRepairHistoryScore(asset.repairHistory);
    const turnaroundScore = calculateTurnaroundScore(vendorMetrics);

    // Calculate overall score
    const overallHealthScore = calculateOverallHealthScore(
      ageScore,
      usageScore,
      repairScore,
      turnaroundScore
    );

    // Get previous score for trend calculation
    const previousScore = await prisma.assetHealthScore.findUnique({
      where: { assetId },
      select: { overallHealthScore: true },
    });

    const healthTrend = getHealthTrend(overallHealthScore, previousScore?.overallHealthScore);
    const riskLevel = getRiskLevel(overallHealthScore);

    // Upsert health score record
    const healthScore = await prisma.assetHealthScore.upsert({
      where: { assetId },
      update: {
        ageScore,
        usageIntensityScore: usageScore,
        repairHistoryScore: repairScore,
        turnaroundScore,
        overallHealthScore,
        riskLevel,
        healthTrend,
        lastUpdated: new Date(),
      },
      create: {
        assetId,
        ageScore,
        usageIntensityScore: usageScore,
        repairHistoryScore: repairScore,
        turnaroundScore,
        overallHealthScore,
        riskLevel,
        healthTrend: 'stable', // New assets start as stable
      },
    });

    return healthScore;
  } catch (error) {
    console.error(`Error calculating health score for asset ${assetId}:`, error);
    throw error;
  }
}

/**
 * Batch recalculate health scores for all assets
 * Called monthly by cron job
 */
async function batchRecalculateHealthScores(prisma) {
  try {
    const allAssets = await prisma.asset.findMany({
      select: { id: true },
    });

    console.log(`Starting health score recalculation for ${allAssets.length} assets...`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches to avoid overwhelming database
    const batchSize = 10;
    for (let i = 0; i < allAssets.length; i += batchSize) {
      const batch = allAssets.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (asset) => {
          try {
            await calculateAssetHealthScore(asset.id, prisma);
            results.successful++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              assetId: asset.id,
              error: error.message,
            });
          }
        })
      );

      console.log(`Processed ${Math.min(i + batchSize, allAssets.length)}/${allAssets.length}`);
    }

    console.log('Health score recalculation complete:', results);
    return results;
  } catch (error) {
    console.error('Error in batch health score calculation:', error);
    throw error;
  }
}

/**
 * Get historical health score trend for an asset
 * Returns health scores over specified period
 */
async function getHealthTrend(assetId, prisma, months = 6) {
  try {
    // This would require a HealthScoreHistory model to track over time
    // For now, return current score with placeholder for historical data
    const currentScore = await prisma.assetHealthScore.findUnique({
      where: { assetId },
    });

    if (!currentScore) {
      return null;
    }

    // Return current score and trend information
    return {
      current: {
        score: currentScore.overallHealthScore,
        riskLevel: currentScore.riskLevel,
        trend: currentScore.healthTrend,
        lastUpdated: currentScore.lastUpdated,
      },
      components: {
        age: currentScore.ageScore,
        usageIntensity: currentScore.usageIntensityScore,
        repairHistory: currentScore.repairHistoryScore,
        turnaround: currentScore.turnaroundScore,
      },
      historicalPeriod: `Last ${months} months`,
      // TODO: Add historical data once HealthScoreHistory model is added
    };
  } catch (error) {
    console.error(`Error getting health trend for asset ${assetId}:`, error);
    throw error;
  }
}

module.exports = {
  calculateAssetHealthScore,
  batchRecalculateHealthScores,
  getHealthTrend,
  calculateAgeScore,
  calculateUsageIntensityScore,
  calculateRepairHistoryScore,
  calculateTurnaroundScore,
  calculateOverallHealthScore,
  getRiskLevel,
  getHealthTrend: getHealthTrend, // Export both as module export
};
