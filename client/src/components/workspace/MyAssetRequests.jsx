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

const PRIORITY_STYLES = {
  low:    'bg-slate-100 text-slate-500',
  normal: 'bg-blue-50  text-blue-600',
  high:   'bg-amber-50 text-amber-600',
  urgent: 'bg-red-50   text-red-600',
};

const ASSET_TYPES = ['laptop', 'monitor', 'keyboard', 'mouse', 'headset', 'chair', 'desk', 'phone', 'charger', 'other'];

function RequestModal({ onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({ assetType: '', quantity: 1, priority: 'normal', reason: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/api/asset-requests', form), 'Request submitted!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Request an Asset</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asset Type *</label>
            <select value={form.assetType} onChange={e => set('assetType', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— Select type —</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} min={1} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Justification</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Why do you need this asset?" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !form.assetType} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyAssetRequests() {
  const [showModal, setShowModal] = useState(false);
  const { data: requests, loading, error: fetchErr, refetch } = useFetch('/api/asset-requests/my', []);
  const { execute, loading: cancelling, error: cancelErr } = useApi();

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this request?')) return;
    try {
      await execute(() => api.put(`/api/asset-requests/${id}/cancel`), 'Request cancelled.');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Asset Requests</h1>
          <p className="text-slate-500 text-sm mt-0.5">Request equipment and track delivery</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Request Asset
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {cancelErr && <AlertMessage type="error" message={cancelErr} />}

      {requests.length === 0 ? (
        <EmptyState icon="📦" title="No asset requests" subtitle="Request a laptop, chair, headset, or any equipment you need" />
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800 capitalize">{r.assetType}</span>
                  {r.quantity > 1 && <span className="text-xs text-slate-400">×{r.quantity}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[r.priority]}`}>{r.priority}</span>
                </div>
                {r.reason && <div className="text-sm text-slate-500 mt-0.5">{r.reason}</div>}
                <div className="text-xs text-slate-400 mt-0.5">{formatDate(r.createdAt)}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={r.status} styles={STATUS_STYLES} />
                {r.status !== 'pending' && r.reviewer && (
                  <span className="text-xs text-slate-400">
                    {r.reviewNote && `${r.reviewNote} · `}by {r.reviewer.name}
                  </span>
                )}
                {r.status === 'fulfilled' && r.fulfilledAt && (
                  <span className="text-xs text-green-600">Delivered {formatDate(r.fulfilledAt)}</span>
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
