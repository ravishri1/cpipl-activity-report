/**
 * Health Scoring Service
 * Real implementation using Asset, AssetRepair, and condition data
 */

const TODAY = () => new Date().toISOString().slice(0, 10);

// ─── Score Weights ────────────────────────────────────────────────────────────
const WEIGHTS = {
  age:           0.20,
  condition:     0.30,
  repairHistory: 0.30,
  warranty:      0.20,
};

// ─── Age Score (0–100) ────────────────────────────────────────────────────────
function calcAgeScore(purchaseDateStr) {
  if (!purchaseDateStr) return 50;
  const ageYears = (Date.now() - new Date(purchaseDateStr).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 1)   return 100;
  if (ageYears < 2)   return 90;
  if (ageYears < 3)   return 75;
  if (ageYears < 5)   return 60;
  if (ageYears < 7)   return 40;
  if (ageYears < 10)  return 20;
  return 5;
}

// ─── Condition Score (0–100) ──────────────────────────────────────────────────
function calcConditionScore(condition) {
  const scores = { new: 100, good: 80, fair: 50, damaged: 20, non_working: 0 };
  return scores[condition] ?? 50;
}

// ─── Repair History Score (0–100) ─────────────────────────────────────────────
function calcRepairHistoryScore(repairs) {
  if (!repairs || repairs.length === 0) return 100;
  const completed = repairs.filter(r => r.status === 'completed');
  const active    = repairs.find(r => !['completed', 'cancelled'].includes(r.status));
  const today     = TODAY();
  const overdue   = repairs.filter(r =>
    !['completed', 'cancelled'].includes(r.status) && r.expectedReturnDate < today
  );
  const totalCost = completed.reduce((s, r) => s + (r.actualCost || r.estimatedCost || 0), 0);

  let score = 100;
  score -= completed.length * 10;
  if (active)           score -= 20;
  score -= overdue.length * 15;
  if (totalCost > 10000) score -= 15;
  else if (totalCost > 5000) score -= 10;
  else if (totalCost > 2000) score -= 5;
  return Math.max(0, Math.min(100, score));
}

