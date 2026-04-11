import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

const STATUS_META = {
  pending_manager: { label: 'Pending Manager', color: 'bg-yellow-100 text-yellow-800' },
  pending_hr:      { label: 'Pending HR',       color: 'bg-blue-100 text-blue-800' },
  notice_period:   { label: 'Notice Period',    color: 'bg-orange-100 text-orange-800' },
  clearance:       { label: 'Clearance',        color: 'bg-purple-100 text-purple-800' },
  fnf_pending:     { label: 'FnF Pending',      color: 'bg-pink-100 text-pink-800' },
  fnf_approved:    { label: 'FnF Approved',     color: 'bg-teal-100 text-teal-800' },
  completed:       { label: 'Completed',        color: 'bg-green-100 text-green-800' },
  rejected:        { label: 'Rejected',         color: 'bg-red-100 text-red-800' },
  cancelled:       { label: 'Withdrawn',        color: 'bg-gray-100 text-gray-600' },
};

const PIPELINE_COLS = [
  { key: 'pending_manager', label: 'Awaiting Manager', icon: '👤' },
  { key: 'pending_hr',      label: 'Awaiting HR',      icon: '🏢' },
  { key: 'notice_period',   label: 'Notice Period',    icon: '📅' },
  { key: 'clearance',       label: 'Clearance',        icon: '✅' },
  { key: 'fnf_pending',     label: 'FnF Pending',      icon: '💰' },
  { key: 'fnf_approved',    label: 'FnF Approved',     icon: '✔️' },
  { key: 'completed',       label: 'Completed',        icon: '🎓' },
];

const ACTIVE_STATUSES = ['pending_manager', 'pending_hr', 'notice_period', 'clearance', 'fnf_pending', 'fnf_approved'];

