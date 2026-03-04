const http = require('http');
const fs = require('fs');
const path = require('path');

// Setup file logging
const logFile = path.join(__dirname, 'procurement-test-results.log');
fs.writeFileSync(logFile, '', 'utf-8'); // Clear file
const originalLog = console.log;
function logMessage(msg) {
  originalLog(msg);
  fs.appendFileSync(logFile, msg + '\n', 'utf-8');
}
console.log = logMessage;

// Admin token from successful login
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AY3BpcGwuY29tIiwidXNlcklkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzI2NTA3NDIsImV4cCI6MTc3MjczNzE0Mn0.r8gbRigdUoQ3zKYqzT8NeoSDGXVjS-Uso08HAFlJJPs';

let testResults = [];
let createdIds = {
  vendor: null,
  order: null
};

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 49376,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🚀 PROCUREMENT API TEST SEQUENCE (10 STEPS)');
  console.log('='.repeat(70));
  console.log('');

  // Test 1: Create Vendor
  console.log('STEP 1: Create Vendor (/api/procurement/vendors POST)');
  try {
    const res = await makeRequest('POST', '/api/procurement/vendors', {
      vendorName: 'TechSupply Corp',
      email: 'vendor@techsupply.com',
      phone: '9876543210',
      address: 'Mumbai, India',
      gstNumber: '27AABCT1234H1Z0',
      category: 'IT Equipment'
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.vendor = res.data.id;
      console.log(`  Vendor ID: ${res.data.id}`);
    } else {
      console.log(`  Response: ${JSON.stringify(res.data).substring(0, 100)}`);
    }
    testResults.push({ step: 1, test: 'Create Vendor', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 1, test: 'Create Vendor', status: false });
  }
  console.log('');

  // Test 2: Get All Vendors
  console.log('STEP 2: Get All Vendors (/api/procurement/vendors GET)');
  try {
    const res = await makeRequest('GET', '/api/procurement/vendors');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    if (res.data) {
      const vendors = Array.isArray(res.data) ? res.data.length : (res.data.data?.length || 0);
      console.log(`  Vendors found: ${vendors}`);
    }
    testResults.push({ step: 2, test: 'Get All Vendors', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 2, test: 'Get All Vendors', status: false });
  }
  console.log('');

  // Test 3: Get Single Vendor
  if (createdIds.vendor) {
    console.log(`STEP 3: Get Single Vendor (/api/procurement/vendors/${createdIds.vendor} GET)`);
    try {
      const res = await makeRequest('GET', `/api/procurement/vendors/${createdIds.vendor}`);
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      if (res.data?.name) {
        console.log(`  Vendor Name: ${res.data.name}`);
      }
      testResults.push({ step: 3, test: 'Get Single Vendor', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 3, test: 'Get Single Vendor', status: false });
    }
  } else {
    console.log('STEP 3: Get Single Vendor - SKIPPED (no vendor created)');
    testResults.push({ step: 3, test: 'Get Single Vendor', status: false });
  }
  console.log('');

  // Test 4: Create Procurement Order
  console.log('STEP 4: Create Procurement Order (/api/procurement/orders POST)');
  try {
    const res = await makeRequest('POST', '/api/procurement/orders', {
      vendorId: createdIds.vendor || 1,
      status: 'draft',
      totalAmount: 950000,
      createdDate: '2026-03-04',
      deliveryDate: '2026-03-11',
      description: 'Order for laptops'
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.order = res.data.id;
      console.log(`  Order ID: ${res.data.id}`);
      console.log(`  Order Number: ${res.data.orderNumber}`);
    } else {
      console.log(`  Response: ${JSON.stringify(res.data).substring(0, 100)}`);
    }
    testResults.push({ step: 4, test: 'Create PO', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 4, test: 'Create PO', status: false });
  }
  console.log('');

  // Test 5: Get All Procurement Orders
  console.log('STEP 5: Get All Procurement Orders (/api/procurement/orders GET)');
  try {
    const res = await makeRequest('GET', '/api/procurement/orders');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    if (res.data) {
      const orders = Array.isArray(res.data) ? res.data.length : (res.data.data?.length || 0);
      console.log(`  Orders found: ${orders}`);
    }
    testResults.push({ step: 5, test: 'Get All POs', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 5, test: 'Get All POs', status: false });
  }
  console.log('');

  // Test 6: Get Single Procurement Order
  if (createdIds.order) {
    console.log(`STEP 6: Get Single PO (/api/procurement/orders/${createdIds.order} GET)`);
    try {
      const res = await makeRequest('GET', `/api/procurement/orders/${createdIds.order}`);
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      if (res.data?.status) {
        console.log(`  Status: ${res.data.status}`);
      }
      testResults.push({ step: 6, test: 'Get Single PO', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 6, test: 'Get Single PO', status: false });
    }
  } else {
    console.log('STEP 6: Get Single PO - SKIPPED (no order created)');
    testResults.push({ step: 6, test: 'Get Single PO', status: false });
  }
  console.log('');

  // Test 6.5: Create Line Item
  if (createdIds.order) {
    console.log(`STEP 6.5: Create Line Item (/api/procurement/orders/${createdIds.order}/line-items POST)`);
    try {
      const lineItemPayload = {
        itemCode: 'ITEM001',
        itemName: 'Test Item',
        quantity: 10,
        unitPrice: 5000,
        category: 'materials'
      };
      const res = await makeRequest('POST', `/api/procurement/orders/${createdIds.order}/line-items`, lineItemPayload);
      console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
      if (res.data?.id) {
        console.log(`  Line Item ID: ${res.data.id}`);
        createdIds.lineItem = res.data.id;
      }
      testResults.push({ step: 6.5, test: 'Create Line Item', status: res.status === 201 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 6.5, test: 'Create Line Item', status: false });
    }
  } else {
    console.log('STEP 6.5: Create Line Item - SKIPPED (no order created)');
    testResults.push({ step: 6.5, test: 'Create Line Item', status: false });
  }
  console.log('');

  // Test 7: Submit Procurement Order
  if (createdIds.order) {
    console.log(`STEP 7: Submit PO (/api/procurement/orders/${createdIds.order}/submit POST)`);
    try {
      const res = await makeRequest('POST', `/api/procurement/orders/${createdIds.order}/submit`, {});
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      if (res.data?.status) {
        console.log(`  New Status: ${res.data.status}`);
      }
      testResults.push({ step: 7, test: 'Submit PO', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 7, test: 'Submit PO', status: false });
    }
  } else {
    console.log('STEP 7: Submit PO - SKIPPED (no order created)');
    testResults.push({ step: 7, test: 'Submit PO', status: false });
  }
  console.log('');

  // Test 8: Approve Procurement Order
  if (createdIds.order) {
    console.log(`STEP 8: Approve PO (/api/procurement/orders/${createdIds.order}/approve POST)`);
    try {
      const approvePayload = {
        approvalDate: new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD format
      };
      const res = await makeRequest('POST', `/api/procurement/orders/${createdIds.order}/approve`, approvePayload);
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      if (res.data?.status) {
        console.log(`  New Status: ${res.data.status}`);
      }
      testResults.push({ step: 8, test: 'Approve PO', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 8, test: 'Approve PO', status: false });
    }
  } else {
    console.log('STEP 8: Approve PO - SKIPPED (no order created)');
    testResults.push({ step: 8, test: 'Approve PO', status: false });
  }
  console.log('');

  // Test 9: Get Inventory
  console.log('STEP 9: Get Inventory (/api/procurement/inventory GET)');
  try {
    const res = await makeRequest('GET', '/api/procurement/inventory');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    if (res.data) {
      const items = Array.isArray(res.data) ? res.data.length : (res.data.data?.length || 0);
      console.log(`  Inventory items: ${items}`);
    }
    testResults.push({ step: 9, test: 'Get Inventory', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 9, test: 'Get Inventory', status: false });
  }
  console.log('');

  // Test 10: Get Low Stock Items
  console.log('STEP 10: Get Low Stock Items (/api/procurement/inventory/low-stock GET)');
  try {
    const res = await makeRequest('GET', '/api/procurement/inventory/low-stock');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    if (res.data) {
      const items = Array.isArray(res.data) ? res.data.length : (res.data.data?.length || 0);
      console.log(`  Low stock items: ${items}`);
    }
    testResults.push({ step: 10, test: 'Low Stock Items', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 10, test: 'Low Stock Items', status: false });
  }
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  let passed = testResults.filter(r => r.status).length;
  let total = testResults.length;
  console.log(`Passed: ${passed}/${total}`);
  console.log('');
  
  testResults.forEach(r => {
    console.log(`  Step ${r.step}: ${r.test.padEnd(25)} ${r.status ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  console.log('');
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! ✅');
  } else {
    console.log(`⚠️  ${total - passed} test(s) failed - ${passed} passed`);
  }
  console.log('');
  console.log('Task 19.3.2: 10-Step Procurement API Test Sequence Complete!');
}

runTests().catch(console.error);
