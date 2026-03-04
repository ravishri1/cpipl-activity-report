# Asset Repair System - Test Execution Guide

**Status:** ✅ Test infrastructure created and ready for execution
**Date:** March 4, 2026
**System:** Asset Lifecycle Phase 2 - Asset Repair/Maintenance Module

---

## Overview

The Asset Repair System backend is fully implemented with 8 API endpoints. A comprehensive automated test suite has been created to verify all endpoints are working correctly.

**Test Suite Location:** `server/tests/repair-endpoints.test.js` (460 lines)
**Test Plan Document:** `ASSET_REPAIR_TEST_PLAN.md` (397 lines)

---

## Prerequisites

Before running tests, ensure:

1. **Backend Server Running**
   ```bash
   cd server
   npm run dev
   ```
   Expected output: `Server running on port 5000`

2. **Database Available**
   - SQLite database at `server/prisma/dev.db`
   - All migrations executed: `npx prisma db push`

3. **Dependencies Installed**
   ```bash
   cd server
   npm install
   ```

4. **Node.js Available**
   - Verify: `node --version`
   - Should be v14+ (v16+ recommended)

---

## Running the Test Suite

### Option 1: Direct Node Execution

```bash
cd "D:\Activity Report Software\server"
node tests/repair-endpoints.test.js
```

**Expected Runtime:** 15-30 seconds

### Option 2: NPM Test Script

If you have npm test configured in `package.json`:

```bash
cd server
npm test -- tests/repair-endpoints.test.js
```

### Option 3: With Output Logging

To save test results to a file:

```bash
cd server
node tests/repair-endpoints.test.js > test-results.log 2>&1
```

---

## Test Suite Details

### Test Phases

| Phase | Name | Tests | Purpose |
|-------|------|-------|---------|
| 1 | Authentication | 2 | Login as admin and member |
| 2 | Test Data Setup | 1 | Verify test asset with 'assigned' status exists |
| 3 | Endpoint Tests | 8 | Test all 8 repair endpoints |
| 4 | Access Control | 1 | Verify authorization works |

**Total Tests:** 10 automated tests

### 8 Repair Endpoints Tested

| # | Method | Endpoint | Test Name |
|---|--------|----------|-----------|
| 1 | POST | `/assets/:assetId/repairs/initiate` | Initiate Repair |
| 2 | GET | `/assets/:assetId/repairs` | Get Active Repair |
| 3 | GET | `/assets/repairs` | List All Repairs |
| 4 | PUT | `/assets/repairs/:repairId/update-status` | Update Repair Status |
| 5 | GET | `/assets/:assetId/repairs/:repairId/timeline` | Get Repair Timeline |
| 6 | PUT | `/assets/repairs/:repairId/edit` | Edit Repair Details |
| 7 | PUT | `/assets/repairs/:repairId/update-status` | Update Status (In Progress) |
| 8 | POST | `/assets/repairs/:repairId/complete` | Complete Repair |

### Test Workflow

The test suite executes the following workflow:

```
1. Setup Phase
   ├─ Admin Login ✓
   ├─ Member Login ✓
   └─ Load Test Asset (status='assigned') ✓

2. Repair Lifecycle Tests
   ├─ Initiate Repair (status='initiated') ✓
   ├─ Get Active Repair ✓
   ├─ List All Repairs ✓
   ├─ Update to 'in_transit' ✓
   ├─ Get Timeline ✓
   ├─ Edit Details (cost/vendor) ✓
   ├─ Update to 'in_progress' ✓
   └─ Complete Repair ✓

3. Integration Tests
   ├─ Get Overdue Repairs ✓
   └─ Member Access Control (should be denied) ✓

4. Summary
   └─ Show pass/fail count and success rate
```

---

## Expected Output

### Successful Test Run

