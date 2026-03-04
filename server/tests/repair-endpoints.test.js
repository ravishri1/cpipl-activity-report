/**
 * Asset Repair System - Automated Test Suite
 * Tests all 8 repair/maintenance endpoints
 * 
 * Run: npm test -- tests/repair-endpoints.test.js
 * Or: node tests/repair-endpoints.test.js
 */

const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_TIMEOUT = 10000;

// Test credentials
const ADMIN_CREDS = {
  email: 'admin@cpipl.com',
  password: 'password123'
};

const MEMBER_CREDS = {
  email: 'rahul@cpipl.com',
  password: 'password123'
};

// ============================================================================
// TEST STATE
// ============================================================================

let testState = {
  adminToken: null,
  memberToken: null,
  testAssetId: null,
  testRepairId: null,
  testResults: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0
};

// ============================================================================
// UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const message = details ? `${testName} - ${details}` : testName;
  log(`  ${status}: ${message}`, passed ? 'green' : 'red');
  testState.totalTests++;
  if (passed) {
    testState.passedTests++;
  } else {
    testState.failedTests++;
  }
}

async function apiCall(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      timeout: TEST_TIMEOUT,
      headers: {}
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    return {
      success: false,
      error: message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

// ============================================================================
// SETUP & AUTHENTICATION
// ============================================================================

async function setupAuthentication() {
  log('\n🔐 PHASE 1: AUTHENTICATION SETUP', 'blue');

  // Login as admin
  log('  Authenticating admin...', 'cyan');
  const adminRes = await apiCall('POST', '/auth/login', ADMIN_CREDS);
  if (!adminRes.success) {
    log(`    ❌ Admin login failed: ${adminRes.error}`, 'red');
    return false;
  }
  testState.adminToken = adminRes.data.token;
  log('    ✅ Admin authenticated', 'green');

  // Login as member
  log('  Authenticating member...', 'cyan');
  const memberRes = await apiCall('POST', '/auth/login', MEMBER_CREDS);
  if (!memberRes.success) {
    log(`    ❌ Member login failed: ${memberRes.error}`, 'red');
    return false;
  }
  testState.memberToken = memberRes.data.token;
  log('    ✅ Member authenticated', 'green');

  return true;
}

async function setupTestData() {
  log('\n📦 PHASE 2: TEST DATA SETUP', 'blue');

  // Get list of assets
  log('  Fetching assets with "assigned" status...', 'cyan');
  const assetsRes = await apiCall('GET', '/assets', null, testState.adminToken);
  
  if (!assetsRes.success) {
    log(`    ❌ Failed to fetch assets: ${assetsRes.error}`, 'red');
    return false;
  }

  const assets = Array.isArray(assetsRes.data) ? assetsRes.data : assetsRes.data.assets || [];
  const assignedAsset = assets.find(a => a.status === 'assigned');

  if (!assignedAsset) {
    log('    ❌ No assets found with "assigned" status', 'red');
    log('    💡 Tip: Need to create/assign an asset before testing repairs', 'yellow');
    return false;
  }

  testState.testAssetId = assignedAsset.id;
  log(`    ✅ Test asset selected: ID=${testState.testAssetId}, Name=${assignedAsset.name}`, 'green');

  return true;
}

// ============================================================================
// TEST CASES
// ============================================================================

async function test1_InitiateRepair() {
  log('\n🔧 TEST 1: Initiate Repair', 'blue');

  const repairData = {
    repairType: 'maintenance',
    sentOutDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vendor: 'Tech Services Ltd',
    vendorPhone: '9876543210',
    vendorEmail: 'service@tech.com',
    vendorLocation: 'Mumbai',
    estimatedCost: 5000,
    issueDescription: 'Regular maintenance check'
  };

  const res = await apiCall(
    'POST',
    `/assets/${testState.testAssetId}/repairs/initiate`,
    repairData,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Initiate Repair', false, res.error);
    return false;
  }

  testState.testRepairId = res.data.id;
  const isPassed = res.data.status === 'initiated';
  logTest('Initiate Repair', isPassed, `ID=${testState.testRepairId}, Status=${res.data.status}`);
  return isPassed;
}

async function test2_GetActiveRepair() {
  log('\n🔍 TEST 2: Get Active Repair', 'blue');

  const res = await apiCall(
    'GET',
    `/assets/${testState.testAssetId}/repairs`,
    null,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Get Active Repair', false, res.error);
    return false;
  }

  const isPassed = res.data.id === testState.testRepairId;
  logTest('Get Active Repair', isPassed, `Repair ID=${res.data.id}`);
  return isPassed;
}

async function test3_ListAllRepairs() {
  log('\n📋 TEST 3: List All Repairs (Admin)', 'blue');

  const res = await apiCall('GET', '/assets/repairs', null, testState.adminToken);

  if (!res.success) {
    logTest('List All Repairs', false, res.error);
    return false;
  }

  const repairs = Array.isArray(res.data) ? res.data : res.data.repairs || [];
  const testRepairExists = repairs.some(r => r.id === testState.testRepairId);
  logTest('List All Repairs', testRepairExists, `Found ${repairs.length} repairs, test repair included=${testRepairExists}`);
  return testRepairExists;
}

async function test4_UpdateRepairStatus() {
  log('\n✏️  TEST 4: Update Repair Status', 'blue');

  const updateData = {
    newStatus: 'in_transit',
    notes: 'Asset sent to vendor for maintenance'
  };

  const res = await apiCall(
    'PUT',
    `/assets/repairs/${testState.testRepairId}/update-status`,
    updateData,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Update Repair Status', false, res.error);
    return false;
  }

  const isPassed = res.data.status === 'in_transit';
  logTest('Update Repair Status', isPassed, `Status updated to: ${res.data.status}`);
  return isPassed;
}

async function test5_GetRepairTimeline() {
  log('\n⏱️  TEST 5: Get Repair Timeline', 'blue');

  const res = await apiCall(
    'GET',
    `/assets/${testState.testAssetId}/repairs/${testState.testRepairId}/timeline`,
    null,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Get Repair Timeline', false, res.error);
    return false;
  }

  const timeline = Array.isArray(res.data) ? res.data : res.data.timeline || [];
  const isPassed = timeline.length >= 1;
  logTest('Get Repair Timeline', isPassed, `Timeline entries: ${timeline.length}`);
  return isPassed;
}

async function test6_EditRepairDetails() {
  log('\n✏️  TEST 6: Edit Repair Details', 'blue');

  const editData = {
    estimatedCost: 7500,
    actualCost: 6500,
    vendorEmail: 'updated@tech.com',
    notes: 'Updated with actual findings'
  };

  const res = await apiCall(
    'PUT',
    `/assets/repairs/${testState.testRepairId}/edit`,
    editData,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Edit Repair Details', false, res.error);
    return false;
  }

  const isPassed = res.data.estimatedCost === 7500;
  logTest('Edit Repair Details', isPassed, `Estimated cost: ₹${res.data.estimatedCost}`);
  return isPassed;
}

async function test7_UpdateStatusToInProgress() {
  log('\n⚙️  TEST 7: Update Status to In Progress', 'blue');

  const updateData = {
    newStatus: 'in_progress',
    notes: 'Maintenance work started'
  };

  const res = await apiCall(
    'PUT',
    `/assets/repairs/${testState.testRepairId}/update-status`,
    updateData,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Update Status to In Progress', false, res.error);
    return false;
  }

  const isPassed = res.data.status === 'in_progress';
  logTest('Update Status to In Progress', isPassed, `Status: ${res.data.status}`);
  return isPassed;
}

async function test8_CompleteRepair() {
  log('\n✅ TEST 8: Complete Repair', 'blue');

  const completeData = {
    actualReturnDate: new Date().toISOString().split('T')[0]
  };

  const res = await apiCall(
    'POST',
    `/assets/repairs/${testState.testRepairId}/complete`,
    completeData,
    testState.adminToken
  );

  if (!res.success) {
    logTest('Complete Repair', false, res.error);
    return false;
  }

  const isPassed = res.data.status === 'completed';
  logTest('Complete Repair', isPassed, `Status: ${res.data.status}, Asset status: ${res.data.asset?.status}`);
  return isPassed;
}

async function test9_GetOverdueRepairs() {
  log('\n⚠️  TEST 9: Get Overdue Repairs', 'blue');

  const res = await apiCall('GET', '/assets/repairs?overdue=true', null, testState.adminToken);

  if (!res.success) {
    logTest('Get Overdue Repairs', false, res.error);
    return false;
  }

  const overdue = Array.isArray(res.data) ? res.data : res.data.repairs || [];
  logTest('Get Overdue Repairs', true, `Found ${overdue.length} overdue repairs`);
  return true;
}

async function test10_MemberAccessControl() {
  log('\n🔒 TEST 10: Member Access Control', 'blue');

  // Member should NOT be able to initiate repairs
  const repairData = {
    repairType: 'maintenance',
    sentOutDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };

  const res = await apiCall(
    'POST',
    `/assets/${testState.testAssetId}/repairs/initiate`,
    repairData,
    testState.memberToken
  );

  // Should fail with 403 Forbidden
  const isPassed = !res.success && res.status === 403;
  logTest('Member Access Control', isPassed, `Expected 403 Forbidden, got ${res.status}`);
  return isPassed;
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║   ASSET REPAIR SYSTEM - AUTOMATED TEST SUITE               ║', 'cyan');
  log('║   Testing all 8 repair endpoints + 2 integration tests    ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  // Setup phase
  const authOk = await setupAuthentication();
  if (!authOk) {
    log('\n❌ Authentication setup failed - aborting tests', 'red');
    process.exit(1);
  }

  const dataOk = await setupTestData();
  if (!dataOk) {
    log('\n❌ Test data setup failed - aborting tests', 'red');
    process.exit(1);
  }

  // Run tests
  log('\n🧪 PHASE 3: ENDPOINT TESTS', 'blue');
  await test1_InitiateRepair();
  await test2_GetActiveRepair();
  await test3_ListAllRepairs();
  await test4_UpdateRepairStatus();
  await test5_GetRepairTimeline();
  await test6_EditRepairDetails();
  await test7_UpdateStatusToInProgress();
  await test8_CompleteRepair();
  await test9_GetOverdueRepairs();

  log('\n🔐 PHASE 4: ACCESS CONTROL TESTS', 'blue');
  await test10_MemberAccessControl();

  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    TEST SUMMARY                            ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  const percentage = Math.round((testState.passedTests / testState.totalTests) * 100);
  log(`\nTotal Tests: ${testState.totalTests}`, 'cyan');
  log(`Passed: ${testState.passedTests}`, 'green');
  log(`Failed: ${testState.failedTests}`, testState.failedTests > 0 ? 'red' : 'green');
  log(`Success Rate: ${percentage}%`, percentage === 100 ? 'green' : 'yellow');

  log('\n' + '═'.repeat(60), 'cyan');
  if (testState.failedTests === 0) {
    log('✅ ALL TESTS PASSED - System is production ready', 'green');
  } else {
    log(`⚠️  ${testState.failedTests} tests failed - Review errors above`, 'yellow');
  }
  log('═'.repeat(60) + '\n', 'cyan');

  process.exit(testState.failedTests > 0 ? 1 : 0);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
