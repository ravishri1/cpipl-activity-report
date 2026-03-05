# Phase 2D: Integration & Testing Plan

## STATUS: IN PROGRESS

### Overall Progress: API Testing 0% | Component Testing 0% | End-to-End Testing 0%

---

## Overview

Phase 2D validates the complete Predictive Maintenance & ML Integration system by:
1. Testing API endpoints independently
2. Testing frontend components in isolation
3. Testing API-to-Frontend data flow
4. Testing complete user workflows
5. Verifying ML model predictions with real asset data

---

## Testing Scope

### API Testing (Backend)

**File:** `server/tests/predictions.test.js` (TO CREATE)

**Endpoints to Test:**
1. `GET /api/predictions/asset/:assetId/health` - Get health + predictions for asset
2. `GET /api/predictions/at-risk?riskLevel=critical` - List at-risk assets
3. `GET /api/predictions/dashboard/summary` - Get risk summary stats
4. `PUT /api/predictions/asset/:assetId/health` - Recalculate health manually
5. `POST /api/predictions/batch/calculate` - Batch calculate predictions
6. `GET /api/predictions/recommendations/:recommendationId` - Get recommendation
7. `PUT /api/predictions/recommendations/:recommendationId/status` - Update recommendation status
8. `GET /api/predictions/insights/:assetId/trend` - Get health trend data

**Test Cases per Endpoint:**
- ✅ Valid request with auth token
- ✅ Valid request as admin (view all assets)
- ✅ Valid request as member (view assigned assets only)
- ❌ Missing auth token → 401
- ❌ Invalid asset ID → 400/404
- ❌ User trying to view other user's assets → 403
- ✅ Response schema validation
- ✅ Data accuracy (calculations correct)

### Component Testing (Frontend)

**File:** `client/src/__tests__/PredictiveMaintenanceDashboard.test.jsx` (TO CREATE)

**Components to Test:**
1. `PredictiveMaintenanceDashboard` - Main layout
2. `HealthScoreCard` - Health visualization
3. `FailureRiskCard` - Risk predictions
4. `RecommendationsPanel` - Recommendations UI
5. `MaintenanceInsightsChart` - Trend chart

**Test Cases per Component:**
- ✅ Component renders without errors
- ✅ Props validation (required props passed)
- ✅ Loading state displays correctly
- ✅ Error state displays correctly
- ✅ Empty state displays correctly
- ✅ User interactions (click, filter, sort)
- ✅ Data formatting (dates, currency, percentages)
- ✅ Responsive design on mobile/tablet/desktop

### Integration Testing

**File:** `client/src/__tests__/PredictiveMaintenanceDashboard.integration.test.jsx` (TO CREATE)

**Scenarios to Test:**
1. ✅ Dashboard loads → API fetches data → Components render
2. ✅ User clicks asset → Detail panel opens → Recommendations display
3. ✅ User filters by risk level → List updates → Chart updates
4. ✅ User changes time range in chart → Chart updates
5. ✅ User approves recommendation → Status updates → UI refreshes
6. ✅ Admin recalculates health → New predictions shown
7. ✅ Error handling → User sees error message
8. ✅ Logout → Dashboard clears

### End-to-End Testing (Manual Verification)

**Checklist:**

