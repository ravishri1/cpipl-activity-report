#!/usr/bin/env node
/**
 * Export Payroll Configuration Script
 * Exports salary structures and payroll configuration from CPIPL to CSV format
 * 
 * Usage: node scripts/export-payroll-config.js [outputFile]
 * Default output: payroll-config-export.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CSV field mapping - CPIPL salary structure fields to CSV column headers
const CSV_FIELDS = [
  { field: 'employeeId', header: 'Employee ID' },
  { field: 'employeeName', header: 'Employee Name' },
  { field: 'ctcAnnual', header: 'CTC Annual' },
  { field: 'ctcMonthly', header: 'CTC Monthly' },
  { field: 'basic', header: 'Basic Salary' },
  { field: 'hra', header: 'HRA' },
  { field: 'da', header: 'Dearness Allowance (DA)' },
  { field: 'specialAllowance', header: 'Special Allowance' },
  { field: 'medicalAllowance', header: 'Medical Allowance' },
  { field: 'conveyanceAllowance', header: 'Conveyance Allowance' },
  { field: 'otherAllowance', header: 'Other Allowance' },
  { field: 'otherAllowanceLabel', header: 'Other Allowance Label' },
  { field: 'employerPf', header: 'Employer PF Contribution' },
  { field: 'employerEsi', header: 'Employer ESI Contribution' },
  { field: 'employeePf', header: 'Employee PF Deduction' },
  { field: 'employeeEsi', header: 'Employee ESI Deduction' },
  { field: 'professionalTax', header: 'Professional Tax' },
  { field: 'tds', header: 'TDS' },
  { field: 'netPayMonthly', header: 'Net Pay Monthly' },
  { field: 'effectiveFrom', header: 'Effective From' },
  { field: 'notes', header: 'Notes' },
];

function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function exportPayrollConfig(outputFile) {
  try {
    console.log('Starting payroll configuration export...');
    
    // Fetch all salary structures
    const salaryStructures = await prisma.salaryStructure.findMany({
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
            isActive: true,
          }
        }
      },
      orderBy: { userId: 'asc' },
    });

    // Filter: only active employees' salary structures
    const activeSalaries = salaryStructures.filter(s => s.user.isActive);
    console.log(`✓ Fetched ${activeSalaries.length} active employee salary structures`);

    // Build CSV content
    const headers = CSV_FIELDS.map(f => f.header).join(',');
    const rows = activeSalaries.map(salary => {
      const row = {};
      CSV_FIELDS.forEach(({ field, header }) => {
        let value = '';
        
        if (field === 'employeeId') value = salary.user.employeeId;
        else if (field === 'employeeName') value = salary.user.name;
        else value = salary[field];
        
        // Format currency fields to 2 decimal places
        if (['ctcAnnual', 'ctcMonthly', 'basic', 'hra', 'da', 'specialAllowance',
              'medicalAllowance', 'conveyanceAllowance', 'otherAllowance',
              'employerPf', 'employerEsi', 'employeePf', 'employeeEsi',
              'professionalTax', 'tds', 'netPayMonthly'].includes(field) && value) {
          value = parseFloat(value).toFixed(2);
        }
        
        row[header] = escapeCSV(value);
      });
      
      return CSV_FIELDS.map(f => row[f.header]).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
      console.log(`✓ Created exports directory: ${exportsDir}`);
    }

    // Write to file
    const fullPath = path.join(exportsDir, outputFile);
    fs.writeFileSync(fullPath, csvContent, 'utf-8');

    const fileSize = (fs.statSync(fullPath).size / 1024).toFixed(2);
    console.log(`✓ Export complete: ${fullPath}`);
    console.log(`✓ Total records: ${activeSalaries.length}`);
    console.log(`✓ File size: ${fileSize} KB`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('PAYROLL CONFIGURATION EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Salary Structures Exported: ${activeSalaries.length}`);
    console.log(`Fields per Record: ${CSV_FIELDS.length}`);
    console.log(`Output File: ${fullPath}`);
    console.log(`Export Date: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log(`\n✓ Successfully exported ${activeSalaries.length} payroll configuration records`);

  } catch (error) {
    console.error('✗ Export failed: ', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const outputFile = process.argv[2] || 'payroll-config-export.csv';
exportPayrollConfig(outputFile);
