import { useState } from 'react';
import {
  ClipboardEdit, CheckCircle, XCircle, AlertCircle,
  Users, X, Clock, LogIn, LogOut, Timer, ShieldAlert,
  AlertTriangle, Briefcase,
} from 'lucide-react';
import api from '../../utils/api';
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

const TYPE_CONFIG = {
  late_mark:     { label: 'Late Mark',     icon: Timer,          color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  missed_punch:  { label: 'Missed Punch',  icon: AlertTriangle,  color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200' },
  short_hours:   { label: 'Short Hours',   icon: Clock,          color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  other:         { label: 'Other',         icon: ClipboardEdit,  color: 'text-slate-600', bg: 'bg-slate-50',  border: 'border-slate-200' },
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

function TypeBadge({ type }) {
  const c = TYPE_CONFIG[type] || TYPE_CONFIG.other;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.bg} ${c.color} ${c.border}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

function formatTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ request, onClose, onReviewed }) {
  const [decision, setDecision] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');
  const { execute, loading, error } = useApi();

  const handleSubmit = async () => {
    try {
      await execute(
        () => api.put(`/regularization/${request.id}/review`, { status: decision, reviewNote: reviewNote || undefined }),
        `Request ${decision}`
      );
      onReviewed();
      onClose();
    } catch {
      // Error displayed by useApi hook
    }
  };

  const att = request.attendance;
  const shift = request.shift;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Review Regularization Request</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Employee info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{request.user?.name}</p>
              <p className="text-xs text-slate-400">{request.user?.employeeId} · {request.user?.department || '—'}</p>
            </div>
            <TypeBadge type={request.type} />
          </div>

          {/* Request details */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold">{formatDate(request.date)}</span>
            </div>

            {/* Shift info */}
            {shift && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1"><Briefcase size={12} /> Shift:</span>
                <span className="font-medium text-slate-700">{shift.name} ({shift.startTime} - {shift.endTime})</span>
              </div>
            )}

            {/* Actual attendance vs requested */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Actual vs Requested</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Actual Check-In</p>
                  <p className="font-mono font-semibold text-slate-700">{att?.checkIn ? formatTime(att.checkIn) : 'No punch'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Requested Check-In</p>
                  <p className="font-mono font-semibold text-emerald-600">{request.requestedIn || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Actual Check-Out</p>
                  <p className="font-mono font-semibold text-slate-700">{att?.checkOut ? formatTime(att.checkOut) : 'No punch'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Requested Check-Out</p>
                  <p className="font-mono font-semibold text-blue-600">{request.requestedOut || '—'}</p>
                </div>
              </div>
              {att?.workHours != null && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-400">Work Hours:</span>
                  <span className={`font-semibold text-sm ${att.workHours < 9 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {att.workHours.toFixed(1)}h {att.workHours < 9 && <span className="text-[10px] font-normal">(min: 9h)</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Late mark info */}
            {request.type === 'late_mark' && shift && att?.checkIn && (
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldAlert size={14} className="text-amber-500" />
                  <span className="text-amber-700 font-medium">
                    Late by {(() => {
                      const [sh, sm] = shift.startTime.split(':').map(Number);
                      const shiftMin = sh * 60 + sm;
                      const ci = new Date(att.checkIn);
                      const ciMin = ci.getHours() * 60 + ci.getMinutes();
                      return ciMin - shiftMin;
                    })()} min
                    (grace: 15 min, shift starts {shift.startTime})
                  </span>
                </div>
              </div>
            )}

            {/* Reason */}
            {request.reason && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-400 mb-1">Reason</p>
                <p className="text-slate-700">{request.reason}</p>
              </div>
            )}
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

          {/* Review note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Add a note for the employee..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

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
              {loading ? 'Saving...' : `Confirm ${decision === 'approved' ? 'Approval' : 'Rejection'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Requests Table ────────────────────────────────────────────────────────────
function RequestsTable({ requests, onReview, showReview }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardEdit className="w-8 h-8 text-slate-300" />}
        title="No requests found"
        subtitle="Adjust filters to see more"
      />
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Shift</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Actual In/Out</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Requested</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Hours</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
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
                <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                  {formatDate(r.date)}
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={r.type} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {r.shift ? (
                    <div>
                      <p className="font-medium text-slate-600">{r.shift.name}</p>
                      <p>{r.shift.startTime} - {r.shift.endTime}</p>
                    </div>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="space-y-0.5">
                    <p>
                      <span className="text-slate-400">In:</span>{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {r.attendance?.checkIn ? formatTime(r.attendance.checkIn) : 'No punch'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">Out:</span>{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {r.attendance?.checkOut ? formatTime(r.attendance.checkOut) : 'No punch'}
                      </span>
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="space-y-0.5">
                    {r.requestedIn && (
                      <p>
                        <span className="text-slate-400">In:</span>{' '}
                        <span className="font-mono font-semibold text-emerald-600">{r.requestedIn}</span>
                      </p>
                    )}
                    {r.requestedOut && (
                      <p>
                        <span className="text-slate-400">Out:</span>{' '}
                        <span className="font-mono font-semibold text-blue-600">{r.requestedOut}</span>
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.attendance?.workHours != null ? (
                    <span className={`font-semibold ${r.attendance.workHours < 9 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {r.attendance.workHours.toFixed(1)}h
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-[150px]">
                  <span className="line-clamp-2 text-xs">{r.reason || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                  {r.reviewer?.name && (
                    <p className="text-[10px] text-slate-400 mt-0.5">by {r.reviewer.name}</p>
                  )}
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function RegularizationManager() {
  const [tab, setTab] = useState('pending');
  const [reviewTarget, setReviewTarget] = useState(null);
  const [filters, setFilters] = useState({ status: '', type: '' });

  // Pending tab — always fresh pending list
  const { data: pending, loading: pendingLoading, error: pendingErr, refetch: refetchPending } =
    useFetch('/regularization?status=pending', []);

  // All tab — filtered
  const allParams = new URLSearchParams();
  if (filters.status) allParams.set('status', filters.status);
  const allQuery = allParams.toString() ? `?${allParams}` : '';
  const { data: all, loading: allLoading, error: allErr, refetch: refetchAll } =
    useFetch(`/regularization${allQuery}`, []);

  const handleReviewed = () => {
    refetchPending();
    refetchAll();
  };

  // Filter by type on client side (since type is computed)
  const filterByType = (list) => {
    if (!filters.type) return list;
    return list.filter(r => r.type === filters.type);
  };

  const TABS = [
    { key: 'pending', label: 'Pending',      count: pending.length, icon: AlertCircle },
    { key: 'all',     label: 'All Requests', count: null,           icon: Users },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex items-center gap-3">
          <ClipboardEdit size={20} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Attendance Regularization</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve employee check-in / check-out correction requests</p>
          </div>
        </div>
      </div>

      {/* Policy info banner */}
      <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Attendance Policy</p>
          <p className="mt-0.5 opacity-80">
            Working hours: 9h/day | Grace period: 15 min | Every 3 unregularized late marks = 0.5 day deduction from leave (or LOP).
            Approving a regularization request clears the late mark penalty for that day.
          </p>
        </div>
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
              requests={filterByType(pending)}
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
            <select
              value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="late_mark">Late Mark</option>
              <option value="missed_punch">Missed Punch</option>
              <option value="short_hours">Short Hours</option>
              <option value="other">Other</option>
            </select>
            {(filters.status || filters.type) && (
              <button
                onClick={() => setFilters({ status: '', type: '' })}
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
              requests={filterByType(all)}
              onReview={setReviewTarget}
              showReview={false}
            />
          )}
        </>
      )}

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
