const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const COF_LT_ID = 9;
const YEAR = 2025;
const SKIP_EMP = 'COLOR047'; // Jyoti already correct from leave requests

async function main() {
  const data = JSON.parse(fs.readFileSync('./cof_used.json', 'utf-8'))
    .filter(r => r.empNo !== SKIP_EMP && r.cofUsed > 0);

  const users = await p.user.findMany({ select: { id: true, employeeId: true, name: true } });
  const empMap = {};
  for (const u of users) if (u.employeeId) empMap[u.employeeId] = u;

  const cofBals = await p.leaveBalance.findMany({ where: { leaveTypeId: COF_LT_ID, year: YEAR } });
  const balMap = {};
  for (const b of cofBals) balMap[b.userId] = b;

  const updates = [];
  for (const r of data) {
    const user = empMap[r.empNo];
    if (!user) { console.log(`  NOT FOUND: ${r.empNo}`); continue; }
    const bal = balMap[user.id];
    if (!bal) { console.log(`  NO BALANCE: ${r.empNo}`); continue; }

    const opening  = bal.opening || 0;
    const total    = bal.total   || 0;
    const used     = r.cofUsed;
    const available = Math.max(opening + total - used, 0);
    updates.push({ id: bal.id, used, empNo: r.empNo, name: r.name, opening, total, available });
  }

  await Promise.all(updates.map(u =>
    p.leaveBalance.update({ where: { id: u.id }, data: { used: u.used } })
  ));

  console.log(`Updated ${updates.length} COF used balances:\n`);
  for (const u of updates) {
    const flag = u.opening + u.total < u.used ? ' ⚠ OVERDRAFT' : '';
    console.log(`  ${u.empNo} ${u.name.substring(0,30).padEnd(30)} open=${u.opening} grant=${u.total} used=${u.used} avail=${u.available}${flag}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
