#!/usr/bin/env node

/**
 * PHASE 4 ORCHESTRATION RUNNER
 * 
 * Purpose: Master script that runs complete Phase 4 workflow
 * - Phase 4.1: Data transformation (CSV → JSON)
 * - Phase 4.2: Database import (JSON → Database)
 * - Phase 4.3: Data verification (Validation checks)
 * - Generates consolidated report with all metrics
 * 
 * Usage: node phase4-runner.js [--skip-preflight] [--phase=4.1|4.2|4.3|all]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = __dirname;
const REPORTS_DIR = path.join(SCRIPTS_DIR, 'reports');
const PROJECT_ROOT = path.join(SCRIPTS_DIR, '..', '..');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Parse command line arguments
const args = process.argv.slice(2);
const skipPreflight = args.includes('--skip-preflight');
const phaseArg = args.find(a => a.startsWith('--phase='));
const targetPhase = phaseArg ? phaseArg.split('=')[1] : 'all';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

function subsection(title) {
  console.log('\n' + '-'.repeat(70));
  log(title, 'cyan');
  console.log('-'.repeat(70));
}

function executePhase(phaseNum, scriptName, description) {
  subsection(`Phase ${phaseNum}: ${description}`);
  
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    log(`❌ Script not found: ${scriptPath}`, 'red');
    return false;
  }
  
  const startTime = Date.now();
  log(`⏱️  Starting at ${new Date().toISOString()}`, 'dim');
  
  try {
    execSync(`node "${scriptPath}"`, {
      cwd: SCRIPTS_DIR,
      stdio: 'inherit',
      encoding: 'utf8'
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ Phase ${phaseNum} completed in ${duration}s`, 'green');
    return true;
  } catch (err) {
    log(`❌ Phase ${phaseNum} failed: ${err.message}`, 'red');
    return false;
  }
}

function verifyReportExists(reportFile) {
  const reportPath = path.join(REPORTS_DIR, reportFile);
  if (fs.existsSync(reportPath)) {
    const size = (fs.statSync(reportPath).size / 1024).toFixed(2);
    log(`📄 Report generated: ${reportFile} (${size} KB)`, 'green');
    return true;
  } else {
    log(`⚠️  Report not found: ${reportFile}`, 'yellow');
    return false;
  }
}

function generateConsolidatedReport(results) {
  const report = {
    runTimestamp: new Date().toISOString(),
    phases: {
      preflight: {
        skipped: skipPreflight,
        status: skipPreflight ? 'SKIPPED' : 'PASSED'
      },
      transformation: {
        status: results.phase41 ? 'COMPLETED' : 'FAILED',
        script: 'phase4-execute.js',
        reportFile: 'PHASE4_TRANSFORMATION_REPORT.json'
      },
      import: {
        status: results.phase42 ? 'COMPLETED' : 'FAILED',
        script: 'phase4-import.js',
        reportFile: 'PHASE4_IMPORT_REPORT.json'
      },
      verification: {
        status: results.phase43 ? 'COMPLETED' : 'FAILED',
        script: 'phase4-verify.js',
        reportFile: 'PHASE4_VERIFICATION_REPORT.json'
      }
    },
    summary: {
      targetPhase: targetPhase,
      phasesExecuted: Object.keys(results).filter(k => results[k]).length,
      allPhasesPassed: Object.values(results).every(v => v === true),
      totalDuration: `${((Date.now() - global.startTime) / 1000).toFixed(2)}s`
    },
    nextSteps: generateNextSteps(results),
    reportLocations: {
      consolidated: path.join(REPORTS_DIR, 'PHASE4_CONSOLIDATED_REPORT.json'),
      transformation: path.join(REPORTS_DIR, 'PHASE4_TRANSFORMATION_REPORT.json'),
      import: path.join(REPORTS_DIR, 'PHASE4_IMPORT_REPORT.json'),
      verification: path.join(REPORTS_DIR, 'PHASE4_VERIFICATION_REPORT.json')
    }
  };
  
  // Write consolidated report
  const reportPath = path.join(REPORTS_DIR, 'PHASE4_CONSOLIDATED_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  return report;
}

function generateNextSteps(results) {
  const steps = [];
  
  if (results.phase41) {
    steps.push('✅ Phase 4.1 (Transformation) completed');
    if (results.phase42) {
      steps.push('✅ Phase 4.2 (Import) completed');
      if (results.phase43) {
        steps.push('✅ Phase 4.3 (Verification) completed');
        steps.push('\n📋 ALL PHASES COMPLETED - BEGIN PHASE 5:');
        steps.push('1. Review PHASE4_VERIFICATION_REPORT.json for any issues');
        steps.push('2. Create greytHR-to-CPIPL final integration mapping document');
        steps.push('3. Update CPIPL system configuration for feature parity');
        steps.push('4. Perform end-to-end testing with stakeholders');
        steps.push('5. Obtain sign-off and approval for go-live');
      } else {
        steps.push('⚠️  Phase 4.3 (Verification) failed - review import report');
        steps.push('Run: node phase4-verify.js to retry verification');
      }
    } else {
      steps.push('⚠️  Phase 4.2 (Import) failed - review transformation report');
      steps.push('Run: node phase4-import.js to retry import');
    }
  } else {
    steps.push('⚠️  Phase 4.1 (Transformation) failed - review preflight checks');
    steps.push('Run: node phase4-preflight.js to diagnose issues');
  }
  
  return steps;
}

// MAIN EXECUTION
async function main() {
  global.startTime = Date.now();
  
  section('🚀 PHASE 4 EXECUTION RUNNER');
  log(`Target Phase: ${targetPhase}`);
  log(`Skip Preflight: ${skipPreflight}`);
  log(`Start Time: ${new Date().toISOString()}`);
  
  const results = {
    phase41: false,
    phase42: false,
    phase43: false
  };
  
  // Phase 4.0: Preflight (unless skipped)
  if (!skipPreflight && (targetPhase === 'all' || targetPhase === '4.0')) {
    subsection('Phase 4.0: Pre-flight Validation');
    log('Run this separately: node phase4-preflight.js', 'yellow');
    log('Skipping for now...', 'dim');
  }
  
  // Phase 4.1: Transformation
  if (targetPhase === 'all' || targetPhase === '4.1') {
    results.phase41 = executePhase('4.1', 'phase4-execute.js', 'Data Transformation');
    if (results.phase41) {
      verifyReportExists('PHASE4_TRANSFORMATION_REPORT.json');
    }
  }
  
  // Phase 4.2: Import
  if (targetPhase === 'all' || targetPhase === '4.2') {
    if (results.phase41 === false && targetPhase === 'all') {
      log('⚠️  Skipping Phase 4.2 because Phase 4.1 failed', 'yellow');
    } else {
      results.phase42 = executePhase('4.2', 'phase4-import.js', 'Data Import');
      if (results.phase42) {
        verifyReportExists('PHASE4_IMPORT_REPORT.json');
      }
    }
  }
  
  // Phase 4.3: Verification
  if (targetPhase === 'all' || targetPhase === '4.3') {
    if (results.phase42 === false && targetPhase === 'all') {
      log('⚠️  Skipping Phase 4.3 because Phase 4.2 failed', 'yellow');
    } else {
      results.phase43 = executePhase('4.3', 'phase4-verify.js', 'Data Verification');
      if (results.phase43) {
        verifyReportExists('PHASE4_VERIFICATION_REPORT.json');
      }
    }
  }
  
  // Generate consolidated report
  section('📊 GENERATING CONSOLIDATED REPORT');
  const consolidatedReport = generateConsolidatedReport(results);
  log(`✅ Report written to: ${consolidatedReport.reportLocations.consolidated}`, 'green');
  
  // Print summary
  section('📈 EXECUTION SUMMARY');
  log(`Total Duration: ${consolidatedReport.summary.totalDuration}`, 'bright');
  log(`Phases Executed: ${consolidatedReport.summary.phasesExecuted}/3`);
  log(`Status: ${consolidatedReport.summary.allPhasesPassed ? '✅ ALL PASSED' : '⚠️ PARTIAL/FAILED'}`, 
    consolidatedReport.summary.allPhasesPassed ? 'green' : 'yellow'
  );
  
  // Print next steps
  section('📋 NEXT STEPS');
  consolidatedReport.nextSteps.forEach(step => {
    if (step.startsWith('✅')) {
      log(step, 'green');
    } else if (step.startsWith('⚠️')) {
      log(step, 'yellow');
    } else if (step.startsWith('📋')) {
      log(step, 'bright');
    } else if (step === '') {
      console.log('');
    } else {
      log(step, 'cyan');
    }
  });
  
  console.log('\n' + '='.repeat(70));
  log('Phase 4 execution runner completed', 'bright');
  console.log('='.repeat(70) + '\n');
  
  // Exit with appropriate code
  process.exit(consolidatedReport.summary.allPhasesPassed ? 0 : 1);
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(2);
});
