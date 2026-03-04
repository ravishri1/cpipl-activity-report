const http = require('http');

const options = {
  hostname: '127.0.0.1',
  port: 62759,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

const body = JSON.stringify({
  email: 'admin@cpipl.com',
  password: 'password123'
});

console.log('Sending request with body:', body);
req.write(body);
req.end();
