import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Search, IndianRupee, TrendingDown, AlertCircle, Download, Edit2, Check, X } from 'lucide-react';

const ENTRY_TYPE_STYLES = {
  opening: 'bg-slate-100 text-slate-600 border-slate-200',
  advance: 'bg-green-100 text-green-700 border-green-200',
  expense: 'bg-red-100 text-red-700 border-red-200',
  reimbursement: 'bg-blue-100 text-blue-700 border-blue-200',
  settlement: 'bg-purple-100 text-purple-700 border-purple-200',
};

const ENTRY_TYPE_LABELS = {
  opening: 'Opening',
  advance: 'Advance',
  expense: 'Expense',
  reimbursement: 'Reimbursement',
  settlement: 'Settlement',
  credit: 'Credit',
  debit: 'Debit',
};

export default function FundLedger() {
  const { data: users, loading: usersLoading, error: usersErr } = useFetch('/users?active=true', []);
  const { execute, data: ledger, loading: fetching, error: fetchErr } = useApi(null);
  const { execute: execBalance, loading: savingBalance, error: balanceErr, success: balanceSuccess } = useApi();

  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceForm, setBalanceForm] = useState({ openingBalance: '', notes: '' });

  const handleGenerate = async () => {
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
      // Regenerate ledger to reflect new opening balance
      await handleGenerate();
    } catch {
      // Error displayed by useApi
    }
  };

  const startEditBalance = () => {
    setBalanceForm({
      openingBalance: String(ledger?.openingBalance ?? 0),
      notes: '',
    });
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
    // Summary row
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

  return (
    <div className="p-6">
      {usersErr && <AlertMessage type="error" message={usersErr} />}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {balanceErr && <AlertMessage type="error" message={balanceErr} />}
      {balanceSuccess && <AlertMessage type="success" message={balanceSuccess} />}

      <h2 className="text-lg font-semibold text-slate-800 mb-4">Fund Ledger</h2>

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
          onClick={handleGenerate}
          disabled={!userId || fetching}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {fetching ? 'Loading...' : 'Generate Ledger'}
        </button>
      </div>

      {/* Ledger Content */}
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
                  {/* Summary footer */}
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
