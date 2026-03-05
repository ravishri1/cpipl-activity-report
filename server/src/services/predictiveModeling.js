/**
 * Predictive Modeling Service
 * Provides failure prediction and maintenance recommendations using ML
 */

const { parseISO, differenceInDays, addDays } = require('date-fns');

/**
 * Feature extraction from asset and repair history
 * Extracts 15-20 features for ML model input
 */
function extractAssetFeatures(asset, repairs, vendorMetrics) {
  const now = new Date();

  // Calculate time-based features
  let ageInMonths = 0;
  if (asset.purchaseDate) {
    const purchase = parseISO(asset.purchaseDate);
    ageInMonths = Math.floor((now - purchase) / (1000 * 60 * 60 * 24 * 30.44));
  }

  // Repair-based features
  const totalRepairs = repairs?.length || 0;
  const completedRepairs = repairs?.filter(r => r.status === 'completed').length || 0;
  const successRate = totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0;

  // Cost features
  const avgRepairCost = calculateAverageRepairCost(repairs);
  const repairFrequencyPerYear = calculateRepairFrequency(repairs);

  // Turnaround features
  const avgTurnaroundDays = calculateAverageTurnaround(repairs);
  const dayssinceLastRepair = calculateDaysSinceLastRepair(repairs);

  // Vendor performance features
  const vendorReliability = vendorMetrics?.trustScore || 0;
  const vendorOnTimeRate = vendorMetrics?.onTimeDeliveryRate || 0;

  // Asset-specific features
  const assetAgeScore = calculateAgeRiskScore(ageInMonths);
  const categoryRiskLevel = getAssetCategoryRisk(asset.category, asset.type);

  // Recent activity features
  const recentRepairCount = countRecentRepairs(repairs, 90); // Last 90 days
  const costVariance = calculateCostVariance(repairs);

  // Build feature array for ML model (15-20 features)
  const features = [
    ageInMonths,              // 1. Asset age in months
    totalRepairs,             // 2. Total repair count (lifetime)
    avgRepairCost,            // 3. Avg repair cost
    repairFrequencyPerYear,   // 4. Repair frequency per year
    avgTurnaroundDays,        // 5. Avg turnaround time
    vendorReliability,        // 6. Vendor trust score (0-100)
    successRate,              // 7. Repair success rate (%)
    dayssinceLastRepair,      // 8. Days since last repair
    recentRepairCount,        // 9. Repairs in last 90 days
    costVariance,             // 10. Cost variance (%)
    assetAgeScore,            // 11. Age-based risk (0-100)
    categoryRiskLevel,        // 12. Category risk level (0-100)
    vendorOnTimeRate,         // 13. Vendor on-time delivery rate (%)
    completedRepairs,         // 14. Count of completed repairs
    totalRepairs > 0 ? completedRepairs / totalRepairs : 0, // 15. Success ratio (0-1)
  ];

  return {
    features,
    featureNames: [
      'ageInMonths', 'totalRepairs', 'avgRepairCost', 'repairFrequencyPerYear',
      'avgTurnaroundDays', 'vendorReliability', 'successRate', 'daysSinceLastRepair',
      'recentRepairCount', 'costVariance', 'assetAgeScore', 'categoryRiskLevel',
      'vendorOnTimeRate', 'completedRepairs', 'successRatio'
    ],
    metadata: {
      assetId: asset.id,
      assetType: asset.type,
      category: asset.category,
      extractedAt: new Date(),
    },
  };
}

// Helper functions for feature extraction
function calculateAverageRepairCost(repairs) {
  if (!repairs || repairs.length === 0) return 0;
  const costs = repairs.filter(r => r.actualCost).map(r => r.actualCost);
  return costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
}

