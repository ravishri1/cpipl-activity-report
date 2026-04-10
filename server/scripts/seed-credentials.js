const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get entity IDs
  const cp = await p.legalEntity.findFirst({ where: { legalName: 'Color Papers' } });
  const cpipl = await p.legalEntity.findFirst({ where: { legalName: { contains: 'Color Papers India' } } });
  console.log('CP:', cp?.id, '| CPIPL:', cpipl?.id);

  // Helper to create portal + credentials
  async function addPortal(name, category, entityId, creds) {
    const portal = await p.companyPortal.create({
      data: { name, category, legalEntityId: entityId, isActive: true }
    });
    for (const c of creds) {
      await p.portalCredential.create({
        data: {
          portalId: portal.id,
          type: c.type || 'shared',
          username: c.email,
          password: c.password || null,
          label: c.label || null,
          notes: c.notes || null,
          phoneNumber: c.phone || null,
          department: c.dept || null,
          purpose: c.purpose || null,
          status: c.closed ? 'revoked' : 'active',
        }
      });
    }
    console.log('  ' + name + ' (' + creds.length + ' creds) -> entity:' + entityId);
    return portal;
  }

  // ===== CP MAIN ACCOUNT =====
  console.log('\n--- CP MAIN ACCOUNT ---');
  await addPortal('Gmail / Portal', 'email', cp?.id, [
    { email: 'in.marketplace@colorpapers.in', password: 'Cp$25551998$$$$@*@@#$$', phone: '8369529033', dept: 'Nandan,Jyoti,Shailesh,Account team & DA Team', purpose: 'Amazon' },
  ]);
  await addPortal('Shiprocket', 'erp', cp?.id, [
    { email: 'main.marketplace@colorpapers.in', password: 'Color@19852026', phone: '8369529033', dept: 'Nandan,Jyoti,Rahul,Shailesh & Account team', purpose: 'Delivery' },
  ]);
  await addPortal('Shiprocket User', 'erp', cp?.id, [
    { email: 'orderprocess.lucknow@colorpapers.in', password: 'Color@@1985###', dept: 'PLD & DA & LKO & Support', purpose: 'User delivery' },
  ]);
  await addPortal('Meesho (Prime Day)', 'erp', cp?.id, [
    { email: 'in.marketplace@colorpapers.in', password: 'Color@#*1985', phone: '8369529033', closed: true },
  ]);
  await addPortal('Mystore', 'erp', cp?.id, [
    { email: 'in.marketplace@colorpapers.in', password: 'Color@1998', phone: '8369529033', closed: true },
  ]);
  await addPortal('Flipkart', 'erp', cp?.id, [
    { email: 'india.marketplaces@gmail.com', password: 'Zxcvbnm,1', notes: 'Display: GlobalstoreIN | Ph: +916391111660', closed: true },
  ]);

  // ===== CPIPL MH =====
  console.log('\n--- CPIPL MH ---');
  await addPortal('Gmail', 'email', cpipl?.id, [
    { email: 'Marketplace.cpipl@gmail.com', password: 'Color@1985', phone: '6391111651', dept: 'RDP User login', purpose: 'Gmail CPIPL MH account' },
  ]);
  await addPortal('Amazon (Main)', 'erp', cpipl?.id, [
    { email: 'Marketplace.cpipl@gmail.com', password: 'Color@*#198508', phone: '6391111651', dept: 'RDP User login', purpose: 'Amazon CPIPL MH account' },
  ]);
  await addPortal('Amazon User 1 Gmail', 'email', cpipl?.id, [
    { email: 'marketplace.cipluser1@gmail.com', password: 'Color@1985', phone: '6391111651', dept: 'RDP User login', purpose: 'Gmail CPIPL MH account' },
  ]);
  await addPortal('Amazon User 1', 'erp', cpipl?.id, [
    { email: 'marketplace.cipluser1@gmail.com', password: 'Cpipl@1985', phone: '6391111651', dept: 'RDP User login', purpose: 'Amazon CPIPL MH Usser' },
  ]);
  await addPortal('Gmail (Express)', 'email', cpipl?.id, [
    { email: 'expressbox.legal@gmail.com', password: 'Express@1985', phone: '6391111651', dept: 'RDP User login', purpose: 'Gmail Amazon purchase' },
  ]);
  await addPortal('Brand Registry', 'erp', cpipl?.id, [
    { email: 'expressbox.legal@gmail.com', password: 'Express@1985', dept: 'RDP User login', purpose: 'Amazon purchase' },
  ]);

  // ===== CPIPL LKO =====
  console.log('\n--- CPIPL LKO ---');
  await addPortal('Gmail (LKO)', 'email', cpipl?.id, [
    { email: 'marketplace.usa2india@gmail.com', password: 'Color@1985', phone: '6391111668', dept: 'RDP User login', purpose: 'Gmail CPIPL LKO account' },
  ]);
  await addPortal('Amazon (LKO)', 'erp', cpipl?.id, [
    { email: 'marketplace.usa2india@gmail.com', password: 'Color*#@198508', phone: '6391111668', dept: 'RDP User login', purpose: 'Amazon CPIPL LKO account' },
  ]);
  await addPortal('Meesho (LKO)', 'erp', cpipl?.id, [
    { email: 'marketplace.usa2india@gmail.com', password: 'Cpipl@#*1985', notes: 'USA2INDIA - 8369529033', dept: 'RDP User login', purpose: 'Gmail CPIPL LKO' },
  ]);
  await addPortal('Shiprocket (LKO)', 'erp', cpipl?.id, [
    { email: 'marketplace.usa2india@gmail.com', password: 'ColorPapers@1985#|', phone: '6391111668', dept: 'RDP User login', purpose: 'Delivery' },
  ]);
  await addPortal('Flipkart (LKO)', 'erp', cpipl?.id, [
    { email: 'marketplace.usa2india@gmail.com', notes: 'Display: USA2INDIA | Ph: 7045240124', dept: 'RDP User login', closed: true },
  ]);
  await addPortal('Channel Max', 'erp', cpipl?.id, [
    { email: 'globalchoice', password: 'BMKrMMe7B8', dept: 'RDP User login', closed: true },
  ]);
  await addPortal('Infinite Mart', 'erp', cpipl?.id, [
    { email: 'infinitemart.23@gmail.com', password: 'PH#0!sr&b19', phone: '8369529033', dept: 'RDP User login', closed: true },
  ]);

  // ===== PLD USER (CP) =====
  console.log('\n--- PLD CP ---');
  await addPortal('Gmail (PLD CP)', 'email', cp?.id, [
    { email: 'pld.catalog.colorpapers@gmail.com', password: 'Color@1985', phone: '8369529033', dept: 'Nandan', purpose: 'Amazon CP' },
  ]);
  await addPortal('Amazon (PLD CP)', 'erp', cp?.id, [
    { email: 'pld.catalog.colorpapers@gmail.com', password: 'pro.deve#^Jun-202608', phone: '8369529033', dept: 'PLD & DA & LKO & Support', purpose: 'Amazon CP' },
  ]);

  // ===== OTHER GMAIL ACCOUNTS =====
  console.log('\n--- OTHER GMAIL ---');
  await addPortal('Gmail (Himanshu)', 'email', null, [
    { email: 'himanshusrivastava.brand@gmail.com', password: 'Color@1985', phone: '8369529033', closed: true },
  ]);
  await addPortal('Gmail (LKO Login)', 'email', null, [
    { email: 'srivstavhimanshu@gmail.com', password: 'Color@*1985', phone: '6391111640', closed: true },
  ]);
  await addPortal('Gmail (Gimmick)', 'email', null, [
    { email: 'gimmicken@gmail.com', password: 'Color@1985', phone: '6391111640', closed: true },
  ]);
  await addPortal('Gmail (AutoPrice)', 'email', null, [
    { email: 'autoprice.cp@gmail.com', password: 'CP5809India@#%', phone: '8369529033', dept: 'Script', purpose: 'Amazon' },
  ]);
  await addPortal('Gmail (India MktP)', 'email', null, [
    { email: 'india.marketplaces@gmail.com', password: 'Color@1985', phone: '8369529033', closed: true },
  ]);

  // ===== PURCHASE / IMPORT ACCOUNTS =====
  console.log('\n--- PURCHASE / IMPORT ---');
  await addPortal('Amazon.com (Purchase)', 'erp', null, [
    { email: 'blulogisticsllc1@gmail.com', password: 'hA777$JyZqq_', notes: 'Anuj, Dilip Y, Dilip G', dept: 'Purchase Team', purpose: 'Purchase account' },
    { email: 'purchase@colorpapers.in', password: '}7]W9#9wmr3(', notes: 'Anuj, Dilip Y, Dilip G', dept: 'Purchase Team', purpose: 'Purchase account' },
    { email: 'tvg.cp6@gmail.com', password: 'nA2.P{r6%87$', notes: 'Not in use', closed: true },
    { email: 'tvg.cp7@gmail.com', password: '7=<3i7{dFR9L', notes: 'Not in use', closed: true },
  ]);
  await addPortal('Amazon.IN (Purchase)', 'erp', null, [
    { email: 'purchase.cpllc3@colorpapers.in', password: '9AoGw_Y0d3=9', notes: 'Dilip Yadav', dept: 'Purchase Team', purpose: 'Purchase account' },
  ]);
  await addPortal('Amazon.com (Bombino)', 'erp', null, [
    { email: 'bombino.colorpapers3@gmail.com', password: '5SFQV5wkhGKR7tKW', notes: 'Anuj, Dilip Y, Dilip G', dept: 'Purchase Team', purpose: 'Purchase account' },
  ]);
  await addPortal('Microsoft Online', 'erp', null, [
    { email: 'purchase@colorpapers.co.in', password: '4a@SfOYT#', notes: 'Anuj, Dilip Y, Dilip G, Rahul D', dept: 'Purchase Team', purpose: 'Purchase account' },
  ]);
  await addPortal('Bombinoexp.com', 'erp', null, [
    { email: 'cpil01@bombinoexp.com', password: 'CPILBOMBINO', notes: 'Anuj, Dilip Y', dept: 'Rajat sir', purpose: 'Shipment' },
    { email: 'xe7184@bombinoexp.com', password: 'XE7184BOMBINO', notes: 'Anuj, Dilip Y', dept: 'Rajat sir', purpose: 'Shipment' },
  ]);
  await addPortal('Bombino USVS', 'erp', null, [
    { email: 'color.papers@ushopvship.com', password: 'Papers@usvs12', notes: 'Anuj, Dilip Y', dept: 'Rajat sir', purpose: 'Shipment' },
  ]);
  await addPortal('FTP (Channel Max)', 'erp', null, [
    { email: 'bino@ravishrivastav.com', password: '1YHY7!eMf_2L', notes: 'Host:184.168.96.38 Port:21', dept: 'Nandan Channel Max', purpose: 'Repricing Channel max' },
  ]);

  const totalPortals = await p.companyPortal.count();
  const totalCreds = await p.portalCredential.count();
  console.log('\nDone! Portals:', totalPortals, '| Credentials:', totalCreds);
}
main().then(() => p.$disconnect());
