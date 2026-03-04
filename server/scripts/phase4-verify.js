#!/usr/bin/env node
/**
 * PHASE 4.3: Data Verification & Validation
 * Validates imported data integrity, relationships, and completeness
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const IMPORTS_DIR = path.join(__dirname, '../imports');

const verification = {
  timestamp: new Date().toISOString(),
  checks: {},
  issues: [],
  summary: {}
};

async function checkEmployeeData() {
  console.log('\n✅ Checking Employee Data Integrity...');
  console.log('-'.repeat(60));
  
  try {
    const employees = await prisma.user.findMany({
      where: { role: { in: ['admin', 'team_lead', 'member'] } }
    });
    
    console.log(`📊 Total employees: ${employees.length}`);
    
    let issues = 0;
    const problems = [];
    
    // Check required fields
    for (const emp of employees) {
      if (!emp.email) {
        problems.push(`Employee ${emp.id}: Missing email`);
        issues++;
      }
      if (!emp.name) {
        problems.push(`Employee ${emp.id}: Missing name`);
        issues++;
      }
      if (!emp.designation) {
        problems.push(`Employee ${emp.id}: Missing designation`);
        issues++;
      }
      if (!emp.department) {
        problems.push(`Employee ${emp.id}: Missing department`);
        issues++;
      }
    }
    
    // Check for duplicate emails
    const emailGroups = employees.reduce((acc, emp) => {
      if (!acc[emp.email]) acc[emp.email] = [];
      acc[emp.email].push(emp.id);
      return acc;
    }, {});
    
    const duplicates = Object.entries(emailGroups).filter(([_, ids]) => ids.length > 1);
    if (duplicates.length > 0) {
      duplicates.forEach(([email, ids]) => {
        problems.push(`Duplicate email: ${email} (IDs: ${ids.join(', ')})`);
        issues++;
      });
    }
    
    // Check date of joining
    let futureJoins = 0;
    employees.forEach(emp => {
      if (emp.dateOfJoining && new Date(emp.dateOfJoining) > new Date()) {
        futureJoins++;
      }
    });
    
    if (futureJoins > 0) {
      problems.push(`${futureJoins} employees have future joining dates`);
    }
    
    verification.checks.employees = {
      total: employees.length,
      issues: issues,
      problems: problems,
      status: issues === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   Status: ${verification.checks.employees.status}`);
    if (issues > 0) {
      console.log(`   ⚠️  Issues found: ${issues}`);
      problems.slice(0, 5).forEach(p => console.log(`       - ${p}`));
      if (problems.length > 5) console.log(`       + ${problems.length - 5} more`);
    } else {
      console.log(`   ✅ All checks passed`);
    }
    
  } catch (err) {
    console.error('Error checking employees:', err.message);
    verification.checks.employees = { status: 'ERROR', error: err.message };
  }
}

async function checkOrganizationalStructure() {
  console.log('\n✅ Checking Organizational Structure...');
  console.log('-'.repeat(60));
  
  try {
    const employees = await prisma.user.findMany({
      include: { reportingManager: { select: { name: true } } }
    });
    
    const withManager = employees.filter(e => e.reportingManagerId).length;
    const withoutManager = employees.filter(e => !e.reportingManagerId).length;
    
    console.log(`📊 Total employees: ${employees.length}`);
    console.log(`   With manager: ${withManager}`);
    console.log(`   Without manager: ${withoutManager}`);
    
    // Check for circular reporting (manager reports to themselves)
    let circular = 0;
    for (const emp of employees) {
      if (emp.reportingManagerId === emp.id) {
        circular++;
        verification.issues.push(`Circular reporting: ${emp.name} reports to self`);
      }
    }
    
    // Check for orphaned managers
    const managerIds = new Set(employees.map(e => e.reportingManagerId).filter(Boolean));
    const orphanedManagers = Array.from(managerIds).filter(
      id => !employees.find(e => e.id === id)
    );
    
    // Get unique departments
    const departments = new Set(employees.map(e => e.department).filter(Boolean));
    
    verification.checks.orgStructure = {
      totalEmployees: employees.length,
      withManager: withManager,
      withoutManager: withoutManager,
      departments: departments.size,
      circularReferences: circular,
      orphanedManagers: orphanedManagers.length,
      status: circular === 0 && orphanedManagers.length === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   Departments: ${departments.size}`);
    console.log(`   Circular references: ${circular}`);
    console.log(`   Orphaned managers: ${orphanedManagers.length}`);
    console.log(`   Status: ${verification.checks.orgStructure.status}`);
    
    if (circular > 0 || orphanedManagers.length > 0) {
      console.log(`   ⚠️  Issues detected`);
    } else {
      console.log(`   ✅ Structure looks good`);
    }
    
  } catch (err) {
    console.error('Error checking org structure:', err.message);
    verification.checks.orgStructure = { status: 'ERROR', error: err.message };
  }
}

async function checkLeaveData() {
  console.log('\n✅ Checking Leave Configuration...');
  console.log('-'.repeat(60));
  
  try {
    const leaves = await prisma.leaveBalance.findMany({
      include: { user: { select: { name: true } }, leaveType: { select: { name: true } } }
    });
    
    console.log(`📊 Total leave balances: ${leaves.length}`);
    
    let issues = 0;
    const problems = [];
    
    // Check for negative balances
    const negative = leaves.filter(l => l.totalAllocated < 0 || l.totalUsed < 0);
    if (negative.length > 0) {
      problems.push(`${negative.length} records with negative values`);
      issues += negative.length;
    }
    
    // Check for used > allocated
    const exceeded = leaves.filter(l => l.totalUsed > l.totalAllocated);
    if (exceeded.length > 0) {
      problems.push(`${exceeded.length} records with used > allocated`);
    }
    
    // Leave type distribution
    const leaveTypeCount = {};
    leaves.forEach(l => {
      leaveTypeCount[l.leaveType.name] = (leaveTypeCount[l.leaveType.name] || 0) + 1;
    });
    
    verification.checks.leaves = {
      total: leaves.length,
      issues: issues,
      leaveTypes: Object.keys(leaveTypeCount).length,
      negativeBalances: negative.length,
      exceededUsage: exceeded.length,
      problems: problems,
      status: issues === 0 && exceeded.length === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   Leave types: ${Object.keys(leaveTypeCount).length}`);
    console.log(`   Negative balances: ${negative.length}`);
    console.log(`   Usage > allocated: ${exceeded.length}`);
    console.log(`   Status: ${verification.checks.leaves.status}`);
    
    if (issues > 0) {
      console.log(`   ⚠️  Data quality issues detected`);
    } else {
      console.log(`   ✅ All leave data valid`);
    }
    
  } catch (err) {
    console.error('Error checking leaves:', err.message);
    verification.checks.leaves = { status: 'ERROR', error: err.message };
  }
}

async function checkAssetData() {
  console.log('\n✅ Checking Asset Register...');
  console.log('-'.repeat(60));
  
  try {
    const assets = await prisma.asset.findMany({
      include: { assignedToUser: { select: { name: true } } }
    });
    
    console.log(`📊 Total assets: ${assets.length}`);
    
    const statuses = {};
    const conditions = {};
    const assigned = assets.filter(a => a.assignedTo).length;
    const unassigned = assets.length - assigned;
    
    assets.forEach(a => {
      statuses[a.status] = (statuses[a.status] || 0) + 1;
      conditions[a.condition] = (conditions[a.condition] || 0) + 1;
    });
    
    // Check for missing required fields
    let issues = 0;
    const problems = [];
    
    assets.forEach(a => {
      if (!a.name) problems.push(`Asset ${a.id}: Missing name`);
      if (!a.type) problems.push(`Asset ${a.id}: Missing type`);
      if (a.purchasePrice < 0) problems.push(`Asset ${a.id}: Negative price`);
    });
    
    issues = problems.length;
    
    // Calculate total asset value
    const totalValue = assets.reduce((sum, a) => sum + (a.purchasePrice || 0), 0);
    
    verification.checks.assets = {
      total: assets.length,
      assigned: assigned,
      unassigned: unassigned,
      statuses: statuses,
      conditions: conditions,
      totalValue: totalValue,
      issues: issues,
      status: issues === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   Assigned: ${assigned}`);
    console.log(`   Unassigned: ${unassigned}`);
    console.log(`   Total value: ₹${totalValue.toLocaleString('en-IN')}`);
    console.log(`   Status: ${verification.checks.assets.status}`);
    
    Object.entries(statuses).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    
    if (issues > 0) {
      console.log(`   ⚠️  ${issues} issues found`);
    } else {
      console.log(`   ✅ All assets valid`);
    }
    
  } catch (err) {
    console.error('Error checking assets:', err.message);
    verification.checks.assets = { status: 'ERROR', error: err.message };
  }
}

async function checkDataRelationships() {
  console.log('\n✅ Checking Data Relationships...');
  console.log('-'.repeat(60));
  
  try {
    // Check for orphaned leave records
    const leaves = await prisma.leaveBalance.findMany({
      include: { user: true }
    });
    
    const orphanedLeaves = leaves.filter(l => !l.user).length;
    
    // Check for orphaned assets
    const assets = await prisma.asset.findMany({
      include: { assignedToUser: true }
    });
    
    const orphanedAssets = assets.filter(a => a.assignedTo && !a.assignedToUser).length;
    
    verification.checks.relationships = {
      orphanedLeaves: orphanedLeaves,
      orphanedAssets: orphanedAssets,
      status: orphanedLeaves === 0 && orphanedAssets === 0 ? 'PASS' : 'FAIL'
    };
    
    console.log(`   Orphaned leave records: ${orphanedLeaves}`);
    console.log(`   Orphaned asset assignments: ${orphanedAssets}`);
    console.log(`   Status: ${verification.checks.relationships.status}`);
    
    if (orphanedLeaves === 0 && orphanedAssets === 0) {
      console.log(`   ✅ All relationships intact`);
    } else {
      console.log(`   ⚠️  Relationship issues detected`);
    }
    
  } catch (err) {
    console.error('Error checking relationships:', err.message);
    verification.checks.relationships = { status: 'ERROR', error: err.message };
  }
}

async function generateVerificationReport() {
  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('📊 PHASE 4.3: VERIFICATION REPORT');
  console.log('='.repeat(60));
  console.log();
  
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  
  Object.entries(verification.checks).forEach(([check, result]) => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${statusIcon} ${check}: ${result.status}`);
    
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else errorCount++;
  });
  
  console.log();
  console.log('='.repeat(60));
  console.log('Overall Status:');
  console.log();
  console.log(`   Passed checks: ${passCount}`);
  console.log(`   Failed checks: ${failCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log();
  
  if (failCount === 0 && errorCount === 0) {
    console.log('✅ ALL VERIFICATION CHECKS PASSED');
    verification.status = 'SUCCESS';
  } else if (errorCount > 0) {
    console.log('⚠️  VERIFICATION ERRORS - Check database connection');
    verification.status = 'ERROR';
  } else {
    console.log('⚠️  SOME CHECKS FAILED - Review data quality');
    verification.status = 'FAILED';
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('Next Steps:');
  console.log();
  
  if (verification.status === 'SUCCESS') {
    console.log('1. ✅ All data verified and valid');
    console.log('2. ✅ Proceed to Phase 5: Final Documentation');
    console.log('3. ✅ Schedule stakeholder sign-off');
  } else if (verification.status === 'ERROR') {
    console.log('1. 🔧 Check database connection');
    console.log('2. 🔧 Verify Prisma migrations are current');
    console.log('3. ↻ Re-run verification');
  } else {
    console.log('1. ⚠️  Review failed checks above');
    console.log('2. 🔧 Fix data quality issues');
    console.log('3. ↻ Re-run verification');
  }
  
  console.log();
  console.log('='.repeat(60));
  
  // Save verification report
  const reportFile = path.join(IMPORTS_DIR, 'PHASE4_VERIFICATION_REPORT.json');
  fs.writeFileSync(reportFile, JSON.stringify(verification, null, 2));
  console.log(`\n💾 Report saved: PHASE4_VERIFICATION_REPORT.json`);
}

async function main() {
  console.log('\n');
  console.log('█'.repeat(60));
  console.log('║' + ' '.repeat(58) + '║');
  console.log('║' + '  PHASE 4.3: DATA VERIFICATION & VALIDATION'.padEnd(59) + '║');
  console.log('║' + ' '.repeat(58) + '║');
  console.log('█'.repeat(60));
  console.log();
  console.log('⏱️  Started at:', new Date().toLocaleString());
  console.log();
  
  try {
    await checkEmployeeData();
    await checkOrganizationalStructure();
    await checkLeaveData();
    await checkAssetData();
    await checkDataRelationships();
    
    await generateVerificationReport();
    
    console.log('\n⏱️  Completed at:', new Date().toLocaleString());
    console.log();
    
  } catch (err) {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
