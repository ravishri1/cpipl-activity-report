#!/usr/bin/env node
/**
 * Export Organizational Structure Script
 * Exports reporting hierarchy and organizational structure from CPIPL to CSV format
 * 
 * Usage: node scripts/export-org-structure.js [outputFile]
 * Default output: org-structure-export.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CSV field mapping for organizational structure
const CSV_FIELDS = [
  { field: 'employeeId', header: 'Employee ID' },
  { field: 'name', header: 'Employee Name' },
  { field: 'designation', header: 'Designation' },
  { field: 'department', header: 'Department' },
  { field: 'location', header: 'Location' },
  { field: 'grade', header: 'Grade/Level' },
  { field: 'email', header: 'Email' },
  { field: 'phone', header: 'Phone' },
  { field: 'reportingManagerId', header: 'Reporting Manager ID' },
  { field: 'reportingManagerName', header: 'Reporting Manager Name' },
  { field: 'reportingManagerDesignation', header: 'Reporting Manager Designation' },
  { field: 'subordinateCount', header: 'Number of Subordinates' },
  { field: 'employmentStatus', header: 'Employment Status' },
  { field: 'dateOfJoining', header: 'Date of Joining' },
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

async function exportOrgStructure(outputFile) {
  try {
    console.log('Starting organizational structure export...');
    
    // Fetch all active employees with reporting manager and subordinate info
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        reportingManager: {
          select: {
            employeeId: true,
            name: true,
            designation: true,
          }
        },
        subordinates: {
          select: { id: true }
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
        let value = '';
        
        if (field === 'reportingManagerId') value = emp.reportingManager?.employeeId || '';
        else if (field === 'reportingManagerName') value = emp.reportingManager?.name || '';
        else if (field === 'reportingManagerDesignation') value = emp.reportingManager?.designation || '';
        else if (field === 'subordinateCount') value = emp.subordinates.length;
        else value = emp[field];
        
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
    console.log(`✓ Total records: ${employees.length}`);
    console.log(`✓ File size: ${fileSize} KB`);

    // Analyze organizational structure
    const managersCount = employees.filter(e => e.subordinates.length > 0).length;
    const avgSubordinates = employees.length > 0 
      ? (employees.reduce((sum, e) => sum + e.subordinates.length, 0) / managersCount).toFixed(1)
      : 0;

    // Count by department
    const byDept = employees.reduce((acc, e) => {
      acc[e.department || 'Unassigned'] = (acc[e.department || 'Unassigned'] || 0) + 1;
      return acc;
    }, {});

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('ORGANIZATIONAL STRUCTURE EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Employees Exported: ${employees.length}`);
    console.log(`Fields per Record: ${CSV_FIELDS.length}`);
    console.log(`Output File: ${fullPath}`);
    console.log(`Export Date: ${new Date().toLocaleString()}`);
    console.log(`\nManagement Structure:`);
    console.log(`  Total Managers: ${managersCount}`);
    console.log(`  Avg Subordinates per Manager: ${avgSubordinates}`);
    console.log(`\nDepartment Breakdown:`);
    Object.entries(byDept).forEach(([dept, count]) => {
      console.log(`  ${dept}: ${count}`);
    });
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log(`\n✓ Successfully exported ${employees.length} organizational records`);

  } catch (error) {
    console.error('✗ Export failed: ', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const outputFile = process.argv[2] || 'org-structure-export.csv';
exportOrgStructure(outputFile);
