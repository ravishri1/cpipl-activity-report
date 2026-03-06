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
  Receipt,
  Briefcase,
  Building2,
  User,
  Hash,
} from 'lucide-react';
import api from '../../utils/api';

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
    </div>
  );
}

/* ---------- Salary Summary ---------- */
function SalarySummary({ payslip }) {
  const stats = [
    {
      label: 'Monthly CTC',
      value: formatCurrency(payslip.grossEarnings + (payslip.employerPf || 0) + (payslip.employerEsi || 0)),
      icon: IndianRupee,
      color: 'blue',
    },
    {
      label: 'Gross Earnings',
      value: formatCurrency(payslip.grossEarnings),
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
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">
            Gross
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {formatCurrency(payslip.grossEarnings)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">
            Deductions
          </p>
          <p className="text-sm font-semibold text-red-600">
            {formatCurrency(payslip.totalDeductions)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wider">
            LOP Days
          </p>
          <p className="text-sm font-semibold text-slate-700">
            {payslip.lopDays || 0}
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

/* ---------- Payslip Detail View ---------- */
function PayslipDetail({ payslip, onBack }) {
  const earnings = [
    { label: 'Basic Salary', value: payslip.basic },
    { label: 'House Rent Allowance', value: payslip.hra },
    { label: 'Dearness Allowance', value: payslip.da },
    { label: 'Special Allowance', value: payslip.specialAllowance },
    { label: 'Medical Allowance', value: payslip.medicalAllowance },
    { label: 'Conveyance Allowance', value: payslip.conveyanceAllowance },
    { label: 'Other Allowances', value: payslip.otherAllowance },
  ].filter((item) => item.value && item.value > 0);

  const deductions = [
    { label: 'Employee PF', value: payslip.employeePf },
    { label: 'ESI', value: payslip.employeeEsi },
    { label: 'Professional Tax', value: payslip.professionalTax },
    { label: 'TDS / Income Tax', value: payslip.tds },
    { label: 'LOP Deduction', value: payslip.lopDeduction },
    { label: 'Other Deductions', value: payslip.otherDeductions },
  ].filter((item) => item.value && item.value > 0);

  const maxRows = Math.max(earnings.length, deductions.length);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Payslips
      </button>

      {/* Payslip Document */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Document Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-5 h-5 opacity-80" />
                <h2 className="text-lg font-bold tracking-wide">
                  {payslip.companyName || 'CPIPL'}
                </h2>
              </div>
              <p className="text-emerald-100 text-sm">
                Payslip for {formatMonth(payslip.month)}
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Receipt className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Employee Info */}
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem
              icon={User}
              label="Employee Name"
              value={payslip.employeeName || payslip.user?.name || '-'}
            />
            <InfoItem
              icon={Hash}
              label="Employee ID"
              value={payslip.employeeCode || payslip.user?.employeeId || '-'}
            />
            <InfoItem
              icon={Briefcase}
              label="Department"
              value={payslip.user?.department || '-'}
            />
            <InfoItem
              icon={Briefcase}
              label="Designation"
              value={payslip.user?.designation || '-'}
            />
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Shift</p>
              {payslip.user?.shift ? (
                <div className="text-sm font-medium text-slate-700">
                  <p>{payslip.user.shift.name}</p>
                  <p className="text-xs text-slate-500">{payslip.user.shift.startTime} - {payslip.user.shift.endTime}</p>
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-500">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Info */}
        <div className="px-8 py-4 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-500 font-medium mb-0.5">
                Working Days
              </p>
              <p className="text-lg font-bold text-blue-700">
                {payslip.workingDays ?? '-'}
              </p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs text-emerald-500 font-medium mb-0.5">
                Present Days
              </p>
              <p className="text-lg font-bold text-emerald-700">
                {payslip.presentDays ?? payslip.paidDays ?? '-'}
              </p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-500 font-medium mb-0.5">
                LOP Days
              </p>
              <p className="text-lg font-bold text-amber-700">
                {payslip.lopDays ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions Table */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Earnings
                </h3>
              </div>
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {earnings.map((item, index) => (
                      <tr
                        key={item.label}
                        className={
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        }
                      >
                        <td className="px-4 py-2.5 text-sm text-slate-600">
                          {item.label}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-800 text-right">
                          {formatCurrency(item.value)}
                        </td>
                      </tr>
                    ))}
                    {/* Pad empty rows to align columns */}
                    {Array.from({
                      length: Math.max(0, maxRows - earnings.length),
                    }).map((_, i) => (
                      <tr
                        key={`pad-e-${i}`}
                        className={
                          (earnings.length + i) % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50'
                        }
                      >
                        <td className="px-4 py-2.5 text-sm">&nbsp;</td>
                        <td className="px-4 py-2.5 text-sm">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-emerald-200 bg-emerald-50">
                      <td className="px-4 py-3 text-sm font-bold text-emerald-800">
                        Gross Earnings
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-800 text-right">
                        {formatCurrency(payslip.grossEarnings)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Deductions Column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Deductions
                </h3>
              </div>
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {deductions.map((item, index) => (
                      <tr
                        key={item.label}
                        className={
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                        }
                      >
                        <td className="px-4 py-2.5 text-sm text-slate-600">
                          {item.label}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-red-600 text-right">
                          {formatCurrency(item.value)}
                        </td>
                      </tr>
                    ))}
                    {/* Pad empty rows */}
                    {Array.from({
                      length: Math.max(0, maxRows - deductions.length),
                    }).map((_, i) => (
                      <tr
                        key={`pad-d-${i}`}
                        className={
                          (deductions.length + i) % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50'
                        }
                      >
                        <td className="px-4 py-2.5 text-sm">&nbsp;</td>
                        <td className="px-4 py-2.5 text-sm">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-red-200 bg-red-50">
                      <td className="px-4 py-3 text-sm font-bold text-red-800">
                        Total Deductions
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-red-800 text-right">
                        {formatCurrency(payslip.totalDeductions)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Net Pay Footer */}
        <div className="mx-8 mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-0.5">
                Net Pay
              </p>
              <p className="text-xs text-slate-500">
                (Gross Earnings - Total Deductions)
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-700">
                {formatCurrency(payslip.netPay)}
              </p>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            This is a system-generated payslip and does not require a signature.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Info Item ---------- */
function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="p-1 bg-white rounded-md border border-slate-200 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div>
        <p className="text-[11px] text-slate-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
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
