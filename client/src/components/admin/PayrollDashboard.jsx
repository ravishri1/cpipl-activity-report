import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  FileText,
  Download,
  Send,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Users,
  IndianRupee,
  ChevronDown,
  ChevronUp,
  Calendar,
  Loader2,
  X,
  Building2,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Lock,
  Unlock,
  LayoutDashboard,
  UserPlus,
  UserMinus,
  Ban,
  Handshake,
  Play,
  ArrowUpDown,
  PauseCircle,
  PlayCircle,
  Calculator,
  Banknote,
  Shield,
  FileDown,
  CheckSquare,
  Square,
  ExternalLink,
  ListChecks,
  SkipForward,
  Plus,
} from 'lucide-react';
import api from '../../utils/api';
import OffDayAllowanceManager from './OffDayAllowanceManager';
import PayrollDeductions from './PayrollDeductions';
import PayrollAdditions from './PayrollAdditions';

const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCurrencyDecimal = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const config = {
    draft: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: Clock,
      label: 'Draft',
    },
    generated: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: FileText,
      label: 'Generated',
    },
    published: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
      icon: CheckCircle,
      label: 'Published',
    },
  };

  const cfg = config[status] || config.draft;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, subtitle, color = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  };

  const icons = {
    success: CheckCircle,
    error: AlertTriangle,
    info: FileText,
    warning: AlertTriangle,
  };

  const Icon = icons[type] || icons.info;

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${styles[type]}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const PayslipDetail = ({ payslip }) => {
  if (!payslip) return null;

  const earnings = [
    { label: 'Basic Salary', value: payslip.basic },
    { label: 'House Rent Allowance (HRA)', value: payslip.hra },
    { label: 'Dearness Allowance (DA)', value: payslip.da },
    { label: 'Special Allowance', value: payslip.specialAllowance },
    { label: 'Medical Allowance', value: payslip.medicalAllowance },
    { label: 'Conveyance Allowance', value: payslip.conveyanceAllowance },
    { label: payslip.otherAllowanceLabel || 'Other Allowances', value: payslip.otherAllowance },
    { label: `Off-Day Allowance${payslip.offDaysWorked > 0 ? ` (${payslip.offDaysWorked} days)` : ''}`, value: payslip.offDayAllowance },
    { label: payslip.otherAdditionsLabel || 'Special Addition', value: payslip.otherAdditions },
  ];

  const deductions = [
    { label: 'Employee PF', value: payslip.employeePf },
    { label: 'ESI', value: payslip.employeeEsi },
    { label: 'Professional Tax (PT)', value: payslip.professionalTax },
    { label: 'TDS / Income Tax', value: payslip.tds },
    { label: 'Other Deductions', value: payslip.otherDeductions },
    { label: 'LOP Deduction', value: payslip.lopDeduction, highlight: true },
  ];

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-5">
      {/* Working Days Info */}
      <div className="flex flex-wrap gap-6 mb-5">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">
            Working Days:{' '}
            <span className="font-semibold text-slate-900">
              {payslip.workingDays ?? '-'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-slate-600">
            Present Days:{' '}
            <span className="font-semibold text-slate-900">
              {payslip.presentDays ?? '-'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-slate-600">
            LOP Days:{' '}
            <span className="font-semibold text-red-600">
              {payslip.lopDays ?? 0}
            </span>
          </span>
        </div>
      </div>

      {/* Earnings and Deductions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Earnings */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-green-50 border-b border-green-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-semibold text-green-800">Earnings</h4>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {earnings.map(
              (item) =>
                item.value != null &&
                item.value !== 0 && (
                  <div
                    key={item.label}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrencyDecimal(item.value)}
                    </span>
                  </div>
                )
            )}
            <div className="flex items-center justify-between px-4 py-3 bg-green-50">
              <span className="text-sm font-semibold text-green-800">
                Gross Earnings
              </span>
              <span className="text-sm font-bold text-green-800">
                {formatCurrencyDecimal(payslip.grossEarnings)}
              </span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="bg-red-50 border-b border-red-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h4 className="text-sm font-semibold text-red-800">Deductions</h4>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {deductions.map(
              (item) =>
                item.value != null &&
                item.value !== 0 && (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between px-4 py-2.5 ${
                      item.highlight ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        item.highlight
                          ? 'text-amber-700 font-medium'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        item.highlight ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrencyDecimal(item.value)}
                    </span>
                  </div>
                )
            )}
            <div className="flex items-center justify-between px-4 py-3 bg-red-50">
              <span className="text-sm font-semibold text-red-800">
                Total Deductions
              </span>
              <span className="text-sm font-bold text-red-800">
                {formatCurrencyDecimal(payslip.totalDeductions)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="mt-5 bg-white rounded-lg border-2 border-green-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-green-600" />
            <span className="text-base font-semibold text-slate-700">
              Net Pay
            </span>
          </div>
          <span className="text-2xl font-bold text-green-600">
            {formatCurrencyDecimal(payslip.netPay)}
          </span>
        </div>
      </div>
    </div>
  );
};

