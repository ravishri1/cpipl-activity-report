const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 49376,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('🔐 Login Test Results');
    console.log('====================');
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    console.log(`Response:`, data);
    
    try {
      const json = JSON.parse(data);
      if (res.statusCode === 200 && json.token) {
        console.log('\n✅ LOGIN SUCCESSFUL!');
        console.log('Token:', json.token.substring(0, 50) + '...');
        console.log('User:', json.user);
      } else {
        console.log('\n❌ Login failed');
      }
    } catch (e) {
      console.log('\nParsing error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

const payload = JSON.stringify({
  email: 'admin@cpipl.com',
  password: 'password123'
});

console.log('Testing login endpoint...');
console.log('POST http://127.0.0.1:49376/api/auth/login');
console.log('Payload:', payload);
console.log('---');

req.write(payload);
req.end();
