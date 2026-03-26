import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Search, IndianRupee, TrendingDown, AlertCircle, Download, Edit2, Check, X, Lock, Unlock, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const ENTRY_TYPE_STYLES = {
  opening: 'bg-slate-100 text-slate-600 border-slate-200',
  advance: 'bg-green-100 text-green-700 border-green-200',
  expense: 'bg-red-100 text-red-700 border-red-200',
  reimbursement: 'bg-blue-100 text-blue-700 border-blue-200',
  settlement: 'bg-purple-100 text-purple-700 border-purple-200',
  income: 'bg-teal-100 text-teal-700 border-teal-200',
  adjustment_in: 'bg-amber-100 text-amber-700 border-amber-200',
  adjustment_out: 'bg-orange-100 text-orange-700 border-orange-200',
};

const ENTRY_TYPE_LABELS = {
  opening: 'Opening',
  advance: 'Advance',
  expense: 'Expense',
  reimbursement: 'Reimbursement',
  settlement: 'Settlement',
  income: 'Income',
  credit: 'Credit',
  debit: 'Debit',
  adjustment_in: 'Adj (+)',
  adjustment_out: 'Adj (-)',
};

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
  { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

export default function FundLedger() {
  const { data: users, loading: usersLoading, error: usersErr } = useFetch('/users?active=true', []);

  // ── Monthly Ledger state ─────────────────────────────────────────────────
  const currentYear = String(new Date().getFullYear());
  const [mlUserId, setMlUserId] = useState('');
  const [mlYear, setMlYear] = useState(currentYear);
  const [expandedLedgerId, setExpandedLedgerId] = useState(null);
  const [expandedEntries, setExpandedEntries] = useState([]);

  const { data: monthlyLedgers, loading: mlLoading, error: mlErr, refetch: refetchLedgers } = useFetch(
    `/expenses/ledger/monthly?${mlUserId ? `userId=${mlUserId}&` : ''}year=${mlYear}`,
    []
  );

  const { execute: execGenerate, loading: generating, error: generateErr, success: generateSuccess } = useApi();
  const { execute: execAutoGenerate, loading: autoGenerating, error: autoGenerateErr, success: autoGenerateSuccess } = useApi();
  const { execute: execLock, loading: locking, error: lockErr } = useApi();
  const { execute: execAdjust, loading: adjusting, error: adjustErr, success: adjustSuccess } = useApi();

  // Generate month modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({ userId: '', month: '' });

  // Auto-generate modal
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoMonth, setAutoMonth] = useState('');

  // Adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ userId: '', month: '', description: '', amount: '', date: '' });

  // View ledger modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewLedger, setViewLedger] = useState(null);

  const handleGenerate = async () => {
    if (!generateForm.userId || !generateForm.month) return;
    try {
      await execGenerate(
        () => api.post('/expenses/ledger/generate', { userId: parseInt(generateForm.userId), month: generateForm.month }),
        'Ledger generated!'
      );
      refetchLedgers();
      setShowGenerateModal(false);
      setGenerateForm({ userId: '', month: '' });
    } catch {
      // Error displayed by useApi
    }
  };

  const handleAutoGenerate = async () => {
    if (!autoMonth) return;
    try {
      await execAutoGenerate(
        () => api.post('/expenses/ledger/auto-generate', { month: autoMonth }),
        'Auto-generation complete!'
      );
      refetchLedgers();
      setShowAutoModal(false);
      setAutoMonth('');
    } catch {
      // Error displayed by useApi
    }
  };

  const handleLock = async (ledger) => {
    if (!window.confirm(`Lock ledger for ${ledger.user?.name} — ${ledger.month}? No adjustments can be made after locking.`)) return;
    try {
      await execLock(() => api.put(`/expenses/ledger/monthly/${ledger.id}/lock`), 'Ledger locked!');
      refetchLedgers();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleUnlock = async (ledger) => {
    if (!window.confirm(`Unlock ledger for ${ledger.user?.name} — ${ledger.month}?`)) return;
    try {
      await execLock(() => api.put(`/expenses/ledger/monthly/${ledger.id}/unlock`), 'Ledger unlocked!');
      refetchLedgers();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleAdjust = async () => {
    if (!adjustForm.userId || !adjustForm.month || !adjustForm.description || !adjustForm.amount || !adjustForm.date) return;
    try {
      await execAdjust(
        () => api.post('/expenses/ledger/adjustment', {
          userId: parseInt(adjustForm.userId),
          month: adjustForm.month,
          description: adjustForm.description,
          amount: parseFloat(adjustForm.amount),
          date: adjustForm.date,
        }),
        'Adjustment saved!'
      );
      refetchLedgers();
      setShowAdjustModal(false);
      setAdjustForm({ userId: '', month: '', description: '', amount: '', date: '' });
    } catch {
      // Error displayed by useApi
    }
  };

  const handleViewLedger = async (ledger) => {
    try {
      const res = await api.get(`/expenses/ledger/monthly/${ledger.id}`);
      setViewLedger(res.data);
      setShowViewModal(true);
    } catch {
      // handled below
    }
  };

  const handleExportMonthlyCSV = (ledger) => {
    window.open(`/api/expenses/ledger/monthly/${ledger.id}/export`, '_blank');
  };

  const openAdjustFor = (ledger) => {
    setAdjustForm({
      userId: String(ledger.userId),
      month: ledger.month,
      description: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
    });
    setShowAdjustModal(true);
  };

  // ── On-demand ledger state (existing) ────────────────────────────────────
  const { execute, data: ledger, loading: fetching, error: fetchErr } = useApi(null);
  const { execute: execBalance, loading: savingBalance, error: balanceErr, success: balanceSuccess } = useApi();

  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ openingBalance: '', notes: '' });

  const handleOnDemandGenerate = async () => {
    if (!userId) return;
    const params = [`userId=${userId}`];
    if (fromDate) params.push(`fromDate=${fromDate}`);
    if (toDate) params.push(`toDate=${toDate}`);
    try {
      await execute(() => api.get(`/expenses/fund-requests/ledger?${params.join('&')}`));
    } catch {
      // Error displayed by useApi
    }
  };

  const handleSaveBalance = async () => {
    if (!userId) return;
    try {
      await execBalance(
        () => api.put(`/expenses/fund-balances/${userId}`, {
          openingBalance: parseFloat(balanceForm.openingBalance) || 0,
          notes: balanceForm.notes || null,
        }),
        'Opening balance updated!'
      );
      setEditingBalance(false);
      await handleOnDemandGenerate();
    } catch {
      // Error displayed by useApi
    }
  };

  const startEditBalance = () => {
    setBalanceForm({ openingBalance: String(ledger?.openingBalance ?? 0), notes: '' });
    setEditingBalance(true);
  };

  const entries = ledger?.entries || [];
  const summary = ledger?.summary || {};

  const handleExportCSV = () => {
    if (!entries.length) return;
    const selectedUser = users.find(u => String(u.id) === String(userId));
    const userName = selectedUser?.name || `user_${userId}`;
    const headers = ['Date', 'Type', 'Description', 'Money In (₹)', 'Money Out (₹)', 'Running Balance (₹)'];
    const rows = entries.map(e => [
      e.date,
      ENTRY_TYPE_LABELS[e.entryType] || e.entryType || (e.type === 'credit' ? 'Credit' : 'Debit'),
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.moneyIn != null ? e.moneyIn : (e.type === 'credit' ? e.amount : 0),
      e.moneyOut != null ? e.moneyOut : (e.type === 'debit' ? e.amount : 0),
      e.balance ?? '',
    ]);
    rows.push([]);
    rows.push(['', '', 'TOTAL', summary.totalIn ?? summary.totalReceived ?? '', summary.totalOut ?? summary.totalSpent ?? '', summary.currentBalance ?? summary.outstanding ?? '']);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund_ledger_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = [];
  for (let y = new Date().getFullYear(); y >= 2023; y--) yearOptions.push(String(y));

  return (
    <div className="p-6 space-y-8">
      {usersErr && <AlertMessage type="error" message={usersErr} />}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Monthly Ledgers Section                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Monthly Ledgers</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAutoModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className="w-4 h-4" /> Auto-Generate All
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Generate Month
            </button>
          </div>
        </div>

        {mlErr && <AlertMessage type="error" message={mlErr} />}
        {generateErr && <AlertMessage type="error" message={generateErr} />}
        {generateSuccess && <AlertMessage type="success" message={generateSuccess} />}
        {autoGenerateErr && <AlertMessage type="error" message={autoGenerateErr} />}
        {autoGenerateSuccess && <AlertMessage type="success" message={autoGenerateSuccess} />}
        {lockErr && <AlertMessage type="error" message={lockErr} />}
        {adjustErr && <AlertMessage type="error" message={adjustErr} />}
        {adjustSuccess && <AlertMessage type="success" message={adjustSuccess} />}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Employee (optional)</label>
            {usersLoading ? (
              <div className="w-48 h-9 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <select
                value={mlUserId}
                onChange={e => setMlUserId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">All Employees</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <select
              value={mlYear}
              onChange={e => setMlYear(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {mlLoading ? (
          <LoadingSpinner />
        ) : monthlyLedgers.length === 0 ? (
          <EmptyState icon="📅" title="No monthly ledgers" subtitle="Generate a monthly ledger to see it here" />
        ) : (
          <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Opening</th>
                  <th className="px-4 py-3 text-right">Total In</th>
                  <th className="px-4 py-3 text-right">Total Out</th>
                  <th className="px-4 py-3 text-right">Closing</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthlyLedgers.map(ml => (
                  <tr key={ml.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{ml.month}</td>
                    <td className="px-4 py-3 text-slate-700">{ml.user?.name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatINR(ml.openingBalance)}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">+{formatINR(ml.totalIn)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">-{formatINR(ml.totalOut)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${ml.closingBalance >= 0 ? 'text-slate-800' : 'text-red-700'}`}>
                      {formatINR(ml.closingBalance)}
                    </td>
                    <td className="px-4 py-3">
                      {ml.isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-white">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                          <Unlock className="w-3 h-3" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewLedger(ml)}
                          className="px-2 py-1 text-xs border rounded hover:bg-slate-50 text-slate-600"
                          title="View entries"
                        >
                          View
                        </button>
                        {!ml.isLocked && (
                          <>
                            <button
                              onClick={() => handleLock(ml)}
                              disabled={locking}
                              className="px-2 py-1 text-xs border rounded hover:bg-slate-50 text-slate-600"
                              title="Lock ledger"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openAdjustFor(ml)}
                              className="px-2 py-1 text-xs border rounded hover:bg-slate-50 text-blue-600"
                              title="Add adjustment"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {ml.isLocked && (
                          <button
                            onClick={() => handleUnlock(ml)}
                            disabled={locking}
                            className="px-2 py-1 text-xs border rounded hover:bg-slate-50 text-amber-600"
                            title="Unlock ledger"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportMonthlyCSV(ml)}
                          className="px-2 py-1 text-xs border rounded hover:bg-slate-50 text-slate-600"
                          title="Export CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Separator                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t-2 border-slate-200 pt-2">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">On-Demand Fund Ledger</h2>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Existing On-Demand Ledger Section                                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        {fetchErr && <AlertMessage type="error" message={fetchErr} />}
        {balanceErr && <AlertMessage type="error" message={balanceErr} />}
        {balanceSuccess && <AlertMessage type="success" message={balanceSuccess} />}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Employee *</label>
            {usersLoading ? (
              <div className="w-48 h-9 bg-slate-100 animate-pulse rounded-lg" />
            ) : (
              <select
                value={userId}
                onChange={e => { setUserId(e.target.value); setEditingBalance(false); }}
                className="border rounded-lg px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">Select Employee</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleOnDemandGenerate}
            disabled={!userId || fetching}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {fetching ? 'Loading...' : 'Generate Ledger'}
          </button>
        </div>

        {!ledger && !fetching && (
          <EmptyState icon="📒" title="Select an employee" subtitle="Choose an employee and click Generate to view their fund ledger" />
        )}

        {fetching && <LoadingSpinner />}

        {ledger && !fetching && (
          <>
            {/* Opening Balance Editor */}
            <div className="mb-4 p-4 bg-slate-50 border rounded-xl flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500 mb-1">Opening Balance</p>
                {editingBalance ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      value={balanceForm.openingBalance}
                      onChange={e => setBalanceForm(f => ({ ...f, openingBalance: e.target.value }))}
                      className="border rounded-lg px-3 py-1.5 text-sm w-32"
                      placeholder="0"
                    />
                    <input
                      type="text"
                      value={balanceForm.notes}
                      onChange={e => setBalanceForm(f => ({ ...f, notes: e.target.value }))}
                      className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[150px]"
                      placeholder="Notes (optional)"
                    />
                    <button
                      onClick={handleSaveBalance}
                      disabled={savingBalance}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> {savingBalance ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingBalance(false)}
                      className="flex items-center gap-1 px-3 py-1.5 border text-xs rounded-lg hover:bg-white"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-slate-800">{formatINR(ledger.openingBalance || 0)}</p>
                )}
              </div>
              {!editingBalance && (
                <button
                  onClick={startEditBalance}
                  className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded-lg hover:bg-white text-slate-600"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Balance
                </button>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <SummaryCard
                icon={<IndianRupee className="w-5 h-5 text-green-600" />}
                label="Total In"
                value={formatINR(summary.totalIn ?? summary.totalReceived ?? 0)}
                color="green"
              />
              <SummaryCard
                icon={<TrendingDown className="w-5 h-5 text-red-600" />}
                label="Total Out"
                value={formatINR(summary.totalOut ?? summary.totalSpent ?? 0)}
                color="red"
              />
              <SummaryCard
                icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
                label="Current Balance"
                value={formatINR(summary.currentBalance ?? summary.outstanding ?? 0)}
                color="amber"
              />
            </div>

            {/* Ledger Table */}
            {entries.length === 0 ? (
              <EmptyState icon="📄" title="No entries" subtitle="No fund transactions found for the selected criteria" />
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 border text-sm rounded-lg hover:bg-slate-50 text-slate-600"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3 text-right">Money In (₹)</th>
                        <th className="px-4 py-3 text-right">Money Out (₹)</th>
                        <th className="px-4 py-3 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry, i) => {
                        const entryType = entry.entryType || (entry.type === 'credit' ? 'advance' : 'expense');
                        const styleClass = ENTRY_TYPE_STYLES[entryType] || ENTRY_TYPE_STYLES.advance;
                        const label = ENTRY_TYPE_LABELS[entryType] || entryType;
                        const moneyIn = entry.moneyIn != null ? entry.moneyIn : (entry.type === 'credit' ? entry.amount : 0);
                        const moneyOut = entry.moneyOut != null ? entry.moneyOut : (entry.type === 'debit' ? entry.amount : 0);
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styleClass}`}>
                                {label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{entry.description}</td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">
                              {moneyIn > 0 ? `+${formatINR(moneyIn)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-red-600">
                              {moneyOut > 0 ? `-${formatINR(moneyOut)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-800">
                              {formatINR(entry.balance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                        <td className="px-4 py-3 text-xs text-slate-500 uppercase" colSpan={3}>Total</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatINR(summary.totalIn ?? summary.totalReceived ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatINR(summary.totalOut ?? summary.totalSpent ?? 0)}</td>
                        <td className="px-4 py-3 text-right text-slate-800">{formatINR(summary.currentBalance ?? summary.outstanding ?? 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Modals                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Generate Month Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Generate Monthly Ledger</h3>
            {generateErr && <AlertMessage type="error" message={generateErr} />}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Employee *</label>
                <select
                  value={generateForm.userId}
                  onChange={e => setGenerateForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Employee</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Month * (YYYY-MM)</label>
                <input
                  type="month"
                  value={generateForm.month}
                  onChange={e => setGenerateForm(f => ({ ...f, month: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={!generateForm.userId || !generateForm.month || generating}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Auto-Generate All Ledgers</h3>
            <p className="text-sm text-slate-500 mb-3">This will generate ledgers for ALL active employees who have any fund activity in the selected month.</p>
            {autoGenerateErr && <AlertMessage type="error" message={autoGenerateErr} />}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Month * (YYYY-MM)</label>
              <input
                type="month"
                value={autoMonth}
                onChange={e => setAutoMonth(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAutoModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleAutoGenerate}
                disabled={!autoMonth || autoGenerating}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {autoGenerating ? 'Generating...' : 'Auto-Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Add Manual Adjustment</h3>
            <p className="text-xs text-slate-500 mb-3">Use positive amount for money in, negative for money out.</p>
            {adjustErr && <AlertMessage type="error" message={adjustErr} />}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Employee *</label>
                <select
                  value={adjustForm.userId}
                  onChange={e => setAdjustForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select Employee</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Month *</label>
                <input
                  type="month"
                  value={adjustForm.month}
                  onChange={e => setAdjustForm(f => ({ ...f, month: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description *</label>
                <input
                  type="text"
                  value={adjustForm.description}
                  onChange={e => setAdjustForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Petty cash correction"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Amount * (+ = in, - = out)</label>
                <input
                  type="number"
                  value={adjustForm.amount}
                  onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="-500 or 1000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date *</label>
                <input
                  type="date"
                  value={adjustForm.date}
                  onChange={e => setAdjustForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAdjustModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleAdjust}
                disabled={!adjustForm.userId || !adjustForm.month || !adjustForm.description || !adjustForm.amount || !adjustForm.date || adjusting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {adjusting ? 'Saving...' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Ledger Modal */}
      {showViewModal && viewLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Ledger — {viewLedger.user?.name} ({viewLedger.month})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Opening: {formatINR(viewLedger.openingBalance)} &nbsp;|&nbsp;
                  In: +{formatINR(viewLedger.totalIn)} &nbsp;|&nbsp;
                  Out: -{formatINR(viewLedger.totalOut)} &nbsp;|&nbsp;
                  Closing: {formatINR(viewLedger.closingBalance)}
                </p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-5">
              {(viewLedger.entries || []).length === 0 ? (
                <EmptyState icon="📄" title="No entries" subtitle="No transactions in this period" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">In (₹)</th>
                      <th className="px-3 py-2 text-right">Out (₹)</th>
                      <th className="px-3 py-2 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(viewLedger.entries || []).map((entry, i) => {
                      const et = entry.entryType || 'advance';
                      const sc = ENTRY_TYPE_STYLES[et] || ENTRY_TYPE_STYLES.advance;
                      const lbl = ENTRY_TYPE_LABELS[et] || et;
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(entry.date)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sc}`}>{lbl}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-xs truncate">{entry.description}</td>
                          <td className="px-3 py-2 text-right text-green-600 font-medium">{entry.moneyIn > 0 ? `+${formatINR(entry.moneyIn)}` : '—'}</td>
                          <td className="px-3 py-2 text-right text-red-600 font-medium">{entry.moneyOut > 0 ? `-${formatINR(entry.moneyOut)}` : '—'}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-800">{formatINR(entry.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 bg-${color}-50 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
