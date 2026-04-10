const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const entity = await p.legalEntity.findFirst({ where: { legalName: { contains: 'Color Papers India' } } });
  if (!entity) { console.log('CPIPL entity not found!'); return; }
  const eid = entity.id;
  console.log('Entity:', eid, entity.legalName);

  // Ensure entity code
  await p.entityCode.upsert({ where: { legalName: entity.legalName }, create: { legalName: entity.legalName, code: 'CPIPL' }, update: {} });

  // City codes
  const cities = [
    ['Faridabad','FBD'],['Howrah','HWH'],['Panchla','PCL'],['Malleshpalya','MLP'],
    ['Attibele','ATB'],['Devanahalli','DVN'],['Shamshabad','SMS'],['Siddipet','SDP'],
    ['Chakan','CHK'],['Bhiwandi','BWD'],['Dapode','DPD'],['Gurugram','GGN'],['Bhukapur','BKP'],
  ];
  for (const [n,c] of cities) {
    const exists = await p.cityCode.findFirst({ where: { OR: [{ cityName: n }, { code: c }] } });
    if (!exists) await p.cityCode.create({ data: { cityName: n, code: c } });
  }

  const base = { legalEntityId: eid, regNo: 1, isPrimary: false, isActive: true };

  // PRIMARY 1: LKO
  const lko = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-LKO/09-R1', gstin: '09AAJCC2415M1ZH', officeCity: 'Lucknow', state: 'Uttar Pradesh', stateCode: '09', address: 'Floor No.: 2ND FLOOR, SS-II/620, LDA COLONY, SECT D-I, KANPUR ROAD, Near NEW PUBLIC INTER COLLEGE, Lucknow, Uttar Pradesh, 226012', placeType: 'Principal', siteCode: 'R1' } });
  console.log('P: CPIPL-LKO/09-R1');
  await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-BKP/09-A1', gstin: '09AAJCC2415M1ZH', officeCity: 'Bhukapur', state: 'Uttar Pradesh', stateCode: '09', address: 'KHASRA NO. 472 AND OTHERS, VILLAGE BHUKAPUR, TEHSIL-SAROJINI NAGAR, Bhupkhera, Lucknow, Uttar Pradesh, 226401', placeType: 'Additional', siteCode: 'A1', principalRegistrationId: lko.id } });
  console.log('  A: CPIPL-BKP/09-A1');

  // WB
  const wb = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-CCU/19-R1', gstin: '19AAJCC2415M1ZG', officeCity: 'Kolkata', state: 'West Bengal', stateCode: '19', address: 'CUBICLE NO. 05, 3/4, 75C, KAMDHENU BUILDING, PARK STREET, Kolkata, West Bengal, 700016', placeType: 'Principal', siteCode: 'R1' } });
  console.log('P: CPIPL-CCU/19-R1');
  const wbA = [
    ['HWH','A1','Howrah','Amta Industrial Park, Amta, Mouza Majukhetra, Panchayat Majukhetra, Naipur, Howrah, West Bengal, 711313'],
    ['HWH','A2','Howrah','Amta Industrial Park-2, Amta - Ranihati Road, Islampur, Howrah, West Bengal, 711401'],
    ['HWH','A3','Howrah','NDR Vanshil Warehouse Park LLP, Raghudevpur, Panchla, Howrah, West Bengal, 711322'],
    ['HWH','A4','Howrah','SpaceArth Warehousing GC Two LLP, Ganesh Complex-2, Mallick Bagan, Panchla, Howrah, West Bengal, 711302'],
  ];
  for (const [code,site,city,addr] of wbA) {
    await p.companyRegistration.create({ data: { ...base, abbr: `CPIPL-${code}/19-${site}`, gstin: '19AAJCC2415M1ZG', officeCity: city, state: 'West Bengal', stateCode: '19', address: addr, placeType: 'Additional', siteCode: site, principalRegistrationId: wb.id } });
    console.log(`  A: CPIPL-${code}/19-${site}`);
  }

  // KA
  const ka = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-MLP/29-R1', gstin: '29AAJCC2415M1ZF', officeCity: 'Malleshpalya', state: 'Karnataka', stateCode: '29', address: 'Shop No. 1, 149/2, New Thippasandra Post, S K Complex, 5th Main Malleshpalya Road, CV Raman Nagar, Malleshpalya, Bengaluru, Karnataka, 560075', placeType: 'Principal', siteCode: 'R1' } });
  console.log('P: CPIPL-MLP/29-R1');
  const kaA = [
    ['ATB','A1','Attibele','R.K.V DEVELOPERS, SY no 524/2, 525/3, 526/3, Madivala and Thattanahalli Village, Anekal Taluk, Attibele, Bengaluru, Karnataka, 562107'],
    ['DVN','A2','Devanahalli','12/P2 IT Sector, Hitech, Defence and Aerospace Park, Devanahalli, Bengaluru, Karnataka, 562149'],
    ['DVN','A3','Devanahalli','Building 2 Wh 2, 12/P2 IT Sector, Hitech, Defence and Aerospace Park, Devanahalli, Bengaluru, Karnataka, 562149'],
  ];
  for (const [code,site,city,addr] of kaA) {
    await p.companyRegistration.create({ data: { ...base, abbr: `CPIPL-${code}/29-${site}`, gstin: '29AAJCC2415M1ZF', officeCity: city, state: 'Karnataka', stateCode: '29', address: addr, placeType: 'Additional', siteCode: site, principalRegistrationId: ka.id } });
    console.log(`  A: CPIPL-${code}/29-${site}`);
  }

  // PRIMARY 2: MH
  const mh = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-THN/27-R1', gstin: '27AAJCC2415M1ZJ', officeCity: 'Thane', state: 'Maharashtra', stateCode: '27', address: 'Ground Floor, 1st, 2nd and 3rd Floor, Vrindavan Building, Om Saidham Mandir Marg, Opp. Namaskar Restaurant, Mira Road East, Mira Bhayandar, Thane, Maharashtra, 401107', placeType: 'Principal', siteCode: 'R1', isPrimary: true } });
  console.log('P: CPIPL-THN/27-R1 (PRIMARY)');
  const mhA = [
    ['BWD','A1','Bhiwandi','WE-I, Renaissance Industrial Smart City, Post Amane, Village Vashere, Bhiwandi, Thane, Maharashtra, 421302'],
    ['CHK','A2','Chakan','B01, ESR Pune Estates Pvt Ltd, Village Ambethan, Chakan, Pune, Maharashtra, 410501'],
    ['BWD','A3','Bhiwandi','WE-I, Renaissance Industrial Smart City, Post Amane, Village Vashere, Thane, Maharashtra, 421302'],
    ['CHK','A4','Chakan','B01, ESR Pune Estates Pvt Ltd, Village Ambethan, Chakan, Pune, Maharashtra, 410501'],
    ['BWD','A5','Bhiwandi','WAREHOUSE 05, H.NO.540, B.G.R REAL LOGI IND PARK, VAHULI, DHARAS DHABA, Bhiwandi, Thane, Maharashtra, 421302'],
    ['DPD','A6','Dapode','UNIT NO.1, S.NO.45/4A, ROYAL WAREHOUSING & LOGISTICS LLP, Gram Panchayat Road, PISE VILLAGE, AMNE POST, Dapode, Bhiwandi, Thane, Maharashtra, 421302'],
  ];
  for (const [code,site,city,addr] of mhA) {
    await p.companyRegistration.create({ data: { ...base, abbr: `CPIPL-${code}/27-${site}`, gstin: '27AAJCC2415M1ZJ', officeCity: city, state: 'Maharashtra', stateCode: '27', address: addr, placeType: 'Additional', siteCode: site, principalRegistrationId: mh.id } });
    console.log(`  A: CPIPL-${code}/27-${site}`);
  }

  // HR
  const hr = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-FBD/06-R1', gstin: '06AAJCC2415M1ZN', officeCity: 'Faridabad', state: 'Haryana', stateCode: '06', address: '2ND FLOOR, SHOP NO.25, SECTOR 16, NEW SABZI MANDI, Faridabad, Haryana, 121004', placeType: 'Principal', siteCode: 'R1' } });
  console.log('P: CPIPL-FBD/06-R1');
  await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-GGN/06-A1', gstin: '06AAJCC2415M1ZN', officeCity: 'Gurugram', state: 'Haryana', stateCode: '06', address: 'Sunsat Warehousing Pvt. Ltd., Hadbast No. 23, Village Sanpka, Tehsil Farukhnagar, Haileymandi, Gurugram, Haryana, 122503', placeType: 'Additional', siteCode: 'A1', principalRegistrationId: hr.id } });
  console.log('  A: CPIPL-GGN/06-A1');

  // TG
  const tg = await p.companyRegistration.create({ data: { ...base, abbr: 'CPIPL-HYD/36-R1', gstin: '36AAJCC2415M1ZK', officeCity: 'Hyderabad', state: 'Telangana', stateCode: '36', address: 'Vdesk 4087, H No 5/497, Near Hitec City Road, Izzathnagar, Kondapur, Hyderabad, Telangana, 500084', placeType: 'Principal', siteCode: 'R1' } });
  console.log('P: CPIPL-HYD/36-R1');
  const tgA = [
    ['SMS','A1','Shamshabad','Survey no.99/1, Mamidipally Village, Shamshabad, Hyderabad, Rangareddy, Telangana, 500108'],
    ['SDP','A2','Siddipet','Aruna Warehousing Company, Unit no 2, Banda Mylaram Village, Mulugu Mandal, Mylaram, Siddipet, Telangana, 502279'],
    ['SMS','A3','Shamshabad','ESR GMR Logistics Park - Shed no 3 RGIA, Shamshabad, Rangareddy, Hyderabad, Telangana, 500108'],
  ];
  for (const [code,site,city,addr] of tgA) {
    await p.companyRegistration.create({ data: { ...base, abbr: `CPIPL-${code}/36-${site}`, gstin: '36AAJCC2415M1ZK', officeCity: city, state: 'Telangana', stateCode: '36', address: addr, placeType: 'Additional', siteCode: site, principalRegistrationId: tg.id } });
    console.log(`  A: CPIPL-${code}/36-${site}`);
  }

  const total = await p.companyRegistration.count({ where: { legalEntityId: eid } });
  console.log('\nTotal CPIPL registrations:', total);
}
main().then(() => p.$disconnect());
