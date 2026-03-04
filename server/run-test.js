#!/usr/bin/env node

// Simple wrapper to run test with error handling
const { spawn } = require('child_process');
const path = require('path');

const testFile = path.join(__dirname, 'test-procurement-correct.js');

// Run the test script as a child process
const child = spawn('node', [testFile], {
  stdio: 'inherit', // Inherit stdio so output goes directly to console
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start test:', err);
  process.exit(1);
});
