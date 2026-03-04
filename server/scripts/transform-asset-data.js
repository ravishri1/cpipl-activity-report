#!/usr/bin/env node
/**
 * Transform Asset Register Data from CSV to CPIPL Schema
 * Input: exports/asset-register-export.csv (4 records)
 * Output: imports/asset-register-transformed.json
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const EXPORTS_DIR = path.join(__dirname, '../exports');
const IMPORTS_DIR = path.join(__dirname, '../imports');

if (!fs.existsSync(IMPORTS_DIR)) {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function transformAssetRecord(row) {
  return {
    // Asset identification
    assetId: row['Asset ID']?.trim(),
    assetName: row['Asset Name']?.trim(),
    assetType: row['Asset Type']?.trim(),
    category: row['Category']?.trim() || 'equipment',
    
    // Asset details
    serialNumber: row['Serial Number']?.trim() || null,
    assetTag: row['Asset Tag']?.trim() || null,
    manufacturer: row['Manufacturer']?.trim() || null,
    model: row['Model']?.trim() || null,
    
    // Financial
    purchaseDate: formatDate(row['Purchase Date']),
    purchasePrice: parseFloat(row['Purchase Price']) || 0,
    currentValue: parseFloat(row['Current Value']) || 0,
    depreciationRate: parseFloat(row['Depreciation Rate']) || 0,
    
    // Condition & status
    condition: row['Condition']?.trim() || 'good',
    status: row['Status']?.trim() || 'available',
    
    // Assignment
    assignedTo: row['Assigned To']?.trim() || null,
    assignedDate: formatDate(row['Assigned Date']),
    assignedFromDate: formatDate(row['From Date']),
    assignedToDate: formatDate(row['To Date']),
    
    // Additional
    location: row['Location']?.trim() || null,
    mandatoryReturn: row['Mandatory Return']?.toLowerCase() === 'true' || false,
    warranty: row['Warranty']?.trim() || null,
    warrantyExpiry: formatDate(row['Warranty Expiry']),
    notes: row['Notes']?.trim() || null
  };
}

function validateRecord(record, index) {
  const errors = [];
  
  if (!record.assetId) errors.push('Missing assetId');
  if (!record.assetName) errors.push('Missing assetName');
  if (!record.assetType) errors.push('Missing assetType');
  if (record.purchasePrice < 0) errors.push('Invalid purchasePrice');
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function transformData() {
  try {
    console.log('📊 PHASE 4: ASSET REGISTER TRANSFORMATION');
    console.log('=' .repeat(50));
    console.log();
    
    console.log('📂 Reading source data...');
    const csvFile = path.join(EXPORTS_DIR, 'asset-register-export.csv');
    
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
        const asset = transformAssetRecord(row);
        const validation = validateRecord(asset, index);
        
        if (validation.valid) {
          transformed.push(asset);
        } else {
          errors.push({
            row: index + 2,
            assetId: asset.assetId,
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
    
    // Analyze asset distribution
    const typeDistribution = {};
    const statusDistribution = {};
    
    transformed.forEach(asset => {
      typeDistribution[asset.assetType] = (typeDistribution[asset.assetType] || 0) + 1;
      statusDistribution[asset.status] = (statusDistribution[asset.status] || 0) + 1;
    });
    
    console.log('📈 Asset Distribution:');
    console.log('   By Type:');
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    console.log('   By Status:');
    Object.entries(statusDistribution).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    console.log();
    
    const qualityScore = (transformed.length / records.length) * 100;
    console.log(`📊 Data Quality: ${qualityScore.toFixed(1)}%`);
    if (qualityScore >= 90) {
      console.log(`✅ Quality meets threshold (≥90%)`);
    }
    console.log();
    
    console.log('💾 Writing transformed data...');
    const outputFile = path.join(IMPORTS_DIR, 'asset-register-transformed.json');
    fs.writeFileSync(
      outputFile,
      JSON.stringify({
        metadata: {
          transformDate: new Date().toISOString(),
          sourceFile: 'asset-register-export.csv',
          totalRecords: records.length,
          validRecords: transformed.length,
          invalidRecords: errors.length,
          qualityScore: qualityScore.toFixed(2),
          typeDistribution: typeDistribution,
          statusDistribution: statusDistribution,
          totalValue: transformed.reduce((sum, a) => sum + (a.purchasePrice || 0), 0),
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
   • Asset Types: ${Object.keys(typeDistribution).length}
   • Total Value: ₹${transformed.reduce((sum, a) => sum + (a.purchasePrice || 0), 0).toLocaleString('en-IN')}
   • Output: asset-register-transformed.json
    `);
    
  } catch (err) {
    console.error('❌ Transformation failed:', err.message);
    process.exit(1);
  }
}

transformData();
