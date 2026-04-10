/**
 * Import salary structures from CTC Report-EOD.xml
 *
 * Rules:
 * - Skip "Jyoti Vasant Naik" (if present)
 * - Variable Pay & Medical Insurance Premium are YEARLY in the file → divide by 12 for monthly
 * - Match employees by employeeId (e.g. COLOR001)
 * - Components: BASIC, HRA, STATUTORY_BONUS, SPECIAL_ALLOWANCE, SUNDAY_ALLOWANCE
 * - Upsert: create new or update existing salary structure
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── All employees from CTC Report-EOD.xml ─────────────────────────────────────
// Cols: empNo, name, basic, hra, statBonus, specAllow, sunAllow, varPayYearly, medInsYearly, annualCtc
const CTC_DATA = [
  ['COLOR001','Ravi Pardeep Shrivastav',   89500, 44750,  0,    25950, 25800, 446400, 19867, 2719872],
  ['COLOR002','Priyanka Ravi Shrivastav',  22500, 11250,  0,     5250,  6000, 108000, 19867,  689472],
  ['COLOR003','Himanshu Srivastava',       25000, 12500,  0,     9300,  7200, 129600, 19867,  819072],
  ['COLOR005','Dayanand Vishnu Halde',     60000, 30000,  0,    14000, 16000, 288000, 19867, 1769472],
  ['COLOR006','Rajendra Pandharinath Ghuge',24467,12233, 4893,   1500,     0, 103423, 19867,  662016],
  ['COLOR007','Pradnya Sushil Vaidya',     20628,  8000, 4126,   1000,     0,  81010, 19867,  527532],
  ['COLOR013','Manish Singh',              20628,  8000, 4126,      0,     0,  78610, 19867,  513132],
  ['COLOR015','Rajan Saroj',              15500,  8000, 3100,   2000,     0,  68640, 19867,  453312],
  ['COLOR018','Anil Kumar Ramdhruv Gautam',15000,  5833, 3000,      0,     0,  57199, 19867,  384672],
  ['COLOR021','Ajeet Kumar Yadav',         22580,  8000, 4516,      0,     0,  84230, 19867,  546852],
  ['COLOR022','Rahul Dixit',              13000,  6700, 2600,      0,     0,  53520, 19867,  359712],
  ['COLOR026','Shailesh Vinod Naik',       25000, 12500, 5000,   2000,     0, 106800, 19867,  682272],
  ['COLOR034','Pranali Nandu Patil',       15000,  5833, 3000,      0,     0,  57199, 19867,  384672],
  ['COLOR044','Rajat Kumar Shrivastava',   28000, 10462, 5600,      0,     0, 105749, 19867,  675960],
  ['COLOR051','Suraj Baban Hate',          12000,  4250, 2400,      0,     0,  44760, 19867,  312984],
  ['COLOR055','Anil Kumar',               13000,  6700, 2600,      0,     0,  53520, 19867,  359712],
  ['COLOR057','Nandan Sanjay Maurya',      20628,  8000, 4126,      0,     0,  78610, 19867,  513132],
  ['COLOR059','Pankaj Kumar',             15000,  7500, 3000,   2000,     0,  66000, 19867,  437472],
  ['COLOR064','Anuj Arya',               15000,  7500, 3000,   5060,     0,  73344, 19867,  481536],
  ['COLOR070','Pratik Anil Singh',         15000,  5833, 3000,      0,     0,  57199, 19867,  384672],
  ['COLOR071','Lavita Jane Fernandes',     15500,  8000, 3100,   2000,     0,  68640, 19867,  453312],
  ['COLOR076','Dilip Yadav',              12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR085','Badal Mishra',             15000,  7500, 3000,      0,     0,  61200, 19867,  408672],
  ['COLOR089','Nishad Sujit',             12000,  4250, 2400,      0,     0,  44760, 19867,  312984],
  ['COLOR090','Abhishek Yadav',           12000,  4250, 2400,      0,     0,  44760, 19867,  312984],
  ['COLOR095','Prashant Kumar Vishwakarma',12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR100','Abhishek Suresh Sawant',    27000, 13500, 5400,  13750,     0, 143160, 19867,  900432],
  ['COLOR101','Swapnil Mahadev Parab',     15000,  7500, 3000,   5060,     0,  73344, 19867,  481536],
  ['COLOR108','Pritesh Santosh Varose',    13000,  6700, 2600,      0,     0,  53520, 19867,  359712],
  ['COLOR113','Abhilasha Jaiswal',         12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR120','Ashishkumar Ashok Tavasalkar',15000,7500, 3000,   5060,     0,  73344, 19867,  481536],
  ['COLOR121','Suraj Gajanan Parab',       12000,  2966, 2400,      0,     0,  41678, 19867,  293988],
  ['COLOR128','Sameer Subhash Bhandvilkar',12000,  2966, 2400,      0,     0,  41678, 19867,  293988],
  ['COLOR133','Neha Premchand Yadav',      12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR136','Mansi Harsukhbhai Thummar', 12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR137','Shubham Arya',             15000,  7500, 3000,      0,     0,  61200, 19867,  408672],
  ['COLOR139','Viraj Sawner',             20628,  8000, 4126,      0,     0,  78610, 19867,  513132],
  ['COLOR143','Samiksha Pushparaj Dhuri',  12000,   185, 2400,      0,     0,  35004, 19867,  252864],
  ['COLOR145','Shikha Ankit Shukla',       12000,   185, 2400,      0,     0,  35004, 19867,  252864],
  ['COLOR146','Mehul Rikame',             12000,   185, 2400,      0,     0,  35004, 19867,  252864],
  ['COLOR147','Kaustubh Gaikwad',         12000,   185, 2400,      0,     0,  35004, 19867,  252864],
  ['COLOR153','Daniel Sunil Das Kuzhivila',13000,  5509, 2600,      0,     0,  50662, 19867,  342564],
  ['COLOR154','Aashutosh Shailendra Patil',12000,  2500, 2400,      0,     0,  40560, 19867,  287100],
  ['COLOR155','Sharmila Dayanand Halde',   20628,  8000, 4126,      0,     0,  78610, 19867,  513132],
  ['COLOR156','Rupali Ramesh Sharma',      12000,   185, 2400,      0,     0,  35004, 19867,  252864],
  ['COLOR157','Yashashree Yadava Kotian',  13000,  6700, 2600,      0,     0,  53520, 19867,  359712],
  ['COLOR158','Nikhil Shahaji Thorat',     20628,  8000, 4126,      0,     0,  78610, 19867,  513132],
];

const SKIP_NAMES = ['jyoti vasant naik']; // normalised lowercase
const ADMIN_USER_ID = 1; // Ravi (admin) — used as revisedBy
const EFFECTIVE_FROM = '2025-04-01'; // CTC Report is for Apr 2025

function buildComponents(basic, hra, statBonus, specAllow, sunAllow) {
  const comps = [];
  if (basic > 0)     comps.push({ code: 'BASIC',            name: 'Basic Salary',           type: 'earning', amount: basic });
  if (hra > 0)       comps.push({ code: 'HRA',              name: 'House Rent Allowance (HRA)', type: 'earning', amount: hra });
  if (statBonus > 0) comps.push({ code: 'STATUTORY_BONUS',  name: 'Statutory Bonus',         type: 'earning', amount: statBonus });
  if (specAllow > 0) comps.push({ code: 'SPECIAL_ALLOWANCE',name: 'Special Allowance',       type: 'earning', amount: specAllow });
  if (sunAllow > 0)  comps.push({ code: 'SUNDAY_ALLOWANCE', name: 'Sunday/Weekly Off Allowance', type: 'earning', amount: sunAllow });
  return comps;
}

async function main() {
  let created = 0, updated = 0, skipped = 0, notFound = 0;
  const results = [];

  for (const [empNo, name, basic, hra, statBonus, specAllow, sunAllow, varPayYr, medInsYr, annualCtc] of CTC_DATA) {
    // Skip check
    if (SKIP_NAMES.includes(name.toLowerCase())) {
      console.log(`  SKIP  ${empNo} ${name} — excluded`);
      skipped++;
      continue;
    }

    // Lookup by employeeId
    const user = await prisma.user.findFirst({ where: { employeeId: empNo } });
    if (!user) {
      console.log(`  MISS  ${empNo} ${name} — not found in EOD`);
      notFound++;
      results.push({ empNo, name, status: 'NOT_FOUND' });
      continue;
    }

    // Build monthly values (yearly → monthly)
    const varPayMonthly    = Math.round(varPayYr / 12);
    const medInsMonthly    = Math.round(medInsYr / 12);
    const components       = buildComponents(basic, hra, statBonus, specAllow, sunAllow);
    const grossEarnings    = components.filter(c => c.type === 'earning').reduce((s, c) => s + c.amount, 0);
    const ctcMonthly       = Math.round(annualCtc / 12);

    // Compute auto-calculated deductions for legacy fields
    const empPf  = basic > 0 ? Math.min(Math.round(basic * 0.12), 1800) : 0;
    const empEsi = grossEarnings > 0 && grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0075) : 0;
    const pt     = grossEarnings > 10000 ? 200 : grossEarnings >= 7500 ? 75 : 0;
    const netPay = grossEarnings - empPf - empEsi - pt;

    const data = {
      ctcAnnual:         annualCtc,
      ctcMonthly:        ctcMonthly,
      basic:             basic,
      hra:               hra,
      da:                0,
      specialAllowance:  specAllow,
      medicalAllowance:  0,
      conveyanceAllowance: 0,
      otherAllowance:    statBonus + sunAllow, // statutory bonus + sunday allowance as other
      otherAllowanceLabel: [statBonus>0?'Statutory Bonus':'', sunAllow>0?'Sunday Allowance':''].filter(Boolean).join(', ') || null,
      variablePay:       varPayMonthly,
      medicalPremium:    medInsMonthly,
      employerPf:        empPf,
      employerEsi:       grossEarnings > 0 && grossEarnings <= 21000 ? Math.round(grossEarnings * 0.0325) : 0,
      employeePf:        empPf,
      employeeEsi:       empEsi,
      professionalTax:   pt,
      tds:               0,
      netPayMonthly:     netPay,
      effectiveFrom:     EFFECTIVE_FROM,
      notes:             `Imported from CTC Report Apr 2025`,
      components:        components,
    };

    const existing = await prisma.salaryStructure.findUnique({ where: { userId: user.id } });

    await prisma.salaryStructure.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    // Create salary revision record
    if (existing && existing.ctcAnnual !== annualCtc) {
      await prisma.salaryRevision.create({
        data: {
          userId:        user.id,
          effectiveFrom: EFFECTIVE_FROM,
          oldCtc:        existing.ctcAnnual,
          newCtc:        annualCtc,
          reason:        'Imported from CTC Report Apr 2025',
          revisedBy:     ADMIN_USER_ID,
          revisionType:  annualCtc > existing.ctcAnnual ? 'increment' : 'decrement',
        },
      });
      console.log(`  UPDATE ${empNo} ${name} — CTC ${existing.ctcAnnual} → ${annualCtc}`);
      updated++;
    } else if (!existing) {
      await prisma.salaryRevision.create({
        data: {
          userId:        user.id,
          effectiveFrom: EFFECTIVE_FROM,
          oldCtc:        0,
          newCtc:        annualCtc,
          reason:        'Initial salary structure — imported from CTC Report Apr 2025',
          revisedBy:     ADMIN_USER_ID,
          revisionType:  'initial',
        },
      });
      console.log(`  CREATE ${empNo} ${name} — CTC ${annualCtc}, gross ${grossEarnings}/mo`);
      created++;
    } else {
      console.log(`  SAME   ${empNo} ${name} — CTC unchanged (${annualCtc})`);
      updated++;
    }

    results.push({ empNo, name, status: existing ? 'UPDATED' : 'CREATED', ctc: annualCtc, grossMonthly: grossEarnings, varPay: varPayMonthly, medIns: medInsMonthly });
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Done. Created: ${created} | Updated: ${updated} | Skipped: ${skipped} | Not found: ${notFound}`);
  if (notFound > 0) {
    console.log('\nEmployees NOT found in EOD (check employeeId):');
    results.filter(r => r.status === 'NOT_FOUND').forEach(r => console.log(`  ${r.empNo} — ${r.name}`));
  }
}

main()
  .catch(e => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
