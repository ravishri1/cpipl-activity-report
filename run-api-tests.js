const http = require('http');

const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'test-token'; // Will be obtained from login

let testsPassed = 0;
let testsFailed = 0;
const results = [];

// Helper to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTest(name, method, path, body = null, expectedStatus = 200) {
  try {
    console.log(`\n📝 Testing: ${name}`);
    const response = await makeRequest(method, path, body);
    
    if (response.status === expectedStatus || (expectedStatus === 201 && response.status === 201)) {
      console.log(`✅ PASS - Status: ${response.status}`);
      testsPassed++;
      results.push({ name, status: 'PASS', httpStatus: response.status });
      return response.data;
    } else {
      console.log(`❌ FAIL - Expected ${expectedStatus}, got ${response.status}`);
      testsFailed++;
      results.push({ name, status: 'FAIL', httpStatus: response.status });
      return null;
    }
  } catch (error) {
    console.log(`❌ ERROR - ${error.message}`);
    testsFailed++;
    results.push({ name, status: 'ERROR', error: error.message });
    return null;
  }
}

// Main test suite
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     PROCUREMENT SYSTEM - 10-STEP API TEST SEQUENCE         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Health Check
  console.log('\n🔍 STEP 1: Server Health Check');
  await runTest('Health Check', 'GET', '/health', null, 200);

  // Step 2: Create Vendor
  console.log('\n🔍 STEP 2: Create Vendor');
  const vendorData = {
    vendorName: 'TechSupply Inc',
    vendorEmail: 'contact@techsupply.com',
    vendorPhone: '+1-800-TECH-123',
    vendorAddress: '123 Tech Lane, Silicon Valley, CA 94025',
    paymentTerms: '30 days'
  };
  const vendorResp = await runTest('Create Vendor', 'POST', '/procurement/vendors', vendorData, 201);
  const vendorId = vendorResp?.id || 1;

  // Step 3: Create Procurement Order
  console.log('\n🔍 STEP 3: Create Procurement Order');
  const orderData = {
    vendorId: vendorId,
    status: 'initiated',
    totalAmount: 50000,
    createdDate: new Date().toISOString().split('T')[0]
  };
  const orderResp = await runTest('Create Procurement Order', 'POST', '/procurement/orders', orderData, 201);
  const orderId = orderResp?.id || 1;

  // Step 4: Add Line Items to Order
  console.log('\n🔍 STEP 4: Add Line Items to Order');
  const lineItemData = {
    itemDescription: 'Laptop Computer - Dell XPS 15',
    quantity: 10,
    unitPrice: 1500,
    totalPrice: 15000
  };
  await runTest('Add Line Item', 'POST', `/procurement/orders/${orderId}/items`, lineItemData, 201);

  // Step 5: List Vendors
  console.log('\n🔍 STEP 5: List Vendors');
  await runTest('List Vendors', 'GET', '/procurement/vendors', null, 200);

  // Step 6: Get Vendor Details
  console.log('\n🔍 STEP 6: Get Vendor Details');
  await runTest('Get Vendor Details', 'GET', `/procurement/vendors/${vendorId}`, null, 200);

  // Step 7: Create Inventory Item
  console.log('\n🔍 STEP 7: Create Inventory Item');
  const inventoryData = {
    itemName: 'Laptop Computer - Dell XPS 15',
    itemCode: 'LAP-DELL-XPS-001',
    quantity: 10,
    reorderLevel: 3,
    unitPrice: 1500,
    category: 'Electronics',
    supplier: vendorId,
    warehouseLocation: 'A-12-3'
  };
  const invResp = await runTest('Create Inventory Item', 'POST', '/procurement/inventory/items', inventoryData, 201);
  const inventoryId = invResp?.id || 1;

  // Step 8: Check Low Stock Items
  console.log('\n🔍 STEP 8: Check Low Stock Items');
  await runTest('Get Low Stock Items', 'GET', '/procurement/inventory/low-stock', null, 200);

  // Step 9: Get Procurement Orders List
  console.log('\n🔍 STEP 9: Get Procurement Orders List');
  await runTest('List Procurement Orders', 'GET', '/procurement/orders', null, 200);

  // Step 10: Get Line Items for Order
  console.log('\n🔍 STEP 10: Get Line Items for Order');
  await runTest('Get Order Line Items', 'GET', `/procurement/orders/${orderId}/items`, null, 200);

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY REPORT                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`);

  console.log('Detailed Results:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    const symbol = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${symbol} ${r.name}: ${r.status}`);
  });
  console.log('─'.repeat(60));

  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The procurement system is working correctly.\n');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the errors above.\n`);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