const PayRegister = ({ month }) => {
  const [registerData, setRegisterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRegister = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/payroll/pay-register?month=${month}`
      );
      setRegisterData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pay register');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchRegister();
  }, [fetchRegister]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-sm text-slate-500">
          Loading pay register...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={fetchRegister}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!registerData) return null;

  const { totals, departments } = registerData;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="Total Gross Pay"
            value={formatCurrency(totals.totalGross)}
            color="green"
          />
          <StatCard
            icon={TrendingDown}
            label="Total Deductions"
            value={formatCurrency(totals.totalDeductions)}
            color="amber"
          />
          <StatCard
            icon={IndianRupee}
            label="Total Net Pay"
            value={formatCurrency(totals.totalNetPay)}
            color="blue"
          />
          <StatCard
            icon={AlertTriangle}
            label="Total LOP Deduction"
            value={formatCurrency(totals.totalLopDeduction)}
            color="purple"
          />
        </div>
      )}

      {/* Department Breakdown */}
      {departments && departments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">
                Department-wise Breakdown
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">
                    Department
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">
                    Employees
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Gross Pay
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Deductions
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((dept, idx) => (
                  <tr
                    key={dept.department || idx}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {dept.department || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {dept.count}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">
                      {formatCurrency(dept.gross)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">
                      {formatCurrency(dept.deductions)}
                    </td>
                    <td className="px-5 py-3 text-right text-green-600 font-bold">
                      {formatCurrency(dept.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {departments.length > 1 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300">
                    <td className="px-5 py-3 font-bold text-slate-900">
                      Total
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {departments.reduce(
                        (sum, d) => sum + (d.count || 0),
                        0
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(
                        departments.reduce(
                          (sum, d) => sum + (d.gross || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {formatCurrency(
                        departments.reduce(
                          (sum, d) => sum + (d.deductions || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-green-600">
                      {formatCurrency(
                        departments.reduce(
                          (sum, d) => sum + (d.netPay || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {(!departments || departments.length === 0) && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Building2 className="w-10 h-10 mb-3" />
          <p className="text-sm">
            No pay register data available for this month
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// P5: Stop Salary Card Component
// ═══════════════════════════════════════════════

const StopSalaryCard = ({ stoppedCount, onRefresh }) => {
  const [stopped, setStopped] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopForm, setStopForm] = useState({ userId: '', reason: '' });
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

  const fetchStopped = async () => {
    try {
      const res = await api.get('/payroll/stopped-employees');
      setStopped(res.data);
      setLoaded(true);
    } catch {}
  };

  useEffect(() => { if (stoppedCount > 0 || !loaded) fetchStopped(); }, [stoppedCount]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users/directory');
      setEmployees((res.data?.users || res.data || []).filter(u => u.isActive));
    } catch {}
  };

  const handleStop = async () => {
    if (!stopForm.userId || !stopForm.reason.trim()) return;
    setSaving(true);
    try {
      await api.put(`/payroll/stop-salary/${stopForm.userId}`, { reason: stopForm.reason });
      setShowStopModal(false);
      setStopForm({ userId: '', reason: '' });
      fetchStopped();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to stop salary');
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (userId) => {
    if (!window.confirm('Release salary processing for this employee?')) return;
    try {
      await api.put(`/payroll/release-salary/${userId}`);
      fetchStopped();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to release');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <PauseCircle className="w-4 h-4 text-red-500" />
          Stop Salary Processing
          {stoppedCount > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{stoppedCount}</span>}
        </h4>
        <button onClick={() => { setShowStopModal(true); fetchEmployees(); }}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Stop</button>
      </div>

      {stopped.length > 0 ? (
        <div className="space-y-2">
          {stopped.slice(0, 3).map(s => (
            <div key={s.userId} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-700">{s.user?.name} ({s.user?.employeeId})</p>
                <p className="text-[10px] text-slate-400">{s.stopSalaryReason}</p>
              </div>
              <button onClick={() => handleRelease(s.userId)}
                className="text-[10px] text-green-600 hover:text-green-700 font-medium flex items-center gap-0.5">
                <PlayCircle className="w-3 h-3" /> Release
              </button>
            </div>
          ))}
          {stopped.length > 3 && <p className="text-xs text-blue-500 font-medium">+{stopped.length - 3} more</p>}
        </div>
      ) : (
        <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
      )}

      {/* Stop Modal */}
      {showStopModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowStopModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Stop Salary Processing</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-600 block mb-1">Employee</label>
                <select value={stopForm.userId} onChange={e => setStopForm(p => ({ ...p, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  <option value="">Select employee...</option>
                  {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Reason</label>
                <input type="text" value={stopForm.reason} onChange={e => setStopForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g., Extended leave, Suspension..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowStopModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200">Cancel</button>
              <button onClick={handleStop} disabled={saving || !stopForm.userId || !stopForm.reason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Stopping...' : 'Stop Salary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Statutory Report Component ─────────────────────────────────────────────────
const StatutoryReport = ({ month }) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    if (!month) return;
    setLoading(true); setError('');
    api.get(`/payroll/statutory?month=${month}`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error || 'Failed to load statutory data.'))
      .finally(() => setLoading(false));
  }, [month]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/payroll/statutory-export?month=${month}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `statutory_${month}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Download failed.'); }
    setDownloading(false);
  };

  if (loading) return <div className="py-12 text-center text-slate-400">Loading statutory data…</div>;
  if (error)   return <div className="py-8 text-center text-red-500">{error}</div>;
  if (!data)   return null;

  const t = data.totals || {};
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Statutory Compliance — {month}</h3>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          {downloading ? 'Downloading…' : 'Export Excel'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total PF (Emp + Employer)', value: formatCurrency(t.totalPf), color: 'bg-blue-50 text-blue-700' },
          { label: 'Total ESI (Emp + Employer)', value: formatCurrency(t.totalEsi), color: 'bg-teal-50 text-teal-700' },
          { label: 'Total TDS', value: formatCurrency(t.tds), color: 'bg-amber-50 text-amber-700' },
          { label: 'Total Prof. Tax', value: formatCurrency(t.professionalTax), color: 'bg-purple-50 text-purple-700' },
        ].map(c => (
          <div key={c.label} className={`${c.color} rounded-xl p-4`}>
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Gross</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-blue-600 uppercase">Emp PF</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-blue-500 uppercase">Er PF</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-teal-600 uppercase">Emp ESI</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-teal-500 uppercase">Er ESI</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-amber-600 uppercase">TDS</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-purple-600 uppercase">P.Tax</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-green-600 uppercase">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows || []).map(r => (
                <tr key={r.userId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.employeeId} · {r.department}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(r.grossEarnings)}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(r.employeePf)}</td>
                  <td className="px-3 py-2 text-right text-blue-500">{formatCurrency(r.employerPf)}</td>
                  <td className="px-3 py-2 text-right text-teal-600">{formatCurrency(r.employeeEsi)}</td>
                  <td className="px-3 py-2 text-right text-teal-500">{formatCurrency(r.employerEsi)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{formatCurrency(r.tds)}</td>
                  <td className="px-3 py-2 text-right text-purple-600">{formatCurrency(r.professionalTax)}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-600">{formatCurrency(r.netPay)}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                <td className="px-3 py-2.5 text-slate-700">TOTAL ({data.headcount})</td>
                <td className="px-3 py-2.5 text-right text-slate-600">{formatCurrency(t.grossEarnings)}</td>
                <td className="px-3 py-2.5 text-right text-blue-600">{formatCurrency(t.employeePf)}</td>
                <td className="px-3 py-2.5 text-right text-blue-500">{formatCurrency(t.employerPf)}</td>
                <td className="px-3 py-2.5 text-right text-teal-600">{formatCurrency(t.employeeEsi)}</td>
                <td className="px-3 py-2.5 text-right text-teal-500">{formatCurrency(t.employerEsi)}</td>
                <td className="px-3 py-2.5 text-right text-amber-600">{formatCurrency(t.tds)}</td>
                <td className="px-3 py-2.5 text-right text-purple-600">{formatCurrency(t.professionalTax)}</td>
                <td className="px-3 py-2.5 text-right text-green-600">{formatCurrency(t.netPay)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Process Payroll Wizard ──────────────────────────────────────────────────
function ProcessPayrollWizard({ month, companyId, targetUserId, targetUserName, onClose, onDone }) {
  const [step, setStep] = useState(1); // 1=checklist, 2=scanning, 3=review, 4=confirm, 5=generating, 6=done
  const [checks, setChecks] = useState(null);
  const [scanErr, setScanErr] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [genErr, setGenErr] = useState(null);

  const scopeLabel = targetUserId ? `for ${targetUserName}` : 'for all employees';

  // Step 2: scan (triggered manually after checklist)
  const runScan = () => {
    setStep(2);
    api.get(`/payroll/process-check?month=${month}&companyId=${companyId}`)
      .then(r => { setChecks(r.data); setStep(3); })
      .catch(e => { setScanErr(e.response?.data?.message || 'Scan failed'); setStep(3); });
  };

  const runGenerate = async () => {
    setStep(5);
    try {
      const body = { month, companyId, ...(targetUserId ? { userId: targetUserId } : {}) };
      const r = await api.post('/payroll/generate', body, { timeout: 120000 }); // 2-min timeout for payroll generate
      setGenerateResult(r.data);
      setStep(6);
      onDone?.();
    } catch (e) {
      setGenErr(e.response?.data?.message || e.response?.data?.error || (e.code === 'ECONNABORTED' ? 'Timed out — server is still processing, check Payslips tab in 30s' : 'Generation failed — ' + (e.message || 'unknown error')));
      setStep(6);
    }
  };

  const CHECK_STATUS = {
    ok:      { icon: '✅', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    warning: { icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    info:    { icon: 'ℹ️', color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
    pending: { icon: '🕐', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
  };

  const CHECK_LINKS = {
    'Salary structures set':          `/admin/salary-setup?filter=missing&companyId=${companyId}&month=${month}`,
    'Pending leave approvals':        '/admin/leave',
    'Advance disbursements pending':  '/admin/salary-advances',
    'Attendance data':                '/admin/attendance',
  };

  const warnings = (checks?.checks || []).filter(c => c.status === 'warning');
  const hasBlocking = warnings.length > 0;

  // Generated/updated/skipped counts from results
  const genCount     = generateResult?.results?.filter(r => r.status === 'generated').length || 0;
  const updatedCount = generateResult?.results?.filter(r => r.status === 'updated').length || 0;
  const skipCount    = generateResult?.results?.filter(r => r.status === 'skipped').length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Process Payroll</h2>
              <p className="text-xs text-slate-400">{formatMonthDisplay(month)} · {targetUserId ? targetUserName : 'All Employees'}</p>
            </div>
          </div>
          {step !== 5 && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-0 px-6 pt-4">
          {['Checklist', 'Scan', 'Review', 'Confirm', 'Generate', 'Done'].map((label, i) => {
            const s = i + 1;
            const active = step === s;
            const done = step > s;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? '✓' : s}
                  </div>
                  <span className={`text-[9px] mt-0.5 font-medium ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < 5 && <div className={`flex-1 h-0.5 mb-3 mx-1 ${done ? 'bg-green-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[260px]">

          {/* Step 1: Checklist */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Complete all pre-payroll steps before proceeding. You can skip steps that don't apply.</p>
              <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
                <PayrollChecklist month={month} compact />
              </div>
            </div>
          )}

          {/* Step 2: Scanning */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center h-52 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Search className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Scanning payroll data…</p>
                <p className="text-xs text-slate-400 mt-1">Checking attendance, leaves, advances & structures</p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-3">
              {scanErr && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-600">{scanErr}</div>
              )}
              {checks && (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'Eligible', value: checks.summary.eligibleForPayroll, color: 'text-blue-600' },
                      { label: 'No Salary Set', value: checks.summary.withoutSalaryStructure, color: checks.summary.withoutSalaryStructure > 0 ? 'text-red-500' : 'text-green-600' },
                      { label: 'Stopped', value: checks.summary.salaryProcessingStopped, color: 'text-amber-600' },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                        <p className="text-[10px] text-slate-500">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Checks list */}
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {checks.checks.map((c, i) => {
                      const st = CHECK_STATUS[c.status] || CHECK_STATUS.info;
                      const link = CHECK_LINKS[c.label];
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${st.bg}`}>
                          <span className="text-base shrink-0 mt-0.5">{st.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{c.label}</p>
                            <p className={`text-xs mt-0.5 ${st.color}`}>{c.detail}</p>
                          </div>
                          {c.status === 'warning' && link && (
                            <a href={link} className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors whitespace-nowrap">
                              Go Fix →
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {checks.summary.existingPayslips > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      ℹ️ <strong>{checks.summary.existingPayslips} payslips already generated</strong> — {targetUserId ? 'will be recalculated & updated' : 'will be skipped (only new employees added)'}. Published ones are always protected.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && checks && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <p className="text-sm font-bold text-blue-800 mb-3">Ready to process payslips for {formatMonthDisplay(month)} {scopeLabel}</p>
                <div className="space-y-2 text-xs text-blue-700">
                  <div className="flex justify-between">
                    <span>Employees to process</span>
                    <span className="font-bold">{checks.summary.eligibleForPayroll}</span>
                  </div>
                  {checks.summary.pendingReimbursements > 0 && (
                    <div className="flex justify-between">
                      <span>Reimbursements included</span>
                      <span className="font-bold text-green-700">{checks.summary.pendingReimbursements} claims</span>
                    </div>
                  )}
                  {checks.summary.advanceRepaymentsDue > 0 && (
                    <div className="flex justify-between">
                      <span>Advance deductions</span>
                      <span className="font-bold text-amber-700">{checks.summary.advanceRepaymentsDue} auto-applied</span>
                    </div>
                  )}
                  {checks.summary.salaryProcessingStopped > 0 && (
                    <div className="flex justify-between">
                      <span>Salary stopped (skipped)</span>
                      <span className="font-bold text-red-600">{checks.summary.salaryProcessingStopped}</span>
                    </div>
                  )}
                  {checks.summary.existingPayslips > 0 && (
                    <div className="flex justify-between">
                      <span>Already generated (skipped)</span>
                      <span className="font-bold text-slate-500">{checks.summary.existingPayslips}</span>
                    </div>
                  )}
                </div>
              </div>
              {hasBlocking && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  ⚠️ There are <strong>{warnings.length} warning(s)</strong> — you can still proceed but review them first.
                </div>
              )}
              <p className="text-xs text-slate-400 text-center">
                {targetUserId ? 'Existing payslip will be recalculated & updated.' : 'Existing payslips skipped — only new employees added.'} Published payslips are always protected.
              </p>
            </div>
          )}

          {/* Step 5: Generating */}
          {step === 5 && (
            <div className="flex flex-col items-center justify-center h-52 gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-green-100 border-t-green-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Generating payslips…</p>
                <p className="text-xs text-slate-400 mt-1">Calculating attendance, LOP, advances & deductions</p>
              </div>
            </div>
          )}

          {/* Step 6: Done */}
          {step === 6 && (
            <div className="flex flex-col items-center justify-center h-52 gap-4">
              {genErr ? (
                <>
                  <div className="text-4xl">❌</div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-red-600">Generation Failed</p>
                    <p className="text-xs text-slate-400 mt-1">{genErr}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-5xl">🎉</div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-green-700">Payslips Processed!</p>
                    <p className="text-xs text-slate-500 mt-1 space-x-2">
                      {genCount > 0 && <span className="font-semibold text-green-600">{genCount} new</span>}
                      {updatedCount > 0 && <span className="font-semibold text-blue-600">{updatedCount} updated</span>}
                      {skipCount > 0 && <span className="text-slate-400">{skipCount} skipped</span>}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-xs text-green-700 text-center">
                    Go to <strong>Payslips tab</strong> to review and publish
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          {step === 1 && (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={runScan}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Scan System →
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!!scanErr && !checks}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Review & Continue →
              </button>
            </>
          )}
          {step === 4 && (
            <>
              <button onClick={() => setStep(3)} className="text-sm text-slate-500 hover:text-slate-700 font-medium px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                ← Back
              </button>
              <button
                onClick={runGenerate}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                Generate Payslips
              </button>
            </>
          )}
          {step === 6 && (
            <button
              onClick={onClose}
              className="w-full px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {genErr ? 'Close' : 'Done — View Payslips'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Payroll Process Checklist ───────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { id: 'lock_prev',       label: 'Lock Previous Payroll',        desc: 'Ensure last month payroll is locked before starting',   link: '/admin/payroll',           category: 'setup' },
  { id: 'emp_additions',   label: 'Employee Additions',           desc: 'Add new joiners and set up salary structures',          link: '/admin/employees/new',     category: 'employees' },
  { id: 'emp_separations', label: 'Employee Separations',         desc: 'Process separations, FnF and last working day',         link: '/admin/lifecycle',         category: 'employees' },
  { id: 'emp_confirm',     label: 'Employee Confirmations',       desc: 'Confirm probationary employees due this month',         link: '/admin/employees',         category: 'employees' },
  { id: 'emp_data',        label: 'Employee Data Updates',        desc: 'Update personal info, bank details, PAN, address',      link: '/admin/employees',         category: 'employees' },
  { id: 'salary_revisions',label: 'Salary Revisions',            desc: 'Apply increment or revision letters effective this month', link: '/admin/salary-structures', category: 'salary' },
  { id: 'one_time_pay',    label: 'Update One Time Payments',     desc: 'Add bonuses, incentives, or special allowances',        link: '/admin/payroll',           category: 'salary' },
  { id: 'one_time_ded',    label: 'Update One Time Deductions',   desc: 'Add fines, recoveries or advance deductions',           link: '/admin/payroll',           category: 'salary' },
  { id: 'advance_update',  label: 'Salary Advance Update',        desc: 'Disburse approved advances and verify repayment deductions', link: '/admin/salary-advances', category: 'salary' },
  { id: 'stop_salary',     label: 'Stop Salary Processing',       desc: 'Mark employees whose salary should be held this month', link: '/admin/payroll',           category: 'salary' },
  { id: 'lop_update',      label: 'Update LOP / LWP',             desc: 'Sync attendance and apply Loss Of Pay days',            link: '/admin/attendance',        category: 'attendance' },
  { id: 'arrears',         label: 'Update Arrears',               desc: 'Calculate and add salary arrears from revisions',       link: '/admin/payroll',           category: 'salary' },
  { id: 'fnf',             label: 'Full & Final Settlements',     desc: 'Process FnF for separated employees',                   link: '/admin/lifecycle',         category: 'salary' },
  { id: 'reimbursements',  label: 'Reimbursement Claims',         desc: 'Approve pending expense and reimbursement claims',      link: '/admin/expenses',          category: 'salary' },
  { id: 'process_payroll', label: 'Process / Generate Payroll',   desc: 'Generate payslips for all active employees',            link: '/admin/payroll',           category: 'process' },
  { id: 'review_register', label: 'Review Pay Register',          desc: 'Verify earnings, deductions and net pay register',      link: '/admin/payroll',           category: 'process' },
  { id: 'bank_transfer',   label: 'Bank Transfer / NEFT Export',  desc: 'Download NEFT file and initiate salary bank transfer',  link: '/admin/payroll',           category: 'process' },
  { id: 'publish_payslips',label: 'Publish Payslips',             desc: 'Make payslips visible to employees on their portal',    link: '/admin/payroll',           category: 'process' },
  { id: 'statutory',       label: 'Statutory Compliance',         desc: 'Download PF ECR, ESIC return and PT challan',           link: '/admin/payroll',           category: 'statutory' },
  { id: 'lock_payroll',    label: 'Lock Payroll',                 desc: 'Lock the month so no further changes can be made',      link: '/admin/payroll',           category: 'statutory' },
  { id: 'payroll_rules',   label: 'Payroll Rules',                desc: 'Configure PF, ESI, PT slabs, LOP divisor used in payroll generation', link: '/admin/payroll-settings', category: 'setup' },
];

const CATEGORY_COLORS = {
  setup:      'bg-slate-100 text-slate-600',
  employees:  'bg-blue-100 text-blue-600',
  salary:     'bg-amber-100 text-amber-700',
  attendance: 'bg-teal-100 text-teal-600',
  process:    'bg-green-100 text-green-700',
  statutory:  'bg-purple-100 text-purple-700',
};

function PayrollChecklist({ month, compact = false }) {
  const storageKey = `payroll-checklist-${month}`;

  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });
  const [ignored, setIgnored] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}-ignored`) || '{}'); } catch { return {}; }
  });
  const [collapsed, setCollapsed] = useState(false);

  // Reload state when month changes
  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { setChecked({}); }
    try { setIgnored(JSON.parse(localStorage.getItem(`${storageKey}-ignored`) || '{}')); } catch { setIgnored({}); }
  }, [storageKey]);

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    if (!next[id]) delete next[id];
    setChecked(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    // un-ignore if re-checking
    if (ignored[id]) {
      const ig = { ...ignored };
      delete ig[id];
      setIgnored(ig);
      localStorage.setItem(`${storageKey}-ignored`, JSON.stringify(ig));
    }
  };

  const ignore = (id) => {
    const next = { ...ignored, [id]: true };
    setIgnored(next);
    localStorage.setItem(`${storageKey}-ignored`, JSON.stringify(next));
  };

  const resetAll = () => {
    if (!window.confirm('Reset all checklist items for this month?')) return;
    setChecked({});
    setIgnored({});
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-ignored`);
  };

  const pending = CHECKLIST_ITEMS.filter(i => !checked[i.id] && !ignored[i.id]);
  const done    = CHECKLIST_ITEMS.filter(i => checked[i.id]);
  const skipped = CHECKLIST_ITEMS.filter(i => ignored[i.id] && !checked[i.id]);
  const total   = CHECKLIST_ITEMS.length;
  const doneCount = done.length + skipped.length;
  const pct = Math.round((doneCount / total) * 100);

  // Compact mode — used inside the Process Payroll wizard
  if (compact) {
    return (
      <div className="space-y-1">
        {CHECKLIST_ITEMS.map(item => {
          const isDone = !!checked[item.id];
          const isIgnored = !!ignored[item.id] && !isDone;
          return (
            <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${isDone ? 'bg-green-50' : isIgnored ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
              <button onClick={() => toggle(item.id)} className={`shrink-0 ${isDone ? 'text-green-500' : 'text-slate-300 hover:text-blue-500'}`}>
                {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
              <span className={`text-xs flex-1 ${isDone ? 'line-through text-slate-400' : isIgnored ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{item.label}</span>
              {!isDone && !isIgnored && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <a href={item.link} className="text-[10px] text-blue-500 hover:underline">Go</a>
                  <span className="text-slate-300">·</span>
                  <button onClick={() => ignore(item.id)} className="text-[10px] text-slate-400 hover:text-slate-600">Skip</button>
                </div>
              )}
              {isDone && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
              {isIgnored && <SkipForward className="w-3 h-3 text-slate-300 shrink-0" />}
            </div>
          );
        })}
        <div className="pt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-500">{pct}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Payroll Process Checklist</h3>
            <p className="text-xs text-slate-400 mt-0.5">{formatMonthDisplay(month)} · {done.length} done · {skipped.length} skipped · {pending.length} remaining</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600">{pct}%</span>
          </div>
          <button onClick={resetAll} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Reset</button>
          <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-slate-100 transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* LEFT — Pending */}
          <div className="flex-1 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {pending.length === 0 ? '🎉 All done!' : `To Do (${pending.length})`}
            </p>
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm font-medium text-green-700">Payroll checklist complete!</p>
                <p className="text-xs text-slate-400 mt-1">All steps done for {formatMonthDisplay(month)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 group border border-transparent hover:border-slate-200 transition-all">
                    <button
                      onClick={() => toggle(item.id)}
                      className="mt-0.5 shrink-0 text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[item.category]}`}>
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={item.link}
                        title="Take me there"
                        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Go
                      </a>
                      <button
                        onClick={() => ignore(item.id)}
                        title="Skip this step"
                        className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        <SkipForward className="w-3 h-3" />
                        Skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped items */}
            {skipped.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Skipped ({skipped.length})</p>
                <div className="space-y-1">
                  {skipped.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                      <SkipForward className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="text-xs text-slate-400 line-through flex-1">{item.label}</span>
                      <button
                        onClick={() => toggle(item.id)}
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Completed */}
          <div className="flex-1 p-4 bg-green-50/30">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Completed ({done.length})
            </p>
            {done.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm text-slate-400">Feeling empty.</p>
                <p className="text-xs text-slate-300 mt-1">Tick off some items &amp; make my day…</p>
              </div>
            ) : (
              <div className="space-y-2">
                {done.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-100">
                    <button onClick={() => toggle(item.id)} className="mt-0.5 shrink-0 text-green-500 hover:text-slate-400 transition-colors">
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-500 line-through">{item.label}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-[10px] text-green-600">Done</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayrollDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedCompanyId, setSelectedCompanyId] = useState(1); // default CPIPL
  const [companies, setCompanies] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [lockSaving, setLockSaving] = useState(null);
  const [processCheck, setProcessCheck] = useState(null);
  const [processCheckLoading, setProcessCheckLoading] = useState(false);
  const [neftExporting, setNeftExporting] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showDeductions, setShowDeductions] = useState(false);
  const [showAdditions, setShowAdditions] = useState(false);
  const [generateTargetUserId, setGenerateTargetUserId] = useState(''); // '' = all employees
  const [salaryListEmployees, setSalaryListEmployees] = useState([]);

  // Load companies on mount
  useEffect(() => {
    api.get('/companies').then(r => setCompanies(r.data || [])).catch(() => {});
  }, []);

  // Load employees for per-employee generate selector
  useEffect(() => {
    api.get('/payroll/salary-list').then(r => setSalaryListEmployees(r.data || [])).catch(() => {});
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/payroll/payslips?month=${selectedMonth}`
      );
      setPayslips(response.data);
    } catch (err) {
      console.error('Failed to fetch payslips:', err);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await api.get(`/payroll/overview?month=${selectedMonth}&companyId=${selectedCompanyId}`);
      setOverview(res.data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedMonth]);

  const toggleLock = async (key, currentValue) => {
    setLockSaving(key);
    try {
      await api.put('/payroll/overview/locks', { [key]: !currentValue });
      setOverview(prev => prev ? { ...prev, locks: { ...prev.locks, [key]: !currentValue } } : prev);
      showToast(`${key.replace(/_/g, ' ')} updated`, 'success');
    } catch (err) {
      showToast('Failed to update', 'error');
    } finally {
      setLockSaving(null);
    }
  };

  useEffect(() => {
    fetchPayslips();
    setExpandedRow(null);
    setSearchQuery('');
    setStatusFilter('all');
  }, [fetchPayslips]);

  useEffect(() => { if (activeTab === 'overview') fetchOverview(); }, [activeTab, fetchOverview, selectedCompanyId, selectedMonth]);

  const handleProcessCheck = async () => {
    setProcessCheckLoading(true);
    try {
      const res = await api.get(`/payroll/process-check?month=${selectedMonth}&companyId=${selectedCompanyId}`);
      setProcessCheck(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to run process check', 'error');
    } finally {
      setProcessCheckLoading(false);
    }
  };

  const handleNeftExport = async () => {
    setNeftExporting(true);
    try {
      const res = await api.get(`/payroll/neft-export?month=${selectedMonth}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `neft-${selectedMonth}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('NEFT export failed — ensure payslips are published first', 'error');
    } finally {
      setNeftExporting(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/payroll/generate', {
        month: selectedMonth,
        companyId: selectedCompanyId,
        ...(generateTargetUserId ? { userId: parseInt(generateTargetUserId) } : {}),
      });
      showToast(
        response.data?.message ||
          `Payslips generated successfully for ${formatMonthDisplay(selectedMonth)}`,
        'success'
      );
      fetchPayslips();
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Failed to generate payslips',
        'error'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (payslipId) => {
    setPublishingId(payslipId);
    try {
      await api.put(`/payroll/payslip/${payslipId}/publish`);
      showToast('Payslip published successfully', 'success');
      fetchPayslips();
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Failed to publish payslip',
        'error'
      );
    } finally {
      setPublishingId(null);
    }
  };

  const handlePublishAll = async () => {
    setPublishing(true);
    try {
      const response = await api.post('/payroll/payslips/publish-all', {
        month: selectedMonth,
      });
      showToast(
        `All payslips published for ${formatMonthDisplay(selectedMonth)}. 🔒 Month is now locked — attendance, leaves & expenses for this month cannot be deleted.`,
        'success'
      );
      fetchPayslips();
      fetchOverview();
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Failed to publish payslips',
        'error'
      );
    } finally {
      setPublishing(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Computed stats
  const stats = {
    totalEmployees: payslips.length,
    generated: payslips.filter(
      (p) => p.status === 'generated' || p.status === 'published'
    ).length,
    published: payslips.filter((p) => p.status === 'published').length,
    totalNetPay: payslips.reduce((sum, p) => sum + (p.netPay || 0), 0),
  };

  const hasUnpublished = payslips.some((p) => p.status === 'generated');

  // Filtering
  const filteredPayslips = payslips.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      (p.user?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.user?.employeeId || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (p.user?.department || '')
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* One-Time Payroll Deductions Modal */}
      {showAdditions && (
        <PayrollAdditions
          month={selectedMonth}
          onClose={() => setShowAdditions(false)}
        />
      )}

      {showDeductions && (
        <PayrollDeductions
          month={selectedMonth}
          onClose={() => setShowDeductions(false)}
        />
      )}

      {/* Process Payroll Wizard */}
      {wizardOpen && (
        <ProcessPayrollWizard
          month={selectedMonth}
          companyId={selectedCompanyId}
          targetUserId={generateTargetUserId ? parseInt(generateTargetUserId) : null}
          targetUserName={generateTargetUserId ? (salaryListEmployees.find(e => e.id === parseInt(generateTargetUserId))?.name || '') : ''}
          onClose={() => { setWizardOpen(false); fetchPayslips(); fetchOverview(); setActiveTab('payslips'); }}
          onDone={() => { fetchPayslips(); fetchOverview(); }}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-lg">
            <Wallet className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payroll</h1>
            <p className="text-sm text-slate-500">
              Generate and manage monthly payslips
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Company selector */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(parseInt(e.target.value))}
              className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              {companies.length === 0 ? (
                <option value={1}>CPIPL</option>
              ) : (
                companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={fetchPayslips}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={stats.totalEmployees}
          subtitle="With salary configured"
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Payslips Generated"
          value={stats.generated}
          subtitle={`of ${stats.totalEmployees} employees`}
          color="amber"
        />
        <StatCard
          icon={CheckCircle}
          label="Published"
          value={stats.published}
          subtitle={`of ${stats.generated} generated`}
          color="green"
        />
        <StatCard
          icon={IndianRupee}
          label="Total Net Pay"
          value={formatCurrency(stats.totalNetPay)}
          subtitle={formatMonthDisplay(selectedMonth)}
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab('payslips')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payslips'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Payslips
            </div>
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'register'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Pay Register
            </div>
          </button>
          <button
            onClick={() => setActiveTab('differences')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'differences'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Differences
            </div>
          </button>
          <button
            onClick={() => setActiveTab('ctc')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ctc'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              CTC View
            </div>
          </button>
          <button
            onClick={() => setActiveTab('arrears')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'arrears'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Arrears
            </div>
          </button>
          <button
            onClick={() => setActiveTab('statutory')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'statutory'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Statutory
            </div>
          </button>
          <button
            onClick={() => setActiveTab('offday')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'offday'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Off-Day Allowance
            </div>
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span className="text-slate-500">Loading payroll overview...</span>
            </div>
          ) : overview && (
            <>
              {/* Month Timeline Strip */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {(() => {
                    const months = [];
                    const [y] = selectedMonth.split('-').map(Number);
                    // FY: Apr(y-1) to Mar(y) or Apr(y) to Mar(y+1)
                    const fyStart = new Date(selectedMonth) >= new Date(`${y}-04-01`) ? y : y - 1;
                    for (let m = 3; m < 15; m++) {
                      const mo = ((m % 12) || 12);
                      const yr = m < 12 ? fyStart : fyStart + 1;
                      const val = `${yr}-${String(mo).padStart(2, '0')}`;
                      const label = new Date(yr, mo - 1).toLocaleString('en-IN', { month: 'short' });
                      const isSelected = val === selectedMonth;
                      const isPast = val < new Date().toISOString().substring(0, 7);
                      months.push(
                        <button
                          key={val}
                          onClick={() => setSelectedMonth(val)}
                          className={`flex-shrink-0 flex flex-col items-center px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md'
                              : isPast
                              ? 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                              : 'bg-white text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {isPast && !isSelected && <Lock className="w-3 h-3 mb-0.5 opacity-50" />}
                          <span className="font-semibold">{label}</span>
                          <span className="text-[10px] opacity-75">{yr}</span>
                        </button>
                      );
                    }
                    return months;
                  })()}
                </div>
              </div>

              {/* Month Header */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  {overview.locks.payrollLocked ? (
                    <Lock className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Unlock className="w-5 h-5 text-green-500" />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      {new Date(overview.year, overview.monthNum - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Cutoff from {new Date(overview.cutoffFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(overview.cutoffTo).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={generateTargetUserId}
                    onChange={e => setGenerateTargetUserId(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    title="Process payroll for all employees or a specific one"
                  >
                    <option value="">All Employees</option>
                    {salaryListEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeId || 'N/A'})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setWizardOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Process Payroll
                  </button>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Payout Details */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Payout Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-sm text-slate-600 flex-1">Net Pay</span>
                      <span className="text-2xl font-bold text-slate-800">{formatCurrency(overview.totals.totalNetPay)}</span>
                    </div>
                    <hr className="border-slate-100" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        <div>
                          <p className="text-xs text-slate-400">Gross Pay</p>
                          <p className="text-sm font-semibold text-slate-700">{formatCurrency(overview.totals.totalGross)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                        <div>
                          <p className="text-xs text-slate-400">Deductions</p>
                          <p className="text-sm font-semibold text-red-600">{formatCurrency(overview.totals.totalDeductions)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                        <div>
                          <p className="text-xs text-slate-400">Work Days</p>
                          <p className="text-sm font-semibold text-slate-700">{overview.workingDays}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div>
                          <p className="text-xs text-slate-400">LOP Deduction</p>
                          <p className="text-sm font-semibold text-red-600">{formatCurrency(overview.totals.totalLop)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Component breakdown */}
                    <hr className="border-slate-100" />
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">Basic</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalBasic)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">HRA</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalHra)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">PF</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalPf)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">ESI</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalEsi)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">PT</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalPt)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-slate-400">TDS</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{formatCurrency(overview.totals.totalTds)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Employee Details + Controls */}
                <div className="space-y-6">
                  {/* Employee Details */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Employee Details</h3>
                    <div className="flex items-start gap-6">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-blue-600">{overview.employees.total}</p>
                        <p className="text-xs text-slate-500 mt-1">Total Employees</p>
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2.5">
                          <UserPlus className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-lg font-bold text-green-700">{String(overview.employees.additions).padStart(2, '0')}</p>
                            <p className="text-[10px] text-green-600">Addition</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-2.5">
                          <Handshake className="w-4 h-4 text-slate-500" />
                          <div>
                            <p className="text-lg font-bold text-slate-700">{String(overview.employees.settlements).padStart(2, '0')}</p>
                            <p className="text-[10px] text-slate-500">Settlements</p>
                          </div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2.5">
                          <Ban className="w-4 h-4 text-amber-600" />
                          <div>
                            <p className="text-lg font-bold text-amber-700">{String(overview.employees.exclusions).padStart(2, '0')}</p>
                            <p className="text-[10px] text-amber-600">Exclusion</p>
                          </div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 flex items-center gap-2.5">
                          <UserMinus className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-lg font-bold text-red-600">{String(overview.employees.separations).padStart(2, '0')}</p>
                            <p className="text-[10px] text-red-500">Separation</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lock/Release Controls */}
                  <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {[
                      { key: 'payroll_inputs_locked', label: 'Payroll Inputs', desc: 'Lock salary structure edits', lockLabel: 'Lock', unlockLabel: 'Unlock', value: overview.locks.payrollInputsLocked },
                      { key: 'employee_view_released', label: 'Employee View Release', desc: 'Let employees see payslips', lockLabel: 'Hold', unlockLabel: 'Release', value: overview.locks.employeeViewReleased, invert: true },
                      { key: 'it_statement_released', label: 'IT Statement Employee View', desc: 'Let employees see IT statements', lockLabel: 'Hold', unlockLabel: 'Release', value: overview.locks.itStatementReleased, invert: true },
                      { key: 'payroll_locked', label: 'Payroll', desc: 'Lock payroll generation', lockLabel: 'Lock', unlockLabel: 'Unlock', value: overview.locks.payrollLocked },
                    ].map((ctrl) => (
                      <div key={ctrl.key} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{ctrl.label}</p>
                          <p className="text-xs text-slate-400">{ctrl.desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {[
                            { label: ctrl.unlockLabel, active: ctrl.invert ? !ctrl.value : ctrl.value },
                            { label: ctrl.lockLabel,   active: ctrl.invert ? ctrl.value  : !ctrl.value },
                          ].map((btn, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                const newValue = i === 1 ? true : false;
                                if (newValue !== ctrl.value) toggleLock(ctrl.key, ctrl.value);
                              }}
                              disabled={lockSaving === ctrl.key}
                              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                btn.active
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              } disabled:opacity-50`}
                            >
                              {lockSaving === ctrl.key ? '...' : btn.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payslip Status */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Payslip Status</h3>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-2xl font-bold text-slate-700">{overview.status.payslipCount}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Total Generated</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-3">
                        <p className="text-2xl font-bold text-amber-600">{overview.status.generated}</p>
                        <p className="text-[10px] text-amber-500 mt-1">Pending Publish</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <p className="text-2xl font-bold text-green-600">{overview.status.published}</p>
                        <p className="text-[10px] text-green-500 mt-1">Published</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Info Cards — greytHR style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Negative Salary */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Negative Salary</h4>
                  {overview.cards?.negativeSalary?.length > 0 ? (
                    <div className="space-y-2">
                      {overview.cards.negativeSalary.map(u => (
                        <p key={u.id} className="text-xs text-slate-600">{u.name} ({u.employeeId})</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                  )}
                </div>

                {/* Stop Salary Processing */}
                <StopSalaryCard
                  stoppedCount={overview.employees?.stoppedSalary || 0}
                  onRefresh={fetchOverview}
                />

                {/* Settled Employees */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Settled Employees{overview.cards?.settledEmployees?.length > 0 && ` (${overview.cards.settledEmployees.length})`}
                  </h4>
                  {overview.cards?.settledEmployees?.length > 0 ? (
                    <div className="space-y-2.5">
                      {overview.cards.settledEmployees.slice(0, 3).map(emp => (
                        <div key={emp.id} className="flex items-center gap-2.5">
                          {emp.photo ? (
                            <img src={emp.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                              {emp.name?.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-slate-700">{emp.name} ({emp.employeeId})</p>
                            <p className="text-[10px] text-slate-400">
                              {emp.lastWorkingDay ? new Date(emp.lastWorkingDay + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                      {overview.cards.settledEmployees.length > 3 && (
                        <p className="text-xs text-blue-500 font-medium">+{overview.cards.settledEmployees.length - 3} more</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                  )}
                </div>

                {/* Hold Salary Payout */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Hold Salary Payout</h4>
                  <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                </div>

                {/* Payout Pending */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Payout Pending</h4>
                  {overview.cards?.payoutPending > 0 ? (
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{overview.cards.payoutPending}</p>
                      <p className="text-xs text-slate-500 mt-1">Bank Transfer (Net Pay)</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                  )}
                </div>

                {/* Locations Without PT State */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Locations Without PT State</h4>
                  <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                </div>
              </div>
            </>
          )}
          {!overview && !overviewLoading && (
            <div className="text-center py-16 text-slate-400">
              <LayoutDashboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No payroll data available for this month.</p>
              <p className="text-xs mt-1">Generate payslips first from the Payslips tab.</p>
            </div>
          )}
        </div>
      )}

      {/* Payslips Tab */}
      {activeTab === 'payslips' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {/* Status Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="generated">Generated</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Excel Export */}
              <button
                onClick={async () => {
                  try {
                    const res = await api.get(`/payroll/export?month=${selectedMonth}`, { responseType: 'blob' });
                    const url = URL.createObjectURL(res.data);
                    const a = document.createElement('a'); a.href = url; a.download = `payroll_${selectedMonth}.xlsx`; a.click();
                    URL.revokeObjectURL(url);
                  } catch { alert('Export failed. Make sure payslips exist for this month.'); }
                }}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-medium transition-colors border border-slate-200"
              >
                <FileDown className="w-4 h-4" />
                Export Excel
              </button>
              {hasUnpublished && (
                <button
                  onClick={handlePublishAll}
                  disabled={publishing}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {publishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Publish All
                </button>
              )}
              <button
                onClick={handleProcessCheck}
                disabled={processCheckLoading}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {processCheckLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Pre-Check
              </button>
              <button
                onClick={handleNeftExport}
                disabled={neftExporting}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {neftExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                NEFT Export
              </button>
              <button
                onClick={() => setShowAdditions(true)}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Additions
              </button>
              <button
                onClick={() => setShowDeductions(true)}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Banknote className="w-4 h-4" />
                Deductions
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Generate Payslips
              </button>
            </div>
          </div>

          {/* Process Check Panel */}
          {processCheck && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-500" />
                  Pre-Payroll Checklist — {processCheck.month}
                </h3>
                <button onClick={() => setProcessCheck(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {processCheck.checks?.map((check) => (
                  <div key={check.label} className={`flex items-start gap-3 p-3 rounded-lg border ${check.status === 'ok' ? 'bg-emerald-50 border-emerald-200' : check.status === 'warning' ? 'bg-amber-50 border-amber-200' : check.status === 'pending' ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
                    <span className="text-lg mt-0.5">{check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'pending' ? '⏳' : 'ℹ️'}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{check.label}</p>
                      <p className="text-xs text-slate-500">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              {processCheck.employees?.withoutSalary?.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-700 mb-1">Missing salary structures:</p>
                  <p className="text-xs text-red-600">{processCheck.employees.withoutSalary.map(u => `${u.name} (${u.employeeId})`).join(', ')}</p>
                </div>
              )}
              {processCheck.employees?.pendingDisbursements?.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Advances approved but not yet disbursed:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {processCheck.employees.pendingDisbursements.map(u => (
                      <span key={u.id} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        {u.name} — ₹{u.amount?.toLocaleString('en-IN')}
                      </span>
                    ))}
                  </div>
                  <a href="/admin/salary-advances" className="text-xs text-amber-600 hover:underline mt-1 inline-block">Go to Salary Advance Manager →</a>
                </div>
              )}
            </div>
          )}

          {/* Payslip Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="ml-3 text-sm text-slate-500">
                  Loading payslips...
                </span>
              </div>
            ) : filteredPayslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText className="w-12 h-12 mb-3" />
                <p className="text-base font-medium text-slate-500">
                  {payslips.length === 0
                    ? 'No payslips found'
                    : 'No matching payslips'}
                </p>
                <p className="text-sm mt-1">
                  {payslips.length === 0
                    ? `Click "Generate Payslips" to create payslips for ${formatMonthDisplay(selectedMonth)}`
                    : 'Try adjusting your search or filter'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600 w-10"></th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">
                        Department
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">
                        Shift
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">
                        Gross Earnings
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">
                        Deductions
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">
                        LOP
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">
                        Net Pay
                      </th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-600">
                        Status
                      </th>
                      <th className="text-center px-5 py-3 font-semibold text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayslips.map((payslip) => (
                      <React.Fragment key={payslip.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          {/* Expand Toggle */}
                          <td className="px-5 py-3">
                            <button
                              onClick={() => toggleExpand(payslip.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            >
                              {expandedRow === payslip.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Employee */}
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900">
                                {payslip.user?.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {payslip.user?.employeeId || '-'}
                                {payslip.user?.designation && (
                                  <span className="ml-1.5 text-slate-400">
                                    &middot; {payslip.user.designation}
                                  </span>
                                )}
                              </p>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-4 py-3 text-slate-600">
                            {payslip.user?.department || '-'}
                          </td>

                          {/* Shift */}
                          <td className="px-4 py-3">
                            {payslip.user?.shiftAssignments?.[0]?.shift ? (
                              <div className="flex flex-col gap-0.5">
                                <p className="font-medium text-slate-700 text-xs">{payslip.user.shiftAssignments[0].shift.name}</p>
                                <p className="text-xs text-slate-500">{payslip.user.shiftAssignments[0].shift.startTime} - {payslip.user.shiftAssignments[0].shift.endTime}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          {/* Gross Earnings */}
                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                            {formatCurrency(payslip.grossEarnings)}
                          </td>

                          {/* Total Deductions */}
                          <td className="px-4 py-3 text-right font-medium text-red-600">
                            {formatCurrency(payslip.totalDeductions)}
                          </td>

                          {/* LOP Days */}
                          <td className="px-4 py-3 text-center">
                            {payslip.lopDays > 0 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                                {payslip.lopDays}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          {/* Net Pay */}
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-green-600">
                              {formatCurrency(payslip.netPay)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={payslip.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => toggleExpand(payslip.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                                title="View details"
                              >
                                {expandedRow === payslip.id ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                {expandedRow === payslip.id ? 'Hide' : 'View'}
                              </button>

                              {payslip.status === 'generated' && (
                                <button
                                  onClick={() => handlePublish(payslip.id)}
                                  disabled={publishingId === payslip.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                                  title="Publish payslip"
                                >
                                  {publishingId === payslip.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
                                  Publish
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {expandedRow === payslip.id && (
                          <tr>
                            <td colSpan={9} className="p-0">
                              <PayslipDetail payslip={payslip} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer Summary */}
            {filteredPayslips.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Showing {filteredPayslips.length} of {payslips.length}{' '}
                    payslips
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      Total Gross:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(
                          filteredPayslips.reduce(
                            (sum, p) => sum + (p.grossEarnings || 0),
                            0
                          )
                        )}
                      </span>
                    </span>
                    <span>
                      Total Net:{' '}
                      <span className="font-semibold text-green-600">
                        {formatCurrency(
                          filteredPayslips.reduce(
                            (sum, p) => sum + (p.netPay || 0),
                            0
                          )
                        )}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay Register Tab */}
      {activeTab === 'register' && <PayRegister month={selectedMonth} />}

      {/* Differences Tab */}
      {activeTab === 'differences' && <PayrollDifferences month={selectedMonth} />}

      {/* CTC View Tab */}
      {activeTab === 'ctc' && <CtcRegister month={selectedMonth} />}

      {/* Arrears Tab */}
      {activeTab === 'arrears' && <ArrearsManager month={selectedMonth} />}

      {/* Statutory Tab */}
      {activeTab === 'statutory' && <StatutoryReport month={selectedMonth} />}

      {/* Off-Day Allowance Tab */}
      {activeTab === 'offday' && (
        <div className="py-2">
          <OffDayAllowanceManager />
        </div>
      )}

    </div>
  );
}

// ═══════════════════════════════════════════════
// P1: Payroll Differences Component
// ═══════════════════════════════════════════════

const PayrollDifferences = ({ month }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, flagged, increased, decreased

  useEffect(() => {
    const fetchDiffs = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/payroll/pay-differences?month=${month}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch differences:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDiffs();
  }, [month]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
      <span className="text-slate-500">Comparing payroll data...</span>
    </div>
  );

  if (!data || data.employees.length === 0) return (
    <div className="text-center py-20 text-slate-400">
      <ArrowUpDown className="w-10 h-10 mx-auto mb-3" />
      <p className="text-sm">No payroll data to compare for {formatMonthDisplay(month)}</p>
      <p className="text-xs mt-1">Generate payslips for at least 2 consecutive months</p>
    </div>
  );

  const filtered = data.employees.filter(e => {
    if (filter === 'flagged') return e.hasSignificantChange;
    if (filter === 'increased') return e.diffs.net > 0;
    if (filter === 'decreased') return e.diffs.net < 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Employees" value={data.summary.totalEmployees} color="blue" />
        <StatCard icon={ArrowUpDown} label="Changed" value={data.summary.totalChanged} color="amber" />
        <StatCard icon={IndianRupee} label="Avg Net Diff" value={formatCurrency(data.summary.avgNetDiff)} color="purple" />
        <StatCard icon={AlertTriangle} label="Flagged (>20%)" value={data.summary.flaggedCount} color={data.summary.flaggedCount > 0 ? 'amber' : 'green'} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">Comparing:</span>
        <span className="text-xs font-medium text-slate-700">{formatMonthDisplay(data.prevMonth)} → {formatMonthDisplay(data.month)}</span>
        <div className="ml-auto flex gap-2">
          {['all', 'flagged', 'increased', 'decreased'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {f === 'all' ? 'All' : f === 'flagged' ? `Flagged (${data.summary.flaggedCount})` : f === 'increased' ? 'Increased' : 'Decreased'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Prev Net</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Curr Net</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Difference</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Diff %</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((emp, i) => (
              <tr key={i} className={emp.hasSignificantChange ? 'bg-amber-50/50' : ''}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{emp.user?.name}</div>
                  <div className="text-xs text-slate-400">{emp.user?.employeeId} • {emp.user?.department}</div>
                </td>
                <td className="text-right px-4 py-3 text-slate-600">
                  {emp.previous ? formatCurrency(emp.previous.netPay) : '—'}
                </td>
                <td className="text-right px-4 py-3 font-medium text-slate-800">
                  {formatCurrency(emp.current?.netPay || emp.current?.net)}
                </td>
                <td className="text-right px-4 py-3">
                  <span className={`font-medium ${emp.diffs.net > 0 ? 'text-green-600' : emp.diffs.net < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {emp.diffs.net > 0 ? '+' : ''}{formatCurrency(emp.diffs.net)}
                  </span>
                </td>
                <td className="text-right px-4 py-3">
                  <span className={`text-xs font-medium ${Math.abs(emp.diffPercent) > 20 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {emp.isNew ? 'New' : `${emp.diffPercent > 0 ? '+' : ''}${emp.diffPercent}%`}
                  </span>
                </td>
                <td className="text-center px-4 py-3">
                  {emp.hasSignificantChange ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      <AlertTriangle className="w-3 h-3" /> Flagged
                    </span>
                  ) : emp.isNew ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                      <UserPlus className="w-3 h-3" /> New
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                      <CheckCircle className="w-3 h-3" /> OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No employees match this filter</div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// P3: CTC Register Component
// ═══════════════════════════════════════════════

const CtcRegister = ({ month }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('department'); // department, employee

  useEffect(() => {
    const fetchCtc = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/payroll/ctc-register?month=${month}`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch CTC data:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCtc();
  }, [month]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
      <span className="text-slate-500">Loading CTC data...</span>
    </div>
  );

  if (!data || data.employeeCount === 0) return (
    <div className="text-center py-20 text-slate-400">
      <Banknote className="w-10 h-10 mx-auto mb-3" />
      <p className="text-sm">No CTC data for {formatMonthDisplay(month)}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={IndianRupee} label="Total CTC (Monthly)" value={formatCurrency(data.totals.totalCtc)} color="purple" />
        <StatCard icon={IndianRupee} label="Total CTC (Annual)" value={formatCurrency(data.totals.totalCtcAnnual)} subtitle="Projected" color="blue" />
        <StatCard icon={TrendingUp} label="Employer PF" value={formatCurrency(data.totals.totalEmployerPf)} color="amber" />
        <StatCard icon={TrendingUp} label="Employer ESI" value={formatCurrency(data.totals.totalEmployerEsi)} color="green" />
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('department')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'department' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          By Department
        </button>
        <button onClick={() => setView('employee')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === 'employee' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          By Employee
        </button>
      </div>

      {/* Department View */}
      {view === 'department' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Department</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Employees</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Gross</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Employer PF</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Employer ESI</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 bg-purple-50">Total CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.departments.map((dept, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 font-medium text-slate-800">{dept.department}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{dept.count}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(dept.gross)}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(dept.employerPf)}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(dept.employerEsi)}</td>
                  <td className="text-right px-4 py-3 font-bold text-purple-700 bg-purple-50/50">{formatCurrency(dept.ctc)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-slate-800">Total</td>
                <td className="text-right px-4 py-3">{data.employeeCount}</td>
                <td className="text-right px-4 py-3">{formatCurrency(data.totals.totalGross)}</td>
                <td className="text-right px-4 py-3">{formatCurrency(data.totals.totalEmployerPf)}</td>
                <td className="text-right px-4 py-3">{formatCurrency(data.totals.totalEmployerEsi)}</td>
                <td className="text-right px-4 py-3 font-bold text-purple-700 bg-purple-50/50">{formatCurrency(data.totals.totalCtc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Employee View */}
      {view === 'employee' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Gross</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Net Pay</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Employer PF</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Employer ESI</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600 bg-purple-50">CTC (Monthly)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.employees.map((emp, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{emp.user?.name}</div>
                    <div className="text-xs text-slate-400">{emp.user?.employeeId} • {emp.user?.department}</div>
                  </td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(emp.grossEarnings)}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(emp.netPay)}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(emp.employerPf)}</td>
                  <td className="text-right px-4 py-3 text-slate-600">{formatCurrency(emp.employerEsi)}</td>
                  <td className="text-right px-4 py-3 font-bold text-purple-700 bg-purple-50/50">{formatCurrency(emp.ctcMonthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// P4: Arrears Manager Component
// ═══════════════════════════════════════════════

const ArrearsManager = ({ month }) => {
  const [arrears, setArrears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [calcForm, setCalcForm] = useState({ userId: '', fromMonth: '', toMonth: month });
  const [calculating, setCalculating] = useState(false);
  const [applying, setApplying] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [toast, setToast] = useState(null);

  const fetchArrears = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payroll/arrears');
      setArrears(res.data);
    } catch (err) {
      console.error('Failed to fetch arrears:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users/directory');
      setEmployees((res.data?.users || res.data || []).filter(u => u.isActive));
    } catch {}
  };

  useEffect(() => { fetchArrears(); fetchEmployees(); }, []);

  const handleCalculate = async () => {
    if (!calcForm.userId || !calcForm.fromMonth || !calcForm.toMonth) return;
    setCalculating(true);
    try {
      const res = await api.post('/payroll/calculate-arrears', calcForm);
      setToast({ message: `Arrears calculated: ${formatCurrency(res.data.totalArrears)}`, type: 'success' });
      setShowCalc(false);
      setCalcForm({ userId: '', fromMonth: '', toMonth: month });
      fetchArrears();
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Calculation failed', type: 'error' });
    } finally {
      setCalculating(false);
    }
  };

  const handleApply = async (arrearId) => {
    if (!window.confirm('Apply these arrears to the current month payslip? This will modify the payslip.')) return;
    setApplying(arrearId);
    try {
      await api.post('/payroll/apply-arrears', { arrearId, applyInMonth: month });
      setToast({ message: 'Arrears applied successfully', type: 'success' });
      fetchArrears();
    } catch (err) {
      setToast({ message: err.response?.data?.message || 'Failed to apply', type: 'error' });
    } finally {
      setApplying(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this arrears calculation?')) return;
    try {
      await api.put(`/payroll/arrears/${id}/cancel`);
      fetchArrears();
    } catch (err) {
      setToast({ message: 'Failed to cancel', type: 'error' });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
      <span className="text-slate-500">Loading arrears...</span>
    </div>
  );

  const statusColors = {
    calculated: 'bg-amber-100 text-amber-700 border-amber-200',
    applied: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Salary Arrears</h3>
          <p className="text-xs text-slate-500">Calculate and apply arrears for backdated salary revisions</p>
        </div>
        <button onClick={() => setShowCalc(!showCalc)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Calculator className="w-4 h-4" />
          Calculate Arrears
        </button>
      </div>

      {/* Calculation Form */}
      {showCalc && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-800">Calculate Arrears</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Employee</label>
              <select value={calcForm.userId} onChange={e => setCalcForm(p => ({ ...p, userId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select employee...</option>
                {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">From Month</label>
              <input type="month" value={calcForm.fromMonth} onChange={e => setCalcForm(p => ({ ...p, fromMonth: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">To Month</label>
              <input type="month" value={calcForm.toMonth} onChange={e => setCalcForm(p => ({ ...p, toMonth: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleCalculate} disabled={calculating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {calculating ? 'Calculating...' : 'Calculate'}
              </button>
              <button onClick={() => setShowCalc(false)} className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-300">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arrears List */}
      {arrears.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Calculator className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm">No arrears records</p>
          <p className="text-xs mt-1">Use "Calculate Arrears" when a salary revision is backdated</p>
        </div>
      ) : (
        <div className="space-y-3">
          {arrears.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{a.user?.name} <span className="text-xs text-slate-400">({a.user?.employeeId})</span></div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Period: {formatMonthDisplay(a.fromMonth)} → {formatMonthDisplay(a.toMonth)}
                    {a.appliedInMonth && <span className="ml-2">• Applied in {formatMonthDisplay(a.appliedInMonth)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${a.totalArrears >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {a.totalArrears >= 0 ? '+' : ''}{formatCurrency(a.totalArrears)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[a.status]}`}>
                    {a.status}
                  </span>
                  {a.status === 'calculated' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApply(a.id)} disabled={applying === a.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {applying === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Apply
                      </button>
                      <button onClick={() => handleCancel(a.id)}
                        className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-300">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* Breakdown */}
              {a.breakdown && a.status !== 'cancelled' && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="grid grid-cols-4 gap-2 text-xs text-slate-500 font-medium mb-1">
                    <span>Month</span><span className="text-right">Old Net</span><span className="text-right">New Net</span><span className="text-right">Arrear</span>
                  </div>
                  {(Array.isArray(a.breakdown) ? a.breakdown : []).map((b, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 text-xs py-1">
                      <span className="text-slate-600">{formatMonthDisplay(b.month)}</span>
                      <span className="text-right text-slate-500">{formatCurrency(b.oldNet)}</span>
                      <span className="text-right text-slate-600">{formatCurrency(b.newNet)}</span>
                      <span className={`text-right font-medium ${b.arrearAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {b.arrearAmount >= 0 ? '+' : ''}{formatCurrency(b.arrearAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// SalaryManager — Employee-basis salary setup + increment/decrement
// ═══════════════════════════════════════════════

const SALARY_FIELDS = [
  { key: 'basic', label: 'Basic Salary' },
  { key: 'hra', label: 'HRA' },
  { key: 'da', label: 'DA' },
  { key: 'specialAllowance', label: 'Special Allowance' },
  { key: 'medicalAllowance', label: 'Medical Allowance' },
  { key: 'conveyanceAllowance', label: 'Conveyance Allowance' },
  { key: 'otherAllowance', label: 'Other Allowance' },
];
const DEDUCTION_FIELDS = [
  { key: 'employerPf', label: 'Employer PF (12%)' },
  { key: 'employerEsi', label: 'Employer ESI (3.25%)' },
  { key: 'employeePf', label: 'Employee PF (12%)' },
  { key: 'employeeEsi', label: 'Employee ESI (0.75%)' },
  { key: 'professionalTax', label: 'Professional Tax' },
  { key: 'tds', label: 'TDS' },
];

function SalaryManager({ showToast }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editEmp, setEditEmp] = useState(null);
  const [reviseEmp, setReviseEmp] = useState(null);
  const [historyEmp, setHistoryEmp] = useState(null);

  const fetchSalaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/payroll/salary-list');
      setEmployees(res.data || []);
    } catch {
      showToast('Failed to load salary data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const filtered = employees.filter(e =>
    !search ||
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  const withSalary = filtered.filter(e => e.salaryStructure);
  const withoutSalary = filtered.filter(e => !e.salaryStructure);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Employee Salaries</h3>
          <p className="text-xs text-slate-500">Set, edit, or revise individual salary for each employee</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Employees', value: employees.length, color: 'blue' },
          { label: 'Salary Configured', value: employees.filter(e => e.salaryStructure).length, color: 'green' },
          { label: 'Pending Setup', value: employees.filter(e => !e.salaryStructure).length, color: 'amber' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4`}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold text-${s.color}-700 mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-slate-500">Loading salaries...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Employees without salary */}
          {withoutSalary.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {withoutSalary.length} employee(s) without salary setup
              </h4>
              <div className="space-y-2">
                {withoutSalary.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{e.name}</span>
                      <span className="text-xs text-slate-400 ml-2">({e.employeeId})</span>
                      <span className="text-xs text-slate-400 ml-2">• {e.department || 'No dept'}</span>
                    </div>
                    <button
                      onClick={() => setEditEmp(e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700"
                    >
                      <IndianRupee className="w-3 h-3" />
                      Set Salary
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employees with salary */}
          {withSalary.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Department</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">CTC Annual</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Net Monthly</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Effective From</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Last Revision</th>
                    <th className="text-center px-5 py-3 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withSalary.map(e => {
                    const s = e.salaryStructure;
                    const lastRev = e.salaryRevisions?.[0];
                    return (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{e.name}</div>
                          <div className="text-xs text-slate-400">{e.employeeId} • {e.designation || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{e.department || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(s.ctcAnnual)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(s.netPayMonthly)}</td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">{s.effectiveFrom || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {lastRev ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              lastRev.revisionType === 'increment' ? 'bg-green-100 text-green-700' :
                              lastRev.revisionType === 'decrement' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {lastRev.revisionType === 'increment' ? '↑' : lastRev.revisionType === 'decrement' ? '↓' : '·'}
                              {new Date(lastRev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setEditEmp(e)}
                              title="Edit salary"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Briefcase className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setReviseEmp(e)}
                              title="Increment / Decrement"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setHistoryEmp(e)}
                              title="Revision history"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Salary Modal */}
      {editEmp && (
        <EditSalaryModal
          employee={editEmp}
          onClose={() => setEditEmp(null)}
          onSaved={() => { setEditEmp(null); fetchSalaries(); showToast('Salary saved successfully', 'success'); }}
          showToast={showToast}
        />
      )}

      {/* Revise Salary Modal */}
      {reviseEmp && (
        <ReviseSalaryModal
          employee={reviseEmp}
          onClose={() => setReviseEmp(null)}
          onSaved={() => { setReviseEmp(null); fetchSalaries(); showToast('Salary revision applied', 'success'); }}
          showToast={showToast}
        />
      )}

      {/* Revision History Modal */}
      {historyEmp && (
        <RevisionHistoryModal
          employee={historyEmp}
          onClose={() => setHistoryEmp(null)}
        />
      )}
    </div>
  );
}

// ── Edit Salary Modal (full component breakdown) ──
function EditSalaryModal({ employee, onClose, onSaved, showToast }) {
  const s = employee.salaryStructure || {};
  const [form, setForm] = useState({
    ctcAnnual: s.ctcAnnual || '',
    basic: s.basic || '', hra: s.hra || '', da: s.da || '',
    specialAllowance: s.specialAllowance || '',
    medicalAllowance: s.medicalAllowance || '',
    conveyanceAllowance: s.conveyanceAllowance || '',
    otherAllowance: s.otherAllowance || '',
    otherAllowanceLabel: s.otherAllowanceLabel || '',
    employerPf: s.employerPf || '', employerEsi: s.employerEsi || '',
    employeePf: s.employeePf || '', employeeEsi: s.employeeEsi || '',
    professionalTax: s.professionalTax || '', tds: s.tds || '',
    effectiveFrom: s.effectiveFrom || new Date().toISOString().slice(0, 10),
    notes: s.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const n = (v) => parseFloat(v) || 0;
  const grossEarnings = n(form.basic) + n(form.hra) + n(form.da) + n(form.specialAllowance) +
    n(form.medicalAllowance) + n(form.conveyanceAllowance) + n(form.otherAllowance);
  const totalDeductions = n(form.employeePf) + n(form.employeeEsi) + n(form.professionalTax) + n(form.tds);
  const netPay = grossEarnings - totalDeductions;

  const handleSave = async () => {
    if (!form.ctcAnnual) { showToast('CTC Annual is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {};
      Object.keys(form).forEach(k => { payload[k] = isNaN(form[k]) || form[k] === '' ? form[k] : parseFloat(form[k]) || 0; });
      payload.ctcMonthly = n(form.ctcAnnual) / 12;
      payload.otherAllowanceLabel = form.otherAllowanceLabel || null;
      payload.notes = form.notes || null;
      await api.put(`/payroll/salary/${employee.id}`, payload);
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save salary', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit Salary — {employee.name}</h3>
            <p className="text-xs text-slate-400">{employee.employeeId} · {employee.department}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* CTC + Effective From */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Annual CTC (₹) *</label>
              <input type="number" value={form.ctcAnnual} onChange={e => setForm(p => ({ ...p, ctcAnnual: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Effective From</label>
              <input type="date" value={form.effectiveFrom} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Earnings */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Earnings</h4>
            <div className="grid grid-cols-2 gap-3">
              {SALARY_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {f.key === 'otherAllowance' && form.otherAllowanceLabel ? form.otherAllowanceLabel : f.label} (₹)
                  </label>
                  <input type="number" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Other Allowance Label</label>
                <input type="text" value={form.otherAllowanceLabel} onChange={e => setForm(p => ({ ...p, otherAllowanceLabel: e.target.value }))}
                  placeholder="e.g. Performance Bonus"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Deductions & Employer Contributions</h4>
            <div className="grid grid-cols-2 gap-3">
              {DEDUCTION_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label} (₹)</label>
                  <input type="number" value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Live Summary */}
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500">Gross Earnings</p>
              <p className="text-base font-bold text-slate-800">{formatCurrency(grossEarnings)}</p>
              <p className="text-xs text-slate-400">per month</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Deductions</p>
              <p className="text-base font-bold text-red-600">{formatCurrency(totalDeductions)}</p>
              <p className="text-xs text-slate-400">per month</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Net Pay</p>
              <p className="text-base font-bold text-green-600">{formatCurrency(netPay)}</p>
              <p className="text-xs text-slate-400">per month</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Salary'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revise Salary Modal (increment / decrement) ──
function ReviseSalaryModal({ employee, onClose, onSaved, showToast }) {
  const currentCtc = employee.salaryStructure?.ctcAnnual || 0;
  const [mode, setMode] = useState('increment'); // 'increment' | 'decrement'
  const [valueType, setValueType] = useState('percent'); // 'percent' | 'amount'
  const [value, setValue] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const numVal = parseFloat(value) || 0;
  let newCtc = currentCtc;
  if (numVal > 0) {
    const signed = mode === 'decrement' ? -numVal : numVal;
    if (valueType === 'percent') {
      newCtc = currentCtc * (1 + signed / 100);
    } else {
      newCtc = currentCtc + signed;
    }
  }
  const diff = newCtc - currentCtc;
  const diffPct = currentCtc > 0 ? ((diff / currentCtc) * 100) : 0;

  const handleApply = async () => {
    if (!value || numVal <= 0) { showToast('Enter a valid value', 'error'); return; }
    if (!effectiveFrom) { showToast('Effective From date is required', 'error'); return; }
    if (newCtc <= 0) { showToast('New CTC must be positive', 'error'); return; }
    setSaving(true);
    try {
      const payload = { userId: employee.id, effectiveFrom, reason };
      if (valueType === 'percent') {
        payload.changePercent = mode === 'decrement' ? -numVal : numVal;
      } else {
        payload.changeAmount = mode === 'decrement' ? -numVal : numVal;
      }
      await api.post('/payroll/increment', payload);
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to apply revision', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Revise Salary — {employee.name}</h3>
            <p className="text-xs text-slate-400">{employee.employeeId} · Current CTC: {formatCurrency(currentCtc)}/yr</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode Toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Revision Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('increment')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  mode === 'increment' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Increment
              </button>
              <button
                onClick={() => setMode('decrement')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  mode === 'decrement' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Decrement
              </button>
            </div>
          </div>

          {/* Value Type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Change By</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setValueType('percent')}
                className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                  valueType === 'percent' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Percentage (%)
              </button>
              <button
                onClick={() => setValueType('amount')}
                className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                  valueType === 'amount' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Fixed Amount (₹)
              </button>
            </div>
          </div>

          {/* Value Input */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {valueType === 'percent' ? 'Percentage (%)' : 'Amount (₹ Annual)'}
            </label>
            <input
              type="number"
              min="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={valueType === 'percent' ? 'e.g. 10' : 'e.g. 60000'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Live Preview */}
          {numVal > 0 && (
            <div className={`rounded-xl p-4 border-2 ${mode === 'increment' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Preview</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Current CTC (Annual)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(currentCtc)}</span>
                </div>
                <div className={`flex justify-between font-medium ${mode === 'increment' ? 'text-green-700' : 'text-red-700'}`}>
                  <span>{mode === 'increment' ? '+ Increment' : '− Decrement'}</span>
                  <span>{mode === 'increment' ? '+' : '−'}{formatCurrency(Math.abs(diff))}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between">
                  <span className="font-semibold text-slate-700">New CTC (Annual)</span>
                  <span className="font-bold text-slate-900">{formatCurrency(newCtc)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>New Monthly Net (approx)</span>
                  <span>{formatCurrency(newCtc / 12)}</span>
                </div>
                <div className={`text-center text-xs font-semibold mt-1 ${mode === 'increment' ? 'text-green-700' : 'text-red-700'}`}>
                  {mode === 'increment' ? '+' : ''}{diffPct.toFixed(2)}% change
                </div>
              </div>
            </div>
          )}

          {/* Effective From + Reason */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Effective From *</label>
              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Reason</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Annual appraisal, correction..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleApply} disabled={saving || numVal <= 0}
            className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
              mode === 'increment' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'increment' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {saving ? 'Applying...' : `Apply ${mode === 'increment' ? 'Increment' : 'Decrement'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Revision History Modal ──
function RevisionHistoryModal({ employee, onClose }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/payroll/salary/${employee.id}/revisions`)
      .then(r => setRevisions(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [employee.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Salary History — {employee.name}</h3>
            <p className="text-xs text-slate-400">{employee.employeeId} · {employee.department}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <ArrowUpDown className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No revision history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((r, i) => {
                const diff = r.newCtc - r.oldCtc;
                const pct = r.oldCtc > 0 ? ((diff / r.oldCtc) * 100) : 0;
                const isInc = r.revisionType === 'increment';
                const isDec = r.revisionType === 'decrement';
                return (
                  <div key={r.id} className={`rounded-xl border p-4 ${isInc ? 'border-green-200 bg-green-50' : isDec ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isInc ? 'bg-green-100 text-green-700' : isDec ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isInc ? '↑ INCREMENT' : isDec ? '↓ DECREMENT' : r.revisionType === 'initial' ? '• INITIAL' : '≡ MANUAL'}
                          </span>
                          {i === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Latest</span>}
                        </div>
                        <div className="text-sm font-semibold text-slate-700">
                          {formatCurrency(r.oldCtc)} → {formatCurrency(r.newCtc)}
                          <span className={`ml-2 text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ({diff >= 0 ? '+' : ''}{formatCurrency(diff)}, {pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Effective: {r.effectiveFrom} · By: {r.revisedByUser?.name || 'Admin'}
                        </div>
                        {r.reason && <div className="text-xs text-slate-500 mt-0.5 italic">"{r.reason}"</div>}
                      </div>
                      <div className="text-xs text-slate-400 ml-4 text-right whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
