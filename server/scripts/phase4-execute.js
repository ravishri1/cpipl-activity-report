#!/usr/bin/env node
/**
 * PHASE 4: Data Transformation Master Script
 * Executes all transformation scripts in sequence
 * Generates consolidated report
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IMPORTS_DIR = path.join(__dirname, '../imports');
const SCRIPTS_DIR = __dirname;

// Ensure imports directory exists
if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function executeScript(scriptName, description) {
  console.log(`\n📝 ${description}...`);
  console.log('-'.repeat(50));
  
  try {
    execSync(`node "${path.join(SCRIPTS_DIR, scriptName)}"`, {
      stdio: 'inherit',
      cwd: SCRIPTS_DIR
    });
    return true;
  } catch (err) {
    console.error(`❌ Failed to execute ${scriptName}: ${err.message}`);
    return false;
  }
}

function generateFinalReport() {
  console.log('\n\n');
  console.log('=' .repeat(60));
  console.log('📊 PHASE 4: TRANSFORMATION EXECUTION REPORT');
  console.log('=' .repeat(60));
  console.log();
  
  const results = {
    timestamp: new Date().toISOString(),
    modules: []
  };
  
  // Check each transformation output
  const transformationFiles = [
    {
      file: 'employee-master-transformed.json',
      module: 'Employee Master Data',
      expected: 41
    },
    {
      file: 'leave-config-transformed.json',
      module: 'Leave Configuration',
      expected: 72
    },
    {
      file: 'asset-register-transformed.json',
      module: 'Asset Register',
      expected: 4
    },
    {
      file: 'org-structure-transformed.json',
      module: 'Organizational Structure',
      expected: 41
    }
  ];
  
  let totalValid = 0;
  let totalRecords = 0;
  
  transformationFiles.forEach(({ file, module, expected }) => {
    const filePath = path.join(IMPORTS_DIR, file);
    
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const valid = data.metadata.validRecords || 0;
        const invalid = data.metadata.invalidRecords || 0;
        const quality = data.metadata.qualityScore || 0;
        
        totalValid += valid;
        totalRecords += (valid + invalid);
        
        console.log(`✅ ${module}`);
        console.log(`   Status: ${quality >= 90 ? 'READY FOR IMPORT' : 'NEEDS REVIEW'}`);
        console.log(`   Records: ${valid}/${valid + invalid} valid (${quality}% quality)`);
        console.log(`   Expected: ${expected} records`);
        
        if (valid !== expected) {
          console.log(`   ⚠️  Mismatch: Expected ${expected}, got ${valid}`);
        } else {
          console.log(`   ✓ Match confirmed`);
        }
        console.log();
        
        results.modules.push({
          module: module,
          file: file,
          valid: valid,
          invalid: invalid,
          quality: parseFloat(quality),
          expected: expected,
          ready: quality >= 90 && valid === expected
        });
        
      } catch (err) {
        console.log(`❌ ${module}`);
        console.log(`   Error reading file: ${err.message}`);
        console.log();
        
        results.modules.push({
          module: module,
          file: file,
          error: err.message,
          ready: false
        });
      }
    } else {
      console.log(`❌ ${module}`);
      console.log(`   Status: NOT GENERATED`);
      console.log(`   File: ${file} (not found)`);
      console.log();
      
      results.modules.push({
        module: module,
        file: file,
        status: 'not_generated',
        ready: false
      });
    }
  });
  
  // Summary statistics
  console.log('=' .repeat(60));
  console.log('📈 OVERALL STATISTICS');
  console.log('=' .repeat(60));
  console.log();
  
  const overallQuality = totalRecords > 0 ? (totalValid / totalRecords * 100) : 0;
  
  console.log(`Total Records Transformed: ${totalValid}/${totalRecords}`);
  console.log(`Overall Quality Score: ${overallQuality.toFixed(1)}%`);
  console.log();
  
  if (overallQuality >= 90) {
    console.log('✅ ALL MODULES READY FOR IMPORT');
    results.status = 'READY_FOR_IMPORT';
  } else {
    console.log('⚠️  SOME MODULES NEED REVIEW');
    results.status = 'NEEDS_REVIEW';
  }
  
  console.log();
  
  // Save consolidated report
  const reportFile = path.join(IMPORTS_DIR, 'PHASE4_TRANSFORMATION_REPORT.json');
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  
  console.log('💾 Report saved to: PHASE4_TRANSFORMATION_REPORT.json');
  console.log();
  
  console.log('=' .repeat(60));
  console.log('🎯 NEXT STEPS');
  console.log('=' .repeat(60));
  console.log();
  
  if (results.status === 'READY_FOR_IMPORT') {
    console.log('1. ✅ Review transformed data files in imports/');
    console.log('2. ✅ Run Phase 4 Import: node phase4-import.js');
    console.log('3. ✅ Verify post-import: node phase4-verify.js');
    console.log('4. ✅ Generate final report');
  } else {
    console.log('1. ⚠️  Review failed transformations');
    console.log('2. 🔧 Fix data quality issues in source CSV files');
    console.log('3. ↻ Re-run transformations');
    console.log('4. ✅ Once ready, proceed to import phase');
  }
  
  console.log();
  console.log('=' .repeat(60));
  
  return results.status === 'READY_FOR_IMPORT';
}

async function main() {
  console.log('\n');
  console.log('█'.repeat(60));
  console.log('║' + ' '.repeat(58) + '║');
  console.log('║' + '  PHASE 4: DATA TRANSFORMATION EXECUTION'.padEnd(59) + '║');
  console.log('║' + ' '.repeat(58) + '║');
  console.log('█'.repeat(60));
  console.log();
  console.log('📋 This phase transforms exported CSV data to CPIPL schema');
  console.log('⏱️  Started at:', new Date().toLocaleString());
  console.log();
  
  const scripts = [
    { name: 'transform-employee-data.js', desc: '1️⃣  Transform Employee Master Data (41 records)' },
    { name: 'transform-leave-data.js', desc: '2️⃣  Transform Leave Configuration (72 records)' },
    { name: 'transform-asset-data.js', desc: '3️⃣  Transform Asset Register (4 records)' },
    { name: 'transform-org-structure.js', desc: '4️⃣  Transform Organizational Structure (41 records)' }
  ];
  
  let allSuccess = true;
  
  for (const script of scripts) {
    if (!executeScript(script.name, script.desc)) {
      allSuccess = false;
    }
  }
  
  if (!allSuccess) {
    console.log('\n\n❌ Some transformations failed. Please check the errors above.');
    process.exit(1);
  }
  
  // Generate report
  const ready = generateFinalReport();
  
  console.log('\n⏱️  Completed at:', new Date().toLocaleString());
  console.log();
  
  if (!ready) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
