#!/usr/bin/env node
/**
 * Transform Employee Master Data from CSV to CPIPL Schema
 * Input: exports/employee-master-data-export.csv (41 records)
 * Output: imports/employee-master-transformed.json
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const EXPORTS_DIR = path.join(__dirname, '../exports');
const IMPORTS_DIR = path.join(__dirname, '../imports');

// Ensure imports directory exists
if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Handle various date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function parseEmploymentType(type) {
  const map = {
    'full_time': 'full_time',
    'part_time': 'part_time',
    'contract': 'contract',
    'temporary': 'temporary'
  };
  return map[type?.toLowerCase()] || 'full_time';
}

function transformEmployeeRecord(row) {
  return {
    // Core identification
    employeeId: row['Employee ID']?.trim(),
    name: row['Employee Name']?.trim(),
    email: row['Official Email']?.trim(),
    phone: row['Phone Number']?.trim(),
    personalEmail: row['Personal Email']?.trim() || null,
    
    // Employment details
    designation: row['Designation']?.trim(),
    department: row['Department']?.trim(),
    employmentType: parseEmploymentType(row['Employment Type']),
    employmentStatus: row['Employment Status']?.toLowerCase() || 'active',
    dateOfJoining: formatDate(row['Date of Joining']),
    confirmationDate: formatDate(row['Confirmation Date']),
    probationEndDate: formatDate(row['Probation End Date']),
    noticePeriod: parseInt(row['Notice Period (Days)']) || 30,
    previousExperience: parseInt(row['Previous Experience']) || 0,
    
    // Location & grade
    location: row['Location']?.trim() || 'Unknown',
    grade: row['Grade']?.trim() || null,
    role: row['Role']?.toLowerCase() || 'member',
    
    // Personal details
    dateOfBirth: formatDate(row['Date of Birth']),
    gender: row['Gender']?.trim() || null,
    maritalStatus: row['Marital Status']?.trim() || null,
    bloodGroup: row['Blood Group']?.trim() || null,
    nationality: row['Nationality']?.trim() || 'Indian',
    
    // Family
    fathersName: row['Father\'s Name']?.trim() || null,
    spouseName: row['Spouse Name']?.trim() || null,
    religion: row['Religion']?.trim() || null,
    placeOfBirth: row['Place of Birth']?.trim() || null,
    
    // Address
    currentAddress: row['Current Address']?.trim() || null,
    permanentAddress: row['Permanent Address']?.trim() || null,
    
    // Documents
    aadhaarNumber: row['Aadhaar Number']?.trim() || null,
    panNumber: row['PAN Number']?.trim() || null,
    passportNumber: row['Passport Number']?.trim() || null,
    passportExpiry: formatDate(row['Passport Expiry']),
    drivingLicense: row['Driving License']?.trim() || null,
    
    // Bank details
    bankName: row['Bank Name']?.trim() || null,
    bankAccountNumber: row['Bank Account Number']?.trim() || null,
    bankBranch: row['Bank Branch']?.trim() || null,
    ifscCode: row['IFSC Code']?.trim() || null,
    uanNumber: row['UAN Number']?.trim() || null,
    
    // Management
    reportingManager: row['Reporting Manager']?.trim() || null,
    emergencyContact: row['Emergency Contact']?.trim() || null
  };
}

function validateRecord(record, index) {
  const errors = [];
  
  if (!record.employeeId) errors.push('Missing employeeId');
  if (!record.name) errors.push('Missing name');
  if (!record.email) errors.push('Missing email');
  if (!record.designation) errors.push('Missing designation');
  if (!record.department) errors.push('Missing department');
  if (!record.dateOfJoining) errors.push('Invalid dateOfJoining');
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function transformData() {
  try {
    console.log('📊 PHASE 4: EMPLOYEE DATA TRANSFORMATION');
    console.log('=' .repeat(50));
    console.log();
    
    // Read CSV file
    console.log('📂 Reading source data...');
    const csvFile = path.join(EXPORTS_DIR, 'employee-master-data-export.csv');
    
    if (!fs.existsSync(csvFile)) {
      throw new Error(`CSV file not found: ${csvFile}`);
    }
    
    const csvContent = fs.readFileSync(csvFile, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`✅ Read ${records.length} records from CSV\n`);
    
    // Transform records
    console.log('🔄 Transforming data...');
    const transformed = [];
    const errors = [];
    
    records.forEach((row, index) => {
      try {
        const employee = transformEmployeeRecord(row);
        const validation = validateRecord(employee, index);
        
        if (validation.valid) {
          transformed.push(employee);
        } else {
          errors.push({
            row: index + 2, // +2 because CSV has header
            employeeId: employee.employeeId,
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
    
    // Calculate data quality
    const qualityScore = (transformed.length / records.length) * 100;
    console.log(`📈 Data Quality: ${qualityScore.toFixed(1)}%`);
    
    if (qualityScore < 90) {
      console.log(`⚠️  WARNING: Quality below 90% threshold!`);
    } else {
      console.log(`✅ Quality meets threshold (≥90%)`);
    }
    console.log();
    
    // Write output
    console.log('💾 Writing transformed data...');
    const outputFile = path.join(IMPORTS_DIR, 'employee-master-transformed.json');
    fs.writeFileSync(
      outputFile,
      JSON.stringify({
        metadata: {
          transformDate: new Date().toISOString(),
          sourceFile: 'employee-master-data-export.csv',
          totalRecords: records.length,
          validRecords: transformed.length,
          invalidRecords: errors.length,
          qualityScore: qualityScore.toFixed(2),
          version: '1.0'
        },
        data: transformed,
        errors: errors
      }, null, 2)
    );
    
    console.log(`✅ Saved to: ${outputFile}`);
    console.log();
    
    // Summary
    console.log('=' .repeat(50));
    console.log('✅ TRANSFORMATION COMPLETE');
    console.log('=' .repeat(50));
    console.log(`
📊 Summary:
   • Total records: ${records.length}
   • Valid: ${transformed.length}
   • Invalid: ${errors.length}
   • Quality: ${qualityScore.toFixed(1)}%
   • Output file: employee-master-transformed.json
   
🚀 Ready for import!
    `);
    
  } catch (err) {
    console.error('❌ Transformation failed:', err.message);
    process.exit(1);
  }
}

transformData();
