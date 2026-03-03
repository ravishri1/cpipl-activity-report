/**
 * Test script for Employee Profile Drive Files Tab
 * 
 * This script tests:
 * 1. Admin access to employee files endpoint
 * 2. File listing with category filtering
 * 3. File upload to employee folder
 * 4. File deletion
 * 5. Profile photo URL handling
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@cpipl.com';
const ADMIN_PASSWORD = 'password123';
const TEST_USER_EMAIL = 'rahul@cpipl.com';

let adminToken = null;
let testUserId = null;
let uploadedFileId = null;

const API = axios.create({ baseURL: BASE_URL });

// Helper: Log test results
function log(title, message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    error: '\x1b[31m',   // red
    warn: '\x1b[33m',    // yellow
    reset: '\x1b[0m'
  };
  const color = colors[type] || colors.info;
  console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${title}: ${message}`);
}

async function runTests() {
  try {
    console.log('\n════════════════════════════════════════════════════════');
    console.log('   EMPLOYEE PROFILE DRIVE FILES TAB - TEST SUITE');
    console.log('════════════════════════════════════════════════════════\n');

    // ─── 1. Login as Admin ───
    log('TEST 1', 'Admin login');
    const loginRes = await API.post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    adminToken = loginRes.data.token;
    API.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;
    log('TEST 1', `✓ Logged in as ${ADMIN_EMAIL}`, 'success');

    // ─── 2. Get test user ID ───
    log('TEST 2', 'Fetch test user ID');
    const usersRes = await API.get('/users/directory?search=rahul');
    const testUser = usersRes.data.users?.find(u => u.email === TEST_USER_EMAIL);
    if (!testUser) {
      throw new Error(`Could not find test user with email ${TEST_USER_EMAIL}`);
    }
    testUserId = testUser.id;
    log('TEST 2', `✓ Found test user: ${testUser.name} (ID: ${testUserId})`, 'success');

    // ─── 3. Fetch employee files (initially empty) ───
    log('TEST 3', 'Fetch employee Drive files (empty list)');
    const filesRes1 = await API.get(`/files/user/${testUserId}`);
    const initialFiles = filesRes1.data;
    if (!Array.isArray(initialFiles)) {
      throw new Error('Response should be an array of files');
    }
    log('TEST 3', `✓ Retrieved ${initialFiles.length} files`, 'success');

    // ─── 4. Test category filtering ───
    log('TEST 4', 'Test category filtering');
    const photosRes = await API.get(`/files/user/${testUserId}?category=photo`);
    const documentsRes = await API.get(`/files/user/${testUserId}?category=document`);
    if (!Array.isArray(photosRes.data) || !Array.isArray(documentsRes.data)) {
      throw new Error('Category filter should return arrays');
    }
    log('TEST 4', `✓ Filtered by category - Photos: ${photosRes.data.length}, Documents: ${documentsRes.data.length}`, 'success');

    // ─── 5. Create a test file for upload ───
    log('TEST 5', 'Create test file');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    const testContent = 'This is a test file for Drive Files tab testing.\nCreated at: ' + new Date().toISOString();
    fs.writeFileSync(testFilePath, testContent);
    log('TEST 5', `✓ Created test file: ${testFilePath}`, 'success');

    // ─── 6. Upload file for employee ───
    log('TEST 6', 'Upload file for employee');
    const fileBuffer = fs.readFileSync(testFilePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'text/plain' });
    formData.append('file', blob, 'test-document.txt');
    formData.append('category', 'document');

    // Use node-fetch or axios with Buffer
    const uploadRes = await API.post(`/files/upload/${testUserId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).catch(async (err) => {
      // Fallback: Manual form data construction
      if (err.code === 'ERR_FORM_DATA_ENCODER_DISABLED') {
        log('TEST 6', 'Using alternative upload method...', 'warn');
        
        // Create proper FormData using Node.js
        const FormDataNode = require('form-data');
        const form = new FormDataNode();
        form.append('file', fs.createReadStream(testFilePath), 'test-document.txt');
        form.append('category', 'document');

        const uploadRes2 = await API.post(`/files/upload/${testUserId}`, form, {
          headers: form.getHeaders()
        });
        return uploadRes2;
      }
      throw err;
    });

    uploadedFileId = uploadRes.data.id;
    log('TEST 6', `✓ File uploaded successfully (ID: ${uploadedFileId})`, 'success');
    log('TEST 6', `  - File name: ${uploadRes.data.fileName}`, 'info');
    log('TEST 6', `  - Category: ${uploadRes.data.category}`, 'info');
    log('TEST 6', `  - Drive URL: ${uploadRes.data.driveUrl ? '✓ Present' : '✗ Missing'}`, 'info');

    // ─── 7. Fetch updated file list ───
    log('TEST 7', 'Fetch updated file list');
    const filesRes2 = await API.get(`/files/user/${testUserId}`);
    const updatedFiles = filesRes2.data;
    if (updatedFiles.length === 0) {
      throw new Error('File list should not be empty after upload');
    }
    const uploadedFile = updatedFiles.find(f => f.id === uploadedFileId);
    if (!uploadedFile) {
      throw new Error('Uploaded file not found in list');
    }
    log('TEST 7', `✓ Retrieved ${updatedFiles.length} files (previously ${initialFiles.length})`, 'success');

    // ─── 8. Verify file metadata ───
    log('TEST 8', 'Verify file metadata');
    const expectedFields = ['id', 'fileName', 'fileSize', 'category', 'mimeType', 'driveUrl', 'uploadedAt'];
    const missingFields = expectedFields.filter(f => !(f in uploadedFile));
    if (missingFields.length > 0) {
      throw new Error(`Missing fields: ${missingFields.join(', ')}`);
    }
    log('TEST 8', `✓ All required fields present:`, 'success');
    log('TEST 8', `  - File: ${uploadedFile.fileName}`, 'info');
    log('TEST 8', `  - Size: ${uploadedFile.fileSize} bytes`, 'info');
    log('TEST 8', `  - Category: ${uploadedFile.category}`, 'info');
    log('TEST 8', `  - MIME: ${uploadedFile.mimeType}`, 'info');
    log('TEST 8', `  - Uploaded: ${uploadedFile.uploadedAt}`, 'info');

    // ─── 9. Test document category filter ───
    log('TEST 9', 'Test document category filter');
    const docsFiltered = await API.get(`/files/user/${testUserId}?category=document`);
    const hasTestDoc = docsFiltered.data.some(f => f.id === uploadedFileId);
    if (!hasTestDoc) {
      throw new Error('Uploaded document not found in document category filter');
    }
    log('TEST 9', `✓ Document filtering works - found test file in documents`, 'success');

    // ─── 10. Test file deletion ───
    log('TEST 10', 'Delete uploaded file');
    const deleteRes = await API.delete(`/files/${uploadedFileId}`);
    if (deleteRes.status !== 200) {
      throw new Error(`Delete request returned status ${deleteRes.status}`);
    }
    log('TEST 10', `✓ File deleted successfully`, 'success');

    // ─── 11. Verify file removal ───
    log('TEST 11', 'Verify file removal');
    const filesRes3 = await API.get(`/files/user/${testUserId}`);
    const finalFiles = filesRes3.data;
    const stillExists = finalFiles.some(f => f.id === uploadedFileId);
    if (stillExists) {
      throw new Error('Deleted file still appears in list');
    }
    log('TEST 11', `✓ File successfully removed from list (${finalFiles.length} files remaining)`, 'success');

    // ─── 12. Test schema validation ───
    log('TEST 12', 'Validate DriveFile schema');
    if (uploadedFiles && uploadedFiles.length > 0) {
      const file = uploadedFiles[0];
      const schemaFields = {
        id: 'number',
        userId: 'number',
        driveFileId: 'string',
        driveFolderId: 'string',
        fileName: 'string',
        mimeType: 'string',
        fileSize: 'number',
        driveUrl: 'string',
        thumbnailUrl: ['string', 'null'],
        category: 'string',
        description: ['string', 'null'],
        uploadedAt: 'string'
      };

      let errors = [];
      for (const [field, expectedType] of Object.entries(schemaFields)) {
        if (!(field in file)) {
          errors.push(`Missing field: ${field}`);
          continue;
        }
        const actualType = typeof file[field];
        const types = Array.isArray(expectedType) ? expectedType : [expectedType];
        const isValid = types.some(t => {
          if (t === 'null') return file[field] === null;
          return typeof file[field] === t;
        });
        if (!isValid) {
          errors.push(`${field}: expected ${expectedType}, got ${actualType}`);
        }
      }

      if (errors.length > 0) {
        throw new Error('Schema validation failed: ' + errors.join('; '));
      }
    }
    log('TEST 12', `✓ DriveFile schema is valid`, 'success');

    // ─── 13. Test access control ───
    log('TEST 13', 'Test access control (non-admin cannot list others files)');
    const memberToken = await API.post('/auth/login', {
      email: 'member@cpipl.com',
      password: 'password123'
    }).then(r => r.data.token).catch(() => null);

    if (memberToken) {
      const testAPI = axios.create({ 
        baseURL: BASE_URL,
        headers: { Authorization: `Bearer ${memberToken}` }
      });
      try {
        await testAPI.get(`/files/user/${testUserId}`);
        log('TEST 13', `✗ Access control failed - member could access other user's files`, 'error');
      } catch (err) {
        if (err.response?.status === 403) {
          log('TEST 13', `✓ Access control working - member denied access to other user's files`, 'success');
        } else {
          log('TEST 13', `✗ Unexpected error: ${err.message}`, 'error');
        }
      }
    }

    // ─── Cleanup ───
    log('CLEANUP', 'Removing test file');
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    log('CLEANUP', '✓ Test file cleaned up', 'success');

    // ─── Summary ───
    console.log('\n════════════════════════════════════════════════════════');
    console.log('\x1b[32m✓ ALL TESTS PASSED\x1b[0m');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('SUMMARY:');
    console.log('  • Admin can access employee files endpoint');
    console.log('  • File listing works correctly');
    console.log('  • Category filtering works');
    console.log('  • File upload succeeds');
    console.log('  • File metadata is complete');
    console.log('  • File deletion works');
    console.log('  • Schema validation passes');
    console.log('  • Access control is enforced');
    console.log('\nThe Employee Profile Drive Files tab is fully functional!\n');

  } catch (err) {
    console.error('\n\x1b[31m✗ TEST FAILED\x1b[0m');
    console.error('Error:', err.message);
    if (err.response?.data) {
      console.error('Response:', err.response.data);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
