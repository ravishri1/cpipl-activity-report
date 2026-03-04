const http = require('http');

const BASE_URL = 'http://127.0.0.1:52977';
let authToken = null;

let testsPassed = 0;
let testsFailed = 0;
const results = [];

// Make HTTP request helper
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Test runner
async function runTest(name, method, path, body = null, expectedStatus = 200, useAuth = true) {
  try {
    console.log(`\n📝 Testing: ${name}`);
    const token = useAuth ? authToken : null;
    const response = await makeRequest(method, path, body, token);
    
    if (response.status === expectedStatus) {
      console.log(`✅ PASS - Status: ${response.status}`);
      testsPassed++;
      results.push({ name, status: 'PASS', httpStatus: response.status });
      return response.data;
    } else {
      console.log(`❌ FAIL - Expected ${expectedStatus}, got ${response.status}`);
      if (response.data && typeof response.data === 'object') {
        console.log(`   Error: ${JSON.stringify(response.data).substring(0, 100)}`);
      }
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
  console.log('║     PROCUREMENT SYSTEM - COMPREHENSIVE API TEST SUITE      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 0: Health Check (no auth needed)
  console.log('\n🔍 STEP 0: Server Health Check');
  const healthResp = await runTest('Health Check', 'GET', '/api/health', null, 200, false);
  if (!healthResp) {
    console.log('\n❌ Server is not responding properly. Cannot continue with tests.');
    return;
  }

  // Step 1: Authentication
  console.log('\n🔍 STEP 1: Authenticate User');
  const loginResp = await runTest('Login', 'POST', '/api/auth/login', {
    email: 'admin@cpipl.com',
    password: 'password123'
  }, 200, false);
  
  if (!loginResp || !loginResp.token) {
    console.log('\n⚠️  Authentication failed. Testing procurement endpoints without token.');
    testsFailed++;
  } else {
    authToken = loginResp.token;
    console.log('✅ Authentication successful. Token obtained.');
    testsPassed++;
  }

  // Step 2: Create Vendor
  console.log('\n🔍 STEP 2: Create Vendor');
  const vendorData = {
    vendorName: 'TechSupply Inc',
    vendorEmail: 'contact@techsupply.com',
    vendorPhone: '+1-800-TECH-123',
    vendorAddress: '123 Tech Lane, Silicon Valley, CA',
    paymentTerms: '30 days'
  };
  const vendorResp = await runTest('Create Vendor', 'POST', '/api/procurement/vendors', vendorData, 201);
  const vendorId = vendorResp?.id || 1;

  // Step 3: Create Procurement Order
  console.log('\n🔍 STEP 3: Create Procurement Order');
  const orderData = {
    vendorId: vendorId,
    status: 'initiated',
    totalAmount: 50000,
    createdDate: new Date().toISOString().split('T')[0]
  };
  const orderResp = await runTest('Create Procurement Order', 'POST', '/api/procurement/orders', orderData, 201);
  const orderId = orderResp?.id || 1;

  // Step 4: Add Line Items to Order
  console.log('\n🔍 STEP 4: Add Line Items to Order');
  const lineItemData = {
    itemDescription: 'Laptop Computer - Dell XPS 15',
    quantity: 10,
    unitPrice: 1500,
    totalPrice: 15000
  };
  await runTest('Add Line Item', 'POST', `/api/procurement/orders/${orderId}/items`, lineItemData, 201);

  // Step 5: List Vendors
  console.log('\n🔍 STEP 5: List All Vendors');
  await runTest('List Vendors', 'GET', '/api/procurement/vendors', null, 200);

  // Step 6: Get Vendor Details
  console.log('\n🔍 STEP 6: Get Specific Vendor Details');
  await runTest('Get Vendor Details', 'GET', `/api/procurement/vendors/${vendorId}`, null, 200);

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
  const invResp = await runTest('Create Inventory Item', 'POST', '/api/procurement/inventory/items', inventoryData, 201);

  // Step 8: Check Low Stock Items
  console.log('\n🔍 STEP 8: Get Low Stock Items');
  await runTest('Get Low Stock Items', 'GET', '/api/procurement/inventory/low-stock', null, 200);

  // Step 9: Get Procurement Orders List
  console.log('\n🔍 STEP 9: List Procurement Orders');
  await runTest('List Procurement Orders', 'GET', '/api/procurement/orders', null, 200);

  // Step 10: Get Line Items for Order
  console.log('\n🔍 STEP 10: Get Order Line Items');
  await runTest('Get Order Line Items', 'GET', `/api/procurement/orders/${orderId}/items`, null, 200);

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY REPORT                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const total = testsPassed + testsFailed;
  const successRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : '0.0';
  
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Success Rate: ${successRate}%\n`);

  console.log('Detailed Results:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    const symbol = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${symbol} ${r.name}: ${r.status}`);
  });
  console.log('─'.repeat(60));

  if (testsFailed === 0 && testsPassed > 5) {
    console.log('\n🎉 ALL TESTS PASSED! Procurement system is operational.\n');
  } else if (testsFailed <= 2) {
    console.log(`\n⚠️  ${testsFailed} minor test(s) failed.\n`);
  } else {
    console.log(`\n❌ ${testsFailed} test(s) failed. Review errors above.\n`);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
