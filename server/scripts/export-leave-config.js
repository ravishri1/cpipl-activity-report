#!/usr/bin/env node
/**
 * Export Leave Configuration Script
 * Exports leave types and employee leave balances from CPIPL to CSV format
 * 
 * Usage: node scripts/export-leave-config.js [outputFile]
 * Default output: leave-config-export.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CSV field mapping for leave configuration
const CSV_FIELDS = [
  { field: 'employeeId', header: 'Employee ID' },
  { field: 'employeeName', header: 'Employee Name' },
  { field: 'leaveType', header: 'Leave Type' },
  { field: 'year', header: 'Year' },
  { field: 'total', header: 'Total Allocated' },
  { field: 'used', header: 'Used' },
  { field: 'balance', header: 'Balance' },
  { field: 'carryForward', header: 'Carry Forward Available' },
  { field: 'maxCarryForward', header: 'Max Carry Forward' },
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

async function exportLeaveConfig(outputFile) {
  try {
    console.log('Starting leave configuration export...');
    
    // Fetch all leave balances with leave type and user info
    const leaveBalances = await prisma.leaveBalance.findMany({
      include: {
        user: {
          select: {
            employeeId: true,
            name: true,
            isActive: true,
          }
        },
        leaveType: {
          select: {
            name: true,
            carryForward: true,
            maxCarryForward: true,
          }
        }
      },
      orderBy: [{ userId: 'asc' }, { year: 'desc' }],
    });

    // Filter: only active employees
    const activeBalances = leaveBalances.filter(b => b.user.isActive);
    console.log(`✓ Fetched ${activeBalances.length} active employee leave balances`);

    // Build CSV content
    const headers = CSV_FIELDS.map(f => f.header).join(',');
    const rows = activeBalances.map(balance => {
      const row = {};
      CSV_FIELDS.forEach(({ field, header }) => {
        let value = '';
        
        if (field === 'employeeId') value = balance.user.employeeId;
        else if (field === 'employeeName') value = balance.user.name;
        else if (field === 'leaveType') value = balance.leaveType.name;
        else if (field === 'carryForward') value = balance.leaveType.carryForward ? 'Yes' : 'No';
        else if (field === 'maxCarryForward') value = balance.leaveType.maxCarryForward;
        else value = balance[field];
        
        // Format numeric fields to 2 decimal places
        if (['total', 'used', 'balance', 'maxCarryForward'].includes(field) && value && !isNaN(value)) {
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
    console.log(`✓ Total records: ${activeBalances.length}`);
    console.log(`✓ File size: ${fileSize} KB`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('LEAVE CONFIGURATION EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Leave Balance Records Exported: ${activeBalances.length}`);
    console.log(`Fields per Record: ${CSV_FIELDS.length}`);
    console.log(`Output File: ${fullPath}`);
    console.log(`Export Date: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log(`\n✓ Successfully exported ${activeBalances.length} leave configuration records`);

  } catch (error) {
    console.error('✗ Export failed: ', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const outputFile = process.argv[2] || 'leave-config-export.csv';
exportLeaveConfig(outputFile);
