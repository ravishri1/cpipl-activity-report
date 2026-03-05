/**
 * Verbose Predictions API Tests
 * Enhanced debugging and logging
 */

const http = require('http');
const app = require('../src/app');

let testsPassed = 0;
let testsFailed = 0;

// Helper function to make HTTP requests
function makeRequest(method, path, token = null, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 Predictions API Tests (Verbose Mode)\n');

  let server = app.listen(5001, async () => {
    console.log('✓ Server started on port 5001\n');

    try {
      // Test 1
      console.log('Test 1: GET /api/predictions/asset/1/health');
      try {
        const res = await makeRequest('GET', '/api/predictions/asset/1/health', 'admin-token');
        console.log(`  Status: ${res.status}`);
        console.log(`  Response: ${res.rawBody ? res.rawBody.substring(0, 100) : 'empty'}`);
        if (res.status === 200) {
          console.log('  ✓ PASSED');
          testsPassed++;
        } else {
          console.log(`  ✗ FAILED - Expected 200, got ${res.status}`);
          testsFailed++;
        }
      } catch (e) {
        console.log(`  ✗ FAILED - ${e.message}`);
        testsFailed++;
      }

      // Test 2
      console.log('\nTest 2: GET /api/predictions/at-risk');
      try {
        const res = await makeRequest('GET', '/api/predictions/at-risk', 'admin-token');
        console.log(`  Status: ${res.status}`);
        console.log(`  Response: ${res.rawBody ? res.rawBody.substring(0, 100) : 'empty'}`);
        if (res.status === 200) {
          console.log('  ✓ PASSED');
          testsPassed++;
        } else {
          console.log(`  ✗ FAILED - Expected 200, got ${res.status}`);
          testsFailed++;
        }
      } catch (e) {
        console.log(`  ✗ FAILED - ${e.message}`);
        testsFailed++;
      }

      // Test 3
      console.log('\nTest 3: GET /api/predictions/dashboard/summary');
      try {
        const res = await makeRequest('GET', '/api/predictions/dashboard/summary', 'admin-token');
        console.log(`  Status: ${res.status}`);
        console.log(`  Response: ${res.rawBody ? res.rawBody.substring(0, 100) : 'empty'}`);
        if (res.status === 200) {
          console.log('  ✓ PASSED');
          testsPassed++;
        } else {
          console.log(`  ✗ FAILED - Expected 200, got ${res.status}`);
          testsFailed++;
        }
      } catch (e) {
        console.log(`  ✗ FAILED - ${e.message}`);
        testsFailed++;
      }

      // Test 4 - No Auth
      console.log('\nTest 4: GET /api/predictions/asset/1/health (No Auth)');
      try {
        const res = await makeRequest('GET', '/api/predictions/asset/1/health', null);
        console.log(`  Status: ${res.status}`);
        if (res.status === 401) {
          console.log('  ✓ PASSED - Correctly rejected without auth');
          testsPassed++;
        } else {
          console.log(`  ✗ FAILED - Expected 401, got ${res.status}`);
          testsFailed++;
        }
      } catch (e) {
        console.log(`  ✗ FAILED - ${e.message}`);
        testsFailed++;
      }

      // Test 5 - Batch
      console.log('\nTest 5: POST /api/predictions/batch/calculate');
      try {
        const res = await makeRequest('POST', '/api/predictions/batch/calculate', 'admin-token', {
          assetIds: [1, 2]
        });
        console.log(`  Status: ${res.status}`);
        console.log(`  Response: ${res.rawBody ? res.rawBody.substring(0, 100) : 'empty'}`);
        if (res.status === 200) {
          console.log('  ✓ PASSED');
          testsPassed++;
        } else {
          console.log(`  ✗ FAILED - Expected 200, got ${res.status}`);
          testsFailed++;
        }
      } catch (e) {
        console.log(`  ✗ FAILED - ${e.message}`);
        testsFailed++;
      }

      console.log('\n' + '='.repeat(50));
      console.log('SUMMARY');
      console.log('='.repeat(50));
      console.log(`✓ Passed: ${testsPassed}`);
      console.log(`✗ Failed: ${testsFailed}`);
      console.log(`Total:   ${testsPassed + testsFailed}`);
      console.log('='.repeat(50) + '\n');

      process.exit(testsFailed > 0 ? 1 : 0);

    } catch (err) {
      console.error('Fatal error:', err);
      process.exit(1);
    } finally {
      if (server) server.close();
    }
  });

  setTimeout(() => {
    console.error('Tests timed out');
    process.exit(1);
  }, 30000);
}

runTests();
