import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { formatDate } from '../../utils/formatters';
import {
  ClipboardCheck, CheckCircle2, XCircle, User, MessageSquare,
  ChevronLeft, ChevronRight, UserCheck, UserPlus, X, Send, CalendarOff, AlertTriangle,
} from 'lucide-react';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

// ─── Apply on Behalf Modal ─────────────────────────────
function ApplyOnBehalfModal({ onClose, onSuccess }) {
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    userId: '', leaveTypeId: '', startDate: '', endDate: '',
    session: 'full_day', reason: '', autoApprove: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    api.get('/users/directory').then(r => setEmployees(r.data || [])).catch(() => {});
    api.get('/leave/types').then(r => setLeaveTypes(r.data || [])).catch(() => {});
  }, []);

  // Fetch balance when employee + leave type selected
  useEffect(() => {
    if (form.userId && form.leaveTypeId) {
      const fy = getCurrentFY();
      api.get(`/leave/balance?year=${fy}&userId=${form.userId}`)
        .then(r => setBalances(r.data || []))
        .catch(() => setBalances([]));
    }
  }, [form.userId, form.leaveTypeId]);

  const selectedBalance = useMemo(() => {
    return balances.find(b => b.leaveTypeId === parseInt(form.leaveTypeId));
  }, [balances, form.leaveTypeId]);

  const isHalfDay = form.session === 'first_half' || form.session === 'second_half';

  useEffect(() => {
    if (isHalfDay && form.startDate) {
      setForm(f => ({ ...f, endDate: f.startDate }));
    }
  }, [form.session, form.startDate, isHalfDay]);

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === parseInt(form.userId));
  }, [employees, form.userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.userId) return setError('Please select an employee.');
    if (!form.leaveTypeId) return setError('Please select a leave type.');
    if (!form.startDate || (!isHalfDay && !form.endDate)) return setError('Please select dates.');
    if (!form.reason || form.reason.trim().length < 5) return setError('Reason must be at least 5 characters.');

    setSubmitting(true);
    try {
      await api.post('/leave/admin/apply-on-behalf', {
        userId: parseInt(form.userId),
        leaveTypeId: parseInt(form.leaveTypeId),
        startDate: form.startDate,
        endDate: isHalfDay ? form.startDate : form.endDate,
        session: form.session,
        reason: form.reason,
        autoApprove: form.autoApprove,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply leave.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">Apply Leave on Behalf</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
            {!form.userId ? (
              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, ID, or department..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {search && filteredEmployees.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg">
                    {filteredEmployees.slice(0, 10).map(emp => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, userId: String(emp.id) })); setSearch(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left border-b border-slate-50 last:border-0"
                      >
                        {emp.driveProfilePhotoUrl || emp.profilePhotoUrl ? (
                          <img src={emp.driveProfilePhotoUrl || emp.profilePhotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                            {emp.name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{emp.name}</p>
                          <p className="text-[10px] text-slate-400">{emp.employeeId} · {emp.department}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                {selectedEmployee?.driveProfilePhotoUrl || selectedEmployee?.profilePhotoUrl ? (
                  <img src={selectedEmployee.driveProfilePhotoUrl || selectedEmployee.profilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">
                    {selectedEmployee?.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-800">{selectedEmployee?.name}</p>
                  <p className="text-[10px] text-blue-500">{selectedEmployee?.employeeId} · {selectedEmployee?.department}</p>
                </div>
                <button type="button" onClick={() => setForm(f => ({ ...f, userId: '', leaveTypeId: '' }))} className="p-1 rounded hover:bg-blue-100">
                  <X className="w-3.5 h-3.5 text-blue-500" />
                </button>
              </div>
            )}
          </div>

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type *</label>
            <select
              value={form.leaveTypeId}
              onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
            {selectedBalance && (
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-600">Available Balance</span>
                <span className="text-sm font-bold text-blue-700">
                  {selectedBalance.available} day{selectedBalance.available !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Session */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'full_day', label: 'Full Day' },
                { value: 'first_half', label: '1st Half' },
                { value: 'second_half', label: '2nd Half' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, session: opt.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.session === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className={`grid gap-3 ${isHalfDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isHalfDay ? 'Date *' : 'From Date *'}
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: isHalfDay ? e.target.value : form.endDate })}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {!isHalfDay && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">To Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  min={form.startDate || ''}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              required
              rows={2}
              minLength={5}
              placeholder="Enter reason for leave (minimum 5 characters)..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Auto-approve toggle */}
          <label className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={form.autoApprove}
              onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <div>
              <span className="text-sm font-medium text-emerald-800">Auto-approve</span>
              <p className="text-[10px] text-emerald-600">Leave will be approved immediately without pending state</p>
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.userId || !form.leaveTypeId || !form.startDate || (!isHalfDay && !form.endDate)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? 'Applying...' : 'Apply Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function LeaveApproval() {
  const [tab, setTab] = useState('pending');
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNote, setReviewNote] = useState({});
  const [showOnBehalf, setShowOnBehalf] = useState(false);

  // Pending requests
  const { data: pending, loading: pendingLoading, error: pendingErr, refetch: refetchPending } = useFetch('/leave/pending', []);

  // All requests (for history tab)
  const { data: allRequests, loading: allLoading, error: allErr, refetch: refetchAll } = useFetch(
    `/leave/all-requests?year=${fyYear}&status=${statusFilter}`, [], [fyYear, statusFilter]
  );

  const { execute, loading: actionLoading, error: actionErr, success } = useApi();

  const handleReview = async (id, status) => {
    if (status === 'rejected' && !reviewNote[id]) {
      if (!window.confirm('Reject without a note? The employee won\'t know the reason.')) return;
    }
    try {
      await execute(
        () => api.put(`/leave/${id}/review`, { status, reviewNote: reviewNote[id] || '' }),
        `Leave request ${status}`
      );
      refetchPending();
      refetchAll();
      setReviewNote(n => { const copy = { ...n }; delete copy[id]; return copy; });
    } catch {
      // Error handled by useApi
    }
  };

  const tabs = [
    { key: 'pending', label: 'Pending', count: pending.length },
    { key: 'history', label: 'All Requests' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" />
          Leave Management
        </h1>
        <button
          onClick={() => setShowOnBehalf(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Apply on Behalf
        </button>
      </div>

      {/* Alerts */}
      {pendingErr && <AlertMessage type="error" message={pendingErr} />}
      {allErr && <AlertMessage type="error" message={allErr} />}
      {actionErr && <AlertMessage type="error" message={actionErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div>
          {pendingLoading ? <LoadingSpinner /> : pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All clear!" subtitle="No pending leave requests" />
          ) : (
            <div className="space-y-4">
              {pending.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Employee info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        {r.user.driveProfilePhotoUrl || r.user.profilePhotoUrl ? (
                          <img
                            src={r.user.driveProfilePhotoUrl || r.user.profilePhotoUrl}
                            alt={r.user.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{r.user.name}</p>
                          <p className="text-xs text-slate-400">{r.user.employeeId} · {r.user.department}</p>
                        </div>
                      </div>

                      {/* Reporting Manager */}
                      {r.user.reportingManager && (
                        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-slate-50 rounded-lg w-fit">
                          <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[10px] text-slate-400 font-medium">Reports to</span>
                          {r.user.reportingManager.driveProfilePhotoUrl || r.user.reportingManager.profilePhotoUrl ? (
                            <img
                              src={r.user.reportingManager.driveProfilePhotoUrl || r.user.reportingManager.profilePhotoUrl}
                              alt={r.user.reportingManager.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-600">
                              {r.user.reportingManager.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-medium text-slate-600">{r.user.reportingManager.name}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-medium">Type</p>
                          <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {r.leaveType.code} — {r.leaveType.name}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-medium">From</p>
                          <p className="text-sm text-slate-700">{formatDate(r.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-medium">To</p>
                          <p className="text-sm text-slate-700">{formatDate(r.endDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-medium">Days</p>
                          <p className="text-sm font-bold text-slate-800">{r.days}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-slate-400 font-medium">Session</p>
                          <p className="text-xs text-slate-600">
                            {r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full Day'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">Reason</p>
                        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{r.reason}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 sm:w-52">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-400">Note (optional)</span>
                      </div>
                      <textarea
                        value={reviewNote[r.id] || ''}
                        onChange={(e) => setReviewNote({ ...reviewNote, [r.id]: e.target.value })}
                        placeholder="Add a note..."
                        rows={2}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-none"
                      />
                      <button
                        onClick={() => handleReview(r.id, 'approved')}
                        disabled={actionLoading}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(r.id, 'rejected')}
                        disabled={actionLoading}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
              <button onClick={() => setFyYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <span className="text-sm font-semibold text-slate-700 px-2 min-w-[90px] text-center">
                {getFYLabel(fyYear)}
              </span>
              <button
                onClick={() => setFyYear(y => y + 1)}
                disabled={fyYear >= getCurrentFY()}
                className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {allLoading ? <LoadingSpinner /> : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Manager</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">From</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">To</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Days</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Reason</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allRequests.length > 0 ? allRequests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-slate-700">{r.user?.name}</p>
                        <p className="text-xs text-slate-400">{r.user?.department}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.user?.reportingManager ? (
                          <div className="flex items-center gap-1.5">
                            {r.user.reportingManager.driveProfilePhotoUrl || r.user.reportingManager.profilePhotoUrl ? (
                              <img
                                src={r.user.reportingManager.driveProfilePhotoUrl || r.user.reportingManager.profilePhotoUrl}
                                alt={r.user.reportingManager.name}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-600">
                                {r.user.reportingManager.name?.charAt(0)?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-slate-600">{r.user.reportingManager.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                          {r.leaveType.code}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-2.5 text-slate-600">{formatDate(r.endDate)}</td>
                      <td className="px-4 py-2.5 font-medium">{r.days}</td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-[180px] truncate" title={r.reason}>{r.reason}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No requests found for {getFYLabel(fyYear)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Apply on Behalf Modal */}
      {showOnBehalf && (
        <ApplyOnBehalfModal
          onClose={() => setShowOnBehalf(false)}
          onSuccess={() => {
            setShowOnBehalf(false);
            refetchPending();
            refetchAll();
          }}
        />
      )}
    </div>
  );
}
