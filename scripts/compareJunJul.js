/**
 * Compare June and July 2025 EOD payslips vs Excel salary registers.
 * Outputs a difference table: employee, month, field, Excel value, EOD value, difference.
 */
const path = require('path');
const { execSync } = require('child_process');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const COMPANY_ID = 1;
const MONTHS = ['2025-06', '2025-07'];

function round(n) { return Math.round(n || 0); }
function diff(a, b) { return Math.abs(round(a) - round(b)); }

async function main() {
  // Parse Excel data
  const pyFile = path.join(__dirname, 'compareJunJul.py');
  const pyOut = execSync(`C:/Python314/python.exe "${pyFile}"`, {
    timeout: 60000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024
  });
  const excelData = JSON.parse(pyOut.trim().split('\n').filter(l => l.startsWith('{'))[0] || pyOut.trim());

  // Fetch EOD payslips
  const eodPayslips = await prisma.payslip.findMany({
    where: { month: { in: MONTHS }, user: { companyId: COMPANY_ID } },
    select: {
      month: true, grossEarnings: true, netPay: true, lopDays: true, presentDays: true,
      workingDays: true, lopDeduction: true, totalDeductions: true, offDayAllowance: true,
      salaryAdvanceDeduction: true,
      user: { select: { employeeId: true, name: true } }
    },
    orderBy: [{ month: 'asc' }, { user: { employeeId: 'asc' } }]
  });

  const eodMap = new Map();
  for (const ps of eodPayslips) {
    eodMap.set(`${ps.month}:${ps.user.employeeId}`, ps);
  }

  const THRESHOLD = 5; // only show differences > ₹5
  const allDiffs = [];

  for (const month of MONTHS) {
    const excelRows = excelData[month] || [];
    const monthName = month === '2025-06' ? 'June 2025' : 'July 2025';

    for (const ex of excelRows) {
      const key = `${month}:${ex.empId}`;
      const eod = eodMap.get(key);
      if (!eod) {
        allDiffs.push({ month: monthName, empId: ex.empId, name: ex.name, field: 'PAYSLIP', excel: 'EXISTS', eod: 'MISSING', gap: 0 });
        continue;
      }

      // Compare gross
      const grossDiff = diff(ex.gross, eod.grossEarnings);
      if (grossDiff > THRESHOLD) {
        allDiffs.push({ month: monthName, empId: ex.empId, name: ex.name, field: 'Gross', excel: round(ex.gross), eod: round(eod.grossEarnings), gap: grossDiff });
      }

      // Compare LOP days
      const lopDiff = diff(ex.lop, eod.lopDays);
      if (lopDiff > 0.4) {
        allDiffs.push({ month: monthName, empId: ex.empId, name: ex.name, field: 'LOP Days', excel: ex.lop, eod: round(eod.lopDays * 10) / 10, gap: lopDiff });
      }

      // Compare Net Pay
      const netDiff = diff(ex.netPay, eod.netPay);
      if (netDiff > THRESHOLD) {
        allDiffs.push({ month: monthName, empId: ex.empId, name: ex.name, field: 'Net Pay', excel: round(ex.netPay), eod: round(eod.netPay), gap: netDiff });
      }
    }

    // Check for EOD payslips with no Excel match
    for (const [key, eod] of eodMap.entries()) {
      if (!key.startsWith(month + ':')) continue;
      const empId = key.split(':')[1];
      const hasExcel = excelRows.some(r => r.empId === empId);
      if (!hasExcel) {
        allDiffs.push({ month: monthName, empId, name: eod.user.name, field: 'PAYSLIP', excel: 'MISSING', eod: 'EXISTS (extra)', gap: 0 });
      }
    }
  }

  // Print summary tables
  console.log('\n' + '='.repeat(110));
  console.log('JUNE & JULY 2025 PAYSLIP COMPARISON — EOD vs Excel');
  console.log('='.repeat(110));

  // Per-month summary
  for (const month of MONTHS) {
    const monthName = month === '2025-06' ? 'June 2025' : 'July 2025';
    const excelRows = excelData[month] || [];
    const eodCount = [...eodMap.keys()].filter(k => k.startsWith(month)).length;
    console.log(`\n${monthName}: Excel=${excelRows.length} employees | EOD=${eodCount} payslips`);
  }

  // Difference table
  if (allDiffs.length === 0) {
    console.log('\n✅ All payslips MATCH the Excel — no differences found (above ₹5 threshold)!');
  } else {
    console.log(`\nDifferences found: ${allDiffs.length}`);
    console.log('\n' + '-'.repeat(110));
    console.log(
      'Month'.padEnd(12) + 'EmpID'.padEnd(12) + 'Name'.padEnd(35) +
      'Field'.padEnd(12) + 'Excel'.padEnd(14) + 'EOD'.padEnd(14) + 'Diff'
    );
    console.log('-'.repeat(110));
    for (const d of allDiffs.sort((a, b) => a.month.localeCompare(b.month) || a.empId.localeCompare(b.empId))) {
      console.log(
        d.month.padEnd(12) + d.empId.padEnd(12) + d.name.slice(0, 33).padEnd(35) +
        d.field.padEnd(12) + String(d.excel).padEnd(14) + String(d.eod).padEnd(14) + (d.gap ? d.gap : '')
      );
    }
    console.log('-'.repeat(110));
  }

  // Full payslip listing for both months
  console.log('\n' + '='.repeat(120));
  console.log('FULL PAYSLIP LISTING (EOD generated)');
  console.log('='.repeat(120));

  for (const month of MONTHS) {
    const excelRows = excelData[month] || [];
    const excelMap = new Map(excelRows.map(r => [r.empId, r]));
    const monthName = month === '2025-06' ? 'June 2025' : 'July 2025';

    console.log(`\n── ${monthName} ──`);
    console.log(
      'EmpID'.padEnd(12) + 'Name'.padEnd(30) + 'LOP'.padEnd(6) + 'Gross(EOD)'.padEnd(12) +
      'Gross(XL)'.padEnd(12) + 'Net(EOD)'.padEnd(12) + 'Net(XL)'.padEnd(12) + 'NetDiff'.padEnd(10) + 'Status'
    );
    console.log('-'.repeat(120));

    const monthPayslips = [...eodMap.entries()]
      .filter(([k]) => k.startsWith(month + ':'))
      .map(([, v]) => v)
      .sort((a, b) => a.user.employeeId.localeCompare(b.user.employeeId));

    for (const ps of monthPayslips) {
      const ex = excelMap.get(ps.user.employeeId);
      const netDiff = ex ? round(ps.netPay) - round(ex.netPay) : null;
      const diffStr = netDiff !== null ? (netDiff === 0 ? '✓' : (netDiff > 0 ? '+' + netDiff : String(netDiff))) : 'N/A';
      console.log(
        ps.user.employeeId.padEnd(12) +
        ps.user.name.slice(0, 28).padEnd(30) +
        String(ps.lopDays ?? 0).padEnd(6) +
        String(round(ps.grossEarnings)).padEnd(12) +
        String(ex ? round(ex.gross) : 'N/A').padEnd(12) +
        String(round(ps.netPay)).padEnd(12) +
        String(ex ? round(ex.netPay) : 'N/A').padEnd(12) +
        diffStr.padEnd(10) +
        (ex ? '' : '[NO EXCEL]')
      );
    }

    // Excel employees missing from EOD
    for (const ex of excelRows) {
      if (!eodMap.has(`${month}:${ex.empId}`)) {
        console.log(ex.empId.padEnd(12) + ex.name.slice(0,28).padEnd(30) + '     '.padEnd(6) + 'N/A'.padEnd(12) + String(round(ex.gross)).padEnd(12) + 'N/A'.padEnd(12) + String(round(ex.netPay)).padEnd(12) + '[MISSING IN EOD]');
      }
    }
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
