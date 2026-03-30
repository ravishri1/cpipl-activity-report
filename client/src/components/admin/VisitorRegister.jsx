import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

function formatTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + formatTime(dt);
}
function duration(checkIn, checkOut) {
  if (!checkOut) return 'Still inside';
  const ms = new Date(checkOut) - new Date(checkIn);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function CheckInModal({ employees, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({ name: '', phone: '', company: '', purpose: '', hostUserId: '', badgeNumber: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/api/visitors', form), 'Visitor checked in!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Log Visitor Check-In</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <AlertMessage type="error" message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visitor Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Mobile number" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company / Organisation</label>
              <input type="text" value={form.company} onChange={e => set('company', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Visitor's company" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Badge / Pass No.</label>
              <input type="text" value={form.badgeNumber} onChange={e => set('badgeNumber', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="V-001" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Host Employee *</label>
            <select value={form.hostUserId} onChange={e => set('hostUserId', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— Select employee being visited —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.department ? `(${e.department})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose of Visit</label>
            <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Meeting, delivery, interview, etc." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !form.name || !form.hostUserId} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Logging…' : 'Check In'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VisitorRegister() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('today');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const today = new Date().toISOString().slice(0, 10);
  const { data: active,    loading: activeLoading,    error: activeErr,    refetch: refetchActive }    = useFetch('/api/visitors/active', []);
  const { data: visitors,  loading: visitorsLoading,  error: visitorsErr,  refetch: refetchVisitors }  = useFetch(`/api/visitors?date=${date}`, []);
  const { data: stats,     loading: statsLoading,     error: statsErr }    = useFetch('/api/visitors/stats', null);
  const { data: employees }  = useFetch('/api/users/active', []);
  const { execute: checkout, loading: checkingOut } = useApi();

  const handleCheckout = async (id, name) => {
    if (!window.confirm(`Check out ${name}?`)) return;
    try {
      await checkout(() => api.put(`/api/visitors/${id}/checkout`), 'Checked out.');
      refetchActive();
      refetchVisitors();
    } catch {}
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visitor Register</h1>
          <p className="text-slate-500 text-sm mt-0.5">Log and manage office visitors</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Check In Visitor
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            ['Today\'s Visitors', stats.totalToday, 'bg-blue-50 text-blue-700'],
            ['Currently Inside', stats.currentlyIn, stats.currentlyIn > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'],
            ['All Time', stats.totalAllTime, 'bg-slate-50 text-slate-700'],
          ].map(([label, val, cls]) => (
            <div key={label} className={`rounded-xl p-4 ${cls}`}>
              <div className="text-2xl font-bold">{val}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-4">
        {[['today','Today / Date'],['active','Currently Inside']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} className={`px-4 py-1.5 text-sm rounded-md font-medium ${activeTab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {activeTab === 'today' && (
        <>
          {visitorsErr && <AlertMessage type="error" message={visitorsErr} />}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-slate-700">Date:</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>

          {visitorsLoading ? <LoadingSpinner /> : visitors.length === 0 ? (
            <EmptyState icon="🏢" title="No visitors" subtitle={`No visitors logged for ${date}`} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Visitor','Company','Host','Purpose','Check In','Check Out','Duration'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visitors.map(v => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{v.name}</div>
                        {v.phone && <div className="text-xs text-slate-400">{v.phone}</div>}
                        {v.badgeNumber && <div className="text-xs text-slate-400">Badge: {v.badgeNumber}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{v.company || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{v.host?.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{v.purpose || '—'}</td>
                      <td className="px-3 py-2.5 font-medium">{formatTime(v.checkIn)}</td>
                      <td className="px-3 py-2.5">{v.checkOut ? formatTime(v.checkOut) : <span className="text-amber-600 text-xs font-medium">Inside</span>}</td>
                      <td className="px-3 py-2.5 text-slate-500 text-xs">{duration(v.checkIn, v.checkOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'active' && (
        <>
          {activeErr && <AlertMessage type="error" message={activeErr} />}
          {activeLoading ? <LoadingSpinner /> : active.length === 0 ? (
            <EmptyState icon="✅" title="No visitors inside" subtitle="All visitors have checked out" />
          ) : (
            <div className="space-y-2">
              {active.map(v => (
                <div key={v.id} className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-800">{v.name}</div>
                    <div className="text-sm text-slate-500">
                      Visiting {v.host?.name} {v.host?.department ? `(${v.host.department})` : ''}
                      {v.purpose && ` · ${v.purpose}`}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Checked in at {formatTime(v.checkIn)} · {duration(v.checkIn, null)}</div>
                  </div>
                  <button
                    onClick={() => handleCheckout(v.id, v.name)}
                    disabled={checkingOut}
                    className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    Check Out
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <CheckInModal
          employees={Array.isArray(employees) ? employees.filter(e => e.isActive) : []}
          onClose={() => setShowModal(false)}
          onDone={() => { refetchActive(); refetchVisitors(); }}
        />
      )}
    </div>
  );
}
