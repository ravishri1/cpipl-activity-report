require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { calcStatutory, DEFAULT_PAYROLL_RULES } = require('./src/utils/payrollRules');
const p = new PrismaClient();

// The 10 employees with ±1 rounding differences
const TARGET_EMPIDS = ['COLOR001','COLOR015','COLOR089','COLOR121','COLOR128','COLOR143','COLOR146','COLOR147','COLOR154','COLOR158'];
const MONTH = '2025-04';

async function main() {
  const users = await p.user.findMany({ where: { employeeId: { in: TARGET_EMPIDS } }, select: { id: true, employeeId: true, name: true } });
  const userMap = {};
  users.forEach(u => userMap[u.id] = u);

  // Get their current payslips
  const payslips = await p.payslip.findMany({
    where: { month: MONTH, userId: { in: users.map(u => u.id) } },
    orderBy: { user: { employeeId: 'asc' } }
  });

  const excelNet = { COLOR001:165490, COLOR015:27553, COLOR089:19954, COLOR121:10595, COLOR128:15595, COLOR143:11949, COLOR146:12835, COLOR147:7835, COLOR154:13599, COLOR158:29661 };

  console.log('\nChecking current stored values (should now be unrounded floats after server restart):');
  for (const ps of payslips) {
    const emp = userMap[ps.userId];
    const ex = excelNet[emp?.employeeId];
    const net = ps.netPay;
    const diff = net - ex;
    console.log(`${emp?.employeeId}: stored netPay=${net} Excel=${ex} diff=${diff > 0 ? '+' : ''}${diff.toFixed(4)}`);
  }

  const total = payslips.reduce((s, x) => s + (x.netPay || 0), 0);
  console.log(`\nThese 10 total: ${total}`);
  console.log(`Excel these 10: ${Object.values(excelNet).reduce((a,b)=>a+b,0)}`);
}

main().then(() => process.exit()).catch(e => { console.error(e.message); process.exit(1); });
