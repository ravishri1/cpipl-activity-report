const http = require('http');

console.log('Starting simple API test...');

function testAPI() {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 49376,
      path: '/api/procurement/vendors',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AY3BpcGwuY29tIiwidXNlcklkIjoxLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzI2NTA3NDIsImV4cCI6MTc3MjczNzE0Mn0.r8gbRigdUoQ3zKYqzT8NeoSDGXVjS-Uso08HAFlJJPs'
      }
    };

    console.log('Making request to', options.hostname + ':' + options.port + options.path);

    const req = http.request(options, (res) => {
      console.log('Response status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        console.log('Received chunk:', chunk.length, 'bytes');
      });
      
      res.on('end', () => {
        console.log('Response received. Length:', data.length);
        console.log('Response data (first 200 chars):', data.substring(0, 200));
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      resolve();
    });

    console.log('Sending request...');
    req.end();
  });
}

testAPI().then(() => {
  console.log('Test complete!');
  process.exit(0);
});
