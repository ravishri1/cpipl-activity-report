import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { COMP_OFF_STATUS_STYLES } from '../../utils/constants';
import { AlarmClock, Plus, Calendar, X } from 'lucide-react';

export default function MyCompOff() {
  const { data: balance, loading: balLoading, refetch: refetchBal } = useFetch('/comp-off/balance', null);
  const { data: requests, loading, error, refetch } = useFetch('/comp-off/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState('earn');
  const [form, setForm] = useState({ workedDate: '', reason: '', daysEarned: 1, daysToRedeem: 1, preferredDate: '' });

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openModal = (t) => { setType(t); setShowModal(true); clearMessages(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(() => api.post('/comp-off/request', { ...form, type }), 'Request submitted!');
    setShowModal(false);
    refetch(); refetchBal();
  };

  if (loading || balLoading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <AlarmClock className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Comp-Off</h1>
            <p className="text-sm text-slate-500">Earn & redeem compensatory off</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('earn')} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Earn Comp-Off
          </button>
          <button onClick={() => openModal('redeem')} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            <Calendar className="w-4 h-4" /> Redeem
          </button>
        </div>
      </div>

      {/* Balance */}
      {balance && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[{ label: 'Earned', val: balance.earned, color: 'text-indigo-600' },
            { label: 'Used', val: balance.used, color: 'text-amber-600' },
            { label: 'Balance', val: balance.balance, color: 'text-emerald-600' }].map(({ label, val, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
              <p className={`text-3xl font-bold ${color}`}>{val}</p>
              <p className="text-sm text-slate-500 mt-1">{label} Days</p>
            </div>
          ))}
        </div>
      )}

      {success && <AlertMessage type="success" message={success} />}
      {error && <AlertMessage type="error" message={error} />}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-800">My Requests</h2>
        </div>
        {requests.length === 0 ? (
          <EmptyState icon="⏰" title="No requests yet" subtitle="Submit an earn or redeem request to get started" />
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>{['Type', 'Date', 'Days', 'Reason', 'Status', 'Applied'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.type === 'earn' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.type === 'earn' ? 'Earn' : 'Redeem'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(r.workedDate || r.preferredDate)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{r.daysEarned || r.daysToRedeem || 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{r.reason || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} styles={COMP_OFF_STATUS_STYLES} /></td>
                  <td className="px-4 py-3 text-sm text-slate-500">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">{type === 'earn' ? 'Earn Comp-Off' : 'Redeem Comp-Off'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {saveErr && <AlertMessage type="error" message={saveErr} />}
              {type === 'earn' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date Worked</label>
                    <input type="date" value={form.workedDate} onChange={e => sf('workedDate', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Days Earned</label>
                    <select value={form.daysEarned} onChange={e => sf('daysEarned', parseFloat(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      <option value={0.5}>0.5 day</option>
                      <option value={1}>1 day</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
                    <input type="date" value={form.preferredDate} onChange={e => sf('preferredDate', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Days to Redeem</label>
                    <select value={form.daysToRedeem} onChange={e => sf('daysToRedeem', parseFloat(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                      <option value={0.5}>0.5 day</option>
                      <option value={1}>1 day</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea value={form.reason} onChange={e => sf('reason', e.target.value)} rows={3} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Brief reason for this request…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
