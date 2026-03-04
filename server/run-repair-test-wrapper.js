#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get absolute path to tests directory
const testsDir = path.join(__dirname, 'tests');
const testFile = path.join(testsDir, 'repair-endpoints.test.js');

console.log('Starting Asset Repair Test Suite...\n');
console.log(`Working directory: ${__dirname}`);
console.log(`Test file: ${testFile}\n`);

// Check if test file exists
if (!fs.existsSync(testFile)) {
  console.error(`ERROR: Test file not found at ${testFile}`);
  process.exit(1);
}

// Import and run the test file
try {
  require(testFile);
} catch (error) {
  console.error('Error running tests:', error.message);
  process.exit(1);
}
