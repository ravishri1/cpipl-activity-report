require('dotenv').config();
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const ps90 = await p.payslip.findFirst({
    where: { userId: 59, month: '2025-04' },
    select: {
      presentDays: true, lopDays: true, workingDays: true, offDaysWorked: true,
      grossEarnings: true, totalDeductions: true, netPay: true,
      earningsBreakdown: true,
      basic: true, hra: true, da: true, specialAllowance: true, otherAllowance: true,
      variablePay: true, offDayAllowance: true, reimbursements: true,
      employeePf: true, employerPf: true, employeeEsi: true, employerEsi: true,
      professionalTax: true, tds: true, lopDeduction: true, salaryAdvanceDeduction: true,
      otherDeductions: true, otherDeductionsLabel: true, lwfEmployee: true,
    }
  });
  console.log('=== COLOR090 April 2025 ===');
  console.log('presentDays:', ps90.presentDays, '| lop:', ps90.lopDays, '| offDaysWorked:', ps90.offDaysWorked, '| workingDays:', ps90.workingDays);
  console.log('EARNINGS: basic=', ps90.basic, 'hra=', ps90.hra, 'da=', ps90.da, 'special=', ps90.specialAllowance);
  console.log('         other=', ps90.otherAllowance, 'offDayAllow=', ps90.offDayAllowance, 'variable=', ps90.variablePay);
  console.log('GROSS:', ps90.grossEarnings);
  console.log('DEDUCTIONS: empPF=', ps90.employeePf, 'empESI=', ps90.employeeEsi, 'PT=', ps90.professionalTax);
  console.log('           TDS=', ps90.tds, 'LOP=', ps90.lopDeduction, 'advance=', ps90.salaryAdvanceDeduction);
  console.log('           otherDed=', ps90.otherDeductions, '(', ps90.otherDeductionsLabel, ')');
  console.log('           LWF=', ps90.lwfEmployee);
  console.log('TOTAL DEDUCTIONS:', ps90.totalDeductions, '| NET:', ps90.netPay);
  if (ps90.earningsBreakdown) {
    const e = typeof ps90.earningsBreakdown === 'string' ? JSON.parse(ps90.earningsBreakdown) : ps90.earningsBreakdown;
    console.log('\nearningsBreakdown:', JSON.stringify(e, null, 2));
  }
}
main().then(()=>process.exit()).catch(e=>{console.error(e.message);process.exit(1)});
