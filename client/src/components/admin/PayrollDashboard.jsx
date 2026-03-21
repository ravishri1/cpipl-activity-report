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
} from 'lucide-react';
import api from '../../utils/api';

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
    { label: 'Other Allowances', value: payslip.otherAllowance },
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

export default function PayrollDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
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
      const res = await api.get(`/payroll/overview?month=${selectedMonth}`);
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

  useEffect(() => { if (activeTab === 'overview') fetchOverview(); }, [activeTab, fetchOverview]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/payroll/generate', {
        month: selectedMonth,
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
        response.data?.message ||
          `All payslips published for ${formatMonthDisplay(selectedMonth)}`,
        'success'
      );
      fetchPayslips();
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
                <button
                  onClick={() => setActiveTab('payslips')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Process Payroll
                </button>
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
                            { label: ctrl.invert ? ctrl.unlockLabel : ctrl.unlockLabel, active: !ctrl.value },
                            { label: ctrl.invert ? ctrl.lockLabel : ctrl.lockLabel, active: ctrl.value },
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
                <div className="bg-white rounded-xl border border-slate-200 p-5 min-h-[140px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Stop Salary Processing</h4>
                  <p className="text-sm text-slate-400 text-center mt-6">No Records</p>
                </div>

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
    </div>
  );
}
