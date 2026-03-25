import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Search, IndianRupee, TrendingDown, AlertCircle } from 'lucide-react';

export default function FundLedger() {
  const { data: users, loading: usersLoading, error: usersErr } = useFetch('/users?active=true', []);
  const { execute, data: ledger, loading: fetching, error: fetchErr, success } = useApi(null);

  const [userId, setUserId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  const entries = ledger?.entries || [];
  const summary = ledger?.summary || {};

  return (
    <div className="p-6">
      {usersErr && <AlertMessage type="error" message={usersErr} />}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      <h2 className="text-lg font-semibold text-slate-800 mb-4">Fund Ledger</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Employee *</label>
          {usersLoading ? (
            <div className="w-48 h-9 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <select
              value={userId}
              onChange={e => setUserId(e.target.value)}
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              icon={<IndianRupee className="w-5 h-5 text-green-600" />}
              label="Total Received"
              value={formatINR(summary.totalReceived || 0)}
              color="green"
            />
            <SummaryCard
              icon={<TrendingDown className="w-5 h-5 text-red-600" />}
              label="Total Spent"
              value={formatINR(summary.totalSpent || 0)}
              color="red"
            />
            <SummaryCard
              icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
              label="Outstanding Balance"
              value={formatINR(summary.outstanding || 0)}
              color="amber"
            />
          </div>

          {/* Ledger Table */}
          {entries.length === 0 ? (
            <EmptyState icon="📄" title="No entries" subtitle="No fund transactions found for the selected criteria" />
          ) : (
            <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                    <th className="px-4 py-3 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry, i) => {
                    const isCredit = entry.type === 'credit';
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{formatDate(entry.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            isCredit
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {isCredit ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{entry.description}</td>
                        <td className={`px-4 py-3 text-right font-medium ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {isCredit ? '+' : '-'}{formatINR(entry.amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {formatINR(entry.balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
