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

function fmtDuration(min) {
  if (!min || min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function AttendanceRegularization() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [showPolicy, setShowPolicy] = useState(true);

  // Bulk selection — keyed by "date|from|to"
  const [selectedPeriods, setSelectedPeriods] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkReasons, setBulkReasons] = useState({}); // { key: reason }
  const [commonReason, setCommonReason] = useState('');

  const { data: requests, loading, error, refetch } = useFetch('/regularization/my', []);
  const { execute: execDelete, loading: deleting } = useApi();
  const { execute: execBulk, loading: bulkSaving, error: bulkErr, success: bulkSuccess, clearMessages: clearBulk } = useApi();

  const { data: lateData, error: lateErr, refetch: refetchLate } = useFetch(`/regularization/late-marks?month=${selectedMonth}`, {
    lateMarks: [], totalLateMarks: 0, regularizedCount: 0, unregularizedCount: 0, halfDayDeductions: 0,
  });

  const { data: profileData } = useFetch('/users/profile', null);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const interval = setInterval(() => { refetchRef.current(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Flatten all periods across all dates into selectable items
  const allPeriods = useMemo(() => {
    const items = [];
    for (const lm of lateData.lateMarks) {
      if (!lm.periods) continue;
      for (const p of lm.periods) {
        const key = `${lm.date}|${p.from}|${p.to}`;
        items.push({
          key,
          date: lm.date,
          from: p.from,
          to: p.to,
          minutes: p.minutes,
          type: p.type,
          regularizationStatus: p.regularizationStatus,
          shiftStart: lm.shiftStart,
        });
      }
    }
    return items;
  }, [lateData.lateMarks]);

  // Eligible periods (not yet regularized)
  const eligiblePeriods = useMemo(() =>
    allPeriods.filter(p => !p.regularizationStatus),
    [allPeriods]
  );

  // Group periods by date for display
  const periodsByDate = useMemo(() => {
    const map = {};
    for (const p of allPeriods) {
      if (!map[p.date]) map[p.date] = [];
      map[p.date].push(p);
    }
    return map;
  }, [allPeriods]);

  const sortedDates = useMemo(() => Object.keys(periodsByDate).sort(), [periodsByDate]);

  useEffect(() => { setSelectedPeriods(new Set()); }, [selectedMonth]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this regularization request?')) return;
    try {
      await execDelete(() => api.delete(`/regularization/${id}`), 'Request cancelled.');
      refetch();
      refetchLate().catch(() => {});
    } catch {}
  };

  // ── Selection helpers ──
  const togglePeriod = (key) => {
    setSelectedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPeriods.size === eligiblePeriods.length) setSelectedPeriods(new Set());
    else setSelectedPeriods(new Set(eligiblePeriods.map(p => p.key)));
  };

  const openBulkModal = () => {
    const reasons = {};
    selectedPeriods.forEach(key => { reasons[key] = ''; });
    setBulkReasons(reasons);
    setCommonReason('');
    clearBulk();
    setShowBulkModal(true);
  };

  const applyCommonReason = () => {
    if (!commonReason.trim()) return;
    setBulkReasons(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (!next[k]) next[k] = commonReason; });
      return next;
    });
  };

  const handleBulkSubmit = async () => {
    if (!allBulkReasonsValid) return;

    // Build requests — each period becomes a separate regularization entry
    const items = [];
    for (const key of selectedPeriods) {
      const period = allPeriods.find(p => p.key === key);
      if (!period) continue;
      items.push({
        date: period.date,
        requestedIn: period.from,
        requestedOut: period.to,
        reason: bulkReasons[key].trim(),
      });
    }

    try {
      await execBulk(
        () => api.post('/regularization/bulk', { requests: items }),
        `${items.length} regularization requests submitted!`
      );
      setShowBulkModal(false);
      setSelectedPeriods(new Set());
      refetch().catch(() => {});
      refetchLate().catch(() => {});
    } catch {}
  };

  const allBulkReasonsValid = useMemo(() =>
    Object.values(bulkReasons).every(r => r && r.trim().length >= 3),
    [bulkReasons]
  );

  const monthRequests = requests.filter(r => r.date && r.date.startsWith(selectedMonth));
  const pending  = monthRequests.filter(r => r.status === 'pending').length;
  const approved = monthRequests.filter(r => r.status === 'approved').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Attendance Regularization</h1>
          <p className="text-sm text-slate-500 mt-0.5">Request corrections for late marks &amp; out-periods</p>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => { const d = new Date(selectedMonth + '-01'); d.setMonth(d.getMonth() - 1); setSelectedMonth(d.toISOString().substring(0, 7)); }} className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white">
            <ChevronDown size={14} className="rotate-90 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">
            {new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => { const d = new Date(selectedMonth + '-01'); d.setMonth(d.getMonth() + 1); const next = d.toISOString().substring(0, 7); if (next <= new Date().toISOString().substring(0, 7)) setSelectedMonth(next); }} className="p-1.5 rounded-lg hover:bg-slate-200 border border-slate-200 bg-white">
            <ChevronDown size={14} className="-rotate-90 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error       && <AlertMessage type="error"   message={error}       />}
      {lateErr     && <AlertMessage type="error"   message={lateErr}     />}
      {bulkSuccess && <AlertMessage type="success" message={bulkSuccess} />}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Requests" value={monthRequests.length} />
        <StatCard label="Pending" value={pending} highlight="amber" />
        <StatCard label="Approved" value={approved} highlight="green" />
        <StatCard label="Late Marks" value={lateData.totalLateMarks} highlight={lateData.totalLateMarks > 0 ? 'amber' : null} />
        <StatCard label="Penalty Days" value={lateData.halfDayDeductions} highlight={lateData.halfDayDeductions > 0 ? 'red' : null}
          subtitle={lateData.halfDayDeductions > 0 ? `${lateData.halfDayDeductions * 0.5} day deduction` : null} />
      </div>

      {/* Policy Alert */}
      {lateData.totalLateMarks > 0 && (
        <div className={`mb-6 px-4 py-3 rounded-xl border text-sm flex items-start gap-2 ${
          lateData.halfDayDeductions > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {lateData.totalLateMarks} late mark{lateData.totalLateMarks !== 1 ? 's' : ''} &bull; {allPeriods.length} gap period{allPeriods.length !== 1 ? 's' : ''}
              {lateData.regularizedCount > 0 && ` (${lateData.regularizedCount} dates regularized)`}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {lateData.unregularizedCount} unregularized.
              {lateData.halfDayDeductions > 0
                ? ` Penalty: ${lateData.halfDayDeductions * 0.5} day(s) deducted.`
                : ` ${3 - (lateData.unregularizedCount % 3)} more before next half-day deduction.`}
            </p>
          </div>
        </div>
      )}

      {/* Gap Periods Detail — grouped by date, each period is selectable */}
      {allPeriods.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setShowPolicy(!showPolicy)} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800">
              <ChevronDown size={16} className={`transition-transform ${showPolicy ? 'rotate-180' : ''}`} />
              Gap Periods ({allPeriods.length})
            </button>
            {selectedPeriods.size > 0 && (
              <button onClick={openBulkModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold shadow-sm">
                <Send size={13} /> Apply Regularization ({selectedPeriods.size})
              </button>
            )}
          </div>

          {showPolicy && (
            <div className="space-y-3">
              {sortedDates.map(date => {
                const datePeriods = periodsByDate[date];
                const lm = lateData.lateMarks.find(l => l.date === date);
                return (
                  <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Date header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">{formatDate(date)}</span>
                        <span className="text-[10px] text-slate-500">Shift: {lm?.shiftStart}</span>
                        {lm?.punchCount > 0 && <span className="text-[10px] text-slate-400">{lm.punchCount} swipes</span>}
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                        <Timer size={10} /> {fmtDuration(lm?.totalMissingMinutes)} total
                      </span>
                    </div>

                    {/* Period rows */}
                    <div className="divide-y divide-slate-100">
                      {datePeriods.map(p => {
                        const isEligible = !p.regularizationStatus;
                        const isSelected = selectedPeriods.has(p.key);
                        const isLate = p.type === 'late_arrival';
                        return (
                          <div key={p.key} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                            {/* Checkbox */}
                            <div className="flex-shrink-0 w-5">
                              {isEligible && (
                                <button onClick={() => togglePeriod(p.key)} className="text-slate-400 hover:text-blue-600">
                                  {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                </button>
                              )}
                            </div>

                            {/* Type badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${
                              isLate ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              {isLate ? 'Late' : 'Out'}
                            </span>

                            {/* Time range */}
                            <span className="font-mono text-xs font-semibold text-slate-700 flex-shrink-0">
                              {p.from} → {p.to}
                            </span>

                            {/* Duration */}
                            <span className="text-[10px] text-slate-500 flex-shrink-0">
                              ({p.minutes} min)
                            </span>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Status */}
                            {p.regularizationStatus ? (
                              <StatusBadge status={p.regularizationStatus} />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-500 text-[10px] font-bold">
                                <AlertTriangle size={10} /> Not Applied
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Select all */}
              {eligiblePeriods.length > 1 && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <button onClick={toggleAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {selectedPeriods.size === eligiblePeriods.length ? 'Deselect All' : `Select All (${eligiblePeriods.length} periods)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk Regularization Modal — reason per period */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Apply Regularization</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedPeriods.size} period{selectedPeriods.size !== 1 ? 's' : ''} — reason mandatory for each</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} className="text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {profileData?.reportingManager && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-xs text-blue-600 font-medium">Approver:</span>
                  <span className="text-xs text-blue-800 font-semibold">{profileData.reportingManager.name}</span>
                </div>
              )}

              {/* Quick fill */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">Quick fill — Apply same reason to all empty fields</p>
                <div className="flex gap-2">
                  <input type="text" value={commonReason} onChange={e => setCommonReason(e.target.value)} placeholder="e.g. Traffic delay, Client meeting..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={applyCommonReason} disabled={!commonReason.trim()} className="px-3 py-2 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap">Apply to All</button>
                </div>
              </div>

              {/* Per-period reason */}
              <div className="space-y-3">
                {[...selectedPeriods].sort().map(key => {
                  const period = allPeriods.find(p => p.key === key);
                  if (!period) return null;
                  const reason = bulkReasons[key] || '';
                  const isValid = reason.trim().length >= 3;
                  const isLate = period.type === 'late_arrival';

                  return (
                    <div key={key} className={`rounded-xl border p-3 space-y-2 ${isValid ? 'border-green-200 bg-green-50/30' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{formatDate(period.date)}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          isLate ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {isLate ? 'Late' : 'Out'}: {period.from} → {period.to} ({period.minutes}m)
                        </span>
                      </div>
                      <textarea
                        value={reason}
                        onChange={e => setBulkReasons(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Reason for this period (required)..."
                        rows={2}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${!isValid && reason.length > 0 ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      {!isValid && reason.length > 0 && <p className="text-[10px] text-red-500">Reason must be at least 3 characters</p>}
                    </div>
                  );
                })}
              </div>

              {bulkErr && <AlertMessage type="error" message={bulkErr} />}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
              <p className="text-xs text-slate-500">
                {Object.values(bulkReasons).filter(r => r && r.trim().length >= 3).length} / {selectedPeriods.size} reasons filled
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handleBulkSubmit} disabled={bulkSaving || !allBulkReasonsValid} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  <Send size={14} />
                  {bulkSaving ? 'Submitting...' : `Submit ${selectedPeriods.size} Request${selectedPeriods.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submitted Requests Table */}
      {monthRequests.length === 0 ? (
        eligiblePeriods.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-700">You have {eligiblePeriods.length} unregularized period{eligiblePeriods.length !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-1">Select periods above and submit regularization to avoid penalties</p>
          </div>
        ) : (
          <EmptyState icon={ClipboardEdit} title="No regularization requests" subtitle={`No requests for ${new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`} />
        )
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <h3 className="px-4 py-3 text-sm font-semibold text-slate-700 border-b border-slate-100">Submitted Requests ({monthRequests.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Time Period</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reviewed By</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      {r.requestedIn && r.requestedOut ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-700">
                          <Clock size={12} /> {r.requestedIn} → {r.requestedOut}
                        </span>
                      ) : r.requestedIn ? (
                        <span className="text-xs text-blue-600">{r.requestedIn}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{r.reviewer?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <button onClick={() => handleCancel(r.id)} disabled={deleting} title="Cancel request" className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
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
