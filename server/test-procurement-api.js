const http = require('http');

// Admin token from successful login
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AY3BpcGwuY29tIiwidXNlcklkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzI2NTA3NDIsImV4cCI6MTc3MjczNzE0Mn0.r8gbRigdUoQ3zKYqzT8NeoSDGXVjS-Uso08HAFlJJPs';
const BASE_URL = '127.0.0.1:49376';

let testResults = [];
let createdIds = {
  vendor: null,
  category: null,
  product: null,
  purchaseOrder: null
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
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Create Vendor
  console.log('STEP 1: Create Vendor');
  try {
    const res = await makeRequest('POST', '/api/procurement/vendors', {
      name: 'TechSupply Corp',
      email: 'vendor@techsupply.com',
      phone: '9876543210',
      address: 'Mumbai, India',
      gst: '27AABCT1234H1Z0'
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.vendor = res.data.id;
      console.log(`  Vendor ID: ${res.data.id}`);
    }
    testResults.push({ step: 1, test: 'Create Vendor', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 1, test: 'Create Vendor', status: false });
  }
  console.log('');

  // Test 2: Get All Vendors
  console.log('STEP 2: Get All Vendors');
  try {
    const res = await makeRequest('GET', '/api/procurement/vendors');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    console.log(`  Vendors found: ${Array.isArray(res.data) ? res.data.length : 0}`);
    testResults.push({ step: 2, test: 'Get All Vendors', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 2, test: 'Get All Vendors', status: false });
  }
  console.log('');

  // Test 3: Create Product Category
  console.log('STEP 3: Create Product Category');
  try {
    const res = await makeRequest('POST', '/api/product-categories', {
      name: 'Computers',
      description: 'Computer hardware and accessories',
      companyId: 1
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.category = res.data.id;
      console.log(`  Category ID: ${res.data.id}`);
    }
    testResults.push({ step: 3, test: 'Create Category', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 3, test: 'Create Category', status: false });
  }
  console.log('');

  // Test 4: Create Product
  console.log('STEP 4: Create Product');
  try {
    const res = await makeRequest('POST', '/api/products', {
      name: 'Dell Laptop XPS 13',
      description: 'High-performance laptop',
      categoryId: createdIds.category || 1,
      unitPrice: 95000,
      reorderLevel: 5,
      companyId: 1
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.product = res.data.id;
      console.log(`  Product ID: ${res.data.id}`);
    }
    testResults.push({ step: 4, test: 'Create Product', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 4, test: 'Create Product', status: false });
  }
  console.log('');

  // Test 5: Get All Products
  console.log('STEP 5: Get All Products');
  try {
    const res = await makeRequest('GET', '/api/products');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    console.log(`  Products found: ${Array.isArray(res.data) ? res.data.length : 0}`);
    testResults.push({ step: 5, test: 'Get All Products', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 5, test: 'Get All Products', status: false });
  }
  console.log('');

  // Test 6: Create Purchase Order
  console.log('STEP 6: Create Purchase Order');
  try {
    const res = await makeRequest('POST', '/api/purchase-orders', {
      poNumber: 'PO-2026-001',
      vendorId: createdIds.vendor || 1,
      poDate: '2026-03-04',
      expectedDeliveryDate: '2026-03-11',
      companyId: 1,
      lineItems: [
        {
          productId: createdIds.product || 1,
          quantity: 10,
          unitPrice: 95000
        }
      ]
    });
    console.log(`  Status: ${res.status} ${res.status === 201 ? '✅' : '❌'}`);
    if (res.data?.id) {
      createdIds.purchaseOrder = res.data.id;
      console.log(`  PO ID: ${res.data.id}`);
    }
    testResults.push({ step: 6, test: 'Create PO', status: res.status === 201 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 6, test: 'Create PO', status: false });
  }
  console.log('');

  // Test 7: Get All Purchase Orders
  console.log('STEP 7: Get All Purchase Orders');
  try {
    const res = await makeRequest('GET', '/api/purchase-orders');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    console.log(`  POs found: ${Array.isArray(res.data) ? res.data.length : 0}`);
    testResults.push({ step: 7, test: 'Get All POs', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 7, test: 'Get All POs', status: false });
  }
  console.log('');

  // Test 8: Get Single Purchase Order
  if (createdIds.purchaseOrder) {
    console.log('STEP 8: Get Single Purchase Order');
    try {
      const res = await makeRequest('GET', `/api/purchase-orders/${createdIds.purchaseOrder}`);
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      console.log(`  PO Status: ${res.data?.status}`);
      testResults.push({ step: 8, test: 'Get Single PO', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 8, test: 'Get Single PO', status: false });
    }
  } else {
    console.log('STEP 8: Get Single Purchase Order - SKIPPED (no PO created)');
    testResults.push({ step: 8, test: 'Get Single PO', status: false });
  }
  console.log('');

  // Test 9: Update Purchase Order Status
  if (createdIds.purchaseOrder) {
    console.log('STEP 9: Update Purchase Order Status');
    try {
      const res = await makeRequest('PATCH', `/api/purchase-orders/${createdIds.purchaseOrder}`, {
        status: 'approved'
      });
      console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
      console.log(`  Updated Status: ${res.data?.status}`);
      testResults.push({ step: 9, test: 'Update PO Status', status: res.status === 200 });
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      testResults.push({ step: 9, test: 'Update PO Status', status: false });
    }
  } else {
    console.log('STEP 9: Update PO Status - SKIPPED (no PO created)');
    testResults.push({ step: 9, test: 'Update PO Status', status: false });
  }
  console.log('');

  // Test 10: Get Inventory Summary
  console.log('STEP 10: Get Inventory Summary/Dashboard');
  try {
    const res = await makeRequest('GET', '/api/inventory-dashboard');
    console.log(`  Status: ${res.status} ${res.status === 200 ? '✅' : '❌'}`);
    if (res.data?.totalProducts) {
      console.log(`  Total Products: ${res.data.totalProducts}`);
    }
    testResults.push({ step: 10, test: 'Inventory Dashboard', status: res.status === 200 });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    testResults.push({ step: 10, test: 'Inventory Dashboard', status: false });
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  let passed = testResults.filter(r => r.status).length;
  let total = testResults.length;
  console.log(`Passed: ${passed}/${total}`);
  console.log('');
  
  testResults.forEach(r => {
    console.log(`  Step ${r.step}: ${r.test.padEnd(30)} ${r.status ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  console.log('');
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED!');
  } else {
    console.log(`⚠️  ${total - passed} test(s) failed`);
  }
}

runTests().catch(console.error);
