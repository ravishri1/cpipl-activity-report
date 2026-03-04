#!/usr/bin/env node
/**
 * Transform Leave Configuration Data from CSV to CPIPL Schema
 * Input: exports/leave-config-export.csv (72 records)
 * Output: imports/leave-config-transformed.json
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const EXPORTS_DIR = path.join(__dirname, '../exports');
const IMPORTS_DIR = path.join(__dirname, '../imports');

if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function transformLeaveRecord(row) {
  return {
    // Employee identification
    employeeId: row['Employee ID']?.trim(),
    employeeName: row['Employee Name']?.trim(),
    
    // Leave details
    leaveType: row['Leave Type']?.trim(),
    year: parseInt(row['Year']) || new Date().getFullYear(),
    
    // Balances
    totalAllocated: parseFloat(row['Total Allocated']) || 0,
    totalUsed: parseFloat(row['Total Used']) || 0,
    balance: parseFloat(row['Balance']) || 0,
    
    // Carry forward info
    carryForward: parseFloat(row['Carry Forward']) || 0,
    carryForwardUsed: parseFloat(row['Carry Forward Used']) || 0,
    carryForwardBalance: parseFloat(row['Carry Forward Balance']) || 0,
    
    // Additional details
    department: row['Department']?.trim() || null,
    designation: row['Designation']?.trim() || null,
    leaveStatus: 'active'
  };
}

function validateRecord(record, index) {
  const errors = [];
  
  if (!record.employeeId) errors.push('Missing employeeId');
  if (!record.leaveType) errors.push('Missing leaveType');
  if (record.totalAllocated < 0) errors.push('Invalid totalAllocated');
  if (record.totalUsed < 0) errors.push('Invalid totalUsed');
  if (record.balance < 0) errors.push('Invalid balance');
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function transformData() {
  try {
    console.log('📊 PHASE 4: LEAVE CONFIGURATION TRANSFORMATION');
    console.log('=' .repeat(50));
    console.log();
    
    console.log('📂 Reading source data...');
    const csvFile = path.join(EXPORTS_DIR, 'leave-config-export.csv');
    
    if (!fs.existsSync(csvFile)) {
      throw new Error(`CSV file not found: ${csvFile}`);
    }
    
    const csvContent = fs.readFileSync(csvFile, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`✅ Read ${records.length} records from CSV\n`);
    
    console.log('🔄 Transforming data...');
    const transformed = [];
    const errors = [];
    
    records.forEach((row, index) => {
      try {
        const leaveRecord = transformLeaveRecord(row);
        const validation = validateRecord(leaveRecord, index);
        
        if (validation.valid) {
          transformed.push(leaveRecord);
        } else {
          errors.push({
            row: index + 2,
            employeeId: leaveRecord.employeeId,
            errors: validation.errors
          });
        }
      } catch (err) {
        errors.push({
          row: index + 2,
          error: err.message
        });
      }
    });
    
    console.log(`✅ Transformed ${transformed.length} records`);
    
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} records had validation errors:`);
      errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.errors?.join(', ') || err.error}`);
      });
    }
    console.log();
    
    // Analyze leave types
    const leaveTypes = {};
    transformed.forEach(rec => {
      leaveTypes[rec.leaveType] = (leaveTypes[rec.leaveType] || 0) + 1;
    });
    
    console.log('📈 Leave Type Distribution:');
    Object.entries(leaveTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} records`);
    });
    console.log();
    
    const qualityScore = (transformed.length / records.length) * 100;
    console.log(`📊 Data Quality: ${qualityScore.toFixed(1)}%`);
    if (qualityScore >= 90) {
      console.log(`✅ Quality meets threshold (≥90%)`);
    }
    console.log();
    
    console.log('💾 Writing transformed data...');
    const outputFile = path.join(IMPORTS_DIR, 'leave-config-transformed.json');
    fs.writeFileSync(
      outputFile,
      JSON.stringify({
        metadata: {
          transformDate: new Date().toISOString(),
          sourceFile: 'leave-config-export.csv',
          totalRecords: records.length,
          validRecords: transformed.length,
          invalidRecords: errors.length,
          qualityScore: qualityScore.toFixed(2),
          leaveTypes: leaveTypes,
          version: '1.0'
        },
        data: transformed,
        errors: errors
      }, null, 2)
    );
    
    console.log(`✅ Saved to: ${outputFile}`);
    console.log();
    
    console.log('=' .repeat(50));
    console.log('✅ TRANSFORMATION COMPLETE');
    console.log('=' .repeat(50));
    console.log(`
📊 Summary:
   • Total records: ${records.length}
   • Valid: ${transformed.length}
   • Invalid: ${errors.length}
   • Quality: ${qualityScore.toFixed(1)}%
   • Leave Types: ${Object.keys(leaveTypes).length}
   • Output: leave-config-transformed.json
    `);
    
  } catch (err) {
    console.error('❌ Transformation failed:', err.message);
    process.exit(1);
  }
}

transformData();
