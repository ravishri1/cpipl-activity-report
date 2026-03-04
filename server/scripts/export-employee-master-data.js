#!/usr/bin/env node
/**
 * Export Employee Master Data Script
 * Exports all active employee data from CPIPL to CSV format for greytHR migration
 * 
 * Usage: node scripts/export-employee-master-data.js [outputFile]
 * Default output: employee-master-data-export.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CSV field mapping - CPIPL fields to CSV column headers
const CSV_FIELDS = [
  // Basic Information
  { field: 'employeeId', header: 'Employee ID' },
  { field: 'name', header: 'Employee Name' },
  { field: 'email', header: 'Official Email' },
  { field: 'phone', header: 'Phone Number' },
  { field: 'personalEmail', header: 'Personal Email' },
  
  // Employment Details
  { field: 'designation', header: 'Designation' },
  { field: 'department', header: 'Department' },
  { field: 'employmentType', header: 'Employment Type' },
  { field: 'employmentStatus', header: 'Employment Status' },
  { field: 'dateOfJoining', header: 'Date of Joining' },
  { field: 'confirmationDate', header: 'Confirmation Date' },
  { field: 'probationEndDate', header: 'Probation End Date' },
  { field: 'noticePeriodDays', header: 'Notice Period (Days)' },
  { field: 'previousExperience', header: 'Previous Experience' },
  { field: 'location', header: 'Location' },
  { field: 'grade', header: 'Grade' },
  { field: 'role', header: 'Role' },
  
  // Personal Information
  { field: 'dateOfBirth', header: 'Date of Birth' },
  { field: 'gender', header: 'Gender' },
  { field: 'maritalStatus', header: 'Marital Status' },
  { field: 'bloodGroup', header: 'Blood Group' },
  { field: 'nationality', header: 'Nationality' },
  { field: 'fatherName', header: "Father's Name" },
  { field: 'spouseName', header: 'Spouse Name' },
  { field: 'religion', header: 'Religion' },
  { field: 'placeOfBirth', header: 'Place of Birth' },
  
  // Address Information
  { field: 'address', header: 'Current Address' },
  { field: 'permanentAddress', header: 'Permanent Address' },
  
  // Identity Documents
  { field: 'aadhaarNumber', header: 'Aadhaar Number' },
  { field: 'panNumber', header: 'PAN Number' },
  { field: 'passportNumber', header: 'Passport Number' },
  { field: 'passportExpiry', header: 'Passport Expiry' },
  { field: 'drivingLicense', header: 'Driving License' },
  
  // Financial Details
  { field: 'bankName', header: 'Bank Name' },
  { field: 'bankAccountNumber', header: 'Bank Account Number' },
  { field: 'bankBranch', header: 'Bank Branch' },
  { field: 'bankIfscCode', header: 'IFSC Code' },
  { field: 'uanNumber', header: 'UAN Number' },
  
  // Organization
  { field: 'reportingManager', header: 'Reporting Manager' },
  { field: 'emergencyContact', header: 'Emergency Contact' },
];

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value).trim();
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function exportEmployeeData(outputFile) {
  try {
    console.log('Starting employee master data export...');
    
    // Fetch all active employees with full profile data
    const employees = await prisma.user.findMany({
      where: { 
        isActive: true,
      },
      include: {
        company: {
          select: { name: true }
        },
        familyMembers: {
          where: { relationship: 'spouse' },
          take: 1,
          select: { name: true }
        },
        educations: {
          select: { id: true, institution: true, degree: true, specialization: true, yearOfPassing: true, percentage: true }
        },
        previousEmployments: {
          select: { id: true, company: true, designation: true, fromDate: true, toDate: true, ctc: true, reasonForLeaving: true }
        },
        documents: {
          select: { id: true, type: true, name: true, fileUrl: true }
        },
      },
      orderBy: { employeeId: 'asc' },
    });

    console.log(`✓ Fetched ${employees.length} active employees`);

    // Build CSV content
    const headers = CSV_FIELDS.map(f => f.header).join(',');
    const rows = employees.map(emp => {
      const row = {};
      CSV_FIELDS.forEach(({ field, header }) => {
        let value = emp[field];
        
        // Special handling for reporting manager
        if (field === 'reportingManager' && emp.reportingManagerId) {
          // Would need to join with manager user - for now, store ID
          value = emp.reportingManagerId;
        }
        
        // Format dates
        if ((field === 'dateOfJoining' || field === 'dateOfBirth' || 
             field === 'confirmationDate' || field === 'probationEndDate' || 
             field === 'passportExpiry') && value) {
          value = value;  // Already in YYYY-MM-DD format
        }
        
        row[header] = escapeCSV(value);
      });
      
      return CSV_FIELDS.map(f => row[f.header]).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');

    // Write to file
    fs.writeFileSync(outputFile, csvContent, 'utf8');
    
    console.log(`✓ Export complete: ${outputFile}`);
    console.log(`✓ Total records: ${employees.length}`);
    console.log(`✓ File size: ${(csvContent.length / 1024).toFixed(2)} KB`);

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Employees Exported: ${employees.length}`);
    console.log(`Fields per Record: ${CSV_FIELDS.length}`);
    console.log(`Output File: ${path.resolve(outputFile)}`);
    console.log(`Export Date: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════');

    return employees.length;
  } catch (error) {
    console.error('✗ Export failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const outputFile = process.argv[2] || path.join(__dirname, '../exports/employee-master-data-export.csv');

// Ensure exports directory exists
const exportsDir = path.dirname(outputFile);
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
  console.log(`✓ Created exports directory: ${exportsDir}`);
}

exportEmployeeData(outputFile).then(count => {
  console.log(`\n✓ Successfully exported ${count} employee records`);
  process.exit(0);
});
