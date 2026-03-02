/**
 * Import greytHR employee data (bank, Aadhaar) into existing users
 * Run: cd server && node scripts/importGreytHRData.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

const DATA_DIR = 'C:\\Users\\91992\\Downloads';

async function importBankDetails() {
  console.log('\n📊 Importing Bank Details...');
  const filePath = path.join(DATA_DIR, 'Bank_details.xls');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Use raw array mode — header is in row 1, data starts row 2
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = allRows.slice(2); // skip title row + header row

  let updated = 0, skipped = 0;

  for (const row of dataRows) {
    const empId = String(row[0] || '').trim();
    const bankName = String(row[2] || '').trim();
    const accountNumber = String(row[3] || '').trim();
    const ifscCode = String(row[4] || '').trim();

    if (!empId || !accountNumber) { skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { employeeId: empId } });
    if (!user) {
      console.log(`  ⚠️  Employee ${empId} not found in DB — skipping`);
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        bankName: bankName || null,
        bankAccountNumber: accountNumber || null,
        bankIfscCode: ifscCode || null,
      },
    });
    updated++;
  }

  console.log(`  ✅ Bank details: ${updated} updated, ${skipped} skipped`);
}

async function importAadhaarDetails() {
  console.log('\n📊 Importing Aadhaar Details...');
  const filePath = path.join(DATA_DIR, 'Aadhar_details.xls');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const dataRows = allRows.slice(2); // skip title row + header row

  let updated = 0, skipped = 0;

  for (const row of dataRows) {
    const empId = String(row[0] || '').trim();
    const aadhaar = String(row[2] || '').trim();

    // All Aadhaar numbers are masked (************) in greytHR export — skip masked ones
    if (!empId || !aadhaar || aadhaar.includes('*')) { skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { employeeId: empId } });
    if (!user) {
      console.log(`  ⚠️  Employee ${empId} not found — skipping`);
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { aadhaarNumber: aadhaar },
    });
    updated++;
  }

  console.log(`  ✅ Aadhaar details: ${updated} updated, ${skipped} skipped (all masked in greytHR export)`);
}

async function importFromExport() {
  console.log('\n📊 Importing additional fields from export.xlsx...');
  const filePath = path.join(DATA_DIR, 'export.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  let updated = 0, skipped = 0;

  for (const row of rows) {
    const empId = String(row['Emp ID'] || row['Employee No'] || '').trim();
    if (!empId) { skipped++; continue; }

    const user = await prisma.user.findUnique({ where: { employeeId: empId } });
    if (!user) {
      skipped++;
      continue;
    }

    const data = {};

    // PAN
    const pan = String(row['PAN'] || '').trim();
    if (pan && pan !== 'undefined' && pan !== 'null') data.panNumber = pan;

    // UAN
    const uan = String(row['UAN'] || '').trim();
    if (uan && uan !== 'undefined' && uan !== 'null') data.uanNumber = uan;

    // Blood Group
    const bg = String(row['Blood Group'] || '').trim();
    if (bg && bg !== 'undefined' && bg !== 'null') data.bloodGroup = bg;

    // Marital Status
    const ms = String(row['Marital Status'] || '').trim();
    if (ms && ms !== 'undefined' && ms !== 'null') {
      data.maritalStatus = ms.toLowerCase().replace(/\s+/g, '_');
    }

    // Confirmation Date
    const cd = String(row['Confirmation Date'] || '').trim();
    if (cd && cd !== 'undefined' && cd !== 'null' && cd !== 'NaN') {
      data.confirmationDate = cd;
    }

    // Location
    const loc = String(row['Location'] || '').trim();
    if (loc && loc !== 'undefined' && loc !== 'null') data.location = loc;

    // Shift
    const shift = String(row['Shift'] || '').trim();
    if (shift && shift !== 'undefined' && shift !== 'null') data.shift = shift;

    // Nationality
    const nat = String(row['Nationality'] || '').trim();
    if (nat && nat !== 'undefined' && nat !== 'null') data.nationality = nat;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`  ✅ Export fields: ${updated} updated, ${skipped} skipped`);
}

async function run() {
  console.log('🚀 Starting greytHR data import...');

  try {
    await importBankDetails();
    await importAadhaarDetails();
    await importFromExport();
    console.log('\n🎉 All imports complete!');
  } catch (err) {
    console.error('❌ Import error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
