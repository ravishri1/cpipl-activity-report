require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Excel data: [employeeId, lopDays, gross, net, sundayAllow, esi, pf, pt]
const excelData = {
  'COLOR001': { lop:0,  gross:186000, net:165490, sunday:25800,  esi:0,   pf:1800, pt:200 },
  'COLOR002': { lop:0,  gross:45000,  net:43000,  sunday:6000,   esi:0,   pf:1800, pt:200 },
  'COLOR003': { lop:0,  gross:54000,  net:52000,  sunday:7200,   esi:0,   pf:1800, pt:200 },
  'COLOR005': { lop:0,  gross:146241, net:111240, sunday:16000,  esi:0,   pf:1800, pt:200 },
  'COLOR006': { lop:0,  gross:43093,  net:41293,  sunday:0,      esi:0,   pf:1800, pt:0   },
  'COLOR007': { lop:0,  gross:33754,  net:31754,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR013': { lop:0,  gross:38213,  net:36213,  sunday:5459,   esi:0,   pf:1800, pt:200 },
  'COLOR015': { lop:0,  gross:29553,  net:27553,  sunday:953,    esi:0,   pf:1800, pt:200 },
  'COLOR018': { lop:0,  gross:27805,  net:25805,  sunday:3972,   esi:0,   pf:1800, pt:200 },
  'COLOR021': { lop:0,  gross:40945,  net:38945,  sunday:5849,   esi:0,   pf:1800, pt:200 },
  'COLOR022': { lop:0,  gross:26017,  net:24257,  sunday:3717,   esi:0,   pf:1560, pt:200 },
  'COLOR026': { lop:0,  gross:44500,  net:32500,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR034': { lop:0,  gross:23833,  net:22033,  sunday:0,      esi:0,   pf:1800, pt:0   },
  'COLOR044': { lop:0,  gross:44062,  net:42062,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR047': { lop:0,  gross:44096,  net:27096,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR051': { lop:6,  gross:16785,  net:15307,  sunday:1865,   esi:126, pf:1152, pt:200 },
  'COLOR055': { lop:0,  gross:26017,  net:24257,  sunday:3717,   esi:0,   pf:1560, pt:200 },
  'COLOR057': { lop:0,  gross:32754,  net:30754,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR059': { lop:0,  gross:27500,  net:25500,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR064': { lop:0,  gross:30560,  net:28560,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR070': { lop:0,  gross:23833,  net:21833,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR071': { lop:0,  gross:28600,  net:26600,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR076': { lop:0,  gross:19717,  net:17929,  sunday:2817,   esi:148, pf:1440, pt:200 },
  'COLOR077': { lop:6,  gross:22000,  net:20360,  sunday:0,      esi:0,   pf:1440, pt:200 },
  'COLOR085': { lop:2,  gross:23800,  net:21920,  sunday:0,      esi:0,   pf:1680, pt:200 },
  'COLOR089': { lop:0,  gross:21758,  net:19954,  sunday:3108,   esi:164, pf:1440, pt:200 },
  'COLOR090': { lop:9,  gross:14920,  net:13600,  sunday:1865,   esi:112, pf:1008, pt:200 },
  'COLOR095': { lop:0,  gross:16900,  net:15133,  sunday:0,      esi:127, pf:1440, pt:200 },
  'COLOR100': { lop:0,  gross:59650,  net:57650,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR101': { lop:0,  gross:30560,  net:28560,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR108': { lop:2,  gross:21556,  net:19900,  sunday:743,    esi:0,   pf:1456, pt:200 },
  'COLOR113': { lop:0,  gross:16900,  net:15333,  sunday:0,      esi:127, pf:1440, pt:0   },
  'COLOR120': { lop:0,  gross:30560,  net:28560,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR121': { lop:0,  gross:17366,  net:10595,  sunday:0,      esi:131, pf:1440, pt:200 },
  'COLOR128': { lop:0,  gross:17366,  net:15595,  sunday:0,      esi:131, pf:1440, pt:200 },
  'COLOR134': { lop:0,  gross:1690,   net:1533,   sunday:0,      esi:13,  pf:144,  pt:0   },
  'COLOR136': { lop:0,  gross:16900,  net:15333,  sunday:0,      esi:127, pf:1440, pt:0   },
  'COLOR137': { lop:2.5,gross:23375,  net:21525,  sunday:0,      esi:0,   pf:1650, pt:200 },
  'COLOR139': { lop:0,  gross:32754,  net:30754,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR143': { lop:2.5,gross:13370,  net:11949,  sunday:0,      esi:101, pf:1320, pt:0   },
  'COLOR145': { lop:4.5,gross:12397,  net:11080,  sunday:0,      esi:93,  pf:1224, pt:0   },
  'COLOR146': { lop:0,  gross:14585,  net:12835,  sunday:0,      esi:110, pf:1440, pt:200 },
  'COLOR147': { lop:0,  gross:14585,  net:7835,   sunday:0,      esi:110, pf:1440, pt:200 },
  'COLOR153': { lop:0,  gross:21109,  net:19349,  sunday:0,      esi:0,   pf:1560, pt:200 },
  'COLOR154': { lop:3,  gross:15210,  net:13599,  sunday:0,      esi:115, pf:1296, pt:200 },
  'COLOR155': { lop:0,  gross:32754,  net:30754,  sunday:0,      esi:0,   pf:1800, pt:200 },
  'COLOR156': { lop:1,  gross:14099,  net:12601,  sunday:0,      esi:106, pf:1392, pt:0   },
  'COLOR157': { lop:1.5,gross:21185,  net:19703,  sunday:0,      esi:0,   pf:1482, pt:0   },
  'COLOR158': { lop:1,  gross:31661,  net:29661,  sunday:0,      esi:0,   pf:1800, pt:200 },
};

async function main() {
  const payslips = await p.payslip.findMany({
    where: { month: '2025-04' },
    include: { user: { select: { employeeId: true, name: true } } },
    orderBy: { user: { employeeId: 'asc' } },
  });

  const rows = [];
  let totalDiff = 0;
  let mismatchCount = 0;

  for (const ps of payslips) {
    const empId = ps.user?.employeeId;
    if (!empId) continue;
    const ex = excelData[empId];
    if (!ex) {
      rows.push(`${empId.padEnd(10)} | NOT IN EXCEL`);
      continue;
    }

    const sysNet = Math.round(ps.netPay || 0);
    const sysGross = Math.round(ps.grossEarnings || 0);
    const sysLop = ps.lopDays || 0;
    const exNet = ex.net;
    const exGross = ex.gross;
    const netDiff = sysNet - exNet;
    const grossDiff = sysGross - exGross;

    const match = Math.abs(netDiff) <= 1; // allow ₹1 rounding
    if (!match) {
      mismatchCount++;
      totalDiff += Math.abs(netDiff);
    }
    const status = match ? '✅' : '❌';
    rows.push(`${status} ${empId.padEnd(10)} | LOP sys=${String(sysLop).padStart(4)} ex=${String(ex.lop).padStart(4)} | GROSS sys=${String(sysGross).padStart(7)} ex=${String(exGross).padStart(7)} diff=${String(grossDiff).padStart(6)} | NET sys=${String(sysNet).padStart(7)} ex=${String(exNet).padStart(7)} diff=${String(netDiff).padStart(6)}`);
  }

  // Check for Excel employees not in system
  const sysEmpIds = new Set(payslips.map(p => p.user?.employeeId).filter(Boolean));
  for (const empId of Object.keys(excelData)) {
    if (!sysEmpIds.has(empId)) {
      rows.push(`⚠️  ${empId.padEnd(10)} | IN EXCEL BUT NO PAYSLIP IN SYSTEM`);
    }
  }

  console.log('\n=== APRIL 2025 PAYSLIP COMPARISON: SYSTEM vs EXCEL ===\n');
  console.log('Status | EmpID      | LOP (sys/ex)    | GROSS (sys/ex/diff)            | NET (sys/ex/diff)');
  console.log('-'.repeat(110));
  rows.forEach(r => console.log(r));
  console.log('-'.repeat(110));
  console.log(`\nTotal payslips in system: ${payslips.length}`);
  console.log(`Mismatches: ${mismatchCount}`);
  console.log(`Total absolute NET difference: ₹${totalDiff}`);
}

main().then(() => process.exit()).catch(e => { console.error(e.message); process.exit(1); });
