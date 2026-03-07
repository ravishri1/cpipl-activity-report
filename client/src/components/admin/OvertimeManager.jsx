import { useState } from 'react';
import {
  Clock, CheckCircle, XCircle, AlertCircle, Gift, BarChart3,
  Search, Filter, X, Users, TrendingUp, Calendar,
} from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: AlertCircle, bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle, bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle,     bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Icon size={11} /> {c.label}
    </span>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ request, onClose, onReviewed }) {
  const [decision, setDecision] = useState('approved');
  const [compOff, setCompOff] = useState(false);
  const { execute, loading, error } = useApi();

  const handleSubmit = async () => {
    await execute(
      () => api.put(`/api/overtime/${request.id}/review`, { status: decision, compOffEarned: compOff }),
      `Request ${decision}`
    );
    onReviewed();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Review Overtime Request</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Request info */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <p><span className="text-slate-500">Employee:</span> <span className="font-medium">{request.user?.name}</span> <span className="text-slate-400">({request.user?.employeeId})</span></p>
            <p><span className="text-slate-500">Department:</span> <span className="font-medium">{request.user?.department || '—'}</span></p>
            <p><span className="text-slate-500">Date:</span> <span className="font-medium">{formatDate(request.date)}</span></p>
            <p><span className="text-slate-500">Hours:</span> <span className="font-semibold text-blue-600">{request.hours}h</span></p>
            {request.reason && <p><span className="text-slate-500">Reason:</span> <span>{request.reason}</span></p>}
          </div>

          {/* Decision */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Decision</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDecision('approved')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  decision === 'approved'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                onClick={() => setDecision('rejected')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  decision === 'rejected'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>

          {/* Comp-off toggle (only if approving) */}
          {decision === 'approved' && (
            <label className="flex items-center gap-3 p-3 rounded-lg border border-purple-200 bg-purple-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compOff}
                onChange={e => setCompOff(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600"
              />
              <span className="text-sm text-purple-800 font-medium flex items-center gap-1.5">
                <Gift size={14} /> Award Compensatory Off
              </span>
            </label>
          )}

          {error && <AlertMessage type="error" message={error} />}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                decision === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Saving…' : `Confirm ${decision === 'approved' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Requests Table ─────────────────────────────────────────────────────────────
function RequestsTable({ requests, onReview, showReview }) {
  if (requests.length === 0) {
    return <EmptyState icon={<Clock className="w-8 h-8 text-slate-300" />} title="No requests found" subtitle="Adjust filters to see more" />;
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Dept</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Hours</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Comp-Off</th>
              {showReview && <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{r.user?.name}</p>
                  <p className="text-xs text-slate-400">{r.user?.employeeId}</p>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{r.user?.department || '—'}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{formatDate(r.date)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-blue-600">{r.hours}h</span>
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.compOffEarned
                    ? <span className="inline-flex items-center gap-1 text-purple-600 text-xs font-medium"><Gift size={12} /> Yes</span>
                    : <span className="text-slate-400">—</span>
                  }
                </td>
                {showReview && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onReview(r)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                    >
                      Review
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { data: summary, loading, error } = useFetch(`/api/overtime/summary?month=${month}`, null);

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 font-medium">Month:</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Requests', value: summary.totalRequests, color: 'text-slate-800' },
              { label: 'Total Hours',    value: `${summary.totalHours}h`, color: 'text-blue-600' },
              { label: 'Approved',       value: summary.approved,  color: 'text-green-600' },
              { label: 'Pending',        value: summary.pending,   color: 'text-amber-600' },
              { label: 'Rejected',       value: summary.rejected,  color: 'text-red-600' },
              { label: 'Comp-Offs',      value: summary.compOffsEarned, color: 'text-purple-600' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-slate-500 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Department breakdown */}
          {summary.byDepartment.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <BarChart3 size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700">By Department</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-600">Department</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Requests</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Hours</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Approved</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Pending</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Rejected</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-600">Comp-Offs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.byDepartment.map(dept => (
                      <tr key={dept.department} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{dept.department}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{dept.totalRequests}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-blue-600">{dept.totalHours}h</td>
                        <td className="px-4 py-2.5 text-right text-green-600">{dept.approved}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{dept.pending}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{dept.rejected}</td>
                        <td className="px-4 py-2.5 text-right text-purple-600">{dept.compOffsEarned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OvertimeManager() {
  const [tab, setTab] = useState('pending');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [filters, setFilters] = useState({ status: '', month: '' });

  // Pending tab
  const { data: pending, loading: pendingLoading, error: pendingErr, refetch: refetchPending } =
    useFetch('/api/overtime/pending', []);

  // All tab
  const allParams = new URLSearchParams();
  if (filters.status) allParams.set('status', filters.status);
  if (filters.month)  allParams.set('month', filters.month);
  const { data: all, loading: allLoading, error: allErr, refetch: refetchAll } =
    useFetch(`/api/overtime/all?${allParams}`, []);

  const handleReviewed = () => {
    refetchPending();
    refetchAll();
  };

  const TABS = [
    { key: 'pending', label: 'Pending', count: pending.length, icon: AlertCircle },
    { key: 'all',     label: 'All Requests', count: null, icon: Users },
    { key: 'summary', label: 'Monthly Summary', count: null, icon: TrendingUp },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Overtime Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review requests and view monthly summaries</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <>
          {pendingLoading && <LoadingSpinner />}
          {pendingErr && <AlertMessage type="error" message={pendingErr} />}
          {!pendingLoading && (
            <RequestsTable
              requests={pending}
              onReview={setReviewTarget}
              showReview
            />
          )}
        </>
      )}

      {/* All Requests Tab */}
      {tab === 'all' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <input
              type="month"
              value={filters.month}
              onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Filter by month"
            />
            {(filters.status || filters.month) && (
              <button
                onClick={() => setFilters({ status: '', month: '' })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          {allLoading && <LoadingSpinner />}
          {allErr && <AlertMessage type="error" message={allErr} />}
          {!allLoading && (
            <RequestsTable
              requests={all}
              onReview={setReviewTarget}
              showReview={false}
            />
          )}
        </>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && <SummaryTab />}

      {/* Review Modal */}
      {reviewTarget && (
        <ReviewModal
          request={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  );
}
