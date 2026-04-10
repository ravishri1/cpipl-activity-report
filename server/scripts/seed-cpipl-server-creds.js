const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cpipl = await p.legalEntity.findFirst({ where: { legalName: { contains: 'Color Papers India' } } });
  console.log('CPIPL entity:', cpipl.id);

  // Find CPIPL LKO and MH registration IDs for linking
  const lkoReg = await p.companyRegistration.findFirst({ where: { abbr: 'CPIPL-LKO/09-R1' } });
  const mhReg = await p.companyRegistration.findFirst({ where: { abbr: 'CPIPL-THN/27-R1' } });
  console.log('LKO reg:', lkoReg?.id, '| MH reg:', mhReg?.id);

  // === CPIPL LKO Amazon Server (103.113.142.172:5656) ===
  const lkoServer = await p.companyPortal.create({
    data: {
      name: 'CPIPL LKO Amazon Server',
      category: 'erp',
      legalEntityId: cpipl.id,
      companyRegistrationId: lkoReg?.id || null,
      description: 'RDP Server - 103.113.142.172:5656',
      isActive: true,
    }
  });
  console.log('\nCreated: CPIPL LKO Amazon Server (id:' + lkoServer.id + ')');

  const lkoCreds = [
    ['grouptechnology','cp@1234Gt%9838','Admin',null],
    ['ACC_USER_CPIPL_LCK_1','Gt478@#','User','Avinash/Shaunak'],
    ['ACC_USER_CPIPL_LCK_2','Gt@1mum@1','User',null],
    ['ACC_USER_CPIPL_LCK_3','Gt@1mum@21','User',null],
    ['DA_USER_CPIPL_LCK_1','Gt@101mum#','User','DA TEAM'],
    ['INV_USER_CPIPL_LCK_1','Gt@105mum#','User',null],
    ['LOG_USER_CPIPL_LCK_1','Gt@110mum#','User','Sujit'],
    ['ORD_USER_CPIPL_LCK_1','Gt@120mum#','User',null],
    ['PLD_CPIPL_I_LCK_1','Gt@135mum#','User',null],
    ['PLD_CPIPL_I_LCK_2','Gt@140mum#','User','Ankit'],
    ['PLD_CPIPL_I_LCK_3','Gt@15mum#','User',null],
    ['PLD_CPIPL_I_LCK_4','Gt@170mum#','User','Mehul'],
    ['PLD_CPIPL_I_LCK_5','Gt@200mum#','User','Shailesh'],
    ['PLD_CPIPL_I_LCK_6','Gt@210mum#','User','Nandan'],
    ['PLD_CPIPL_I_LCK_7','Gt@225mum#','User','Ritesh'],
    ['PUR_USER_CPIPL_LCK_1','9lc9lQnx5%','User',null],
    ['RTN_USER_CPIPL_LCK_1','Gt@260mum#','User','Sujit'],
    ['RTN_USER_CPIPL_LCK_2','Gt@290mum#','User',null],
    ['RTN USER CPIPL LCK 3','Gt@310mum#','User',null],
    ['SUP_USER_CPIPL_LCK_1','Gt@340mum#','User','Pranali'],
    ['MGR_USER_CPIPL_LCK_1','Gt@444mum#','User',null],
  ];

  for (const [username, password, role, employee] of lkoCreds) {
    await p.portalCredential.create({
      data: {
        portalId: lkoServer.id,
        type: 'individual',
        username,
        password,
        label: role,
        department: employee || null,
        notes: 'IP: 103.113.142.172:5656',
        status: 'active',
      }
    });
  }
  console.log('  Added ' + lkoCreds.length + ' LKO server credentials');

  // === CPIPL MH Amazon Server (182.70.112.201:5656) ===
  const mhServer = await p.companyPortal.create({
    data: {
      name: 'CPIPL MH Amazon Server',
      category: 'erp',
      legalEntityId: cpipl.id,
      companyRegistrationId: mhReg?.id || null,
      description: 'RDP Server - 182.70.112.201:5656',
      isActive: true,
    }
  });
  console.log('\nCreated: CPIPL MH Amazon Server (id:' + mhServer.id + ')');

  const mhCreds = [
    ['grouptechnology','cp@1234Gt%9838','Admin',null],
    ['LOG_USER_CPIPL_2','In@2020&2','User','Noopur/Rahul'],
    ['LOG_USER_CPIPL_3','Tri@2020%1','User','Sujit'],
    ['MRK_USER_CPIPL_1','Tri @99@1','User',null],
    ['PLD_USER_CPIPL_1','Group@221','User',null],
    ['PLD_USER_CPIPL_2','Group@222','User','Ankit'],
    ['PLD_USER_CPIPL_2.1','Ipl@2025%1','User',null],
    ['PLD_USER_CPIPL_3','Mum@ipl$%27#','User',null],
    ['PLD_USER_CPIPL_4','Mum@gt@1','User','Mehul'],
    ['PLD_USER_CPIPL_5','Rob@mum%1','User','Shailesh'],
    ['PLD_USER_CPIPL_6','Luck@ipl@1','User',null],
    ['PLD_USER_CPIPL_7','Mum@mum%1','User','Ritesh'],
    ['PLD_USER_CPIPL_8','Iplmumbai#1','User','Nandan'],
    ['PUR_ACC_USER_CPIPL_3','@@Tw5P5i','User',null],
    ['PUR_USER_CPIPL_1','##FqRpgKZ','User',null],
    ['PUR_USER_CPIPL_2','@#M7RoPe','User',null],
    ['PUR_USER_CPIPL_3','@E9b7DL#2','User',null],
    ['ACC_USER_CPIPL_1','Cp@2020%1','User','Avinash/Shaunak'],
    ['DA_USER_CPIPL_1','Cp@2020$1','User','DA TEAM'],
    ['RTN_USER_CPIPL_1','India@mumbai*1','User','Sujit'],
    ['RTN_USER_CPIPL_2','India@25%1','User',null],
    ['RTN_USER_CPIPL_3','India@231','User',null],
    ['SUP_USER_CPIPL_1','Pid@12@1','User','Shubanshu'],
    ['SUP_USER_CPIPL_2','Sub@123@1','User','Pranali'],
    ['SUP_USER_CPIPL_3','India@000','User','Anuj Arya'],
    ['CTS_USER_CPIPL_1','India@0001','User',null],
    ['ERM_SUP_USER_1','Color@9167','User',null],
  ];

  for (const [username, password, role, employee] of mhCreds) {
    await p.portalCredential.create({
      data: {
        portalId: mhServer.id,
        type: 'individual',
        username,
        password,
        label: role,
        department: employee || null,
        notes: 'IP: 182.70.112.201:5656',
        status: 'active',
      }
    });
  }
  console.log('  Added ' + mhCreds.length + ' MH server credentials');

  const totalPortals = await p.companyPortal.count();
  const totalCreds = await p.portalCredential.count();
  console.log('\nTotal: ' + totalPortals + ' portals, ' + totalCreds + ' credentials');
}
main().then(() => p.$disconnect());