function calculateRepairFrequency(repairs) {
  if (!repairs || repairs.length === 0) return 0;
  
  // Find oldest repair date
  const dates = repairs
    .filter(r => r.sentOutDate)
    .map(r => parseISO(r.sentOutDate))
    .sort((a, b) => a - b);

  if (dates.length < 2) return 0;

  const oldest = dates[0];
  const newest = dates[dates.length - 1];
  const yearsSpan = (newest - oldest) / (1000 * 60 * 60 * 24 * 365.25);

  return yearsSpan > 0 ? repairs.length / yearsSpan : repairs.length;
}

function calculateAverageTurnaround(repairs) {
  if (!repairs || repairs.length === 0) return 0;

  let totalDays = 0;
  let count = 0;

  repairs.forEach(repair => {
    if (repair.sentOutDate && repair.actualReturnDate) {
      const sent = parseISO(repair.sentOutDate);
      const returned = parseISO(repair.actualReturnDate);
      totalDays += differenceInDays(returned, sent);
      count++;
    }
  });

  return count > 0 ? totalDays / count : 0;
}

function calculateDaysSinceLastRepair(repairs) {
  if (!repairs || repairs.length === 0) return 999; // No repairs = high value

  const lastRepair = repairs.sort((a, b) => 
    parseISO(b.sentOutDate) - parseISO(a.sentOutDate)
  )[0];

  if (lastRepair.actualReturnDate) {
    const returned = parseISO(lastRepair.actualReturnDate);
    return differenceInDays(new Date(), returned);
  }

  return 999;
}

function countRecentRepairs(repairs, daysBack) {
  if (!repairs) return 0;

  const cutoffDate = addDays(new Date(), -daysBack);
  return repairs.filter(r => {
    if (!r.sentOutDate) return false;
    return parseISO(r.sentOutDate) >= cutoffDate;
  }).length;
}

function calculateCostVariance(repairs) {
  if (!repairs || repairs.length < 2) return 0;

  const variances = repairs
    .filter(r => r.estimatedCost && r.actualCost)
    .map(r => Math.abs(r.actualCost - r.estimatedCost) / r.estimatedCost * 100);

  return variances.length > 0 
    ? variances.reduce((a, b) => a + b, 0) / variances.length 
    : 0;
}

function calculateAgeRiskScore(ageInMonths) {
  // Older assets = higher risk
  // 0-12 months: 10, 36 months: 50, 60+ months: 100
  if (ageInMonths <= 0) return 10;
  if (ageInMonths >= 60) return 100;
  return 10 + (ageInMonths / 60) * 90;
}

function getAssetCategoryRisk(category, type) {
  // Risk levels by category
  const categoryRisks = {
    'laptop': 60,
    'phone': 50,
    'simcard': 20,
    'mouse': 10,
    'charger': 30,
    'monitor': 40,
    'keyboard': 15,
    'headset': 20,
    'id_card': 5,
    'access_card': 5,
    'scanner': 70,
    'ac_remote': 25,
    'other': 40,
  };

  const typeRisks = {
    'personal': 50,
    'office': 40,
    'infrastructure': 70,
  };

  return (categoryRisks[type] || 40) * 0.6 + (typeRisks[category] || 40) * 0.4;
}

/**
 * Predict asset failure probability for multiple timeframes
 * Returns probabilities for 30/60/90 day windows
 */
