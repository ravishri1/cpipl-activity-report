// server/src/seeds/companyMasterSeed.js
// Run: node server/src/seeds/companyMasterSeed.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function computeAbbr(gstin, entityCode, cityCode) {
  const stateCode = gstin.slice(0, 2);
  const regNo = parseInt(gstin[12]);
  return `${entityCode}-${cityCode}/${stateCode}-R${regNo}`;
}

function nextYearDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function lastYearDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('🌱 Seeding Company Master data...\n');

  // ── Clear existing ──────────────────────────────────────────
  await prisma.complianceCertificate.deleteMany();
  await prisma.companyRegistration.deleteMany();
  await prisma.legalEntity.deleteMany();
  await prisma.entityCode.deleteMany();
  await prisma.cityCode.deleteMany();
  console.log('  ✓ Cleared existing company master data');

  // ── Entity Codes ────────────────────────────────────────────
  await prisma.entityCode.createMany({
    data: [
      { legalName: 'Color Papers',                  code: 'CP'    },
      { legalName: 'Bluenotes',                     code: 'BN'    },
      { legalName: 'Gimmickcare Enterprises',       code: 'GC'    },
      { legalName: 'Color Papers India Pvt. Ltd.',  code: 'CPIPL' },
      { legalName: 'Rodial',                        code: 'RDL'   },
    ],
  });
  console.log('  ✓ Created 5 entity codes');

  // ── City Codes ──────────────────────────────────────────────
  await prisma.cityCode.createMany({
    data: [
      { cityName: 'Mumbai',    code: 'MUM' },
      { cityName: 'Lucknow',   code: 'LKO' },
      { cityName: 'Bangalore', code: 'BLR' },
      { cityName: 'Hyderabad', code: 'HYD' },
      { cityName: 'Kolkata',   code: 'CCU' },
      { cityName: 'Gurgaon',   code: 'GGN' },
      { cityName: 'Delhi',     code: 'DEL' },
      { cityName: 'Chennai',   code: 'CHE' },
      { cityName: 'Pune',      code: 'PNE' },
    ],
  });
  console.log('  ✓ Created 9 city codes');

  // ── Legal Entities ──────────────────────────────────────────
  const cp    = await prisma.legalEntity.create({ data: { legalName: 'Color Papers',                 pan: 'BWWPS3198E', tan: 'PNEC09431C', lei: '9845004936B8T0DFE094' } });
  const bn    = await prisma.legalEntity.create({ data: { legalName: 'Bluenotes',                    pan: 'BIIPM8394J', tan: null,          lei: null } });
  const gc    = await prisma.legalEntity.create({ data: { legalName: 'Gimmickcare Enterprises',      pan: 'DRCPS4035R', tan: 'LKNH06653D', lei: null } });
  const cpipl = await prisma.legalEntity.create({ data: { legalName: 'Color Papers India Pvt. Ltd.', pan: 'AAJCC2415M', tan: 'PNEC15279F', lei: null } });
  const rdl   = await prisma.legalEntity.create({ data: { legalName: 'Rodial',                       pan: null,         tan: 'CPWPS5156Q', lei: null } });
  console.log('  ✓ Created 5 legal entities');

  // ── Company Registrations (14 total) ────────────────────────
  // Color Papers — 5 GSTINs
  const cp1 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cp.id, gstin: '27BWWPS3198E1ZY', stateCode: '27', regNo: 1,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Principal',
    abbr: computeAbbr('27BWWPS3198E1ZY', 'CP', 'MUM'),
    fssai: '10019022009005', iec: '315911697',
    address: 'Miraroad East, Thane District, Mumbai, Maharashtra 401107',
  }});
  const cp2 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cp.id, gstin: '27BWWPS3198E2ZX', stateCode: '27', regNo: 2,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Additional',
    abbr: computeAbbr('27BWWPS3198E2ZX', 'CP', 'MUM'),
    address: 'Secondary Office, Miraroad East, Mumbai, Maharashtra 401107',
  }});
  const cp3 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cp.id, gstin: '09BWWPS3198E1ZK', stateCode: '09', regNo: 1,
    state: 'Uttar Pradesh', district: 'Lucknow', officeCity: 'Lucknow', placeType: 'Principal',
    abbr: computeAbbr('09BWWPS3198E1ZK', 'CP', 'LKO'),
    address: 'Gomti Nagar, Lucknow, Uttar Pradesh 226010',
  }});
  const cp4 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cp.id, gstin: '29BWWPS3198E1ZM', stateCode: '29', regNo: 1,
    state: 'Karnataka', district: 'Bangalore', officeCity: 'Bangalore', placeType: 'Principal',
    abbr: computeAbbr('29BWWPS3198E1ZM', 'CP', 'BLR'),
    address: 'Koramangala, Bangalore, Karnataka 560034',
  }});
  const cp5 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cp.id, gstin: '19BWWPS3198E1ZN', stateCode: '19', regNo: 1,
    state: 'West Bengal', district: 'Kolkata', officeCity: 'Kolkata', placeType: 'Principal',
    abbr: computeAbbr('19BWWPS3198E1ZN', 'CP', 'CCU'),
    address: 'Park Street, Kolkata, West Bengal 700017',
  }});
  console.log('  ✓ Created 5 Color Papers registrations');

  // Bluenotes — 2 GSTINs
  const bn1 = await prisma.companyRegistration.create({ data: {
    legalEntityId: bn.id, gstin: '27BIIPM8394J1ZP', stateCode: '27', regNo: 1,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Principal',
    abbr: computeAbbr('27BIIPM8394J1ZP', 'BN', 'MUM'),
    fssai: '11524998000133',
    udyam: 'UDYAM-MH-33-0332008',
    address: 'Miraroad East, Mumbai, Maharashtra 401107',
  }});
  const bn2 = await prisma.companyRegistration.create({ data: {
    legalEntityId: bn.id, gstin: '09BIIPM8394J1ZL', stateCode: '09', regNo: 1,
    state: 'Uttar Pradesh', district: 'Lucknow', officeCity: 'Lucknow', placeType: 'Principal',
    abbr: computeAbbr('09BIIPM8394J1ZL', 'BN', 'LKO'),
    address: 'Hazratganj, Lucknow, Uttar Pradesh 226001',
  }});
  console.log('  ✓ Created 2 Bluenotes registrations');

  // Gimmickcare Enterprises — 2 GSTINs
  const gc1 = await prisma.companyRegistration.create({ data: {
    legalEntityId: gc.id, gstin: '09DRCPS4035R1ZF', stateCode: '09', regNo: 1,
    state: 'Uttar Pradesh', district: 'Lucknow', officeCity: 'Lucknow', placeType: 'Principal',
    abbr: computeAbbr('09DRCPS4035R1ZF', 'GC', 'LKO'),
    fssai: '10020051003754', iec: 'DRCPS4035R',
    address: 'Gomti Nagar, Lucknow, Uttar Pradesh 226010',
  }});
  const gc2 = await prisma.companyRegistration.create({ data: {
    legalEntityId: gc.id, gstin: '27DRCPS4035R1ZG', stateCode: '27', regNo: 1,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Principal',
    abbr: computeAbbr('27DRCPS4035R1ZG', 'GC', 'MUM'),
    address: 'Andheri West, Mumbai, Maharashtra 400058',
  }});
  console.log('  ✓ Created 2 Gimmickcare registrations');

  // Color Papers India Pvt. Ltd. — 4 GSTINs
  // cpipl1 = CPIPL-MUM/27-R1 = DEFAULT EMPLOYMENT ENTITY (27AAJCC2415M1ZJ)
  const cpipl1 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cpipl.id, gstin: '27AAJCC2415M1ZJ', stateCode: '27', regNo: 1,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Principal',
    abbr: computeAbbr('27AAJCC2415M1ZJ', 'CPIPL', 'MUM'),
    fssai: '11522998001111', iec: 'AAJCC2415M',
    udyam: 'UDYAM-MH-33-0197893',
    address: 'Miraroad East, Thane District, Mumbai, Maharashtra 401107',
  }});
  const cpipl2 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cpipl.id, gstin: '27AAJCC2415M2ZH', stateCode: '27', regNo: 2,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Additional',
    abbr: computeAbbr('27AAJCC2415M2ZH', 'CPIPL', 'MUM'),
    address: 'Additional Office, Miraroad East, Mumbai, Maharashtra 401107',
  }});
  const cpipl3 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cpipl.id, gstin: '09AAJCC2415M1ZB', stateCode: '09', regNo: 1,
    state: 'Uttar Pradesh', district: 'Lucknow', officeCity: 'Lucknow', placeType: 'Principal',
    abbr: computeAbbr('09AAJCC2415M1ZB', 'CPIPL', 'LKO'),
    address: 'Gomti Nagar Extension, Lucknow, Uttar Pradesh 226010',
  }});
  const cpipl4 = await prisma.companyRegistration.create({ data: {
    legalEntityId: cpipl.id, gstin: '36AAJCC2415M1ZD', stateCode: '36', regNo: 1,
    state: 'Telangana', district: 'Hyderabad', officeCity: 'Hyderabad', placeType: 'Principal',
    abbr: computeAbbr('36AAJCC2415M1ZD', 'CPIPL', 'HYD'),
    address: 'HITEC City, Hyderabad, Telangana 500081',
  }});
  console.log('  ✓ Created 4 CPIPL registrations');

  // Rodial — 1 GSTIN
  const rdl1 = await prisma.companyRegistration.create({ data: {
    legalEntityId: rdl.id, gstin: '27CPWPS5156Q1ZR', stateCode: '27', regNo: 1,
    state: 'Maharashtra', district: 'Mumbai', officeCity: 'Mumbai', placeType: 'Principal',
    abbr: computeAbbr('27CPWPS5156Q1ZR', 'RDL', 'MUM'),
    address: 'Bandra West, Mumbai, Maharashtra 400050',
  }});
  console.log('  ✓ Created 1 Rodial registration');
  console.log('  ✓ Total: 14 company registrations');

  // ── Compliance Certificates ─────────────────────────────────
  const NY = nextYearDate();
  const LY = lastYearDate();

  await prisma.complianceCertificate.createMany({ data: [
    // CP-MUM/27-R1 (cp1)
    { companyRegistrationId: cp1.id, certificateType: 'FSSAI',  certificateNo: '10019022009005',      issueDate: '2024-01-15', expiryDate: NY,   renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30 },
    { companyRegistrationId: cp1.id, certificateType: 'IEC',    certificateNo: '315911697',           issueDate: '2020-06-01', expiryDate: null, renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30, notes: 'Annual KYC update required' },
    { companyRegistrationId: cp1.id, certificateType: 'LEI',    certificateNo: '9845004936B8T0DFE094',issueDate: '2023-03-01', expiryDate: NY,   renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 45 },
    { companyRegistrationId: cp1.id, certificateType: 'UDYAM',  certificateNo: 'UDYAM-MH-33-0044949',issueDate: '2020-07-01', expiryDate: null, renewalFrequency: 'LIFETIME', lastRenewed: null, nextDue: null, reminderDays: 30 },

    // BN-MUM/27-R1 (bn1)
    { companyRegistrationId: bn1.id, certificateType: 'FSSAI',  certificateNo: '11524998000133',      issueDate: '2024-03-01', expiryDate: NY,   renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30 },
    { companyRegistrationId: bn1.id, certificateType: 'UDYAM',  certificateNo: 'UDYAM-MH-33-0332008',issueDate: '2021-09-01', expiryDate: null, renewalFrequency: 'LIFETIME', lastRenewed: null, nextDue: null, reminderDays: 30 },

    // GC-LKO/09-R1 (gc1)
    { companyRegistrationId: gc1.id, certificateType: 'FSSAI',  certificateNo: '10020051003754',      issueDate: '2024-04-01', expiryDate: NY,   renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30 },
    { companyRegistrationId: gc1.id, certificateType: 'IEC',    certificateNo: 'DRCPS4035R',          issueDate: '2019-08-01', expiryDate: null, renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30, notes: 'Annual KYC update required' },

    // CPIPL-MUM/27-R1 (cpipl1) — default employment entity
    { companyRegistrationId: cpipl1.id, certificateType: 'FSSAI',  certificateNo: '11522998001111',      issueDate: '2022-06-01', expiryDate: NY,   renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30 },
    { companyRegistrationId: cpipl1.id, certificateType: 'IEC',    certificateNo: 'AAJCC2415M',          issueDate: '2018-11-01', expiryDate: null, renewalFrequency: 'YEARLY',   lastRenewed: LY,  nextDue: NY, reminderDays: 30, notes: 'Annual KYC update required' },
    { companyRegistrationId: cpipl1.id, certificateType: 'UDYAM',  certificateNo: 'UDYAM-MH-33-0197893',issueDate: '2020-09-01', expiryDate: null, renewalFrequency: 'LIFETIME', lastRenewed: null, nextDue: null, reminderDays: 30 },
  ]});
  console.log('  ✓ Created 11 compliance certificates');

  console.log('\n✅ Company Master seeded successfully!');
  console.log(`   Default employment entity: CPIPL-MUM/27-R1`);
  console.log(`   GSTIN: 27AAJCC2415M1ZJ`);
  console.log(`   CompanyRegistration ID: ${cpipl1.id}`);
  console.log(`\n   Tip: Update all User.companyRegistrationId = ${cpipl1.id} for existing employees.`);
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