export default function SeparationManager() {
  const navigate = useNavigate();
  const [view, setView] = useState('pipeline');
  const [filter, setFilter] = useState('active');
  const [showInitiateForm, setShowInitiateForm] = useState(false);
  const [form, setForm] = useState({ userId: '', type: 'resignation', requestDate: new Date().toISOString().slice(0, 10), lastWorkingDate: '', reason: '' });

  const { data: separations, loading, error: fetchErr, refetch } = useFetch('/api/separation', []);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const filtered = filter === 'active'
    ? separations.filter(s => ACTIVE_STATUSES.includes(s.status))
    : filter === 'completed'
    ? separations.filter(s => s.status === 'completed')
    : separations;

  const openInitiateForm = async () => {
    setShowInitiateForm(true);
    if (users.length === 0) {
      setUsersLoading(true);
      try {
        const res = await api.get('/api/users?fields=id,name,employeeId,department,employmentStatus,isActive');
        setUsers(res.data || []);
      } catch {
        // ignore — dropdown will be empty
      } finally {
        setUsersLoading(false);
      }
    }
  };

  const handleInitiate = async () => {
    if (!form.userId) return;
    try {
      await execute(() => api.post('/api/separation', { ...form, userId: parseInt(form.userId) }), 'Separation initiated.');
      refetch();
      setShowInitiateForm(false);
      setForm({ userId: '', type: 'resignation', requestDate: new Date().toISOString().slice(0, 10), lastWorkingDate: '', reason: '' });
    } catch {}
  };

  const byStatus = (status) => filtered.filter(s => s.status === status);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Separation Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage employee resignations and exit process</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(v => v === 'pipeline' ? 'list' : 'pipeline')}
            className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            {view === 'pipeline' ? '📋 List View' : '🗂 Pipeline View'}
          </button>
          <button onClick={openInitiateForm}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
            + Initiate Separation
          </button>
        </div>
      </div>

      {/* Thin loading bar */}
      {loading && <div className="h-1 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-pulse w-2/3" /></div>}

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active', count: separations.filter(s => ACTIVE_STATUSES.includes(s.status)).length, color: 'text-blue-600' },
          { label: 'In Notice Period', count: separations.filter(s => s.status === 'notice_period').length, color: 'text-orange-600' },
          { label: 'Pending FnF', count: separations.filter(s => ['fnf_pending', 'clearance'].includes(s.status)).length, color: 'text-pink-600' },
          { label: 'Salary On Hold', count: separations.filter(s => !s.salaryReleased && s.salaryHoldUntil && today >= s.salaryHoldUntil).length, color: 'text-amber-600', alert: true },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.alert && s.count > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.count}</p>
            {s.alert && s.count > 0 && <p className="text-xs text-amber-600 mt-1">⏰ Ready to release</p>}
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${filter === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Initiate Form */}
      {showInitiateForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Initiate Separation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} disabled={usersLoading}>
                <option value="">{usersLoading ? 'Loading employees...' : 'Select employee...'}</option>
                {users.filter(u => u.employmentStatus === 'active' || u.isActive).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.employeeId || 'No ID'}) — {u.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="resignation">Resignation</option>
                <option value="retirement">Retirement</option>
                <option value="termination">Termination</option>
                <option value="absconding">Absconding</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resignation Date *</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.requestDate} onChange={e => setForm(f => ({ ...f, requestDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Working Date (if known)</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.lastWorkingDate} onChange={e => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleInitiate} disabled={saving || !form.userId}
              className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Initiating...' : 'Initiate Separation'}
            </button>
            <button onClick={() => setShowInitiateForm(false)} className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_COLS.map(col => {
              const cards = byStatus(col.key);
              return (
                <div key={col.key} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-sm font-semibold text-gray-700">{col.icon} {col.label}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{loading ? '…' : cards.length}</span>
                  </div>
                  <div className="space-y-2 min-h-24">
                    {loading ? (
                      <div className="h-16 bg-gray-100 animate-pulse rounded-xl border border-dashed border-gray-200" />
                    ) : cards.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">Empty</div>
                    ) : (
                      cards.map(s => <SepCard key={s.id} sep={s} today={today} onClick={() => navigate(`/admin/separations/${s.id}`)} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon="📋" title="No separations found" subtitle="No records match the current filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee', 'Type', 'Status', 'Confirmed LWD', 'Notice Left', 'FnF', 'Salary Hold', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(s => {
                    const sm = STATUS_META[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-600' };
                    const lwd = s.adjustedLWD || s.lastWorkingDate;
                    const daysLeft = lwd ? Math.max(0, Math.round((new Date(lwd) - new Date(today)) / 86400000)) : null;
                    const holdDue = s.salaryHoldUntil && today >= s.salaryHoldUntil && !s.salaryReleased;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/separations/${s.id}`)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{s.user?.name}</div>
                          <div className="text-xs text-gray-400">{s.user?.employeeId} · {s.user?.department}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-600 text-xs">{s.type}</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sm.color}`}>{sm.label}</span></td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{lwd || '—'}{s.leaveDaysDuringNotice > 0 && <span className="text-amber-600 ml-1">+{s.leaveDaysDuringNotice}d</span>}</td>
                        <td className="px-4 py-3 text-xs">
                          {s.status === 'notice_period' && daysLeft !== null
                            ? <span className={daysLeft <= 3 ? 'text-red-600 font-medium' : daysLeft <= 7 ? 'text-orange-600' : 'text-gray-600'}>{daysLeft}d</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {s.fnfTotal ? <span className="text-gray-700">₹{Math.abs(s.fnfTotal).toFixed(0)}</span> : '—'}
                          {s.fnfApprovedAt && <span className="text-green-600 ml-1">✓</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {s.salaryHoldUntil
                            ? s.salaryReleased
                              ? <span className="text-green-600">✅ Released</span>
                              : holdDue
                              ? <span className="text-red-600 font-medium">⏰ Due</span>
                              : <span className="text-amber-600">🔒 {s.salaryHoldUntil}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3"><span className="text-blue-600 text-xs hover:underline">View →</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SepCard({ sep, today, onClick }) {
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  const daysLeft = lwd ? Math.max(0, Math.round((new Date(lwd) - new Date(today)) / 86400000)) : null;
  const holdDue = sep.salaryHoldUntil && today >= sep.salaryHoldUntil && !sep.salaryReleased;

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
          {sep.user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-700">{sep.user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{sep.user?.designation || sep.user?.department}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>LWD</span>
          <span className="font-medium text-gray-700">{lwd || 'TBD'}</span>
        </div>

        {sep.leaveDaysDuringNotice > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700 text-center">
            ⚠️ Extended +{sep.leaveDaysDuringNotice}d (leave)
          </div>
        )}

        {daysLeft !== null && sep.status === 'notice_period' && (
          <div className="flex justify-between">
            <span className="text-gray-500">Days left</span>
            <span className={`font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-500' : 'text-gray-700'}`}>{daysLeft}d</span>
          </div>
        )}

        {holdDue && (
          <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700 text-center font-medium">
            ⏰ Salary release due!
          </div>
        )}

        {!holdDue && sep.salaryHoldUntil && !sep.salaryReleased && (
          <div className="flex justify-between">
            <span className="text-gray-500">Hold until</span>
            <span className="text-amber-600 font-medium">{sep.salaryHoldUntil}</span>
          </div>
        )}

        {sep.checklistProgress && sep.checklistProgress.total > 0 && (
          <div>
            <div className="flex justify-between text-gray-500 mb-0.5">
              <span>Checklist</span>
              <span>{sep.checklistProgress.done}/{sep.checklistProgress.total}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(sep.checklistProgress.done / sep.checklistProgress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
