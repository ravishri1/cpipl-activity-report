const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();

const LT = { PL: 7, LOP: 8, COF: 9, CF: 10 };
const SKIP_EMP = 'COLOR047'; // Jyoti already done
const YEAR = 2025;

async function main() {
  const data = JSON.parse(fs.readFileSync('./opening_balances.json', 'utf-8'));

  // 1. Bulk fetch all users
  const users = await p.user.findMany({
    where: { isActive: true },
    select: { id: true, employeeId: true, name: true }
  });
  const empMap = {};
  for (const u of users) if (u.employeeId) empMap[u.employeeId] = u;

  // 2. Bulk fetch all existing FY2025 balances
  const existingBals = await p.leaveBalance.findMany({
    where: { year: YEAR },
    select: { id: true, userId: true, leaveTypeId: true, total: true }
  });
  // Map: `${userId}_${leaveTypeId}` → balance record
  const balMap = {};
  for (const b of existingBals) balMap[`${b.userId}_${b.leaveTypeId}`] = b;

  const updates = []; // { id, data }
  const creates = []; // { data }
  let skipped = 0, notFound = 0;

  for (const emp of data) {
    if (emp.empNo === SKIP_EMP) { skipped++; continue; }
    const user = empMap[emp.empNo];
    if (!user) { console.log(`NOT FOUND: ${emp.empNo}`); notFound++; continue; }

    const cfOpen  = Math.max(emp.cfOpen,  0);
    const cofOpen = Math.max(emp.cofOpen, 0);

    // [leaveTypeId, opening, total]  — null total means "keep existing"
    const typeConfigs = [
      [LT.CF,  cfOpen,  0],   // CF: opening=carry, total=0
      [LT.COF, cofOpen, null], // COF: opening=carry, keep existing total (grants)
      [LT.PL,  0,       12],   // PL: opening=0, total=12
      [LT.LOP, 0,       0],    // LOP: opening=0, total=0
    ];

    for (const [ltId, opening, totalOverride] of typeConfigs) {
      const key = `${user.id}_${ltId}`;
      const existing = balMap[key];
      const total = totalOverride !== null ? totalOverride : (existing ? existing.total : 0);

      if (existing) {
        updates.push({ id: existing.id, data: { opening, total } });
      } else {
        creates.push({
          userId: user.id, leaveTypeId: ltId, year: YEAR,
          opening, total, used: 0, balance: opening + total
        });
      }
    }

    const lapsedNote = emp.lapsed > 0 ? ` | LAPSED ${emp.lapsed}d` : '';
    console.log(`  ${emp.empNo} ${emp.name.substring(0,30).padEnd(30)} CF.open=${cfOpen} COF.open=${cofOpen}${lapsedNote}`);
  }

  console.log(`\nRunning ${updates.length} updates + ${creates.length} creates...`);

  // 3. Run all updates in parallel (batches of 20)
  const BATCH = 20;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(batch.map(u => p.leaveBalance.update({ where: { id: u.id }, data: u.data })));
    process.stdout.write(`  Updated ${Math.min(i + BATCH, updates.length)}/${updates.length}\r`);
  }

  // 4. Creates in batches
  for (let i = 0; i < creates.length; i += BATCH) {
    const batch = creates.slice(i, i + BATCH);
    await Promise.all(batch.map(c => p.leaveBalance.create({ data: c })));
  }

  console.log(`\nDone — ${updates.length} updated, ${creates.length} created, ${skipped} skipped (Jyoti), ${notFound} not found`);

  const lapsed = data.filter(e => e.lapsed > 0 && e.empNo !== SKIP_EMP);
  console.log(`\nLapsed PL employees (${lapsed.length}):`);
  for (const e of lapsed) console.log(`  ${e.empNo} ${e.name}: lapsed ${e.lapsed}d`);
}

main().catch(console.error).finally(() => p.$disconnect());