```
Database & ML Model:
  ☐ ML model file exists at server/ml/models/asset_failure_model.pkl
  ☐ Model was trained with at least 10 assets
  ☐ Model produces predictions for test assets
  ☐ Feature scaling is consistent

Backend API:
  ☐ Server starts: npm run dev (port 5000)
  ☐ Database has test assets with repair history
  ☐ Health scores calculate correctly
  ☐ Failure predictions generate without errors
  ☐ Recommendations create with correct priorities
  ☐ At-risk filtering works (critical/high/medium/low)

Frontend Components:
  ☐ Client starts: npm run dev (port 3000)
  ☐ /admin/predictive-maintenance route loads
  ☐ Dashboard displays risk summary cards
  ☐ Asset list shows all assets with health scores
  ☐ Risk level color coding is correct
  ☐ Clicking asset opens detail panel
  ☐ Detail panel shows recommendations
  ☐ Category filter tabs work (All/Documents/Receipts/etc.)
  ☐ Chart displays health trend over time

Data Flow:
  ☐ API returns data in expected format
  ☐ Frontend parses JSON correctly
  ☐ Numbers display with correct formatting
  ☐ Dates display in correct format
  ☐ Colors match risk levels

User Workflows:
  ☐ Admin views all assets
  ☐ Admin approves recommendations
  ☐ Admin recalculates health
  ☐ Member views assigned assets only
  ☐ Member cannot approve/recalculate
  ☐ Logout clears dashboard

Error Scenarios:
  ☐ Asset not found → 404 shown
  ☐ No repair history → Default health score shown
  ☐ Model not trained → Graceful fallback
  ☐ API timeout → Loading spinner, retry option
  ☐ Invalid auth → Redirect to login
```

---

## Testing Data Setup

### Create Test Assets (Manual in DB)

```sql
INSERT INTO assets (name, type, serialNumber, purchasePrice, purchaseDate, location, assignedTo, warranty, value) VALUES
  ('Laptop Dell XPS-15', 'Electronics', 'DELL-2021-001', 120000, '2021-01-15', 'Office A', 1, '2023-01-15', 85000),
  ('Printer HP LaserJet', 'Peripherals', 'HP-2020-001', 45000, '2020-06-20', 'Office B', 1, '2022-06-20', 15000),
  ('Server Dell PowerEdge', 'Infrastructure', 'DELL-2019-001', 500000, '2019-03-10', 'Server Room', 1, '2024-03-10', 100000),
  ('Forklift Toyota', 'Vehicles', 'TOYOTA-2018-001', 800000, '2018-11-05', 'Warehouse', 2, '2020-11-05', 200000),
  ('CNC Machine', 'Equipment', 'CNC-2020-001', 1200000, '2020-07-01', 'Factory Floor', 3, '2025-07-01', 400000);
```

### Create Test Repair History

```sql
INSERT INTO repairHistory (assetId, repairDate, description, cost, vendor, status) VALUES
  (1, '2024-06-15', 'Screen replacement', 15000, 'Tech Service', 'completed'),
  (1, '2024-02-10', 'Battery repair', 8000, 'Tech Service', 'completed'),
  (2, '2024-08-20', 'Toner cartridge', 5000, 'HP Service', 'completed'),
  (3, '2024-01-05', 'Thermal paste replacement', 12000, 'Expert Tech', 'completed'),
  (4, '2024-04-30', 'Tire replacement', 25000, 'Toyota Service', 'completed'),
  (4, '2023-12-10', 'Oil change', 8000, 'Toyota Service', 'completed');
```

### Train ML Model

```bash
cd server
python ml/train_model.py
```

Expected output:
```
Loading data from database...
Extracting features...
Training Random Forest model...
Model Accuracy: 0.85
Precision: 0.82
Recall: 0.88
F1 Score: 0.85
Model saved to: server/ml/models/asset_failure_model.pkl
```

---

## Test Execution Plan

### Step 1: API Testing (2 hours)

```bash
# Ensure server is running
cd server
npm run dev

# In another terminal, run API tests
npm test -- predictions.test.js

# Expected: All endpoints return correct status codes and data
```

### Step 2: Component Testing (2 hours)

```bash
# Component unit tests
cd client
npm test -- PredictiveMaintenanceDashboard.test.jsx

# Expected: All components render and handle props correctly
```

### Step 3: Integration Testing (2 hours)

```bash
# API-to-Frontend integration tests
npm test -- PredictiveMaintenanceDashboard.integration.test.jsx

# Expected: Data flows correctly from API to UI
```

### Step 4: Manual E2E Testing (2 hours)

1. **Start both servers:**
   ```bash
   # Terminal 1
   cd server && npm run dev

   # Terminal 2
   cd client && npm run dev
   ```

