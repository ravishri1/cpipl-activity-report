import { useState } from 'react';
import { Clock, Plus, X, CheckCircle, XCircle, AlertCircle, Gift } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  icon: AlertCircle,   bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle,   bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
  rejected: { label: 'Rejected', icon: XCircle,       bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
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

export default function MyOvertime() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', hours: '', reason: '' });

  const { data: requests, loading, error, refetch } = useFetch('/api/overtime/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.post('/api/overtime', form),
      'Overtime request submitted!'
    );
    setForm({ date: '', hours: '', reason: '' });
    setShowForm(false);
    refetch();
  };

  const totalApprovedHours = requests
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.hours, 0);

  const compOffs = requests.filter(r => r.compOffEarned).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">My Overtime</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and request overtime hours</p>
        </div>
        <button
          onClick={() => { setShowForm(true); clearMessages(); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Request Overtime
        </button>
      </div>

      {/* Alerts */}
      {error && <AlertMessage type="error" message={error} />}
      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Requests</p>
          <p className="text-2xl font-bold text-slate-800">{requests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Approved Hours</p>
          <p className="text-2xl font-bold text-green-600">{totalApprovedHours}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Comp-Offs Earned</p>
          <p className="text-2xl font-bold text-purple-600">{compOffs}</p>
        </div>
      </div>

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Request Overtime</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hours <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={form.hours}
                  onChange={e => setField('hours', e.target.value)}
                  required
                  min="0.5"
                  max="12"
                  step="0.5"
                  placeholder="e.g. 2.5"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Max 12 hours per day</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={e => setField('reason', e.target.value)}
                  rows={3}
                  placeholder="Brief description of work done..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {saveErr && <AlertMessage type="error" message={saveErr} />}
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
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requests Table */}
      {requests.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-8 h-8 text-slate-300" />}
          title="No overtime requests"
          subtitle="Submit a request when you work extra hours"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Hours</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Comp-Off</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{formatDate(r.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                        <Clock size={13} /> {r.hours}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.reason || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      {r.compOffEarned ? (
                        <span className="inline-flex items-center gap-1 text-purple-600 text-xs font-medium">
                          <Gift size={13} /> Earned
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(r.createdAt)}</td>
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
