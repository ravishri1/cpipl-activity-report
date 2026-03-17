import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ClipboardEdit, X, CheckCircle, XCircle, AlertCircle,
  Clock, Trash2, Timer, ShieldAlert, AlertTriangle, ChevronDown,
  CheckSquare, Square, Send,
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

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Icon size={11} /> {c.label}
    </span>
  );
}

const EMPTY_FORM = { date: '', requestedIn: '', requestedOut: '', reason: '' };

export default function AttendanceRegularization() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [showPolicy, setShowPolicy] = useState(true);

  // Bulk selection
  const [selectedDates, setSelectedDates] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkReasons, setBulkReasons] = useState({}); // { date: reason }
  const [commonReason, setCommonReason] = useState('');

  const { data: requests, setData: setRequests, loading, error, refetch } = useFetch('/regularization/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();
  const { execute: execDelete, loading: deleting } = useApi();
  const { execute: execBulk, loading: bulkSaving, error: bulkErr, success: bulkSuccess, clearMessages: clearBulk } = useApi();

  // Fetch late marks for the selected month
  const { data: lateData, error: lateErr, refetch: refetchLate } = useFetch(`/regularization/late-marks?month=${selectedMonth}`, {
    lateMarks: [], totalLateMarks: 0, regularizedCount: 0, unregularizedCount: 0, halfDayDeductions: 0,
  });

  // Fetch reporting manager name
  const { data: profileData } = useFetch('/users/profile', null);

  // Auto-poll every 30 seconds so list stays fresh
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const interval = setInterval(() => { refetchRef.current(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Unregularized late marks (eligible for selection)
  const eligibleLateMarks = useMemo(() =>
    lateData.lateMarks.filter(lm => !lm.regularizationStatus),
    [lateData.lateMarks]
  );

  // Reset selections when month changes
  useEffect(() => { setSelectedDates(new Set()); }, [selectedMonth]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Format DateTime to HH:MM for time input
  const toTimeStr = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const openForm = (date = '', checkIn = null, checkOut = null) => {
    setForm({
      ...EMPTY_FORM,
      date,
      requestedIn: toTimeStr(checkIn),
      requestedOut: toTimeStr(checkOut),
    });
    setFormError('');
    clearMessages();
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.requestedIn && !form.requestedOut) {
      setFormError('Please enter at least one of Check-In or Check-Out time.');
      return;
    }
    const payload = {
      date: form.date,
      reason: form.reason,
      ...(form.requestedIn  && { requestedIn:  form.requestedIn }),
      ...(form.requestedOut && { requestedOut: form.requestedOut }),
    };
    try {
      const newRecord = await execute(
        () => api.post('/regularization', payload),
        'Regularization request submitted!'
      );
      setShowForm(false);
      if (newRecord) setRequests(prev => [newRecord, ...(Array.isArray(prev) ? prev : [])]);
      refetch().catch(() => {});
      refetchLate().catch(() => {});
    } catch {
      // Error displayed by useApi hook
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this regularization request?')) return;
    try {
      await execDelete(
        () => api.delete(`/regularization/${id}`),
        'Request cancelled.'
      );
      refetch();
      refetchLate().catch(() => {});
    } catch {
      // Error displayed by useApi hook
    }
  };

  // ── Bulk selection helpers ──
  const toggleDate = (date) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDates.size === eligibleLateMarks.length) {
      setSelectedDates(new Set());
    } else {
      setSelectedDates(new Set(eligibleLateMarks.map(lm => lm.date)));
    }
  };

  const openBulkModal = () => {
    // Pre-fill reasons as empty, pre-fill times from late marks data
    const reasons = {};
    selectedDates.forEach(date => { reasons[date] = ''; });
    setBulkReasons(reasons);
    setCommonReason('');
    clearBulk();
    setShowBulkModal(true);
  };

  const applyCommonReason = () => {
    if (!commonReason.trim()) return;
    setBulkReasons(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(d => { if (!next[d]) next[d] = commonReason; });
      return next;
    });
  };

  const handleBulkSubmit = async () => {
    // Validate all reasons filled
    const missing = Object.entries(bulkReasons).filter(([, r]) => !r || r.trim().length < 3);
    if (missing.length > 0) {
      return; // Button is disabled, but safety check
    }

    // Build requests array with pre-filled times
    const items = [];
    for (const date of selectedDates) {
      const lm = lateData.lateMarks.find(l => l.date === date);
      items.push({
        date,
        requestedIn: lm?.checkIn ? toTimeStr(lm.checkIn) : null,
        requestedOut: lm?.checkOut ? toTimeStr(lm.checkOut) : null,
        reason: bulkReasons[date].trim(),
      });
    }

    try {
      await execBulk(
        () => api.post('/regularization/bulk', { requests: items }),
        `${items.length} regularization requests submitted!`
      );
      setShowBulkModal(false);
      setSelectedDates(new Set());
      refetch().catch(() => {});
      refetchLate().catch(() => {});
    } catch {
      // Error displayed by useApi hook
    }
  };

  // Check if all bulk reasons are filled (min 3 chars)
  const allBulkReasonsValid = useMemo(() =>
    Object.values(bulkReasons).every(r => r && r.trim().length >= 3),
    [bulkReasons]
  );

  // Filter requests by selected month
  const monthRequests = requests.filter(r => r.date && r.date.startsWith(selectedMonth));
  const pending  = monthRequests.filter(r => r.status === 'pending').length;
  const approved = monthRequests.filter(r => r.status === 'approved').length;
  const rejected = monthRequests.filter(r => r.status === 'rejected').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Sticky Header with Month Navigation */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Attendance Regularization</h1>
            <p className="text-sm text-slate-500 mt-0.5">Request corrections for missed or incorrect check-in/out</p>
          </div>
{/* No manual "New Request" — employees regularize only from late marks below */}
        </div>
        {/* Month selector */}
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() - 1);
              setSelectedMonth(d.toISOString().substring(0, 7));
            }}
            className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white"
          >
            <ChevronDown size={14} className="rotate-90 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
            {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() + 1);
              const next = d.toISOString().substring(0, 7);
              if (next <= new Date().toISOString().substring(0, 7)) setSelectedMonth(next);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white"
          >
            <ChevronDown size={14} className="-rotate-90 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error      && <AlertMessage type="error"   message={error}   />}
      {saveErr    && <AlertMessage type="error"   message={saveErr} />}
      {success    && <AlertMessage type="success" message={success} />}
      {lateErr    && <AlertMessage type="error"   message={lateErr} />}
      {bulkSuccess && <AlertMessage type="success" message={bulkSuccess} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Requests" value={monthRequests.length} />
        <StatCard label="Pending" value={pending} highlight="amber" />
        <StatCard label="Approved" value={approved} highlight="green" />
        <StatCard label="Late Marks" value={lateData.totalLateMarks} highlight={lateData.totalLateMarks > 0 ? 'amber' : null} />
        <StatCard
          label="Penalty Days"
          value={lateData.halfDayDeductions}
          highlight={lateData.halfDayDeductions > 0 ? 'red' : null}
          subtitle={lateData.halfDayDeductions > 0 ? `${lateData.halfDayDeductions * 0.5} day deduction` : null}
        />
      </div>

      {/* Late Mark Policy Alert */}
      {lateData.totalLateMarks > 0 && (
        <div className={`mb-6 px-4 py-3 rounded-xl border text-sm flex items-start gap-2 ${
          lateData.halfDayDeductions > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {lateData.totalLateMarks} late mark{lateData.totalLateMarks !== 1 ? 's' : ''} in {selectedMonth}
              {lateData.regularizedCount > 0 && ` (${lateData.regularizedCount} regularized)`}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {lateData.unregularizedCount} unregularized.
              {lateData.halfDayDeductions > 0
                ? ` Penalty: ${lateData.halfDayDeductions * 0.5} day(s) deducted from leave/LOP.`
                : ` ${3 - (lateData.unregularizedCount % 3)} more before next half-day deduction.`}
            </p>
          </div>
        </div>
      )}

      {/* Late Marks Detail with Bulk Selection */}
      {lateData.lateMarks.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowPolicy(!showPolicy)}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              <ChevronDown size={16} className={`transition-transform ${showPolicy ? 'rotate-180' : ''}`} />
              Late Marks Detail ({selectedMonth})
            </button>

            {/* Bulk action button */}
            {selectedDates.size > 0 && (
              <button
                onClick={openBulkModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold shadow-sm transition-all"
              >
                <Send size={13} />
                Apply Regularization ({selectedDates.size})
              </button>
            )}
          </div>

          {showPolicy && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {eligibleLateMarks.length > 0 && (
                      <th className="px-3 py-2 w-8">
                        <button onClick={toggleAll} className="text-slate-400 hover:text-blue-600">
                          {selectedDates.size === eligibleLateMarks.length && eligibleLateMarks.length > 0
                            ? <CheckSquare size={15} className="text-blue-600" />
                            : <Square size={15} />}
                        </button>
                      </th>
                    )}
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Shift Start</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Check-In</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Late By</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Regularization</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lateData.lateMarks.map((lm, idx) => {
                    const isEligible = !lm.regularizationStatus;
                    const isSelected = selectedDates.has(lm.date);
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                      >
                        {eligibleLateMarks.length > 0 && (
                          <td className="px-3 py-2">
                            {isEligible && (
                              <button onClick={() => toggleDate(lm.date)} className="text-slate-400 hover:text-blue-600">
                                {isSelected
                                  ? <CheckSquare size={15} className="text-blue-600" />
                                  : <Square size={15} />}
                              </button>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2 font-medium text-slate-800">{formatDate(lm.date)}</td>
                        <td className="px-4 py-2 text-slate-600">{lm.shiftStart}</td>
                        <td className="px-4 py-2 font-mono text-slate-700">
                          {lm.checkIn ? new Date(lm.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                            <Timer size={10} /> {lm.lateMinutes} min
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {lm.regularizationStatus ? (
                            <StatusBadge status={lm.regularizationStatus} />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-500 text-[10px] font-bold">
                              <AlertTriangle size={10} /> Not Applied
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isEligible && (
                            <button
                              onClick={() => openForm(lm.date, lm.checkIn, lm.checkOut)}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold"
                            >
                              Apply
                            </button>
                          )}
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

      {/* Single Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">New Regularization Request</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Approver info */}
              {profileData?.reportingManager && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs text-blue-600 font-medium">Approver:</span>
                  <span className="text-xs text-blue-800 font-semibold">{profileData.reportingManager.name}</span>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  readOnly={!!form.requestedIn || !!form.requestedOut}
                  className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.requestedIn || form.requestedOut ? 'bg-slate-50 text-slate-600' : ''}`}
                />
              </div>

              {/* Time fields — pre-filled and read-only when from Apply button */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check-In Time</label>
                  <input
                    type="time"
                    value={form.requestedIn}
                    onChange={e => setField('requestedIn', e.target.value)}
                    readOnly={!!form.requestedIn}
                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.requestedIn ? 'bg-slate-50 text-slate-600' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    value={form.requestedOut}
                    onChange={e => setField('requestedOut', e.target.value)}
                    readOnly={!!form.requestedOut}
                    className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.requestedOut ? 'bg-slate-50 text-slate-600' : ''}`}
                  />
                </div>
              </div>
              {!form.requestedIn && !form.requestedOut && (
                <p className="text-xs text-slate-400 -mt-2">At least one of Check-In or Check-Out is required.</p>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.reason}
                  onChange={e => setField('reason', e.target.value)}
                  required
                  rows={3}
                  placeholder="Explain why the correction is needed..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {formError && <AlertMessage type="error" message={formError} />}
              {saveErr   && <AlertMessage type="error" message={saveErr}   />}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Regularization Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Bulk Regularization</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''} selected — reason is mandatory for each</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Approver info */}
              {profileData?.reportingManager && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs text-blue-600 font-medium">Approver:</span>
                  <span className="text-xs text-blue-800 font-semibold">{profileData.reportingManager.name}</span>
                </div>
              )}

              {/* Quick fill: Apply same reason to all */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Quick fill — Apply same reason to all empty fields</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commonReason}
                    onChange={e => setCommonReason(e.target.value)}
                    placeholder="e.g. Traffic delay, Client meeting..."
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={applyCommonReason}
                    disabled={!commonReason.trim()}
                    className="px-3 py-2 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
                  >
                    Apply to All
                  </button>
                </div>
              </div>

              {/* Per-date reason inputs */}
              <div className="space-y-3">
                {[...selectedDates].sort().map(date => {
                  const lm = lateData.lateMarks.find(l => l.date === date);
                  const reason = bulkReasons[date] || '';
                  const isValid = reason.trim().length >= 3;
                  return (
                    <div key={date} className={`rounded-xl border p-3 space-y-2 ${isValid ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-800">{formatDate(date)}</span>
                          {lm && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                              <Timer size={10} /> {lm.lateMinutes} min late
                            </span>
                          )}
                        </div>
                        {lm?.checkIn && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            In: {new Date(lm.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            {lm.checkOut && ` — Out: ${new Date(lm.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                          </span>
                        )}
                      </div>
                      <textarea
                        value={reason}
                        onChange={e => setBulkReasons(prev => ({ ...prev, [date]: e.target.value }))}
                        placeholder="Reason for regularization (required)..."
                        rows={2}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                          !isValid && reason.length > 0 ? 'border-red-300' : 'border-slate-200'
                        }`}
                      />
                      {!isValid && reason.length > 0 && (
                        <p className="text-[10px] text-red-500">Reason must be at least 3 characters</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {bulkErr && <AlertMessage type="error" message={bulkErr} />}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <p className="text-xs text-slate-500">
                {Object.values(bulkReasons).filter(r => r && r.trim().length >= 3).length} / {selectedDates.size} reasons filled
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkSaving || !allBulkReasonsValid}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={14} />
                  {bulkSaving ? 'Submitting...' : `Submit ${selectedDates.size} Request${selectedDates.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submitted Requests Table — filtered by month */}
      {monthRequests.length === 0 ? (
        eligibleLateMarks.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-700">You have {eligibleLateMarks.length} unregularized late mark{eligibleLateMarks.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-1">Select dates above and submit regularization to avoid penalties</p>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardEdit}
            title="No regularization requests"
            subtitle={`No requests for ${new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}
          />
        )
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Check-In</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Check-Out</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reviewed By</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Note</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      {r.requestedIn ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <Clock size={12} /> {r.requestedIn}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.requestedOut ? (
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                          <Clock size={12} /> {r.requestedOut}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.reviewer?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate" title={r.reviewNote}>{r.reviewNote || '—'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={deleting}
                          title="Cancel request"
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function StatCard({ label, value, highlight, subtitle }) {
  const hl = {
    amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-600' },
    green: { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-600' },
    red:   { border: 'border-red-200',   bg: 'bg-red-50',   text: 'text-red-600' },
  };
  const s = highlight ? hl[highlight] : { border: 'border-slate-200', bg: 'bg-white', text: 'text-slate-800' };
  return (
    <div className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${s.text}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
