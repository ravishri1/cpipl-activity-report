import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-blue-100 text-blue-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const PRIORITY_BADGE = {
  low:    'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50  text-blue-600',
  high:   'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100  text-red-700',
};

function ReviewModal({ req, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [status, setStatus] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');

  const handleSubmit = async () => {
    try {
      await execute(() => api.put(`/asset-requests/${req.id}/review`, { status, reviewNote: reviewNote || undefined }), `Request ${status}!`);
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Review Asset Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Employee</span><span className="font-medium">{req.user?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Asset</span><span className="font-medium capitalize">{req.assetType} ×{req.quantity}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Priority</span><span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${PRIORITY_BADGE[req.priority]}`}>{req.priority}</span></div>
            {req.reason && <div className="flex justify-between"><span className="text-slate-500">Reason</span><span className="font-medium max-w-xs text-right">{req.reason}</span></div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
            <div className="flex gap-3">
              {['approved','rejected'].map(s => (
                <label key={s} className={`cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium ${status === s ? (s === 'approved' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700') : 'border-slate-200 text-slate-600'}`}>
                  <input type="radio" checked={status === s} onChange={() => setStatus(s)} className="hidden" />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Optional note..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${status === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? 'Saving…' : status === 'approved' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssetRequestManager() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const { execute: fulfill, loading: fulfilling } = useApi();

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  if (priorityFilter) params.set('priority', priorityFilter);

  const { data: requests, loading, error: fetchErr, refetch } = useFetch(`/asset-requests?${params}`, []);

  const handleFulfill = async (id) => {
    if (!window.confirm('Mark this request as fulfilled (asset delivered)?')) return;
    try {
      await fulfill(() => api.put(`/asset-requests/${id}/fulfill`), 'Marked as fulfilled!');
      refetch();
    } catch {}
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Asset Request Manager</h1>
        <p className="text-slate-500 text-sm mt-0.5">Review and fulfill employee asset requests</p>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {['','pending','approved','fulfilled','rejected','cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-full border font-medium ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
              {s === '' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap ml-2">
          {['','urgent','high','normal','low'].map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)} className={`px-3 py-1 text-xs rounded-full border font-medium ${priorityFilter === p ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
              {p === '' ? 'All Priority' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : requests.length === 0 ? (
        <EmptyState icon="📦" title="No asset requests" subtitle="No requests match your filters" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Employee','Dept','Asset','Qty','Priority','Reason','Status','Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{r.user?.name}</div>
                    <div className="text-xs text-slate-400">{formatDate(r.createdAt)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.user?.department}</td>
                  <td className="px-3 py-2.5 font-medium capitalize">{r.assetType}</td>
                  <td className="px-3 py-2.5 text-center">{r.quantity}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} styles={STATUS_STYLES} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      {r.status === 'pending' && (
                        <button onClick={() => setReviewModal(r)} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Review</button>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={() => handleFulfill(r.id)} disabled={fulfilling} className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Fulfill</button>
                      )}
                      {r.status !== 'pending' && r.status !== 'approved' && r.reviewer && (
                        <span className="text-xs text-slate-400">by {r.reviewer.name}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewModal && <ReviewModal req={reviewModal} onClose={() => setReviewModal(null)} onDone={refetch} />}
    </div>
  );
}
