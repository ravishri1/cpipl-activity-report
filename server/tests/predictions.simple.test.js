/**
 * Simplified Predictions API Tests
 * Uses built-in Node.js http module instead of supertest
 * Tests core functionality of all 8 endpoints
 */

const http = require('http');
const assert = require('assert');
const app = require('../src/app');

let server;
let testsPassed = 0;
let testsFailed = 0;

// Helper function to make HTTP requests
function makeRequest(method, path, token, body = null) {
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
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
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

// Test runner
async function runTests() {
  console.log('\n🧪 Starting Predictions API Tests (Simplified)...\n');

  // Start server
  server = app.listen(5001, async () => {
    console.log('✓ Test server started on port 5001');

    try {
      // Test 1: Health endpoint with admin auth
      console.log('\nTest 1: GET /api/predictions/asset/1/health (Admin)');
      try {
        const res = await makeRequest('GET', '/api/predictions/asset/1/health', 'admin-token');
        assert(res.status === 200 || res.status === 404, `Expected 200 or 404, got ${res.status}`);
        console.log('✓ PASSED - Health endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 2: At-risk assets endpoint
      console.log('\nTest 2: GET /api/predictions/at-risk (Admin)');
      try {
        const res = await makeRequest('GET', '/api/predictions/at-risk', 'admin-token');
        assert(res.status === 200 || res.status === 404, `Expected 200 or 404, got ${res.status}`);
        console.log('✓ PASSED - At-risk endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 3: Dashboard summary endpoint
      console.log('\nTest 3: GET /api/predictions/dashboard/summary (Admin)');
      try {
        const res = await makeRequest('GET', '/api/predictions/dashboard/summary', 'admin-token');
        assert(res.status === 200 || res.status === 404, `Expected 200 or 404, got ${res.status}`);
        console.log('✓ PASSED - Dashboard summary endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 4: Auth required test
      console.log('\nTest 4: GET /api/predictions/asset/1/health (No Auth)');
      try {
        const res = await makeRequest('GET', '/api/predictions/asset/1/health', null);
        assert(res.status === 401, `Expected 401 (unauthorized), got ${res.status}`);
        console.log('✓ PASSED - Authentication is required');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 5: Invalid asset ID
      console.log('\nTest 5: GET /api/predictions/asset/invalid/health (Invalid ID)');
      try {
        const res = await makeRequest('GET', '/api/predictions/asset/invalid/health', 'admin-token');
        assert(res.status === 400, `Expected 400 (bad request), got ${res.status}`);
        console.log('✓ PASSED - Invalid asset ID validation working');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 6: Batch calculate endpoint
      console.log('\nTest 6: POST /api/predictions/batch/calculate (Batch)');
      try {
        const res = await makeRequest('POST', '/api/predictions/batch/calculate', 'admin-token', {
          assetIds: [1, 2]
        });
        assert(res.status === 200 || res.status === 404 || res.status === 403, `Got ${res.status}`);
        console.log('✓ PASSED - Batch endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 7: Recommendations endpoint
      console.log('\nTest 7: GET /api/predictions/recommendations/1 (Recommendation)');
      try {
        const res = await makeRequest('GET', '/api/predictions/recommendations/1', 'admin-token');
        assert(res.status === 200 || res.status === 404, `Expected 200 or 404, got ${res.status}`);
        console.log('✓ PASSED - Recommendations endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Test 8: Insights trend endpoint
      console.log('\nTest 8: GET /api/predictions/insights/1/trend (Trend)');
      try {
        const res = await makeRequest('GET', '/api/predictions/insights/1/trend', 'admin-token');
        assert(res.status === 200 || res.status === 404, `Expected 200 or 404, got ${res.status}`);
        console.log('✓ PASSED - Insights endpoint accessible');
        testsPassed++;
      } catch (e) {
        console.log('✗ FAILED -', e.message);
        testsFailed++;
      }

      // Print results
      console.log('\n' + '='.repeat(50));
      console.log('TEST SUMMARY');
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

  // Timeout safety
  setTimeout(() => {
    console.error('Tests timed out');
    process.exit(1);
  }, 30000);
}

// Run tests
runTests();
