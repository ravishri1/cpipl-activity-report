#!/usr/bin/env node
/**
 * Transform Organizational Structure Data from CSV to CPIPL Schema
 * Input: exports/org-structure-export.csv (41 records)
 * Output: imports/org-structure-transformed.json
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const EXPORTS_DIR = path.join(__dirname, '../exports');
const IMPORTS_DIR = path.join(__dirname, '../imports');

if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function transformOrgRecord(row) {
  return {
    // Employee identification
    employeeId: row['Employee ID']?.trim(),
    employeeName: row['Employee Name']?.trim(),
    
    // Job details
    designation: row['Designation']?.trim(),
    department: row['Department']?.trim(),
    location: row['Location']?.trim() || null,
    
    // Management hierarchy
    reportingManagerId: row['Reporting Manager ID']?.trim() || null,
    reportingManagerName: row['Reporting Manager Name']?.trim() || null,
    subordinateCount: parseInt(row['Subordinate Count']) || 0,
    
    // Organization details
    level: row['Level']?.trim() || 'individual_contributor',
    grade: row['Grade']?.trim() || null,
    costCenter: row['Cost Center']?.trim() || null,
    status: 'active'
  };
}

function validateRecord(record, index) {
  const errors = [];
  
  if (!record.employeeId) errors.push('Missing employeeId');
  if (!record.employeeName) errors.push('Missing employeeName');
  if (!record.designation) errors.push('Missing designation');
  if (!record.department) errors.push('Missing department');
  if (record.subordinateCount < 0) errors.push('Invalid subordinateCount');
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function transformData() {
  try {
    console.log('📊 PHASE 4: ORGANIZATIONAL STRUCTURE TRANSFORMATION');
    console.log('=' .repeat(50));
    console.log();
    
    console.log('📂 Reading source data...');
    const csvFile = path.join(EXPORTS_DIR, 'org-structure-export.csv');
    
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
        const org = transformOrgRecord(row);
        const validation = validateRecord(org, index);
        
        if (validation.valid) {
          transformed.push(org);
        } else {
          errors.push({
            row: index + 2,
            employeeId: org.employeeId,
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
      console.log(`⚠️  ${errors.length} records had validation errors`);
    }
    console.log();
    
    // Analyze organizational structure
    const departments = {};
    const managers = {};
    let totalSubordinates = 0;
    
    transformed.forEach(record => {
      // Department distribution
      departments[record.department] = (departments[record.department] || 0) + 1;
      
      // Manager tracking
      if (record.reportingManagerId && record.reportingManagerId !== '') {
        managers[record.reportingManagerId] = (managers[record.reportingManagerId] || 0) + 1;
      }
      
      // Total subordinates
      totalSubordinates += record.subordinateCount || 0;
    });
    
    console.log('📈 Organizational Analysis:');
    console.log(`   Total Departments: ${Object.keys(departments).length}`);
    console.log(`   Total Managers: ${Object.keys(managers).length}`);
    console.log(`   Total Subordinates: ${totalSubordinates}`);
    console.log();
    
    console.log('   Top Departments:');
    Object.entries(departments)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([dept, count]) => {
        console.log(`     ${dept}: ${count} employees`);
      });
    console.log();
    
    const qualityScore = (transformed.length / records.length) * 100;
    console.log(`📊 Data Quality: ${qualityScore.toFixed(1)}%`);
    if (qualityScore >= 90) {
      console.log(`✅ Quality meets threshold (≥90%)`);
    }
    console.log();
    
    console.log('💾 Writing transformed data...');
    const outputFile = path.join(IMPORTS_DIR, 'org-structure-transformed.json');
    fs.writeFileSync(
      outputFile,
      JSON.stringify({
        metadata: {
          transformDate: new Date().toISOString(),
          sourceFile: 'org-structure-export.csv',
          totalRecords: records.length,
          validRecords: transformed.length,
          invalidRecords: errors.length,
          qualityScore: qualityScore.toFixed(2),
          departments: Object.keys(departments).length,
          managers: Object.keys(managers).length,
          totalSubordinates: totalSubordinates,
          departmentDistribution: departments,
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
   • Departments: ${Object.keys(departments).length}
   • Management levels: ${Object.keys(managers).length}
   • Output: org-structure-transformed.json
    `);
    
  } catch (err) {
    console.error('❌ Transformation failed:', err.message);
    process.exit(1);
  }
}

transformData();
