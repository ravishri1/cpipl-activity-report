#!/usr/bin/env node

/**
 * PHASE 4 PRE-FLIGHT VALIDATION SCRIPT
 * 
 * Purpose: Verify all prerequisites are in place before executing Phase 4
 * - Checks CSV export files exist and are readable
 * - Validates database connectivity
 * - Verifies required Node packages
 * - Checks disk space and permissions
 * - Confirms script files exist
 * - Validates environment variables
 * 
 * Run this before phase4-execute.js to catch issues early
 */

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPTS_DIR, '..', '..');
const IMPORTS_DIR = path.join(SCRIPTS_DIR, 'imports');
const REPORTS_DIR = path.join(SCRIPTS_DIR, 'reports');

const checks = {
  directories: [],
  csvFiles: [],
  scripts: [],
  database: [],
  packages: [],
  environment: [],
  summary: {
    totalChecks: 0,
    passed: 0,
    failed: 0,
    critical: 0
  }
};

function log(level, category, message, isCritical = false) {
  const icons = {
    pass: '✅',
    warn: '⚠️ ',
    fail: '❌',
    info: 'ℹ️ '
  };
  console.log(`${icons[level]} [${category}] ${message}`);
  if (isCritical) checks.summary.critical++;
}

function addCheck(category, passed, message, isCritical = false) {
  checks[category].push({ passed, message });
  checks.summary.totalChecks++;
  if (passed) {
    checks.summary.passed++;
    log('pass', category.toUpperCase(), message);
  } else {
    checks.summary.failed++;
    log('fail', category.toUpperCase(), message, isCritical);
  }
}

console.log('\n🚀 PHASE 4 PRE-FLIGHT VALIDATION\n');
console.log('=' .repeat(60));

// 1. CHECK DIRECTORY STRUCTURE
console.log('\n1️⃣  CHECKING DIRECTORY STRUCTURE');
console.log('-'.repeat(60));

addCheck('directories', 
  fs.existsSync(IMPORTS_DIR), 
  `Imports directory exists: ${IMPORTS_DIR}`
);

addCheck('directories',
  fs.existsSync(REPORTS_DIR),
  `Reports directory exists: ${REPORTS_DIR}`
);

// Create reports dir if missing
if (!fs.existsSync(REPORTS_DIR)) {
  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    addCheck('directories', true, 'Reports directory created successfully');
  } catch (err) {
    addCheck('directories', false, `Failed to create reports directory: ${err.message}`, true);
  }
}

// 2. CHECK CSV EXPORT FILES
console.log('\n2️⃣  CHECKING CSV EXPORT FILES');
console.log('-'.repeat(60));

const expectedFiles = [
  'employee-master-data-export.csv',
  'leave-config-export.csv',
  'asset-register-export.csv',
  'org-structure-export.csv'
];

expectedFiles.forEach(file => {
  const filePath = path.join(IMPORTS_DIR, file);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    try {
      const stats = fs.statSync(filePath);
      const sizeKb = (stats.size / 1024).toFixed(2);
      addCheck('csvFiles', true, `${file} (${sizeKb} KB)`);
    } catch (err) {
      addCheck('csvFiles', false, `${file} - Cannot read stats: ${err.message}`, true);
    }
  } else {
    addCheck('csvFiles', false, `${file} - NOT FOUND`, true);
  }
});

// 3. CHECK TRANSFORMATION SCRIPTS
console.log('\n3️⃣  CHECKING TRANSFORMATION SCRIPTS');
console.log('-'.repeat(60));

const requiredScripts = [
  'transform-employee-data.js',
  'transform-leave-data.js',
  'transform-asset-data.js',
  'transform-org-structure.js',
  'phase4-execute.js',
  'phase4-import.js',
  'phase4-verify.js'
];

requiredScripts.forEach(script => {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  const exists = fs.existsSync(scriptPath);
  
  if (exists) {
    try {
      const stats = fs.statSync(scriptPath);
      const lines = fs.readFileSync(scriptPath, 'utf8').split('\n').length;
      addCheck('scripts', true, `${script} (${lines} lines)`);
    } catch (err) {
      addCheck('scripts', false, `${script} - Cannot read: ${err.message}`, true);
    }
  } else {
    addCheck('scripts', false, `${script} - NOT FOUND`, true);
  }
});

// 4. CHECK DATABASE CONNECTIVITY
console.log('\n4️⃣  CHECKING DATABASE CONNECTIVITY');
console.log('-'.repeat(60));

try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  // Try to query user count
  prisma.$queryRaw`SELECT COUNT(*) as count FROM User;`
    .then(async (result) => {
      addCheck('database', true, `Database connected - ${result[0]?.count || 0} users found`);
      await prisma.$disconnect();
    })
    .catch((err) => {
      addCheck('database', false, `Database query failed: ${err.message}`, true);
    });
} catch (err) {
  addCheck('database', false, `Prisma client error: ${err.message}`, true);
}

// 5. CHECK NODE PACKAGES
console.log('\n5️⃣  CHECKING REQUIRED PACKAGES');
console.log('-'.repeat(60));

const requiredPackages = [
  'csv-parse',
  '@prisma/client',
  'dotenv'
];

requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
    addCheck('packages', true, `${pkg} - installed`);
  } catch (err) {
    addCheck('packages', false, `${pkg} - NOT INSTALLED`, true);
  }
});

// 6. CHECK ENVIRONMENT
console.log('\n6️⃣  CHECKING ENVIRONMENT VARIABLES');
console.log('-'.repeat(60));

require('dotenv').config({ path: path.join(PROJECT_ROOT, 'server', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
addCheck('environment', true, `NODE_ENV: ${nodeEnv}`);

const dbUrl = process.env.DATABASE_URL ? 'Set' : 'Not set';
addCheck('environment', 
  process.env.DATABASE_URL ? true : false, 
  `DATABASE_URL: ${dbUrl}`,
  !process.env.DATABASE_URL
);

// 7. SUMMARY
console.log('\n' + '='.repeat(60));
console.log('📊 PRE-FLIGHT VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`\nTotal Checks: ${checks.summary.totalChecks}`);
console.log(`✅ Passed: ${checks.summary.passed}`);
console.log(`❌ Failed: ${checks.summary.failed}`);
console.log(`🔴 Critical Issues: ${checks.summary.critical}`);

if (checks.summary.critical === 0) {
  console.log('\n✅ ALL CHECKS PASSED - READY TO EXECUTE PHASE 4');
  console.log('\nNext steps:');
  console.log('1. Run: node scripts/phase4-execute.js (Phase 4.1: Transformation)');
  console.log('2. Review: PHASE4_TRANSFORMATION_REPORT.json');
  console.log('3. Run: node scripts/phase4-import.js (Phase 4.2: Import)');
  console.log('4. Review: PHASE4_IMPORT_REPORT.json');
  console.log('5. Run: node scripts/phase4-verify.js (Phase 4.3: Verification)');
  console.log('6. Review: PHASE4_VERIFICATION_REPORT.json');
  process.exit(0);
} else {
  console.log('\n❌ CRITICAL ISSUES DETECTED - CANNOT PROCEED WITH PHASE 4');
  console.log('\nPlease resolve the following issues before running Phase 4:');
  
  ['directories', 'csvFiles', 'scripts', 'database', 'packages', 'environment'].forEach(cat => {
    const failures = checks[cat].filter(c => !c.passed);
    if (failures.length > 0) {
      console.log(`\n${cat.toUpperCase()}:`);
      failures.forEach(f => console.log(`  • ${f.message}`));
    }
  });
  
  process.exit(1);
}