// ─── Warranty Score (0–100) ───────────────────────────────────────────────────
function calcWarrantyScore(warrantyExpiry) {
  if (!warrantyExpiry) return 50;
  const days = Math.floor((new Date(warrantyExpiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (days > 365) return 100;
  if (days > 180) return 85;
  if (days > 90)  return 70;
  if (days > 30)  return 55;
  if (days > 0)   return 40;
  if (days > -90) return 25;
  return 10;
}

// ─── Failure Probability ──────────────────────────────────────────────────────
function calcFailureProbability(healthScore, repairCount) {
  const base        = (100 - healthScore) / 100;
  const repairFactor = Math.min(repairCount * 0.05, 0.3);
  return {
    days30: Math.round(Math.min(base * 0.25 + repairFactor * 0.10, 0.95) * 100) / 100,
    days60: Math.round(Math.min(base * 0.40 + repairFactor * 0.15, 0.95) * 100) / 100,
    days90: Math.round(Math.min(base * 0.55 + repairFactor * 0.20, 0.95) * 100) / 100,
  };
}

// ─── Risk Level ───────────────────────────────────────────────────────────────
function getRiskLevel(score) {
  if (score < 30) return 'critical';
  if (score < 50) return 'high';
  if (score < 70) return 'medium';
  return 'low';
}

// ─── Trend ───────────────────────────────────────────────────────────────────
function calcHealthTrend(asset, repairs) {
  const recent = (repairs || []).filter(r => {
    if (!r.createdAt) return false;
    return new Date(r.createdAt) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  });
  if (recent.length > 1) return 'declining';
  return 'stable';
}

// ─── Primary Risk Factors ─────────────────────────────────────────────────────
function getPrimaryRiskFactors(scores) {
  const factors = [
    { factor: 'asset_age',       label: 'Old Asset',        score: scores.age },
    { factor: 'poor_condition',  label: 'Poor Condition',   score: scores.condition },
    { factor: 'repair_history',  label: 'Frequent Repairs', score: scores.repair },
    { factor: 'warranty_status', label: 'Warranty Expired', score: scores.warranty },
  ];
  return factors
    .filter(f => f.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(f => f.factor);
}

// ─── Recommendations ──────────────────────────────────────────────────────────
function generateRecommendations(asset, scores, repairs) {
  const recs  = [];
  const today = TODAY();

  if (asset.condition === 'damaged') {
    recs.push({ action: 'repair', urgency: 'high', priority: 80,
      reasoning: 'Asset is damaged and needs immediate repair',
      estimatedCost: 2500, failureRiskReduction: 40 });
  } else if (asset.condition === 'fair') {
    recs.push({ action: 'preventive_maintenance', urgency: 'medium', priority: 60,
      reasoning: 'Fair condition — preventive maintenance will extend lifespan',
      estimatedCost: 800, failureRiskReduction: 25 });
  }

  if (asset.warrantyExpiry) {
    const daysLeft = Math.floor((new Date(asset.warrantyExpiry) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 90) {
      recs.push({ action: 'inspection', urgency: 'high', priority: 85,
        reasoning: `Warranty expires in ${daysLeft} days — inspect and claim issues now`,
        estimatedCost: 0, failureRiskReduction: 20 });
    }
  }

  const completed = (repairs || []).filter(r => r.status === 'completed');
  if (completed.length >= 3) {
    recs.push({ action: 'replacement_evaluation',
      urgency: completed.length >= 5 ? 'high' : 'medium',
      priority: completed.length >= 5 ? 75 : 55,
      reasoning: `${completed.length} repairs recorded — evaluate if replacement is cost-effective`,
      estimatedCost: null, failureRiskReduction: 70 });
  }

  const overdueRepair = (repairs || []).find(r =>
    !['completed', 'cancelled'].includes(r.status) && r.expectedReturnDate < today
  );
  if (overdueRepair) {
    recs.push({ action: 'follow_up_vendor', urgency: 'critical', priority: 95,
      reasoning: `Repair with ${overdueRepair.vendor || 'vendor'} is overdue — follow up immediately`,
      estimatedCost: null, failureRiskReduction: 30 });
  }

  if (scores.age < 40 && completed.length === 0) {
    recs.push({ action: 'preventive_maintenance', urgency: 'medium', priority: 50,
      reasoning: 'Aging asset with no maintenance history — schedule preventive check',
      estimatedCost: 600, failureRiskReduction: 30 });
  }

  return recs.sort((a, b) => b.priority - a.priority);
}

// ─── Main: Calculate Full Health for One Asset ────────────────────────────────
function calculateHealthScore(asset, repairs = []) {
  const scores = {
    age:       calcAgeScore(asset.purchaseDate),
    condition: calcConditionScore(asset.condition),
    repair:    calcRepairHistoryScore(repairs),
    warranty:  calcWarrantyScore(asset.warrantyExpiry),
  };

  const overall = Math.round(
    scores.age       * WEIGHTS.age +
    scores.condition * WEIGHTS.condition +
    scores.repair    * WEIGHTS.repairHistory +
    scores.warranty  * WEIGHTS.warranty
  );

  return {
    assetId:            asset.id,
    overallHealthScore: overall,
    riskLevel:          getRiskLevel(overall),
    healthTrend:        calcHealthTrend(asset, repairs),
    scoreBreakdown: {
      ageScore:           scores.age,
      conditionScore:     scores.condition,
      repairHistoryScore: scores.repair,
      warrantyScore:      scores.warranty,
    },
    predictions: {
      ...calcFailureProbability(overall, repairs.length),
      primaryRiskFactors: getPrimaryRiskFactors(scores),
    },
    recommendations: generateRecommendations(asset, scores, repairs),
    calculatedAt: new Date().toISOString(),
  };
}

// ─── Upsert health data into DB ───────────────────────────────────────────────
async function upsertHealthScore(prisma, asset, repairs = []) {
  const result = calculateHealthScore(asset, repairs);

  await prisma.assetHealthScore.upsert({
    where:  { assetId: asset.id },
    create: {
      assetId:             asset.id,
      ageScore:            result.scoreBreakdown.ageScore,
      usageIntensityScore: result.scoreBreakdown.repairHistoryScore,
      repairHistoryScore:  result.scoreBreakdown.repairHistoryScore,
      turnaroundScore:     result.scoreBreakdown.warrantyScore,
      overallHealthScore:  result.overallHealthScore,
      riskLevel:           result.riskLevel,
      healthTrend:         result.healthTrend,
    },
    update: {
      ageScore:            result.scoreBreakdown.ageScore,
      usageIntensityScore: result.scoreBreakdown.repairHistoryScore,
      repairHistoryScore:  result.scoreBreakdown.repairHistoryScore,
      turnaroundScore:     result.scoreBreakdown.warrantyScore,
      overallHealthScore:  result.overallHealthScore,
      riskLevel:           result.riskLevel,
      healthTrend:         result.healthTrend,
      lastUpdated:         new Date(),
    },
  });

  await prisma.predictionResult.upsert({
    where:  { assetId: asset.id },
    create: {
      assetId:            asset.id,
      failureProb30Days:  result.predictions.days30,
      failureProb60Days:  result.predictions.days60,
      failureProb90Days:  result.predictions.days90,
      confidenceScore:    75,
      primaryRiskFactors: JSON.stringify(result.predictions.primaryRiskFactors),
      riskDescription:    `Risk level: ${result.riskLevel}`,
    },
    update: {
      failureProb30Days:  result.predictions.days30,
      failureProb60Days:  result.predictions.days60,
      failureProb90Days:  result.predictions.days90,
      primaryRiskFactors: JSON.stringify(result.predictions.primaryRiskFactors),
      riskDescription:    `Risk level: ${result.riskLevel}`,
    },
  });

  // Replace pending recommendations with fresh ones
  await prisma.maintenanceRecommendation.deleteMany({
    where: { assetId: asset.id, status: 'pending' },
  });
  for (const rec of result.recommendations) {
    await prisma.maintenanceRecommendation.create({
      data: {
        assetId:              asset.id,
        action:               rec.action,
        urgency:              rec.urgency,
        priority:             rec.priority,
        reasoning:            rec.reasoning,
        estimatedCost:        rec.estimatedCost ?? null,
        failureRiskReduction: rec.failureRiskReduction ?? null,
        confidenceScore:      75,
        status:               'pending',
      },
    });
  }

  return result;
}

module.exports = {
  calculateHealthScore,
  upsertHealthScore,
  getRiskLevel,
  calcAgeScore,
  calcConditionScore,
  calcRepairHistoryScore,
  calcWarrantyScore,
};
