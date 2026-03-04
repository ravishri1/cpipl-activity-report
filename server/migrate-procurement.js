#!/usr/bin/env node

/**
 * Migration Script: Add Procurement Integration
 * Runs: npx prisma migrate dev --name add_procurement_integration
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Procurement Integration Migration...\n');

// Change to server directory
process.chdir(path.join(__dirname));

// Run the migration
const migrate = spawn('npx', [
  'prisma',
  'migrate',
  'dev',
  '--name',
  'add_procurement_integration'
], {
  stdio: 'inherit',
  shell: true
});

migrate.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Schema Changes Applied:');
    console.log('  • User model: Added 5 procurement relations');
    console.log('  • Asset model: Added 4 procurement fields + 1 relation');
    console.log('  • Database: Ready for API endpoints\n');
    process.exit(0);
  } else {
    console.error(`\n❌ Migration failed with code ${code}`);
    process.exit(1);
  }
});
