@echo off
cd /d "D:\Activity Report Software"
git add -A
git commit -m "Phase 3 Track 2 - Phase 2A: Backend Infrastructure - Predictive Maintenance System

- Added AssetHealthScore, PredictionResult, MaintenanceRecommendation models to Prisma schema
- Created healthScoring.js service (343 lines) with health score calculation algorithms
- Created predictiveModeling.js service (478 lines) with ML-based prediction and recommendations
- Created predictions.js routes (364 lines) with 6 REST endpoints:
  * GET /api/predictions/asset/:assetId/health - Full prediction data for asset
  * GET /api/predictions/at-risk - List at-risk assets by failure probability
  * POST /api/predictions/recalculate-all - Admin endpoint to recalculate all assets
  * GET /api/predictions/recommendations - List recommendations with filtering
  * PUT /api/predictions/recommendation/:id - Update recommendation status
  * GET /api/predictions/asset/:assetId/health/trend - Historical health trend
- Registered /api/predictions routes in app.js
- Ran Prisma migration: add_predictive_maintenance

Health Scoring Features:
- Age score: Based on purchase date vs expected asset lifespan
- Usage intensity: Based on repair frequency
- Repair history: Based on success rate and turnaround time
- Turnaround score: Vendor performance metrics
- Overall health: Weighted average of 4 components (0-100)
- Risk levels: low/medium/high/critical

Prediction Features (rule-based, ML-ready):
- Failure probability for 30/60/90 day windows
- Top 3 risk factors identification
- Confidence scoring
- Support for ML model integration

Recommendation Engine:
- Automatic recommendation generation based on health + predictions
- Actions: immediate_inspection, preventive_maintenance, condition_monitoring, parts_replacement
- ROI calculation for each recommendation
- Status tracking: pending/approved/in_progress/completed"