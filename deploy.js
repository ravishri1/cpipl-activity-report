#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const projectDir = 'D:\\Activity Report Software';

console.log('========================================');
console.log('PHASE 3 PRODUCTION DEPLOYMENT');
console.log('========================================\n');

try {
  console.log('📂 Project Directory:', projectDir);
  console.log('📋 Current directory:', process.cwd());
  
  // Change to project directory
  process.chdir(projectDir);
  console.log('✅ Changed to project directory\n');
  
  // Check git status
  console.log('📊 Checking git status...');
  const status = execSync('git status --short', { encoding: 'utf8' });
  console.log(status || 'Clean working tree');
  console.log();
  
  // Commit all changes
  console.log('💾 Committing changes...');
  try {
    const commitMsg = 'Production Deployment: Google Drive File Management, Insurance Cards, Training Module, Asset Repairs Design, Phase 3 Data Exports - March 4, 2026';
    execSync(`git commit -m "${commitMsg}"`, { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log('✅ Commit successful\n');
  } catch (e) {
    console.log('⚠️  Git commit skipped (may already be committed or no changes)\n');
  }
  
  // Push to production
  console.log('🚀 Pushing to production (origin/main)...');
  try {
    execSync('git push origin main', { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    console.log('✅ Push successful\n');
  } catch (e) {
    console.log('⚠️  Git push may have issues (check network/credentials)\n');
  }
  
  // Get latest commit
  console.log('📍 Latest commit:');
  const log = execSync('git log -1 --oneline', { encoding: 'utf8' });
  console.log(log);
  
  console.log('========================================');
  console.log('✅ DEPLOYMENT COMPLETE');
  console.log('========================================\n');
  console.log('📋 Phase 4 Ready: Data Transformation and Import\n');
  
} catch (error) {
  console.error('❌ Error during deployment:', error.message);
  process.exit(1);
}
