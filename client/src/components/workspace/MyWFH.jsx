import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const WFH_STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

function RequestModal({ onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/wfh', { date, reason: reason || undefined }), 'WFH request submitted!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Request Work From Home</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Briefly explain the reason for WFH..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !date} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyWFH() {
  const [showModal, setShowModal] = useState(false);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(currentMonth);

  const { data: requests, loading, error: fetchErr, refetch } = useFetch(`/api/wfh/my?month=${month}`, []);
  const { execute, loading: cancelling, error: cancelErr } = useApi();

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this WFH request?')) return;
    try {
      await execute(() => api.put(`/api/wfh/${id}/cancel`), 'Request cancelled.');
      refetch();
    } catch {}
  };

  const approved = requests.filter(r => r.status === 'approved').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My WFH Requests</h1>
          <p className="text-slate-500 text-sm mt-0.5">Request and track work-from-home days</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Request WFH
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {cancelErr && <AlertMessage type="error" message={cancelErr} />}

      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-slate-700">Month:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        {approved > 0 && (
          <span className="text-sm text-green-600 font-medium">{approved} approved this month</span>
        )}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon="🏠" title="No WFH requests" subtitle="You haven't requested any WFH days this month" />
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800">{formatDate(r.date)}</div>
                {r.reason && <div className="text-sm text-slate-500 mt-0.5">{r.reason}</div>}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} styles={WFH_STATUS_STYLES} />
                {r.status !== 'pending' && r.reviewer && (
                  <span className="text-xs text-slate-400">
                    {r.status === 'approved' ? '✓' : '✗'} by {r.reviewer.name}
                    {r.reviewNote && ` — ${r.reviewNote}`}
                  </span>
                )}
                {r.status === 'pending' && (
                  <button onClick={() => handleCancel(r.id)} disabled={cancelling} className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <RequestModal onClose={() => setShowModal(false)} onDone={refetch} />}
    </div>
  );
}
