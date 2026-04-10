const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const COF_LT_ID = 9;
const YEAR = 2025;

async function main() {
  const grants = JSON.parse(fs.readFileSync('./cof_grants.json', 'utf-8'))
    .filter(r => r.cofGrant > 0);

  // Bulk fetch users and balances
  const users = await p.user.findMany({ select: { id: true, employeeId: true, name: true } });
  const empMap = {};
  for (const u of users) if (u.employeeId) empMap[u.employeeId] = u;

  const cofBals = await p.leaveBalance.findMany({ where: { leaveTypeId: COF_LT_ID, year: YEAR } });
  const balMap = {};
  for (const b of cofBals) balMap[b.userId] = b;

  const updates = [], creates = [];

  for (const g of grants) {
    const user = empMap[g.empNo];
    if (!user) { console.log(`  NOT FOUND: ${g.empNo}`); continue; }

    const bal = balMap[user.id];
    if (bal) {
      updates.push({ id: bal.id, total: g.cofGrant, empNo: g.empNo, name: g.name, cofGrant: g.cofGrant });
    } else {
      creates.push({ userId: user.id, leaveTypeId: COF_LT_ID, year: YEAR, opening: 0, total: g.cofGrant, used: 0, balance: g.cofGrant, empNo: g.empNo, name: g.name });
    }
  }

  // Apply updates in parallel
  await Promise.all(updates.map(u => p.leaveBalance.update({ where: { id: u.id }, data: { total: u.total } })));
  await Promise.all(creates.map(c => p.leaveBalance.create({ data: { userId: c.userId, leaveTypeId: c.leaveTypeId, year: c.year, opening: c.opening, total: c.total, used: c.used, balance: c.balance } })));

  console.log(`Updated ${updates.length} + Created ${creates.length} COF balances:\n`);
  for (const u of [...updates, ...creates]) {
    console.log(`  ${u.empNo} ${u.name}: COF.total = ${u.cofGrant || u.total}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
