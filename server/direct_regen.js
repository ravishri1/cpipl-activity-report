require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { calcStatutory, DEFAULT_PAYROLL_RULES } = require('./src/utils/payrollRules');
const { getSaturdayPolicyForMonth } = require('./src/utils/saturdayPolicyHelper');
const p = new PrismaClient();

const TARGET = ['COLOR001','COLOR015','COLOR089','COLOR121','COLOR128','COLOR143','COLOR146','COLOR147','COLOR154','COLOR158'];
const MONTH = '2025-04';
const EXCEL_NET = { COLOR001:165490, COLOR015:27553, COLOR089:19954, COLOR121:15595, COLOR128:15595, COLOR143:11949, COLOR146:12835, COLOR147:12835, COLOR154:13599, COLOR158:29661 };

async function main() {
  const year = 2025, monthNum = 4, daysInMonth = 30;
  const monthStart = `${MONTH}-01`, monthEnd = `${MONTH}-30`;

  const users = await p.user.findMany({ where: { employeeId: { in: TARGET } }, select: { id:true, employeeId:true, name:true, companyId:true, branchId:true } });
  const userMap = {};
  users.forEach(u => userMap[u.id] = u);

  for (const user of users) {
    const sal = await p.salaryStructure.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    if (!sal) { console.log(user.employeeId, 'NO SALARY'); continue; }

    // Salary advance repayments
    const advances = await p.salaryAdvance.findMany({ where: { userId: user.id, repaymentMonth: MONTH, status: 'active' } });
    const salaryAdvanceDeduction = advances.reduce((s, a) => s + (a.monthlyRepayment || 0), 0);

    // LOP from approved leave
    const leaves = await p.leaveRequest.findMany({ where: { userId: user.id, status: 'approved', startDate: { lte: monthEnd }, endDate: { gte: monthStart } }, include: { leaveType: true } });
    let lopDays = 0;
    for (const lv of leaves) {
      if (lv.leaveType?.name?.toUpperCase().includes('LOP') || lv.isLOP) {
        const s = new Date(Math.max(new Date(lv.startDate), new Date(monthStart)));
        const e = new Date(Math.min(new Date(lv.endDate), new Date(monthEnd)));
        const days = Math.ceil((e - s) / 86400000) + 1;
        lopDays += days;
      }
    }

    // Use stored lopDays from existing payslip if available
    const existingPs = await p.payslip.findFirst({ where: { userId: user.id, month: MONTH } });
    if (existingPs) lopDays = existingPs.lopDays || 0;

    // Earnings
    const earningComps = Array.isArray(sal.components) ? sal.components.filter(c => c.type === 'earning') : [];
    const grossBase = earningComps.length > 0
      ? earningComps.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
      : sal.basic + sal.hra + sal.da + sal.specialAllowance + sal.medicalAllowance + sal.conveyanceAllowance + sal.otherAllowance;

    // Off-day allowance — use existing payslip value
    const offDayAllowance = existingPs ? (existingPs.offDayAllowance || 0) : 0;
    const offDaysWorked = existingPs ? (existingPs.offDaysWorked || 0) : 0;

    const grossEarnings = grossBase + offDayAllowance;
    const lopDivisor = daysInMonth;
    const lopDeduction = grossBase / lopDivisor * lopDays;  // NO Math.round

    const esicCeiling = 21000;
    const esicEligible = grossBase <= esicCeiling;
    const payrollRules = DEFAULT_PAYROLL_RULES;
    const payBasic = earningComps.length > 0 ? earningComps.filter(c => c.code === 'BASIC').reduce((s,c) => s + (parseFloat(c.amount)||0), 0) : sal.basic;
    const statutoryBase = Math.max(0, grossEarnings - lopDeduction);
    const statutoryBasic = payBasic * (lopDivisor - lopDays) / lopDivisor;
    const statutory = calcStatutory(statutoryBase, statutoryBasic, sal.ptExempt || false, false, payrollRules, null, monthNum, esicEligible);
    const tds = sal.tds || 0;
    const totalDeductions = statutory.employeePf + statutory.employeeEsi + statutory.professionalTax + tds;
    const netPay = grossEarnings - totalDeductions - lopDeduction - salaryAdvanceDeduction;  // NO Math.round

    const ex = EXCEL_NET[user.employeeId];
    console.log(`${user.employeeId}: netPay=${netPay.toFixed(4)} Excel=${ex} diff=${(netPay-ex).toFixed(4)}  [ESI=${statutory.employeeEsi.toFixed(4)}, LOP=${lopDeduction.toFixed(4)}, offDay=${offDayAllowance}]`);
  }
}

main().then(() => process.exit()).catch(e => { console.error(e.message); process.exit(1); });