```
╔════════════════════════════════════════════════════════════╗
║   ASSET REPAIR SYSTEM - AUTOMATED TEST SUITE               ║
║   Testing all 8 repair endpoints + 2 integration tests    ║
╚════════════════════════════════════════════════════════════╝

🔐 PHASE 1: AUTHENTICATION SETUP
  Authenticating admin...
    ✅ Admin authenticated
  Authenticating member...
    ✅ Member authenticated

📦 PHASE 2: TEST DATA SETUP
  Fetching assets with "assigned" status...
    ✅ Test asset selected: ID=123, Name=Laptop HP-001

🧪 PHASE 3: ENDPOINT TESTS
  ✅ PASS: Initiate Repair - ID=456, Status=initiated
  ✅ PASS: Get Active Repair - Repair ID=456
  ✅ PASS: List All Repairs - Found 1 repairs, test repair included=true
  ✅ PASS: Update Repair Status - Status updated to: in_transit
  ✅ PASS: Get Repair Timeline - Timeline entries: 2
  ✅ PASS: Edit Repair Details - Estimated cost: ₹7500
  ✅ PASS: Update Status to In Progress - Status: in_progress
  ✅ PASS: Complete Repair - Status: completed, Asset status: available
  ✅ PASS: Get Overdue Repairs - Found 0 overdue repairs

🔐 PHASE 4: ACCESS CONTROL TESTS
  ✅ PASS: Member Access Control - Expected 403 Forbidden, got 403

╔════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                            ║
╚════════════════════════════════════════════════════════════╝

Total Tests: 10
Passed: 10
Failed: 0
Success Rate: 100%

════════════════════════════════════════════════════════════
✅ ALL TESTS PASSED - System is production ready
════════════════════════════════════════════════════════════
```

### Test Results Interpretation

| Result | Meaning | Action |
|--------|---------|--------|
| ✅ 10/10 Passed | All endpoints working | ✓ Ready for production |
| 🟡 8-9/10 Passed | One endpoint issue | Review failed endpoint logs |
| ❌ <8/10 Passed | Multiple issues | Debug endpoints and retry |

---

## Common Issues & Solutions

### Issue 1: "Server is not running"

**Error Message:**
```
❌ Fatal error: connect ECONNREFUSED 127.0.0.1:5000
```

**Solution:**
```bash
# In another terminal window:
cd server
npm run dev
# Wait for "Server running on port 5000" message
# Then run tests in the original terminal
```

### Issue 2: "No assets found with assigned status"

**Error Message:**
```
❌ No assets found with "assigned" status
```

**Solution:**
```bash
# Create a test asset first:
cd server
npx prisma studio
# Add Asset with status='assigned'
# Or modify existing asset to status='assigned'
```

### Issue 3: "Admin login failed"

**Error Message:**
```
❌ Admin login failed: Invalid credentials
```

**Solution:**
```bash
# Verify seed data:
cd server
npx prisma db seed
# Check that admin@cpipl.com/password123 exists
```

### Issue 4: Node not found in PATH

**Error Message:**
```
node : The term 'node' is not recognized
```

**Solution:**
```bash
# Find node installation:
where node

# If not found, verify Node.js installation:
node --version
npm --version

# If still missing, reinstall Node.js from nodejs.org
```

---

## Manual Testing (If Automated Tests Fail)

If the automated test suite cannot run, follow these manual test steps using curl or Postman:

### Test 1: Admin Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cpipl.com","password":"password123"}'
# Copy token from response (ADMIN_TOKEN)
```

### Test 2: Get Test Asset
```bash
curl -X GET http://localhost:5000/api/assets \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Find an asset with status='assigned' (ASSET_ID)
```

### Test 3: Initiate Repair
```bash
curl -X POST http://localhost:5000/api/assets/ASSET_ID/repairs/initiate \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "repairType":"maintenance",
    "sentOutDate":"2026-03-04",
    "expectedReturnDate":"2026-03-11",
    "vendor":"Tech Services",
    "vendorPhone":"9876543210",
    "estimatedCost":5000
  }'
# Copy repair ID from response (REPAIR_ID)
```

### Test 4: Get Active Repair
```bash
curl -X GET http://localhost:5000/api/assets/ASSET_ID/repairs \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Verify returned repair ID matches
```

### Test 5: Update Status
```bash
curl -X PUT http://localhost:5000/api/assets/repairs/REPAIR_ID/update-status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"in_transit","notes":"Sent to vendor"}'
# Verify status changed to 'in_transit'
```

### Test 6: Complete Repair
```bash
curl -X POST http://localhost:5000/api/assets/repairs/REPAIR_ID/complete \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actualReturnDate":"2026-03-10"}'
# Verify status='completed' and asset status='available'
```

---

## Debugging Failed Tests

### Enable Verbose Logging

Modify the test file to add detailed logging:

1. Open `server/tests/repair-endpoints.test.js`
2. Find section: `// CONFIGURATION`
3. Add: `const DEBUG = true;`
4. In apiCall function, add:
   ```javascript
   if (DEBUG) console.log(`[API] ${method} ${endpoint}`, data);
   ```

