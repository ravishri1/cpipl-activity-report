import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { COMP_OFF_STATUS_STYLES } from '../../utils/constants';
import { AlarmClock, Plus, Calendar, Trash2, CheckCircle, XCircle, Clock, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function MyCompOff() {
  const { data: balance, loading: balLoading, error: balErr, refetch: refetchBal } = useFetch('/comp-off/balance/me', null);
  const { data: requests, loading, error: fetchErr, refetch } = useFetch('/comp-off/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();

  const [activeTab, setActiveTab] = useState('earn'); // earn | redeem | history
  const [form, setForm] = useState({ workedDate: '', reason: '', days: 1, preferredDate: '' });
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Validate date when user picks a date for earning comp-off
  const validateDate = useCallback(async (date) => {
    if (!date) { setValidation(null); return; }
    setValidating(true);
    try {
      const res = await api.get(`/comp-off/validate-date?date=${date}`);
      setValidation(res.data);
      // Auto-set days based on maxDays
      if (res.data.maxDays === 0.5) sf('days', 0.5);
      else sf('days', 1);
    } catch {
      setValidation({ isValid: false, error: 'Failed to validate date' });
    } finally {
      setValidating(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'earn' && form.workedDate) {
      validateDate(form.workedDate);
    }
  }, [form.workedDate, activeTab, validateDate]);

  const handleEarnSubmit = async (e) => {
    e.preventDefault();
    if (!validation?.isValid) return;
    try {
      await execute(() => api.post('/comp-off', {
        type: 'earn', workDate: form.workedDate, days: form.days, reason: form.reason,
      }), 'Comp-off earn request submitted!');
      setForm({ workedDate: '', reason: '', days: 1, preferredDate: '' });
      setValidation(null);
      refetch(); refetchBal();
    } catch { /* useApi handles error display */ }
  };

  const handleRedeemSubmit = async (e) => {
    e.preventDefault();
    try {
      await execute(() => api.post('/comp-off', {
        type: 'redeem', workDate: form.preferredDate, days: form.days, reason: form.reason,
      }), 'Comp-off redeem request submitted!');
      setForm({ workedDate: '', reason: '', days: 1, preferredDate: '' });
      refetch(); refetchBal();
    } catch { /* useApi handles error display */ }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this comp-off request?')) return;
    try {
      await execute(() => api.delete(`/comp-off/${id}`), 'Request cancelled');
      refetch(); refetchBal();
    } catch { /* useApi handles error display */ }
  };

  if (loading || balLoading) return <LoadingSpinner />;

  const bal = balance || { earned: 0, used: 0, balance: 0 };
  const pendingEarn = requests.filter(r => r.type === 'earn' && r.status === 'pending');
  const pendingRedeem = requests.filter(r => r.type === 'redeem' && r.status === 'pending');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <AlarmClock className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comp-Off</h1>
          <p className="text-sm text-slate-500">Earn & redeem compensatory offs for working on holidays/weekends</p>
        </div>
      </div>

      {/* Policy Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl mb-6">
        <button onClick={() => setShowPolicy(!showPolicy)} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Comp-Off Policy</span>
          </div>
          {showPolicy ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>
        {showPolicy && (
          <div className="px-4 pb-3 text-sm text-amber-700 space-y-1">
            <p>• You can earn comp-off by working on <strong>holidays or weekends (Saturday/Sunday)</strong>.</p>
            <p>• You must have <strong>attendance (punch-in/out)</strong> on that day.</p>
            <p>• <strong>Full day (1 day):</strong> Minimum 9 hours of work required.</p>
            <p>• <strong>Half day (0.5 day):</strong> Minimum 5 hours of work required.</p>
            <p>• After manager approval, the earned comp-off is added to your balance.</p>
            <p>• You can then <strong>redeem</strong> comp-off balance as leave on any working day.</p>
          </div>
        )}
      </div>

      {fetchErr && <AlertMessage type="error" message={typeof fetchErr === 'string' ? fetchErr : 'Failed to load requests'} />}
      {balErr && <AlertMessage type="error" message={typeof balErr === 'string' ? balErr : 'Failed to load balance'} />}
      {saveErr && <AlertMessage type="error" message={typeof saveErr === 'string' ? saveErr : (saveErr?.message || 'An error occurred')} />}
      {success && <AlertMessage type="success" message={success} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Tabs + Form */}
        <div className="lg:col-span-2">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 mb-6">
            {[
              { key: 'earn', label: 'Earn Comp-Off', icon: Plus, count: pendingEarn.length },
              { key: 'redeem', label: 'Redeem', icon: Calendar, count: pendingRedeem.length },
              { key: 'history', label: 'History', icon: Clock, count: 0 },
            ].map(tab => (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); clearMessages(); setValidation(null); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* ── Earn Tab ── */}
          {activeTab === 'earn' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Earn Comp-Off</h2>
              <p className="text-sm text-slate-500 mb-5">Request comp-off for working on a holiday or weekend</p>

              <form onSubmit={handleEarnSubmit} className="space-y-5">
                {/* Date Worked */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date Worked <span className="text-red-500">*</span></label>
                  <input type="date" value={form.workedDate} onChange={e => sf('workedDate', e.target.value)}
                    max={new Date().toISOString().slice(0, 10)} required
                    className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>

                {/* Validation Result */}
                {validating && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    Validating date...
                  </div>
                )}

                {validation && !validating && (
                  <div className={`rounded-lg p-4 border ${validation.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {validation.isValid
                        ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                        : <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />}
                      <div className="text-sm">
                        {validation.isValid ? (
                          <>
                            <p className="font-medium text-green-800">{validation.dayLabel}</p>
                            <p className="text-green-700 mt-0.5">{validation.eligibility}</p>
                            {validation.attendance && (
                              <p className="text-green-600 mt-0.5 text-xs">
                                Check-in: {validation.attendance.checkIn ? new Date(validation.attendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} · Check-out: {validation.attendance.checkOut ? new Date(validation.attendance.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-medium text-red-800">{validation.error}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Days — only show if valid */}
                {validation?.isValid && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Days to Earn</label>
                      <select value={form.days} onChange={e => sf('days', parseFloat(e.target.value))}
                        className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm">
                        {validation.maxDays >= 0.5 && <option value={0.5}>Half Day (0.5)</option>}
                        {validation.maxDays >= 1 && <option value={1}>Full Day (1.0)</option>}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                      <textarea value={form.reason} onChange={e => sf('reason', e.target.value)} rows={3} required
                        placeholder="Why did you work on this day? (e.g., urgent delivery, client deadline)"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>

                    <button type="submit" disabled={saving}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      {saving ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </>
                )}
              </form>
            </div>
          )}

          {/* ── Redeem Tab ── */}
          {activeTab === 'redeem' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">Redeem Comp-Off</h2>
              <p className="text-sm text-slate-500 mb-5">Use your comp-off balance to take a day off</p>

              {bal.balance <= 0 ? (
                <EmptyState icon="📭" title="No balance available" subtitle="You need to earn comp-off before you can redeem it" />
              ) : (
                <form onSubmit={handleRedeemSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date to Take Off <span className="text-red-500">*</span></label>
                    <input type="date" value={form.preferredDate} onChange={e => sf('preferredDate', e.target.value)}
                      min={new Date().toISOString().slice(0, 10)} required
                      className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Days to Redeem</label>
                    <select value={form.days} onChange={e => sf('days', parseFloat(e.target.value))}
                      className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      <option value={0.5}>Half Day (0.5)</option>
                      {bal.balance >= 1 && <option value={1}>Full Day (1.0)</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
                    <textarea value={form.reason} onChange={e => sf('reason', e.target.value)} rows={3}
                      placeholder="Reason for taking comp-off leave (optional)"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>

                  <button type="submit" disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {saving ? 'Submitting…' : 'Submit Request'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── History Tab ── */}
          {activeTab === 'history' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="font-semibold text-slate-800">Request History</h2>
              </div>
              {requests.length === 0 ? (
                <EmptyState icon="⏰" title="No requests yet" subtitle="Submit an earn or redeem request to get started" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>{['Type', 'Date', 'Days', 'Reason', 'Status', 'Reviewed By', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requests.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.type === 'earn' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {r.type === 'earn' ? '↑ Earn' : '↓ Redeem'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{formatDate(r.workDate)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800">{r.days}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{r.reason || '—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={r.status} styles={COMP_OFF_STATUS_STYLES} /></td>
                          <td className="px-4 py-3 text-sm text-slate-500">{r.reviewer?.name || '—'}</td>
                          <td className="px-4 py-3">
                            {r.status === 'pending' && (
                              <button onClick={() => handleCancel(r.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600" title="Cancel request">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Balance Card */}
        <div className="space-y-4">
          {/* Balance Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-indigo-600 px-5 py-4">
              <h3 className="text-white font-semibold text-sm">Comp-Off Balance</h3>
              <p className="text-indigo-200 text-xs mt-0.5">{new Date().getFullYear()}</p>
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <p className="text-4xl font-bold text-indigo-600">{bal.balance}</p>
                <p className="text-sm text-slate-500 mt-1">Available Days</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{bal.earned}</p>
                  <p className="text-xs text-green-600">Earned</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">{bal.used}</p>
                  <p className="text-xs text-amber-600">Used</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Requests Summary */}
          {(pendingEarn.length > 0 || pendingRedeem.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Pending Requests</h3>
              {pendingEarn.length > 0 && (
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">Earn requests</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{pendingEarn.length}</span>
                </div>
              )}
              {pendingRedeem.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Redeem requests</span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">{pendingRedeem.length}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">How it works</h3>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
              <li>Work on a holiday or weekend</li>
              <li>Submit an <strong>Earn</strong> request with the date</li>
              <li>Manager approves → balance increases</li>
              <li>Submit a <strong>Redeem</strong> request to take off</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
