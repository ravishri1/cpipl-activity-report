const fs = require('fs');
const http = require('http');
const path = require('path');

const logFile = path.join(__dirname, 'test-results.json');

function writeLog(message) {
  console.log(message); // Also to console
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`, 'utf-8');
}

writeLog('Test started!');
writeLog('Node version: ' + process.version);
writeLog('Working directory: ' + process.cwd());

const options = {
  hostname: '127.0.0.1',
  port: 49376,
  path: '/api/procurement/vendors',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AY3BpcGwuY29tIiwidXNlcklkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzI2NTA3NDIsImV4cCI6MTc3MjczNzE0Mn0.r8gbRigdUoQ3zKYqzT8NeoSDGXVjS-Uso08HAFlJJPs'
  }
};

writeLog('Making request to ' + options.hostname + ':' + options.port + options.path);

const req = http.request(options, (res) => {
  writeLog('Response status: ' + res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    writeLog('Response complete. Data length: ' + data.length);
    writeLog('Response data: ' + data.substring(0, 500));
    writeLog('Test finished!');
    process.exit(0);
  });
});

req.on('error', (err) => {
  writeLog('Error: ' + err.message);
  process.exit(1);
});

req.end();

setTimeout(() => {
  writeLog('Timeout waiting for response');
  process.exit(1);
}, 5000);
