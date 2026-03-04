#!/usr/bin/env node

/**
 * Server Launcher - Handles working directory and starts Express app
 * This script properly sets the working directory and starts the backend server
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Get the server directory
const serverDir = path.join(__dirname, 'server');
const appFile = path.join(serverDir, 'src', 'app.js');

// Verify app.js exists
if (!fs.existsSync(appFile)) {
  console.error(`❌ Error: app.js not found at ${appFile}`);
  process.exit(1);
}

console.log(`📁 Working directory: ${serverDir}`);
console.log(`📄 Starting: ${appFile}`);
console.log(`⏳ Initializing...\n`);

// Change to server directory
process.chdir(serverDir);

// Start the app using Node directly
const app = spawn('node', ['src/app.js'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

app.on('error', (err) => {
  console.error(`❌ Failed to start server: ${err.message}`);
  process.exit(1);
});

app.on('exit', (code) => {
  console.log(`\n⛔ Server stopped with exit code ${code}`);
  process.exit(code);
});

// Handle signals
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down server...');
  app.kill();
});

process.on('SIGTERM', () => {
  console.log('\n\n⏹️  Shutting down server...');
  app.kill();
});
