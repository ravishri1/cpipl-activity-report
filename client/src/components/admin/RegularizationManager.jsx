import { useState } from 'react';
import {
  ClipboardEdit, CheckCircle, XCircle, AlertCircle,
  Users, X, Clock, Timer, ShieldAlert, Download,
  AlertTriangle, ChevronRight, MessageSquare, User,
  Calendar, ArrowRight,
} from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

// ── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300', dot: 'bg-amber-400' },
  approved: { label: 'Approved', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300', dot: 'bg-green-500' },
  rejected: { label: 'Rejected', bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',   dot: 'bg-red-500' },
};

const TYPE_LABELS = {
  late_mark: 'Late In',
  missed_punch: 'Regularization',
  short_hours: 'Short Hours',
  other: 'Regularization',
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function formatTime(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Detail View (greytHR-style full page) ────────────────────────────────────
function RequestDetail({ request, onBack, onReviewed }) {
  const [reviewNote, setReviewNote] = useState('');
  const { execute, loading, error } = useApi();

  const handleAction = async (decision) => {
    try {
      await execute(
        () => api.put(`/regularization/${request.id}/review`, { status: decision, reviewNote: reviewNote || undefined }),
        `Request ${decision}`
      );
      onReviewed();
      onBack();
    } catch {
      // Error displayed by useApi hook
    }
  };

  const att = request.attendance;
  const shift = request.shift;

  // Compute late minutes
  let lateMinutes = null;
  if (shift?.startTime && att?.checkIn) {
    const [sh, sm] = shift.startTime.split(':').map(Number);
    const shiftMin = sh * 60 + (sm || 0);
    const ci = new Date(att.checkIn);
    const ciMin = ci.getHours() * 60 + ci.getMinutes();
    lateMinutes = ciMin - shiftMin;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mb-4 font-medium"
      >
        ← Back to list
      </button>

      <div className="flex gap-6">
        {/* ── Left: Main Content ── */}
        <div className="flex-1 space-y-4">
          {/* Applied By / Applied To card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                {/* Applied By */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Applied By</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {request.user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{request.user?.name}</p>
                      <p className="text-xs text-slate-400">#{request.user?.employeeId}</p>
                    </div>
                  </div>
                </div>

                <ArrowRight size={16} className="text-slate-300 mt-4" />

                {/* Applied To */}
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5">Applied To</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                      A
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Admin</p>
                      <p className="text-xs text-slate-400">Approver</p>
                    </div>
                  </div>
                </div>
              </div>

              <StatusBadge status={request.status} />
            </div>
          </div>

          {/* Applied Dates + Remarks card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex gap-12">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Applied Date(s)</p>
                <p className="text-sm font-semibold text-slate-800">{formatShortDate(request.date)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Permission Type</p>
                <p className="text-sm font-semibold text-slate-800">{TYPE_LABELS[request.type] || 'Regularization'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Remarks</p>
                <p className="text-sm text-slate-700">{request.reason || '—'}</p>
              </div>
            </div>
          </div>

          {/* Session / Time Slot table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Session / Time Slot</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Permission Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-8 bg-blue-500 rounded-full" />
                      <span className="font-medium text-slate-800">{formatShortDate(request.date)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700">
                        {request.requestedIn || (att?.checkIn ? formatTime(att.checkIn) : '--:--')}
                      </span>
                      <span className="text-slate-400">—</span>
                      <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700">
                        {request.requestedOut || (att?.checkOut ? formatTime(att.checkOut) : '--:--')}
                      </span>
                    </div>
                    {(request.requestedIn || request.requestedOut) && (
                      <p className="text-[10px] text-blue-500 mt-1 font-medium">
                        Applied for: {request.requestedIn || '--:--'} - {request.requestedOut || '--:--'}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-medium">
                    {TYPE_LABELS[request.type] || 'Regularization'}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {request.reason || '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Attendance Context card (our addition — useful for admin) */}
          {(att || shift) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">Attendance Context</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {shift && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Shift</p>
                    <p className="font-semibold text-slate-700">{shift.name}</p>
                    <p className="text-xs text-slate-500">{shift.startTime} - {shift.endTime}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Actual Check-In</p>
                  <p className="font-mono font-semibold text-slate-700">{att?.checkIn ? formatTime(att.checkIn) : 'No punch'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Actual Check-Out</p>
                  <p className="font-mono font-semibold text-slate-700">{att?.checkOut ? formatTime(att.checkOut) : 'No punch'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Work Hours</p>
                  <p className={`font-semibold ${att?.workHours != null && att.workHours < 9 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {att?.workHours != null ? `${att.workHours.toFixed(1)}h` : '—'}
                  </p>
                </div>
              </div>

              {/* Late info */}
              {lateMinutes != null && lateMinutes > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs">
                  <ShieldAlert size={14} className="text-amber-500" />
                  <span className="text-amber-700 font-medium">
                    Late by {lateMinutes} min (grace: 15 min, shift starts {shift.startTime})
                  </span>
                </div>
              )}
            </div>
          )}

          {error && <AlertMessage type="error" message={error} />}

          {/* Action buttons (bottom bar) */}
          {request.status === 'pending' && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onBack}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={loading}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? 'Saving...' : 'Approve'}
              </button>
              <button
                onClick={() => handleAction('rejected')}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {loading ? 'Saving...' : 'Reject'}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Timeline sidebar ── */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-20">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Timeline</h3>

            {/* Current approver */}
            <div className="flex gap-3 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-xs">
                  A
                </div>
                <div className="w-0.5 flex-1 bg-slate-200 mt-1" />
              </div>
              <div className="flex-1 pb-4">
                <p className="font-semibold text-sm text-slate-800">Admin</p>
                <p className="text-xs text-slate-400">{STATUS_CONFIG[request.status]?.label || 'Pending'}</p>

                {/* Comment box for pending */}
                {request.status === 'pending' && (
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder="Write your comment here"
                    className="w-full mt-2 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                )}

                {/* Show review note if already reviewed */}
                {request.reviewNote && (
                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{request.reviewNote}</p>
                )}
              </div>
            </div>

            {/* Submitter */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                  {request.user?.name?.charAt(0) || '?'}
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">{request.user?.name}</p>
                <p className="text-[10px] text-slate-400">
                  {request.createdAt ? new Date(request.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}{' '}
                  {request.createdAt ? new Date(request.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">Submitted The Application</p>
              </div>
            </div>

            {/* Reviewed info */}
            {request.reviewer?.name && request.reviewedAt && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                    {request.reviewer.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{request.reviewer.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(request.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                      {new Date(request.reviewedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {request.status === 'approved' ? 'Approved' : 'Rejected'} the request
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Request Card (greytHR-style list item) ───────────────────────────────────
function RequestCard({ request, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group"
    >
      <div className="flex items-center justify-between">
        {/* Left: Employee */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {request.user?.name?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{request.user?.name}</p>
            <p className="text-xs text-slate-400">#{request.user?.employeeId}</p>
          </div>
        </div>

        {/* Middle: Type + Applied Date */}
        <div className="flex-1 px-6">
          <p className="text-sm text-slate-500">
            Permission Type <span className="font-semibold text-slate-800">{TYPE_LABELS[request.type] || 'Regularization'}</span>
          </p>
          <p className="text-sm text-slate-500">
            Applied Date <span className="font-semibold text-slate-800">{formatShortDate(request.date)}</span>
          </p>
        </div>

        {/* Right: Status + arrow */}
        <div className="flex items-center gap-4">
          <StatusBadge status={request.status} />
          <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RegularizationManager() {
  const [tab, setTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filters, setFilters] = useState({ status: '', type: '', dateRange: '' });

  // Pending requests
  const { data: pending, loading: pendingLoading, error: pendingErr, refetch: refetchPending } =
    useFetch('/regularization?status=pending', []);

  // All requests — filtered by status
  const allParams = new URLSearchParams({ all: '1' });
  if (filters.status) allParams.set('status', filters.status);
  const allQuery = `?${allParams}`;
  const { data: all, loading: allLoading, error: allErr, refetch: refetchAll } =
    useFetch(`/regularization${allQuery}`, []);

  const handleReviewed = () => {
    refetchPending();
    refetchAll();
  };

  // Client-side type filter
  const filterByType = (list) => {
    if (!filters.type) return list;
    return list.filter(r => r.type === filters.type);
  };

  const activeList = tab === 'pending' ? pending : all;
  const activeLoading = tab === 'pending' ? pendingLoading : allLoading;
  const activeErr = tab === 'pending' ? pendingErr : allErr;
  const filteredList = filterByType(activeList);

  // If a request is selected, show detail view
  if (selectedRequest) {
    return (
      <div className="p-6">
        <RequestDetail
          request={selectedRequest}
          onBack={() => setSelectedRequest(null)}
          onReviewed={handleReviewed}
        />
      </div>
    );
  }

  const TABS = [
    { key: 'pending', label: 'Active',        count: pending.length, icon: AlertCircle },
    { key: 'all',     label: 'All Requests',  count: null,           icon: Users },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ClipboardEdit size={22} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Regularization & Permission</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve employee attendance regularization requests</p>
          </div>
        </div>
      </div>

      {/* Filters row (greytHR-style) */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Tabs as pill buttons */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        <select
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All Types</option>
          <option value="late_mark">Late In</option>
          <option value="missed_punch">Regularization</option>
          <option value="short_hours">Short Hours</option>
        </select>

        {/* Status filter (only on All tab) */}
        {tab === 'all' && (
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        )}

        {(filters.type || filters.status) && (
          <button
            onClick={() => setFilters({ status: '', type: '', dateRange: '' })}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <X size={14} /> Clear
          </button>
        )}

        {/* Count */}
        <div className="ml-auto text-sm text-slate-400">
          {filteredList.length} request{filteredList.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Error display */}
      {activeErr && <AlertMessage type="error" message={activeErr} />}

      {/* Loading */}
      {activeLoading ? (
        <LoadingSpinner />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={ClipboardEdit}
          title="No requests found"
          subtitle={tab === 'pending' ? 'No pending regularization requests' : 'Adjust filters to see more'}
        />
      ) : (
        /* Request cards list */
        <div className="space-y-3">
          {filteredList.map(r => (
            <RequestCard
              key={r.id}
              request={r}
              onClick={() => setSelectedRequest(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