async function predictFailureRisk(assetId, prisma) {
  try {
    // Fetch asset with related data
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        repairHistory: {
          orderBy: { sentOutDate: 'desc' },
          take: 20, // Last 20 repairs
        },
      },
    });

    if (!asset) {
      throw new Error(`Asset with ID ${assetId} not found`);
    }

    // Extract features
    const features = extractAssetFeatures(asset, asset.repairHistory, null);

    // TODO: Load ML model and make prediction
    // For now, use rule-based approach as placeholder
    const prediction = predictUsingRules(features, asset.repairHistory);

    // Store prediction result
    const predictionResult = await prisma.predictionResult.upsert({
      where: { assetId },
      update: {
        failureProb30Days: prediction.prob30,
        failureProb60Days: prediction.prob60,
        failureProb90Days: prediction.prob90,
        confidenceScore: prediction.confidence,
        primaryRiskFactors: JSON.stringify(prediction.riskFactors),
        riskDescription: prediction.description,
        modelVersion: 'v1.0-rules', // Will change to ML model version
        lastRecalculated: new Date(),
      },
      create: {
        assetId,
        failureProb30Days: prediction.prob30,
        failureProb60Days: prediction.prob60,
        failureProb90Days: prediction.prob90,
        confidenceScore: prediction.confidence,
        primaryRiskFactors: JSON.stringify(prediction.riskFactors),
        riskDescription: prediction.description,
        modelVersion: 'v1.0-rules',
      },
    });

    return {
      assetId,
      predictions: {
        next30Days: prediction.prob30,
        next60Days: prediction.prob60,
        next90Days: prediction.prob90,
      },
      confidence: prediction.confidence,
      riskFactors: prediction.riskFactors,
      description: prediction.description,
    };
  } catch (error) {
    console.error(`Error predicting failure risk for asset ${assetId}:`, error);
    throw error;
  }
}

/**
 * Rule-based prediction (placeholder until ML model is integrated)
 * Uses asset features to estimate failure probability
 */
function predictUsingRules(features, repairs) {
  const { features: vals, featureNames } = features;

  // Extract key features
  const ageInMonths = vals[0];
  const totalRepairs = vals[1];
  const repairFrequency = vals[3];
  const avgTurnaround = vals[4];
  const successRate = vals[6];
  const assetAgeRisk = vals[10];
  const recentRepairs = vals[8];

  // Base probability from age
  let baseProb = (assetAgeRisk / 100) * 40;

  // Add from repair frequency
  baseProb += Math.min(30, (repairFrequency / 2) * 30); // Max 30% from frequency

  // Reduce from success rate
  baseProb -= Math.min(10, (successRate / 100) * 10);

  // Add from recent repairs
  baseProb += Math.min(20, (recentRepairs / 3) * 20); // Max 20% from recent

  // Ensure in range [0-100]
  baseProb = Math.max(5, Math.min(95, baseProb));

  // Calculate 30/60/90 day probabilities with decay
  const prob30 = baseProb;
  const prob60 = Math.min(100, baseProb * 1.2);
  const prob90 = Math.min(100, baseProb * 1.4);

  // Identify top risk factors
  const riskFactors = [];
  if (ageInMonths > 48) riskFactors.push('Asset age > 4 years');
  if (repairFrequency > 2) riskFactors.push('High repair frequency');
  if (successRate < 70) riskFactors.push('Low repair success rate');
  if (recentRepairs > 2) riskFactors.push('Multiple recent repairs');
  if (avgTurnaround > 7) riskFactors.push('Long repair turnaround time');

  const description = riskFactors.length > 0
    ? `Asset has elevated failure risk due to: ${riskFactors.slice(0, 3).join(', ')}`
    : 'Asset is performing normally with low failure risk';

  return {
    prob30: Math.round(prob30),
    prob60: Math.round(prob60),
    prob90: Math.round(prob90),
    confidence: 65, // Placeholder confidence for rule-based system
    riskFactors: riskFactors.slice(0, 3), // Top 3 factors
    description,
  };
}

/**
 * Generate maintenance recommendations based on health score and predictions
 */
