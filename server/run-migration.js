#!/usr/bin/env node

/**
 * Run Prisma migration for Procurement system
 * This script executes the database migration programmatically
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(50));
console.log('PRISMA MIGRATION - PROCUREMENT SYSTEM');
console.log('='.repeat(50));
console.log('');

// Change to server directory
const serverDir = path.resolve(__dirname, '.');
console.log(`Working directory: ${serverDir}`);
console.log('');

// Run Prisma migrate dev command
const migrationProcess = spawn('npx', ['prisma', 'migrate', 'dev', '--name', 'add_procurement_integration'], {
  cwd: serverDir,
  stdio: 'inherit',
  shell: true
});

migrationProcess.on('close', (code) => {
  console.log('');
  console.log('='.repeat(50));
  if (code === 0) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
  } else {
    console.log(`❌ MIGRATION FAILED WITH CODE: ${code}`);
  }
  console.log('='.repeat(50));
  process.exit(code);
});

migrationProcess.on('error', (err) => {
  console.error('❌ ERROR EXECUTING MIGRATION:', err.message);
  process.exit(1);
});
