import React, { useState, useEffect } from 'react';
import {
  Wallet,
  FileText,
  IndianRupee,
  ArrowLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Loader2,
  BarChart3,
  ArrowUpDown,
  Printer,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatMonth = (month) => {
  try {
    return new Date(month + '-01').toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return month;
  }
};

export default function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [activeTab, setActiveTab] = useState('payslips');

  useEffect(() => {
    fetchPayslips();
  }, []);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/payroll/my-payslips');
      const published = (response.data || []).filter(
        (p) => p.status === 'published'
      );
      published.sort((a, b) => b.month.localeCompare(a.month));
      setPayslips(published);
    } catch (err) {
      console.error('Failed to fetch payslips:', err);
      setError('Failed to load payslips. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const latestPayslip = payslips.length > 0 ? payslips[0] : null;

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchPayslips} />;
  }

  if (selectedPayslip) {
    return (
      <PayslipDetail
        payslip={selectedPayslip}
        onBack={() => setSelectedPayslip(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-100 rounded-xl">
          <Wallet className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Payslips</h1>
          <p className="text-sm text-slate-500">
            View and download your monthly payslips
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button onClick={() => setActiveTab('payslips')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payslips' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Payslips
            </div>
          </button>
          <button onClick={() => setActiveTab('ytd')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ytd' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              YTD Summary
            </div>
          </button>
          <button onClick={() => setActiveTab('revisions')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'revisions' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Salary Revisions
            </div>
          </button>
        </nav>
      </div>

      {/* Payslips Tab */}
      {activeTab === 'payslips' && (
        <>
          {/* Salary Summary Card */}
          {latestPayslip ? (
            <SalarySummary payslip={latestPayslip} />
          ) : (
            <EmptyState />
          )}

          {/* Payslip List */}
          {payslips.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                Payslip History
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {payslips.map((payslip) => (
                  <PayslipCard
                    key={payslip.id}
                    payslip={payslip}
                    onView={() => setSelectedPayslip(payslip)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* YTD Summary Tab */}
      {activeTab === 'ytd' && <YtdSummary />}

      {/* Salary Revisions Tab */}
      {activeTab === 'revisions' && <SalaryRevisionHistory />}
    </div>
  );
}

/* ---------- Salary Summary ---------- */
function SalarySummary({ payslip }) {
  // Gross earned = full gross minus LOP deduction (greytHR style: what was actually earned)
  const grossEarned = payslip.grossEarnings - (payslip.lopDeduction || 0);
  const stats = [
    {
      label: 'Monthly CTC',
      value: formatCurrency(payslip.grossEarnings + (payslip.employerPf || 0) + (payslip.employerEsi || 0)),
      icon: IndianRupee,
      color: 'blue',
    },
    {
      label: 'Gross Earned',
      value: formatCurrency(grossEarned),
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      label: 'Total Deductions',
      value: formatCurrency(payslip.totalDeductions),
      icon: TrendingDown,
      color: 'red',
    },
    {
      label: 'Net Pay',
      value: formatCurrency(payslip.netPay),
      icon: Wallet,
      color: 'violet',
    },
  ];

  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'bg-blue-100 text-blue-600',
      text: 'text-blue-700',
    },
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'bg-emerald-100 text-emerald-600',
      text: 'text-emerald-700',
    },
    red: {
      bg: 'bg-red-50',
      icon: 'bg-red-100 text-red-600',
      text: 'text-red-700',
    },
    violet: {
      bg: 'bg-violet-50',
      icon: 'bg-violet-100 text-violet-600',
      text: 'text-violet-700',
    },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
          Latest Salary Summary
        </h2>
        <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
          {formatMonth(payslip.month)}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const colors = colorMap[stat.color];
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`${colors.bg} rounded-xl p-4 transition-transform hover:scale-[1.02]`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colors.icon}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {stat.label}
                </span>
              </div>
              <p className={`text-lg font-bold ${colors.text}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Payslip Card ---------- */
function PayslipCard({ payslip, onView }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all duration-200 group">
      {/* Month Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-emerald-100 transition-colors">
            <Calendar className="w-4 h-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
          </div>
          <h3 className="font-semibold text-slate-800">
            {formatMonth(payslip.month)}
          </h3>
        </div>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          Paid
        </span>
      </div>

      {/* Net Pay */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-0.5">Net Pay</p>
        <p className="text-2xl font-bold text-slate-800">
          {formatCurrency(payslip.netPay)}
        </p>
      </div>

      {/* Small Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5 pb-4 border-b border-slate-100">
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Gross Earned</p>
          <p className="text-sm font-semibold text-slate-700">
            {formatCurrency(payslip.grossEarnings - (payslip.lopDeduction || 0))}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Deductions</p>
          <p className="text-sm font-semibold text-red-600">
            {formatCurrency((payslip.totalDeductions || 0) - (payslip.lopDeduction || 0))}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">Paid Days</p>
          <p className="text-sm font-semibold text-slate-700">
            {payslip.presentDays ?? payslip.paidDays ?? payslip.workingDays ?? '-'}
          </p>
        </div>
      </div>

      {/* View Details Button */}
      <button
        onClick={onView}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
      >
        <Eye className="w-4 h-4" />
        View Details
      </button>
    </div>
  );
}

/* ---------- Rupees in Words ---------- */
function rupeeWords(amount) {
  let n = Math.round(amount || 0);
  if (n === 0) return 'Zero Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const w = (num) => {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' '+ones[num%10] : '');
    return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' '+w(num%100) : '');
  };
  const parts = [];
  if (n >= 10000000) { parts.push(w(Math.floor(n/10000000))+' Crore'); n %= 10000000; }
  if (n >= 100000)   { parts.push(w(Math.floor(n/100000))+' Lakh');   n %= 100000;   }
  if (n >= 1000)     { parts.push(w(Math.floor(n/1000))+' Thousand'); n %= 1000;     }
  if (n > 0)         parts.push(w(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

/* ---------- Payslip Detail View (greythr style) ---------- */
function PayslipDetail({ payslip, onBack }) {
  // Fetch PL leave balance for the payslip's financial year
  const [plAvailed, setPlAvailed] = useState(null);
  const [plPending, setPlPending] = useState(null);

  useEffect(() => {
    const month = payslip.month; // 'YYYY-MM'
    if (!month) return;
    const [y, m] = month.split('-').map(Number);
    // FY: Apr–Mar; if month < April, FY start = y-1, else y
    const fyStart = m < 4 ? y - 1 : y;
    api.get(`/leave/balance?year=${fyStart}`)
      .then(res => {
        const pl = (res.data || []).find(b => b.leaveType?.code === 'PL');
        if (pl) {
          setPlAvailed(pl.used ?? 0);
          setPlPending(pl.available ?? 0);
        }
      })
      .catch(() => {}); // silently ignore — payslip still renders
  }, [payslip.month]);

  const totalDays = payslip.workingDays || 30;
  const presentDays = payslip.presentDays ?? payslip.paidDays ?? totalDays;
  const lopDays = payslip.lopDays || 0;
  const hasLop = lopDays > 0;
  const earnFrac = totalDays > 0 ? presentDays / totalDays : 1;

  const isVariable = (name) => {
    const l = (name || '').toLowerCase();
    return l.includes('sunday') || l.includes('off day') || l.includes('offday') || l.includes('holiday allow') || l.includes('reimburs');
  };

  const prorate = (amount, variable = false) => {
    if (!amount) return 0;
    if (!hasLop || variable) return amount;
    return Math.round(amount * earnFrac);
  };

  // Build earnings rows: { label, master, actual }
  const earningsRows = (() => {
    let rows;
    if (Array.isArray(payslip.earningsBreakdown) && payslip.earningsBreakdown.length > 0) {
      rows = payslip.earningsBreakdown
        .filter(c => (c.amount || 0) > 0)
        .map(c => {
          const vari = isVariable(c.name);
          return { label: (c.name || '').toUpperCase(), master: c.amount, actual: prorate(c.amount, vari) };
        });
    } else {
      rows = [
        payslip.basic > 0          && { label: 'BASIC',                                                  master: payslip.basic,           actual: prorate(payslip.basic) },
        payslip.hra > 0            && { label: 'HRA',                                                    master: payslip.hra,             actual: prorate(payslip.hra) },
        payslip.da > 0             && { label: 'DEARNESS ALLOWANCE',                                     master: payslip.da,              actual: prorate(payslip.da) },
        payslip.specialAllowance>0 && { label: 'SPECIAL ALLOWANCE',                                      master: payslip.specialAllowance, actual: prorate(payslip.specialAllowance) },
        payslip.otherAllowance > 0 && { label: (payslip.otherAllowanceLabel||'OTHER ALLOWANCE').toUpperCase(), master: payslip.otherAllowance, actual: prorate(payslip.otherAllowance) },
      ].filter(Boolean);
      if (payslip.offDayAllowance > 0) {
        rows.push({ label: 'SUNDAY ALLOWANCE', master: payslip.offDayAllowance, actual: payslip.offDayAllowance });
      }
    }
    if (payslip.reimbursements > 0) {
      rows.push({ label: 'REIMBURSEMENTS', master: payslip.reimbursements, actual: payslip.reimbursements });
    }
    return rows;
  })();

  const deductionsRows = [
    payslip.employeePf > 0             && { label: 'PF',                                                            actual: payslip.employeePf },
    payslip.employeeEsi > 0            && { label: 'ESI',                                                           actual: payslip.employeeEsi },
    payslip.professionalTax > 0        && { label: 'PROF TAX',                                                      actual: payslip.professionalTax },
    payslip.tds > 0                    && { label: 'INCOME TAX (TDS)',                                              actual: payslip.tds },
    payslip.salaryAdvanceDeduction > 0 && { label: 'SALARY ADVANCE',                                               actual: payslip.salaryAdvanceDeduction },
    payslip.otherDeductions > 0        && { label: (payslip.otherDeductionsLabel||'OTHER DEDUCTIONS').toUpperCase(), actual: payslip.otherDeductions },
  ].filter(Boolean);

  const totalMaster = earningsRows.reduce((s, r) => s + r.master, 0);
  const totalActual = earningsRows.reduce((s, r) => s + r.actual, 0);
  const totalDed    = deductionsRows.reduce((s, r) => s + r.actual, 0);
  const maxRows     = Math.max(earningsRows.length, deductionsRows.length);

  const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const printDate = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });

  // Employee info — sourced from the enriched user include on the payslip
  const companyName  = payslip.companyName                                     || 'COLOR PAPERS INDIA PRIVATE LIMITED';
  const empName      = payslip.employeeName || payslip.user?.name              || '-';
  const empId        = payslip.employeeCode || payslip.user?.employeeId        || '-';
  const designation  = payslip.user?.designation  || payslip.designation       || '-';
  const department   = payslip.user?.department                                || '-';
  const doj          = payslip.user?.dateOfJoining || payslip.dateOfJoining    || '-';
  const pfUan        = payslip.user?.uanNumber                                 || '-';   // from User.uanNumber
  const bankName     = payslip.user?.bankName                                  || '-';   // from User.bankName
  const bankAccount  = payslip.user?.bankAccountNumber                         || '-';   // from User.bankAccountNumber
  const panNumber    = payslip.user?.panNumber                                 || '-';   // from User.panNumber
  const location     = payslip.user?.branch?.name || payslip.user?.location   || '-';   // from User.branch.name or User.location

  // border/cell style helpers
  const tdBorderR  = { borderRight: '1px solid #bbb' };
  const tdBorderR2 = { borderRight: '2px solid #888' };
  const cellPad    = { padding: '5px 10px' };
  const hdrCell    = { padding: '6px 10px', fontWeight: 'bold', background: '#e4e4e4' };

  return (
    <div className="space-y-4">
      {/* Controls — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Payslips
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </div>

      {/* ── Payslip Document ── */}
      <div
        id="payslip-doc"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px', background: '#fff',
                 border: '1px solid #aaa', maxWidth: '820px', margin: '0 auto' }}
      >
        {/* inject print CSS */}
        <style>{`
          @media print {
            .print\\:hidden { display: none !important; }
            body { margin: 0; }
            #payslip-doc { border: none; }
          }
        `}</style>

        {/* ── Company Header ── */}
        <div style={{ textAlign: 'center', padding: '14px 20px 10px', borderBottom: '2px solid #555' }}>
          <div style={{ fontSize: '17px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{companyName}</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
            Payslip for the month of {formatMonth(payslip.month)}
          </div>
        </div>

        {/* ── Employee Info ── */}
        <div style={{ borderBottom: '1px solid #999' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              {[
                ['Name',            empName,     'Employee No',  empId       ],
                ['Designation',     designation, 'Bank Name',    bankName    ],
                ['Department',      department,  'Bank Acc No',  bankAccount ],
                ['Date of Joining', doj,         'PAN Number',   panNumber   ],
                ['PF UAN',          pfUan,       'Location',     location    ],
              ].map(([l1, v1, l2, v2], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ ...cellPad, fontWeight: '600', color: '#444', width: '18%' }}>{l1}</td>
                  <td style={{ ...cellPad, width: '32%', ...tdBorderR }}>{v1}</td>
                  <td style={{ ...cellPad, fontWeight: '600', color: '#444', width: '18%' }}>{l2}</td>
                  <td style={{ ...cellPad, width: '32%' }}>{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Attendance ── */}
        <div style={{ borderBottom: '1px solid #999' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              <tr>
                {[
                  ['Days Present', presentDays],
                  ['Days Paid',    totalDays],
                  ['PL Availed',   plAvailed ?? '-'],   // from /api/leave/balance
                  ['PL Pending',   plPending ?? '-'],   // from /api/leave/balance
                  ['LOP',          lopDays],
                ].map(([label, val], i) => (
                  <td key={i} style={{ ...cellPad, borderRight: i < 4 ? '1px solid #ddd' : 'none' }}>
                    <strong>{label}</strong>: {val}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Earnings + Deductions Table ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', borderBottom: '1px solid #999' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #888' }}>
              <td style={{ ...hdrCell, width: '28%', ...tdBorderR }}>Earnings</td>
              <td style={{ ...hdrCell, width: '12%', textAlign: 'right', ...tdBorderR }}>Master</td>
              <td style={{ ...hdrCell, width: '12%', textAlign: 'right', ...tdBorderR2 }}>Actual</td>
              <td style={{ ...hdrCell, width: '28%', ...tdBorderR }}>Deductions</td>
              <td style={{ ...hdrCell, width: '12%', textAlign: 'right' }}>Actual</td>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => {
              const earn = earningsRows[i];
              const ded  = deductionsRows[i];
              return (
                <tr key={i} style={{ borderBottom: '1px solid #eee', background: i % 2 === 1 ? '#fafafa' : '#fff' }}>
                  <td style={{ ...cellPad, ...tdBorderR }}>{earn?.label || ''}</td>
                  <td style={{ ...cellPad, textAlign: 'right', ...tdBorderR }}>{earn ? fmtINR(earn.master) : ''}</td>
                  <td style={{ ...cellPad, textAlign: 'right', ...tdBorderR2 }}>{earn ? fmtINR(earn.actual) : ''}</td>
                  <td style={{ ...cellPad, ...tdBorderR }}>{ded?.label || ''}</td>
                  <td style={{ ...cellPad, textAlign: 'right' }}>{ded ? fmtINR(ded.actual) : ''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #888', fontWeight: 'bold', background: '#ececec' }}>
              <td style={{ ...cellPad, ...tdBorderR }}>Total Earnings:INR.</td>
              <td style={{ ...cellPad, textAlign: 'right', ...tdBorderR }}>{fmtINR(totalMaster)}</td>
              <td style={{ ...cellPad, textAlign: 'right', ...tdBorderR2 }}>{fmtINR(totalActual)}</td>
              <td style={{ ...cellPad, ...tdBorderR }}>Total Deductions:INR.</td>
              <td style={{ ...cellPad, textAlign: 'right' }}>{fmtINR(totalDed)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── Net Pay ── */}
        <div style={{ padding: '10px 12px 2px', textAlign: 'right' }}>
          <strong style={{ fontSize: '13px' }}>
            Net Pay for the month: {fmtINR(payslip.netPay)}
          </strong>
        </div>
        <div style={{ padding: '2px 12px 10px', textAlign: 'right', fontStyle: 'italic', fontSize: '12px' }}>
          ({rupeeWords(payslip.netPay)})
        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid #ccc', padding: '10px 12px 4px', textAlign: 'center', fontSize: '11px', color: '#666' }}>
          This is a system generated payslip and does not require a signature
        </div>
        <div style={{ padding: '2px 12px 10px', fontSize: '11px', color: '#666' }}>
          Print Date:{printDate}
        </div>
      </div>
    </div>
  );
}

/* ---------- Loading State ---------- */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
      <p className="text-sm text-slate-500">Loading your payslips...</p>
    </div>
  );
}

/* ---------- Error State ---------- */
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="p-4 bg-red-50 rounded-full mb-4">
        <FileText className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-sm text-slate-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

/* ---------- YTD Summary ---------- */
function YtdSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fy, setFy] = useState(() => {
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  });

  useEffect(() => {
    const fetchYtd = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/payroll/ytd-summary?fy=${fy}`);
        setData(res.data);
      } catch (err) {
        setError('Failed to load YTD summary');
      } finally {
        setLoading(false);
      }
    };
    fetchYtd();
  }, [fy]);

  // Generate FY options (last 3 years)
  const fyOptions = [];
  const now = new Date();
  const currentStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = 0; i < 3; i++) {
    const y = currentStartYear - i;
    fyOptions.push(`${y}-${y + 1}`);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mr-2" />
      <span className="text-slate-500">Loading YTD summary...</span>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
  );

  if (!data || data.monthCount === 0) return (
    <div className="text-center py-16 text-slate-400">
      <BarChart3 className="w-10 h-10 mx-auto mb-3" />
      <p className="text-sm">No published payslips for FY {fy}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* FY Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          Year-to-Date Summary
        </h2>
        <select value={fy} onChange={e => setFy(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          {fyOptions.map(f => <option key={f} value={f}>FY {f}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Gross</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(data.totals.grossEarnings)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{data.monthCount} months</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Deductions</p>
          <p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(data.totals.totalDeductions)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Net Pay</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(data.totals.netPay)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Tax (TDS)</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(data.totals.tds)}</p>
          <p className="text-xs text-slate-400 mt-0.5">PF: {formatCurrency(data.totals.employeePf)}</p>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Month</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Gross</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">PF</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Tax</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">LOP</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Deductions</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 bg-emerald-50">Net Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.monthly.map((m, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-slate-700">{formatMonth(m.month)}</td>
                <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(m.grossEarnings)}</td>
                <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(m.employeePf)}</td>
                <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(m.tds)}</td>
                <td className="text-right px-4 py-3 text-red-500">{formatCurrency(m.lopDeduction)}</td>
                <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(m.totalDeductions)}</td>
                <td className="text-right px-4 py-3 font-bold text-emerald-700 bg-emerald-50/50">{formatCurrency(m.netPay)}</td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-4 py-3 text-slate-800">Total ({data.monthCount} months)</td>
              <td className="text-right px-4 py-3">{formatCurrency(data.totals.grossEarnings)}</td>
              <td className="text-right px-4 py-3">{formatCurrency(data.totals.employeePf)}</td>
              <td className="text-right px-4 py-3">{formatCurrency(data.totals.tds)}</td>
              <td className="text-right px-4 py-3 text-red-500">{formatCurrency(data.totals.lopDeduction)}</td>
              <td className="text-right px-4 py-3">{formatCurrency(data.totals.totalDeductions)}</td>
              <td className="text-right px-4 py-3 font-bold text-emerald-700 bg-emerald-50/50">{formatCurrency(data.totals.netPay)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Employer Contribution Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Employer Contributions (FY {fy})</h4>
        <div className="flex gap-6 text-sm">
          <span className="text-blue-700">Employer PF: <strong>{formatCurrency(data.totals.employerPf)}</strong></span>
          <span className="text-blue-700">Employer ESI: <strong>{formatCurrency(data.totals.employerEsi)}</strong></span>
          <span className="text-blue-700">Total CTC: <strong>{formatCurrency(data.totals.grossEarnings + data.totals.employerPf + data.totals.employerEsi)}</strong></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Empty State ---------- */
function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <Wallet className="w-10 h-10 text-slate-300" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          No Payslips Available Yet
        </h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Your payslips will appear here once they are generated and published by
          the payroll team. Check back after your first pay cycle.
        </p>
      </div>
    </div>
  );
}

/* ---------- Salary Revision History ---------- */
function SalaryRevisionHistory() {
  const { user } = useAuth();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/payroll/salary/${user.id}/revisions`)
      .then(r => setRevisions(r.data || []))
      .catch(() => setError('Failed to load revision history.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
      <span className="text-slate-500 text-sm">Loading revisions...</span>
    </div>
  );

  if (error) return (
    <div className="text-center py-16 text-red-500 text-sm">{error}</div>
  );

  if (revisions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <ArrowUpDown className="w-10 h-10 mb-3" />
      <p className="text-base font-medium text-slate-500">No salary revisions yet</p>
      <p className="text-sm mt-1">Your salary history will appear here when revisions are applied.</p>
    </div>
  );

  const latest = revisions[0];
  const isLatestInc = latest.revisionType === 'increment';
  const isLatestDec = latest.revisionType === 'decrement';
  const latestDiff = latest.newCtc - latest.oldCtc;
  const latestPct = latest.oldCtc > 0 ? ((latestDiff / latest.oldCtc) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Latest Revision Banner */}
      {(isLatestInc || isLatestDec) && (
        <div className={`rounded-2xl p-5 border-2 ${isLatestInc ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isLatestInc ? 'bg-green-100' : 'bg-amber-100'}`}>
                {isLatestInc
                  ? <TrendingUp className="w-6 h-6 text-green-600" />
                  : <TrendingDown className="w-6 h-6 text-amber-600" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isLatestInc ? 'text-green-800' : 'text-amber-800'}`}>
                  {isLatestInc ? 'Salary Increment Applied' : 'Salary Revision Applied'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Effective from {latest.effectiveFrom} · Updated on {new Date(latest.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                {latest.reason && <p className="text-xs text-slate-500 italic mt-0.5">"{latest.reason}"</p>}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-bold ${isLatestInc ? 'text-green-700' : 'text-amber-700'}`}>
                {isLatestInc ? '+' : ''}{latestPct.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">
                {isLatestInc ? '+' : ''}{formatCurrency(latestDiff)}/yr
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-white rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-400">Previous CTC</p>
              <p className="text-sm font-bold text-slate-700">{formatCurrency(latest.oldCtc)}</p>
              <p className="text-xs text-slate-400">per year</p>
            </div>
            <div className={`rounded-xl p-3 border ${isLatestInc ? 'bg-green-100 border-green-200' : 'bg-amber-100 border-amber-200'}`}>
              <p className="text-xs text-slate-500">New CTC</p>
              <p className={`text-sm font-bold ${isLatestInc ? 'text-green-800' : 'text-amber-800'}`}>{formatCurrency(latest.newCtc)}</p>
              <p className="text-xs text-slate-400">per year</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-400">Monthly Approx.</p>
              <p className="text-sm font-bold text-slate-700">{formatCurrency(latest.newCtc / 12)}</p>
              <p className="text-xs text-slate-400">per month</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          Complete Revision History
        </h3>
        <div className="space-y-3">
          {revisions.map((r, i) => {
            const diff = r.newCtc - r.oldCtc;
            const pct = r.oldCtc > 0 ? ((diff / r.oldCtc) * 100) : 0;
            const isInc = r.revisionType === 'increment';
            const isDec = r.revisionType === 'decrement';
            return (
              <div key={r.id} className={`bg-white rounded-xl border p-4 ${isInc ? 'border-l-4 border-l-green-500' : isDec ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-slate-300'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isInc ? 'bg-green-100 text-green-700' : isDec ? 'bg-red-100 text-red-600' : r.revisionType === 'initial' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isInc ? '↑ INCREMENT' : isDec ? '↓ DECREMENT' : r.revisionType === 'initial' ? '• INITIAL SETUP' : '≡ MANUAL UPDATE'}
                      </span>
                      {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Current</span>}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-slate-800">{formatCurrency(r.newCtc)}</span>
                      <span className="text-xs text-slate-400">per year</span>
                      {r.oldCtc > 0 && (
                        <span className={`text-xs font-semibold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          ({diff >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {r.oldCtc > 0 && <span>Previously {formatCurrency(r.oldCtc)}/yr · </span>}
                      Effective {r.effectiveFrom}
                    </div>
                    {r.reason && <div className="text-xs text-slate-500 mt-1 italic">"{r.reason}"</div>}
                  </div>
                  <div className="text-right text-xs text-slate-400 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
