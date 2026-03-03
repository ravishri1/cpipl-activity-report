const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const AdmZip = require('adm-zip');

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  validateStatus: () => true, // Don't throw on any status
});

async function test() {
  try {
    // Step 1: Login
    console.log('Step 1: Login as admin');
    const loginRes = await API.post('/auth/login', {
      email: 'admin@cpipl.com',
      password: 'password123',
    });
    
    if (loginRes.status !== 200) {
      console.log('ERROR:', loginRes.data);
      return;
    }
    
    const token = loginRes.data.token;
    API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✓ Logged in, token:', token.slice(0, 20) + '...');

    // Get employee with COLOR191 employeeId to know which user to check later
    console.log('\nStep 1.5: Get employee with COLOR191');
    const empRes = await API.get('/users/directory');
    const empWithColor191 = empRes.data.users.find(u => u.employeeId === 'COLOR191');
    console.log('✓ Found employee:', empWithColor191?.name, '(ID:', empWithColor191?.id, ')');

    // Step 2: Create a test ZIP with one photo
    console.log('\nStep 2: Create test ZIP');
    const zip = new AdmZip();
    const testImage = Buffer.alloc(100);
    zip.addFile('COLOR191.jpg', testImage);
    const zipBuffer = zip.toBuffer();
    console.log('✓ Created ZIP, size:', zipBuffer.length);

    // Step 3: Upload ZIP
    console.log('\nStep 3: Upload ZIP to /api/files/bulk-photos');
    const form = new FormData();
    form.append('zip', zipBuffer, 'test.zip');
    
    const uploadRes = await API.post('/files/bulk-photos', form, {
      headers: form.getHeaders(),
    });
    
    console.log('Status:', uploadRes.status);
    console.log('Response:', JSON.stringify(uploadRes.data, null, 2));

    // Step 4: Check if user was updated
    if (uploadRes.status === 200 && empWithColor191) {
      console.log('\nStep 4: Check user driveProfilePhotoUrl');
      const userRes = await API.get(`/users/${empWithColor191.id}/profile`);
      console.log(`User ${empWithColor191.name} driveProfilePhotoUrl:`, userRes.data.driveProfilePhotoUrl);
      if (userRes.data.driveProfilePhotoUrl) {
        console.log('✓ SUCCESS: Photo URL is set!');
      } else {
        console.log('✗ FAILED: Photo URL is still undefined!');
      }
    }

  } catch (err) {
    console.error('ERROR:', err.message);
  }
}

test();
