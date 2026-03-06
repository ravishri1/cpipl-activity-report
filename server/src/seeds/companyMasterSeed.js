/**
 * Company Master Seed Script
 * Seeds: 5 Legal Entities, 6 EntityCodes, 9 CityCodes, 14 CompanyRegistrations, Initial ComplianceCertificates
 * Run: node server/src/seeds/companyMasterSeed.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Company Master data...\n');

  // ── 1. EntityCodes ────────────────────────────────────────
  console.log('Creating EntityCodes...');
  const entityCodes = [
    { legalName: 'Color Papers',                   code: 'CP'    },
    { legalName: 'Bluenotes',                      code: 'BN'    },
    { legalName: 'Gimmickcare Enterprises',        code: 'GC'    },
    { legalName: 'Color Papers India Pvt. Ltd.',   code: 'CPIPL' },
    { legalName: 'Rodial',                         code: 'RDL'   },
    { legalName: 'Gimmickcare',                    code: 'GMC'   },
  ];
  for (const ec of entityCodes) {
    await prisma.entityCode.upsert({
      where: { legalName: ec.legalName },
      update: { code: ec.code },
      create: ec,
    });
  }
  console.log(`  ✓ ${entityCodes.length} EntityCodes`);

  // ── 2. CityCodes ──────────────────────────────────────────
  console.log('Creating CityCodes...');
  const cityCodes = [
    { cityName: 'Mumbai',    code: 'MUM' },
    { cityName: 'Lucknow',   code: 'LKO' },
    { cityName: 'Bangalore', code: 'BLR' },
    { cityName: 'Hyderabad', code: 'HYD' },
    { cityName: 'Kolkata',   code: 'CCU' },
    { cityName: 'Gurgaon',   code: 'GGN' },
    { cityName: 'Chennai',   code: 'MAA' },
    { cityName: 'Pune',      code: 'PNQ' },
    { cityName: 'Ahmedabad', code: 'AMD' },
  ];
  for (const cc of cityCodes) {
    await prisma.cityCode.upsert({
      where: { cityName: cc.cityName },
      update: { code: cc.code },
      create: cc,
    });
  }
  console.log(`  ✓ ${cityCodes.length} CityCodes`);

  // ── 3. Legal Entities ─────────────────────────────────────
  console.log('Creating Legal Entities...');
  const legalEntities = [
    {
      legalName: 'Color Papers',
      pan: 'BWWPS3198E',
      tan: 'PNEC09431C',
      lei: '9845004936B8T0DFE094',
    },
    {
      legalName: 'Bluenotes',
      pan: 'BIIPM8394J',
      tan: null,
      lei: null,
    },
    {
      legalName: 'Gimmickcare Enterprises',
      pan: 'DRCPS4035R',
      tan: 'LKNH06653D',
      lei: null,
    },
    {
      legalName: 'Color Papers India Pvt. Ltd.',
      pan: 'AAJCC2415M',
      tan: 'PNEC15279F',
      lei: null,
    },
    {
      legalName: 'Rodial',
      pan: null,
      tan: 'CPWPS5156Q',
      lei: null,
    },
  ];

  const entityMap = {}; // legalName → id
  for (const le of legalEntities) {
    const record = await prisma.legalEntity.upsert({
      where: { pan: le.pan ?? `__NO_PAN_${le.legalName}` },
      update: { legalName: le.legalName, tan: le.tan, lei: le.lei },
      create: le,
    }).catch(async () => {
      // If upsert by PAN fails (null PAN), use legalName lookup
      const existing = await prisma.legalEntity.findFirst({ where: { legalName: le.legalName } });
      if (existing) return existing;
      return prisma.legalEntity.create({ data: le });
    });
    entityMap[le.legalName] = record.id;
  }
  console.log(`  ✓ ${legalEntities.length} Legal Entities`);

  // ── Helper: compute abbr from GSTIN + officeCity + legalName ──
  function computeAbbr(gstin, officeCity, legalName) {
    const stateCode = gstin.slice(0, 2);
    const regNo     = parseInt(gstin[12]) || 1;
    const ecEntry   = entityCodes.find(e => e.legalName === legalName);
    const ccEntry   = cityCodes.find(c => c.cityName === officeCity);
    if (!ecEntry) throw new Error(`No EntityCode for: ${legalName}`);
    if (!ccEntry) throw new Error(`No CityCode for: ${officeCity}`);
    return `${ecEntry.code}-${ccEntry.code}/${stateCode}-R${regNo}`;
  }

  // ── 4. Company Registrations (14 records) ─────────────────
  console.log('Creating Company Registrations...');
  const registrations = [
    // Color Papers — 5 GSTINs
    {
      legalName:  'Color Papers',
      officeCity: 'Mumbai',
      gstin:      '27BWWPS3198E1ZD',
      state:      'Maharashtra',
      district:   'Thane',
      placeType:  'Principal',
      address:    'Mira Road, Thane, Maharashtra',
      fssai:      '10019022009005',
      udyam:      'UDYAM-MH-33-0044949',
      iec:        '315911697',
    },
    {
      legalName:  'Color Papers',
      officeCity: 'Lucknow',
      gstin:      '09BWWPS3198E1ZU',
      state:      'Uttar Pradesh',
      district:   'Lucknow',
      placeType:  'Additional',
      address:    'Lucknow, Uttar Pradesh',
    },
    {
      legalName:  'Color Papers',
      officeCity: 'Bangalore',
      gstin:      '29BWWPS3198E1ZV',
      state:      'Karnataka',
      district:   'Bengaluru',
      placeType:  'Additional',
      address:    'Bangalore, Karnataka',
    },
    {
      legalName:  'Color Papers',
      officeCity: 'Hyderabad',
      gstin:      '36BWWPS3198E1ZW',
      state:      'Telangana',
      district:   'Hyderabad',
      placeType:  'Additional',
      address:    'Hyderabad, Telangana',
    },
    {
      legalName:  'Color Papers',
      officeCity: 'Kolkata',
      gstin:      '19BWWPS3198E1ZX',
      state:      'West Bengal',
      district:   'Kolkata',
      placeType:  'Additional',
      address:    'Kolkata, West Bengal',
    },
    // Bluenotes — 2 GSTINs
    {
      legalName:  'Bluenotes',
      officeCity: 'Mumbai',
      gstin:      '27BIIPM8394J1ZA',
      state:      'Maharashtra',
      district:   'Thane',
      placeType:  'Principal',
      address:    'Mira Road, Thane, Maharashtra',
      fssai:      '11524998000133',
      udyam:      'UDYAM-MH-33-0332008',
    },
    {
      legalName:  'Bluenotes',
      officeCity: 'Lucknow',
      gstin:      '09BIIPM8394J1ZB',
      state:      'Uttar Pradesh',
      district:   'Lucknow',
      placeType:  'Additional',
      address:    'Lucknow, Uttar Pradesh',
    },
    // Gimmickcare Enterprises — 2 GSTINs
    {
      legalName:  'Gimmickcare Enterprises',
      officeCity: 'Lucknow',
      gstin:      '09DRCPS4035R1ZL',
      state:      'Uttar Pradesh',
      district:   'Lucknow',
      placeType:  'Principal',
      address:    'Lucknow, Uttar Pradesh',
      fssai:      '10020051003754',
      iec:        'DRCPS4035R',
    },
    {
      legalName:  'Gimmickcare Enterprises',
      officeCity: 'Mumbai',
      gstin:      '27DRCPS4035R2ZM',
      state:      'Maharashtra',
      district:   'Thane',
      placeType:  'Additional',
      address:    'Mira Road, Thane, Maharashtra',
    },
    // Color Papers India Pvt. Ltd. — 3 GSTINs (THE MASTER EMPLOYMENT ENTITY)
    {
      legalName:  'Color Papers India Pvt. Ltd.',
      officeCity: 'Mumbai',
      gstin:      '27AAJCC2415M1ZJ',   // ← THE DEFAULT EMPLOYMENT GSTIN
      state:      'Maharashtra',
      district:   'Thane',
      placeType:  'Principal',
      address:    'Mira Road, Thane, Maharashtra',
      fssai:      '11522998001111',
      udyam:      'UDYAM-MH-33-0197893',
      iec:        'AAJCC2415M',
    },
    {
      legalName:  'Color Papers India Pvt. Ltd.',
      officeCity: 'Lucknow',
      gstin:      '09AAJCC2415M2ZK',
      state:      'Uttar Pradesh',
      district:   'Lucknow',
      placeType:  'Additional',
      address:    'Lucknow, Uttar Pradesh',
    },
    {
      legalName:  'Color Papers India Pvt. Ltd.',
      officeCity: 'Gurgaon',
      gstin:      '06AAJCC2415M3ZG',
      state:      'Haryana',
      district:   'Gurugram',
      placeType:  'Additional',
      address:    'Gurgaon, Haryana',
    },
    // Rodial — 2 GSTINs
    {
      legalName:  'Rodial',
      officeCity: 'Mumbai',
      gstin:      '27CPWPS5156Q1ZR',
      state:      'Maharashtra',
      district:   'Thane',
      placeType:  'Principal',
      address:    'Mira Road, Thane, Maharashtra',
    },
    {
      legalName:  'Rodial',
      officeCity: 'Lucknow',
      gstin:      '09CPWPS5156Q2ZS',
      state:      'Uttar Pradesh',
      district:   'Lucknow',
      placeType:  'Additional',
      address:    'Lucknow, Uttar Pradesh',
    },
  ];

  const registrationMap = {}; // gstin → id
  for (const reg of registrations) {
    const { legalName, ...data } = reg;
    const legalEntityId = entityMap[legalName];
    if (!legalEntityId) throw new Error(`No legalEntityId for: ${legalName}`);

    const stateCode = data.gstin.slice(0, 2);
    const regNo     = parseInt(data.gstin[12]) || 1;
    const abbr      = computeAbbr(data.gstin, data.officeCity, legalName);

    const record = await prisma.companyRegistration.upsert({
      where: { gstin: data.gstin },
      update: { abbr, ...data, legalEntityId, stateCode, regNo },
      create: { abbr, ...data, legalEntityId, stateCode, regNo },
    });
    registrationMap[data.gstin] = record.id;
    console.log(`  ✓ ${abbr} [${data.gstin}]`);
  }
  console.log(`\n  ✓ ${registrations.length} Company Registrations`);

  // ── 5. Compliance Certificates ────────────────────────────
  console.log('\nCreating Compliance Certificates...');

  function addYears(dateStr, years) {
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  }

  const today = new Date().toISOString().slice(0, 10);
  // FSSAI licenses typically run Apr 1 to Mar 31
  const fssaiLastRenewed = '2024-04-01';
  const fssaiNextDue     = '2025-04-01';

  const certData = [
    // CP-MUM/27-R1
    { gstin: '27BWWPS3198E1ZD', type: 'FSSAI',  no: '10019022009005',         freq: 'YEARLY',   lastRenewed: fssaiLastRenewed, nextDue: fssaiNextDue },
    { gstin: '27BWWPS3198E1ZD', type: 'IEC',    no: '315911697',               freq: 'YEARLY',   lastRenewed: '2024-01-01',    nextDue: '2025-01-01',  notes: 'Annual KYC required' },
    { gstin: '27BWWPS3198E1ZD', type: 'LEI',    no: '9845004936B8T0DFE094',   freq: 'YEARLY',   lastRenewed: '2024-03-01',    nextDue: '2025-03-01' },
    { gstin: '27BWWPS3198E1ZD', type: 'UDYAM',  no: 'UDYAM-MH-33-0044949',   freq: 'LIFETIME', lastRenewed: null,            nextDue: null },
    // BN-MUM/27-R1
    { gstin: '27BIIPM8394J1ZA', type: 'FSSAI',  no: '11524998000133',         freq: 'YEARLY',   lastRenewed: fssaiLastRenewed, nextDue: fssaiNextDue },
    { gstin: '27BIIPM8394J1ZA', type: 'UDYAM',  no: 'UDYAM-MH-33-0332008',   freq: 'LIFETIME', lastRenewed: null,            nextDue: null },
    // GC-LKO/09-R1
    { gstin: '09DRCPS4035R1ZL', type: 'FSSAI',  no: '10020051003754',         freq: 'YEARLY',   lastRenewed: fssaiLastRenewed, nextDue: fssaiNextDue },
    { gstin: '09DRCPS4035R1ZL', type: 'IEC',    no: 'DRCPS4035R',             freq: 'YEARLY',   lastRenewed: '2024-01-01',    nextDue: '2025-01-01',  notes: 'Annual KYC required' },
    // CPIPL-MUM/27-R1 (DEFAULT EMPLOYMENT ENTITY)
    { gstin: '27AAJCC2415M1ZJ', type: 'FSSAI',  no: '11522998001111',         freq: 'YEARLY',   lastRenewed: fssaiLastRenewed, nextDue: fssaiNextDue },
    { gstin: '27AAJCC2415M1ZJ', type: 'IEC',    no: 'AAJCC2415M',             freq: 'YEARLY',   lastRenewed: '2024-01-01',    nextDue: '2025-01-01',  notes: 'Annual KYC required' },
    { gstin: '27AAJCC2415M1ZJ', type: 'UDYAM',  no: 'UDYAM-MH-33-0197893',   freq: 'LIFETIME', lastRenewed: null,            nextDue: null },
  ];

  for (const cert of certData) {
    const companyRegistrationId = registrationMap[cert.gstin];
    if (!companyRegistrationId) {
      console.warn(`  ⚠ Skipping cert — no registration for GSTIN: ${cert.gstin}`);
      continue;
    }
    await prisma.complianceCertificate.upsert({
      where: {
        // Use a composite approach — check by registrationId + type + no
        id: -1, // force create path
      },
      update: {},
      create: {
        companyRegistrationId,
        certificateType:   cert.type,
        certificateNo:     cert.no,
        renewalFrequency:  cert.freq,
        lastRenewed:       cert.lastRenewed ?? null,
        nextDue:           cert.nextDue ?? null,
        reminderDays:      30,
        notes:             cert.notes ?? null,
        expiryDate:        cert.nextDue ?? null,
      },
    }).catch(async () => {
      // Upsert trick doesn't work well; just create
      await prisma.complianceCertificate.create({
        data: {
          companyRegistrationId,
          certificateType:  cert.type,
          certificateNo:    cert.no,
          renewalFrequency: cert.freq,
          lastRenewed:      cert.lastRenewed ?? null,
          nextDue:          cert.nextDue ?? null,
          expiryDate:       cert.nextDue ?? null,
          reminderDays:     30,
          notes:            cert.notes ?? null,
        },
      });
    });
    console.log(`  ✓ ${cert.type} [${cert.no}] → ${registrations.find(r=>r.gstin===cert.gstin)?.officeCity}`);
  }

  console.log('\n✅ Company Master seed complete!');
  console.log('\nSummary:');
  console.log(`  Legal Entities:           ${legalEntities.length}`);
  console.log(`  Company Registrations:    ${registrations.length}`);
  console.log(`  Entity Codes:             ${entityCodes.length}`);
  console.log(`  City Codes:               ${cityCodes.length}`);
  console.log(`  Compliance Certificates:  ${certData.length}`);
  console.log('\nDefault employment entity: CPIPL-MUM/27-R1 (27AAJCC2415M1ZJ)');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