2. **Login as admin:**
   - URL: http://localhost:3000
   - Email: admin@cpipl.com
   - Password: password123

3. **Navigate to Predictive Maintenance:**
   - Sidebar → Organization → Predictive Maintenance
   - Or direct: http://localhost:3000/admin/predictive-maintenance

4. **Execute manual verification checklist above**

5. **Check browser console:**
   - No errors in console
   - Network requests all successful (200/304 status)
   - No missing assets or 404s

6. **Check server logs:**
   - No errors
   - Predictions calculated successfully
   - Database queries working

---

## Expected Results

### API Testing
- ✅ All 8 endpoints respond with 200/201/204
- ✅ Response schemas match documentation
- ✅ Authentication works correctly
- ✅ Authorization prevents unauthorized access
- ✅ Calculations are accurate

### Component Testing
- ✅ All 5 components render without errors
- ✅ Props validation works
- ✅ User interactions handled correctly
- ✅ Loading/error/empty states display
- ✅ Data formatting is correct

### Integration Testing
- ✅ Data flows from API to components
- ✅ User interactions trigger API calls
- ✅ UI updates on data changes
- ✅ Error handling prevents crashes

### E2E Testing
- ✅ Dashboard loads in <3 seconds
- ✅ All assets display with health scores
- ✅ Risk levels color-coded correctly
- ✅ Detail panel opens on asset click
- ✅ Recommendations display in panel
- ✅ Chart shows health trend
- ✅ No console errors
- ✅ No network errors

---

## Bug Tracking Template

When issues are found, document them:

```
**Issue ID:** BUG-001
**Component:** PredictiveMaintenanceDashboard
**Severity:** Critical | High | Medium | Low
**Description:** [What is broken]
**Steps to Reproduce:** [1. 2. 3.]
**Expected Result:** [What should happen]
**Actual Result:** [What actually happens]
**Error Message:** [Any console/server errors]
**Suggested Fix:** [Optional]
```

---

## Current Status

**Phase 2D Progress:**
- [ ] API Testing - PENDING
- [ ] Component Testing - PENDING
- [ ] Integration Testing - PENDING
- [ ] E2E Manual Testing - PENDING

**Files to Create:**
1. `server/tests/predictions.test.js`
2. `client/src/__tests__/PredictiveMaintenanceDashboard.test.jsx`
3. `client/src/__tests__/PredictiveMaintenanceDashboard.integration.test.jsx`
4. Test data setup SQL

**Estimated Timeline:**
- API Testing: 2 hours
- Component Testing: 2 hours
- Integration Testing: 2 hours
- E2E Testing: 2 hours
- **Total: 8 hours**

---

## Next Steps

1. ✅ Create test directory structure
2. ⏳ Set up test data in database
3. ⏳ Train ML model with test data
4. ⏳ Create API test suite
5. ⏳ Create component test suite
6. ⏳ Create integration test suite
7. ⏳ Execute all tests
8. ⏳ Document results
9. ⏳ Fix any failing tests
10. ⏳ Sign off on Phase 2D completion

---

## Success Criteria

✅ **Phase 2D is COMPLETE when:**
1. All API endpoints return expected status codes
2. All components render without errors
3. Data flows correctly from API to Frontend
4. User workflows execute without errors
5. No console errors or warnings
6. No network errors (4xx/5xx responses)
7. All 8 manual E2E test checklist items pass
8. ML model predictions are accurate and reasonable
9. Performance is acceptable (<3s dashboard load)
10. Documentation is updated

---

## Rollback Plan

If critical issues are found:
1. Revert latest commits: `git reset --hard HEAD~1`
2. Identify root cause
3. Fix issue in new branch: `git checkout -b fix/issue-name`
4. Re-test in isolation
5. Merge back to main

---

Last Updated: March 5, 2026
Status: PHASE 2D TESTING PLAN CREATED - READY FOR EXECUTION