async function generateRecommendations(assetId, predictionResult, prisma) {
  try {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        healthScore: true,
        repairHistory: { orderBy: { sentOutDate: 'desc' }, take: 5 },
      },
    });

    if (!asset) {
      throw new Error(`Asset with ID ${assetId} not found`);
    }

    const recommendations = [];
    const healthScore = asset.healthScore?.overallHealthScore || 50;
    const failureProb30 = predictionResult?.failureProb30Days || 0;

    // Recommendation 1: Critical failure risk
    if (failureProb30 > 70 || healthScore < 30) {
      recommendations.push({
        action: 'immediate_inspection',
        urgency: 'critical',
        priority: 95,
        reasoning: 'High failure risk detected - immediate inspection required',
        estimatedCost: 500,
        estimatedDowntime: 4,
        failureRiskReduction: 85,
        estimatedROI: 5,
        confidenceScore: 90,
      });
    }

    // Recommendation 2: Preventive maintenance
    if (failureProb30 > 50 && failureProb30 <= 70) {
      recommendations.push({
        action: 'preventive_maintenance',
        urgency: 'high',
        priority: 80,
        reasoning: 'Elevated failure risk - recommend preventive maintenance schedule',
        estimatedCost: 1500,
        estimatedDowntime: 8,
        failureRiskReduction: 60,
        estimatedROI: 3,
        confidenceScore: 75,
      });
    }

    // Recommendation 3: Condition monitoring
    if (healthScore < 50 && failureProb30 < 50) {
      recommendations.push({
        action: 'condition_monitoring',
        urgency: 'medium',
        priority: 60,
        reasoning: 'Asset condition degrading - monitor closely for changes',
        estimatedCost: 300,
        estimatedDowntime: 1,
        failureRiskReduction: 20,
        estimatedROI: 2,
        confidenceScore: 70,
      });
    }

    // Recommendation 4: Parts replacement
    if (asset.repairHistory && asset.repairHistory.length > 3) {
      const avgCost = asset.repairHistory.reduce((sum, r) => sum + (r.actualCost || 0), 0) / asset.repairHistory.length;
      if (avgCost > 1000) {
        recommendations.push({
          action: 'parts_replacement',
          urgency: 'medium',
          priority: 70,
          reasoning: 'High repair costs suggest potential component wear - consider targeted replacement',
          estimatedCost: 2000,
          estimatedDowntime: 6,
          failureRiskReduction: 50,
          estimatedROI: 2.5,
          confidenceScore: 65,
        });
      }
    }

    // Store recommendations
    const createdRecommendations = [];
    for (const rec of recommendations) {
      const created = await prisma.maintenanceRecommendation.create({
        data: {
          assetId,
          ...rec,
        },
      });
      createdRecommendations.push(created);
    }

    return createdRecommendations;
  } catch (error) {
    console.error(`Error generating recommendations for asset ${assetId}:`, error);
    throw error;
  }
}

/**
 * Calculate ROI for a maintenance action
 */async function calculateROI(asset, recommendation, prisma) {
  try {
    // Get recent repair costs to estimate failure cost
    const recentRepairs = await prisma.assetRepair.findMany({
      where: { assetId: asset.id },
      orderBy: { sentOutDate: 'desc' },
      take: 5,
    });

    const avgRepairCost = recentRepairs.length > 0
      ? recentRepairs.reduce((sum, r) => sum + (r.actualCost || 0), 0) / recentRepairs.length
      : 1000; // Default estimate

    // Estimate failure cost (repair + downtime)
    const downtimeHours = recommendation.estimatedDowntime || 4;
    const downtimeCost = (downtimeHours / 8) * 500; // Assume $500/day productivity loss
    const estimatedFailureCost = avgRepairCost + downtimeCost;

    // Calculate ROI
    const actionCost = recommendation.estimatedCost || 1000;
    const riskReduction = recommendation.failureRiskReduction || 50;
    const failureProbability = 0.5; // Assume 50% baseline failure probability

    const expectedSavings = estimatedFailureCost * (riskReduction / 100) * failureProbability;
    const roi = actionCost > 0 ? (expectedSavings / actionCost) : 0;

    return {
      actionCost,
      estimatedFailureCost,
      downtimeCost,
      expectedSavings: Math.round(expectedSavings),
      roi: Math.round(roi * 100) / 100,
      paybackMonths: roi > 0 ? 12 / (roi * 4) : null, // Rough estimate
    };
  } catch (error) {
    console.error('Error calculating ROI:', error);
    return null;
  }
}

module.exports = {
  extractAssetFeatures,
  predictFailureRisk,
  predictUsingRules,
  generateRecommendations,
  calculateROI,
};
