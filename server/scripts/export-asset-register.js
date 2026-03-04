#!/usr/bin/env node
/**
 * Export Asset Register Script
 * Exports all assets and their allocations from CPIPL to CSV format
 * 
 * Usage: node scripts/export-asset-register.js [outputFile]
 * Default output: asset-register-export.csv
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// CSV field mapping for asset register
const CSV_FIELDS = [
  { field: 'assetId', header: 'Asset ID' },
  { field: 'name', header: 'Asset Name' },
  { field: 'type', header: 'Asset Type' },
  { field: 'serialNumber', header: 'Serial Number' },
  { field: 'assetTag', header: 'Asset Tag' },
  { field: 'category', header: 'Category' },
  { field: 'purchaseDate', header: 'Purchase Date' },
  { field: 'value', header: 'Value (₹)' },
  { field: 'warrantyExpiry', header: 'Warranty Expiry' },
  { field: 'warrantyVendor', header: 'Warranty Vendor' },
  { field: 'condition', header: 'Condition' },
  { field: 'status', header: 'Status' },
  { field: 'assignedToEmployeeId', header: 'Assigned to Employee ID' },
  { field: 'assignedToName', header: 'Assigned to Name' },
  { field: 'assignedDate', header: 'Assignment Date' },
  { field: 'returnDate', header: 'Return Date' },
  { field: 'location', header: 'Location' },
  { field: 'isMandatoryReturn', header: 'Mandatory Return' },
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

async function exportAssetRegister(outputFile) {
  try {
    console.log('Starting asset register export...');
    
    // Fetch all assets with assignment info
    const assets = await prisma.asset.findMany({
      include: {
        assignee: {
          select: {
            employeeId: true,
            name: true,
          }
        },
        company: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { id: 'asc' },
    });

    console.log(`✓ Fetched ${assets.length} assets`);

    // Build CSV content
    const headers = CSV_FIELDS.map(f => f.header).join(',');
    const rows = assets.map((asset, index) => {
      const row = {};
      CSV_FIELDS.forEach(({ field, header }) => {
        let value = '';
        
        if (field === 'assetId') value = asset.id;
        else if (field === 'assignedToEmployeeId') value = asset.assignee?.employeeId || '';
        else if (field === 'assignedToName') value = asset.assignee?.name || '';
        else if (field === 'isMandatoryReturn') value = asset.isMandatoryReturn ? 'Yes' : 'No';
        else value = asset[field];
        
        // Format currency fields
        if (field === 'value' && value && !isNaN(value)) {
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
    console.log(`✓ Total records: ${assets.length}`);
    console.log(`✓ File size: ${fileSize} KB`);

    // Analyze asset distribution
    const byStatus = assets.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('ASSET REGISTER EXPORT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Assets Exported: ${assets.length}`);
    console.log(`Fields per Record: ${CSV_FIELDS.length}`);
    console.log(`Output File: ${fullPath}`);
    console.log(`Export Date: ${new Date().toLocaleString()}`);
    console.log('\nAsset Status Breakdown:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log(`\n✓ Successfully exported ${assets.length} asset records`);

  } catch (error) {
    console.error('✗ Export failed: ', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const outputFile = process.argv[2] || 'asset-register-export.csv';
exportAssetRegister(outputFile);
