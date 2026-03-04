const http = require('http');
const fs = require('fs');

const logFile = 'D:\\Activity Report Software\\server\\test-login.log';

function log(msg) {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, output);
  console.log(output);
}

// Clear log file
fs.writeFileSync(logFile, '');

log('[TEST] Testing login endpoint...\n');

const options = {
  hostname: '127.0.0.1',
  port: 57268,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const postData = JSON.stringify({
  email: 'admin@cpipl.com',
  password: 'password123'
});

log('[TEST] POST /api/auth/login');
log(`[TEST] Body: ${postData}`);
log('[TEST] Sending request...\n');

const req = http.request(options, (res) => {
  log(`[TEST] Status: ${res.statusCode}`);
  log(`[TEST] Headers: ${JSON.stringify(res.headers)}`);
  log('[TEST] Response body:\n');

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    log(data);
    log('\n[TEST] Test complete');
    process.exit(0);
  });
});

req.on('error', (error) => {
  log(`[TEST] Error: ${error.message}`);
  process.exit(1);
});

req.write(postData);
req.end();
