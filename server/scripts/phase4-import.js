#!/usr/bin/env node
/**
 * PHASE 4.2: Data Import Script
 * Imports transformed JSON data into CPIPL database
 * Requires: Prisma ORM, SQLite database, transformed JSON files
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const IMPORTS_DIR = path.join(__dirname, '../imports');
const prisma = new PrismaClient();

// Import tracking
const results = {
  timestamp: new Date().toISOString(),
  modules: {},
  errors: [],
  totalRecords: 0,
  successfulRecords: 0,
  failedRecords: 0
};

async function importEmployeeData() {
  console.log('\n📝 IMPORTING: Employee Master Data...');
  console.log('-'.repeat(60));
  
  try {
    const filePath = path.join(IMPORTS_DIR, 'employee-master-transformed.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Transformed file not found. Run phase4-execute.js first.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const employees = data.data;
    
    console.log(`📊 Found ${employees.length} employee records to import`);
    
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    for (const emp of employees) {
      try {
        // Check if employee already exists
        const existing = await prisma.user.findUnique({
          where: { email: emp.email }
        });
        
        if (existing) {
          console.log(`⚠️  Employee ${emp.employeeId} (${emp.email}) already exists - skipping`);
          continue;
        }
        
        // Create employee user record
        await prisma.user.create({
          data: {
            email: emp.email,
            name: emp.name,
            phone: emp.phone || '',
            designation: emp.designation,
            department: emp.department,
            dateOfJoining: emp.dateOfJoining,
            employeeId: emp.employeeId,
            role: emp.role || 'member',
            password: 'temp_password_123', // Temporary - user should change on first login
            
            // Personal details
            gender: emp.gender,
            dateOfBirth: emp.dateOfBirth,
            maritalStatus: emp.maritalStatus,
            personalEmail: emp.personalEmail,
            bloodGroup: emp.bloodGroup,
            
            // Address
            currentAddress: emp.currentAddress,
            permanentAddress: emp.permanentAddress,
            
            // Documents
            aadharNumber: emp.aadhaarNumber,
            panNumber: emp.panNumber,
            passportNumber: emp.passportNumber,
            drivingLicense: emp.drivingLicense,
            
            // Bank
            bankName: emp.bankName,
            bankAccountNumber: emp.bankAccountNumber,
            ifscCode: emp.ifscCode,
            uanNumber: emp.uanNumber,
            
            // Company
            location: emp.location,
            grade: emp.grade,
            noticePeriodDays: emp.noticePeriod,
            
            // Status
            status: emp.employmentStatus || 'active',
            isActive: emp.employmentStatus === 'active'
          }
        });
        
        imported++;
        console.log(`✅ Imported employee ${emp.employeeId}: ${emp.name}`);
        
      } catch (err) {
        failed++;
        errors.push({
          employeeId: emp.employeeId,
          error: err.message
        });
        console.log(`❌ Failed to import ${emp.employeeId}: ${err.message}`);
      }
    }
    
    results.modules.employees = {
      total: employees.length,
      imported: imported,
      failed: failed,
      status: failed === 0 ? 'SUCCESS' : 'PARTIAL'
    };
    
    results.totalRecords += employees.length;
    results.successfulRecords += imported;
    results.failedRecords += failed;
    
    if (errors.length > 0) {
      results.errors.push({
        module: 'employees',
        errors: errors
      });
    }
    
    console.log(`\n📊 Employee Import Summary:`);
    console.log(`   Total: ${employees.length}`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Status: ${results.modules.employees.status}`);
    
    return true;
    
  } catch (err) {
    console.error('❌ Employee import failed:', err.message);
    results.modules.employees = { status: 'FAILED', error: err.message };
    return false;
  }
}

async function importOrgStructure() {
  console.log('\n📝 IMPORTING: Organizational Structure...');
  console.log('-'.repeat(60));
  
  try {
    const filePath = path.join(IMPORTS_DIR, 'org-structure-transformed.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Transformed file not found.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const orgRecords = data.data;
    
    console.log(`📊 Found ${orgRecords.length} organization records to process`);
    
    let updated = 0;
    let failed = 0;
    const errors = [];
    
    for (const org of orgRecords) {
      try {
        // Find employee by ID
        const employee = await prisma.user.findUnique({
          where: { email: org.email || undefined },
          select: { id: true, employeeId: true }
        });
        
        if (!employee) {
          // Try to find by employeeId
          const empByEmpId = await prisma.user.findFirst({
            where: { employeeId: org.employeeId },
            select: { id: true }
          });
          
          if (!empByEmpId) {
            throw new Error(`Employee not found: ${org.employeeId}`);
          }
        }
        
        // Find reporting manager if specified
        let managerId = null;
        if (org.reportingManagerId) {
          const manager = await prisma.user.findFirst({
            where: { employeeId: org.reportingManagerId },
            select: { id: true }
          });
          managerId = manager?.id || null;
        }
        
        // Update employee with organization details
        await prisma.user.update({
          where: { employeeId: org.employeeId },
          data: {
            department: org.department,
            designation: org.designation,
            location: org.location,
            grade: org.grade,
            reportingManagerId: managerId
          }
        });
        
        updated++;
        console.log(`✅ Updated org structure for ${org.employeeId}`);
        
      } catch (err) {
        failed++;
        errors.push({
          employeeId: org.employeeId,
          error: err.message
        });
        console.log(`❌ Failed to update ${org.employeeId}: ${err.message}`);
      }
    }
    
    results.modules.orgStructure = {
      total: orgRecords.length,
      updated: updated,
      failed: failed,
      status: failed === 0 ? 'SUCCESS' : 'PARTIAL'
    };
    
    results.totalRecords += orgRecords.length;
    results.successfulRecords += updated;
    results.failedRecords += failed;
    
    if (errors.length > 0) {
      results.errors.push({
        module: 'orgStructure',
        errors: errors
      });
    }
    
    console.log(`\n📊 Org Structure Summary:`);
    console.log(`   Total: ${orgRecords.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Status: ${results.modules.orgStructure.status}`);
    
    return true;
    
  } catch (err) {
    console.error('❌ Org structure import failed:', err.message);
    results.modules.orgStructure = { status: 'FAILED', error: err.message };
    return false;
  }
}

async function importLeaveData() {
  console.log('\n📝 IMPORTING: Leave Configuration...');
  console.log('-'.repeat(60));
  
  try {
    const filePath = path.join(IMPORTS_DIR, 'leave-config-transformed.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Transformed file not found.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const leaves = data.data;
    
    console.log(`📊 Found ${leaves.length} leave balance records to import`);
    
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany();
    const leaveTypeMap = {};
    leaveTypes.forEach(lt => {
      leaveTypeMap[lt.name] = lt.id;
    });
    
    for (const leave of leaves) {
      try {
        // Find employee
        const employee = await prisma.user.findFirst({
          where: { employeeId: leave.employeeId },
          select: { id: true }
        });
        
        if (!employee) {
          throw new Error(`Employee not found: ${leave.employeeId}`);
        }
        
        // Get or find leave type
        let leaveTypeId = leaveTypeMap[leave.leaveType];
        if (!leaveTypeId) {
          // Create leave type if doesn't exist
          const createdType = await prisma.leaveType.create({
            data: {
              name: leave.leaveType,
              status: 'active'
            }
          });
          leaveTypeId = createdType.id;
          leaveTypeMap[leave.leaveType] = leaveTypeId;
        }
        
        // Check if leave balance already exists
        const existing = await prisma.leaveBalance.findFirst({
          where: {
            userId: employee.id,
            leaveTypeId: leaveTypeId,
            year: leave.year
          }
        });
        
        if (existing) {
          console.log(`⚠️  Leave balance exists for ${leave.employeeId} - ${leave.leaveType} - ${leave.year}`);
          continue;
        }
        
        // Create leave balance
        await prisma.leaveBalance.create({
          data: {
            userId: employee.id,
            leaveTypeId: leaveTypeId,
            year: leave.year,
            totalAllocated: leave.totalAllocated || 0,
            totalUsed: leave.totalUsed || 0,
            carryForward: leave.carryForward || 0,
            carryForwardUsed: leave.carryForwardUsed || 0
          }
        });
        
        imported++;
        console.log(`✅ Imported leave balance for ${leave.employeeId}: ${leave.leaveType}`);
        
      } catch (err) {
        failed++;
        errors.push({
          employeeId: leave.employeeId,
          leaveType: leave.leaveType,
          error: err.message
        });
        console.log(`❌ Failed to import leave for ${leave.employeeId}: ${err.message}`);
      }
    }
    
    results.modules.leaves = {
      total: leaves.length,
      imported: imported,
      failed: failed,
      status: failed === 0 ? 'SUCCESS' : 'PARTIAL'
    };
    
    results.totalRecords += leaves.length;
    results.successfulRecords += imported;
    results.failedRecords += failed;
    
    if (errors.length > 0) {
      results.errors.push({
        module: 'leaves',
        errors: errors
      });
    }
    
    console.log(`\n📊 Leave Import Summary:`);
    console.log(`   Total: ${leaves.length}`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Status: ${results.modules.leaves.status}`);
    
    return true;
    
  } catch (err) {
    console.error('❌ Leave import failed:', err.message);
    results.modules.leaves = { status: 'FAILED', error: err.message };
    return false;
  }
}

async function importAssetData() {
  console.log('\n📝 IMPORTING: Asset Register...');
  console.log('-'.repeat(60));
  
  try {
    const filePath = path.join(IMPORTS_DIR, 'asset-register-transformed.json');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Transformed file not found.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const assets = data.data;
    
    console.log(`📊 Found ${assets.length} asset records to import`);
    
    let imported = 0;
    let failed = 0;
    const errors = [];
    
    for (const asset of assets) {
      try {
        // Check if asset already exists
        const existing = await prisma.asset.findFirst({
          where: {
            assetTag: asset.assetTag || undefined,
            serialNumber: asset.serialNumber || undefined
          }
        });
        
        if (existing) {
          console.log(`⚠️  Asset ${asset.assetId} already exists - skipping`);
          continue;
        }
        
        // Find assigned employee if specified
        let assignedUserId = null;
        if (asset.assignedTo) {
          const user = await prisma.user.findFirst({
            where: { employeeId: asset.assignedTo },
            select: { id: true }
          });
          assignedUserId = user?.id || null;
        }
        
        // Create asset
        await prisma.asset.create({
          data: {
            name: asset.assetName,
            type: asset.assetType,
            category: asset.category || 'equipment',
            serialNumber: asset.serialNumber,
            assetTag: asset.assetTag,
            purchaseDate: asset.purchaseDate,
            purchasePrice: asset.purchasePrice || 0,
            condition: asset.condition || 'good',
            status: asset.status || 'available',
            location: asset.location,
            notes: asset.notes,
            warranty: asset.warranty,
            warrantyExpiry: asset.warrantyExpiry,
            
            // Assignment
            assignedTo: assignedUserId,
            assignedDate: asset.assignedDate,
            mandatoryReturn: asset.mandatoryReturn || false
          }
        });
        
        imported++;
        console.log(`✅ Imported asset ${asset.assetId}: ${asset.assetName}`);
        
      } catch (err) {
        failed++;
        errors.push({
          assetId: asset.assetId,
          error: err.message
        });
        console.log(`❌ Failed to import ${asset.assetId}: ${err.message}`);
      }
    }
    
    results.modules.assets = {
      total: assets.length,
      imported: imported,
      failed: failed,
      status: failed === 0 ? 'SUCCESS' : 'PARTIAL'
    };
    
    results.totalRecords += assets.length;
    results.successfulRecords += imported;
    results.failedRecords += failed;
    
    if (errors.length > 0) {
      results.errors.push({
        module: 'assets',
        errors: errors
      });
    }
    
    console.log(`\n📊 Asset Import Summary:`);
    console.log(`   Total: ${assets.length}`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Status: ${results.modules.assets.status}`);
    
    return true;
    
  } catch (err) {
    console.error('❌ Asset import failed:', err.message);
    results.modules.assets = { status: 'FAILED', error: err.message };
    return false;
  }
}

async function generateFinalReport() {
  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('📊 PHASE 4.2: IMPORT EXECUTION REPORT');
  console.log('='.repeat(60));
  console.log();
  
  console.log('📈 Import Results:');
  console.log();
  
  Object.entries(results.modules).forEach(([module, status]) => {
    const icon = status.status === 'SUCCESS' ? '✅' : status.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${icon} ${module}: ${status.status}`);
    if (status.total !== undefined) {
      console.log(`   Imported: ${status.imported || status.updated || 0}/${status.total}`);
      console.log(`   Failed: ${status.failed || 0}`);
    }
  });
  
  console.log();
  console.log('='.repeat(60));
  console.log('Overall Summary:');
  console.log(`   Total Records: ${results.totalRecords}`);
  console.log(`   Successful: ${results.successfulRecords}`);
  console.log(`   Failed: ${results.failedRecords}`);
  
  const successRate = results.totalRecords > 0 
    ? ((results.successfulRecords / results.totalRecords) * 100).toFixed(1)
    : 0;
  
  console.log(`   Success Rate: ${successRate}%`);
  console.log();
  
  if (results.failedRecords === 0) {
    console.log('✅ ALL DATA IMPORTED SUCCESSFULLY');
    results.status = 'SUCCESS';
  } else if (results.failedRecords < results.totalRecords) {
    console.log('⚠️  PARTIAL SUCCESS - Some records failed');
    results.status = 'PARTIAL';
  } else {
    console.log('❌ IMPORT FAILED - No records imported');
    results.status = 'FAILED';
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('Next Steps:');
  console.log();
  
  if (results.status === 'SUCCESS') {
    console.log('1. ✅ All data imported successfully');
    console.log('2. ✅ Run Phase 4.3 verification: node phase4-verify.js');
    console.log('3. ✅ Review verification report');
    console.log('4. ✅ Proceed to Phase 5 documentation');
  } else {
    console.log('1. ⚠️  Review import errors above');
    console.log('2. 🔧 Fix source data or database issues');
    console.log('3. ↻ Re-run import for failed records');
    console.log('4. 📋 Check import report for details');
  }
  
  console.log();
  console.log('='.repeat(60));
  
  // Save report
  const reportFile = path.join(IMPORTS_DIR, 'PHASE4_IMPORT_REPORT.json');
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Report saved: PHASE4_IMPORT_REPORT.json`);
}

async function main() {
  console.log('\n');
  console.log('█'.repeat(60));
  console.log('║' + ' '.repeat(58) + '║');
  console.log('║' + '  PHASE 4.2: DATA IMPORT EXECUTION'.padEnd(59) + '║');
  console.log('║' + ' '.repeat(58) + '║');
  console.log('█'.repeat(60));
  console.log();
  console.log('⏱️  Started at:', new Date().toLocaleString());
  console.log();
  
  try {
    // Execute imports in order
    await importEmployeeData();
    await importOrgStructure();
    await importLeaveData();
    await importAssetData();
    
    // Generate final report
    await generateFinalReport();
    
    console.log('\n⏱️  Completed at:', new Date().toLocaleString());
    console.log();
    
  } catch (err) {
    console.error('Fatal error:', err);
    results.fatalError = err.message;
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