### Check Backend Logs

While tests run, watch backend console for errors:

```bash
# Terminal 1: Backend
cd server && npm run dev
# Watch for error messages while tests run in Terminal 2

# Terminal 2: Tests
cd server && node tests/repair-endpoints.test.js
```

### Verify Database State

After tests, check if data was created:

```bash
cd server
npx prisma studio

# Browse AssetRepair and RepairTimeline tables
# Verify records match test data
```

---

## Test Verification Checklist

After running tests, verify:

- [ ] All 10 tests show ✅ PASS
- [ ] Success rate is 100%
- [ ] No error messages in output
- [ ] Backend logs show no errors
- [ ] Response times are <1 second per endpoint
- [ ] Asset status changed from 'assigned' to 'available' after repair completion
- [ ] Database has new AssetRepair and RepairTimeline records

---

## Continuous Testing

### Running Tests Repeatedly

```bash
# Run tests 3 times
for i in {1..3}; do
  echo "=== Test Run $i ==="
  node tests/repair-endpoints.test.js
  sleep 2
done
```

### Testing Against Different Assets

The test suite will automatically select the first 'assigned' asset found. To test with multiple assets:

1. Create multiple assets with status='assigned'
2. Run tests multiple times (each will use a different asset)

### Scheduled Testing

To run tests on a schedule (requires a task scheduler):

```bash
# Windows Task Scheduler:
# Trigger: Daily at 2:00 AM
# Action: cmd /c "cd D:\Activity Report Software\server && node tests/repair-endpoints.test.js >> test-log.txt 2>&1"
```

---

## Next Steps After Passing Tests

Once all tests pass (✅ 10/10):

1. **Document Results**
   - Copy test output to Phase 2 sign-off document
   - Mark "Test complete Asset Repair workflow end-to-end" as COMPLETE

2. **Code Review**
   - Review Asset Repair implementation
   - Check for any edge cases in repair workflow

3. **Integration Testing**
   - Test Asset Repair with Employee Profile (DriveFiles tab)
   - Test Asset Repair with Asset Handover system
   - Test Asset Repair with Notifications

4. **Frontend Integration**
   - Verify AssetRepairTimeline component loads without errors
   - Test "Send for Repair" functionality in AssetManager
   - Verify repair status displays correctly

5. **Production Readiness**
   - Environment variable configuration
   - Database backup procedures
   - Error monitoring setup

---

## Support & Troubleshooting

### Getting Help

1. Check test output for specific error message
2. Review corresponding section in this guide
3. Check backend logs for related errors
4. Verify prerequisites are all met

### Collecting Debug Information

If tests fail, collect this information:

```
System:
- Windows version: [output of `ver`]
- Node.js version: [output of `node --version`]
- npm version: [output of `npm --version`]

Backend:
- Server running on port 5000: [yes/no]
- Database file exists: [yes/no]
- Database size: [bytes]

Test:
- Full error message: [paste exact error]
- Test phase that failed: [1-4]
- Endpoint that failed: [if known]
- Test run timestamp: [YYYY-MM-DD HH:MM:SS]

Environment:
- NODE_ENV: [value or "not set"]
- DATABASE_URL: [value or "not set"]
- API_BASE_URL: [value or "not set"]
```

---

## Sign-Off

Once tests pass and verification is complete:

**Tested By:** [Name]  
**Date:** [YYYY-MM-DD]  
**Test Run Duration:** [minutes]  
**Tests Passed:** ✅ 10/10  
**Ready for Production:** ✅ YES

---

## Related Documentation

- **Backend Implementation:** `server/src/routes/assets.js` (repair endpoints)
- **Database Schema:** `server/prisma/schema.prisma` (AssetRepair & RepairTimeline models)
- **Frontend Components:** `client/src/components/admin/AssetRepairTimeline.jsx`
- **Complete Test Plan:** `ASSET_REPAIR_TEST_PLAN.md`

---

**Last Updated:** March 4, 2026  
**Status:** ✅ Test infrastructure ready for execution
