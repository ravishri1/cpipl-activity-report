import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const STATUS_STYLES = { open: 'bg-red-100 text-red-700', under_review: 'bg-amber-100 text-amber-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-500' };
const PRIORITY_STYLES = { low: 'bg-slate-100 text-slate-500', normal: 'bg-blue-50 text-blue-600', high: 'bg-red-50 text-red-600' };
const CATEGORY_LABELS = { workplace: 'Workplace', harassment: 'Harassment', compensation: 'Compensation', management: 'Management', policy: 'Policy', other: 'Other' };

function DetailModal({ grievanceId, hrUsers, onClose, onDone }) {
  const { data: g, loading, error: fetchErr, refetch } = useFetch(`/api/grievances/${grievanceId}`, null);
  const { execute, loading: saving, error: saveErr } = useApi();
  const { execute: addComment, loading: commenting, error: commentErr } = useApi();
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [resolution, setResolution] = useState('');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const handleUpdate = async () => {
    const data = {};
    if (status)     data.status     = status;
    if (assignedTo) data.assignedTo = assignedTo;
    if (resolution) data.resolution = resolution;
    try {
      await execute(() => api.put(`/api/grievances/${grievanceId}`, data), 'Updated.');
      onDone();
      refetch();
    } catch {}
  };

  const handleComment = async () => {
    if (!comment.trim()) return;
    try {
      await addComment(() => api.post(`/api/grievances/${grievanceId}/comments`, { comment, isInternal }), 'Comment added.');
      setComment('');
      refetch();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800">Grievance Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-4">
          {fetchErr && <AlertMessage type="error" message={fetchErr} />}
          {saveErr && <AlertMessage type="error" message={saveErr} />}
          {loading ? <LoadingSpinner /> : !g ? null : (
            <>
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold text-slate-800 text-base">{g.subject}</div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                  <span>By: <strong>{g.isAnonymous ? 'Anonymous' : g.user?.name}</strong></span>
                  <span>{CATEGORY_LABELS[g.category]}</span>
                  <span>{formatDate(g.createdAt)}</span>
                </div>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{g.description}</p>

              {/* Update controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                  <select value={status || g.status} onChange={e => setStatus(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {['open','under_review','resolved','closed'].map(s => <option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Assigned To</label>
                  <select value={assignedTo || (g.assignedTo || '')} onChange={e => setAssignedTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Unassigned —</option>
                    {hrUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Resolution Note</label>
                <textarea value={resolution || (g.resolution || '')} onChange={e => setResolution(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe the resolution or action taken..." />
              </div>
              <button onClick={handleUpdate} disabled={saving} className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>

              {/* Comments */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Comments & Notes</div>
                <div className="space-y-2 mb-3">
                  {(g.comments || []).map(c => (
                    <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium text-slate-700">{c.user?.name || 'HR'}</span>
                        <span className="text-slate-400">{c.isInternal ? '🔒 Internal' : ''} {formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-700">{c.comment}</p>
                    </div>
                  ))}
                </div>
                {commentErr && <AlertMessage type="error" message={commentErr} />}
                <div className="flex gap-2">
                  <input value={comment} onChange={e => setComment(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Add note or response..." />
                  <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                    Internal
                  </label>
                  <button onClick={handleComment} disabled={commenting || !comment.trim()} className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50">Send</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GrievanceManager() {
  const [statusFilter, setStatusFilter] = useState('');
  const [detailId, setDetailId] = useState(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);

  const { data: grievances, loading, error: fetchErr, refetch } = useFetch(`/api/grievances?${params}`, []);
  const { data: hrUsers } = useFetch('/api/users/active', []);
  const { data: stats } = useFetch('/api/grievances/stats/summary', null);

  const adminUsers = Array.isArray(hrUsers) ? hrUsers.filter(u => ['admin','sub_admin'].includes(u.role)) : [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Grievance Manager</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage and resolve employee grievances</p>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            ['Total', stats.total, 'bg-blue-50 text-blue-700'],
            ['Open', stats.byStatus?.find(s=>s.status==='open')?._count || 0, 'bg-red-50 text-red-700'],
            ['Under Review', stats.byStatus?.find(s=>s.status==='under_review')?._count || 0, 'bg-amber-50 text-amber-700'],
            ['Resolved', stats.byStatus?.find(s=>s.status==='resolved')?._count || 0, 'bg-green-50 text-green-700'],
          ].map(([l,v,cls]) => (
            <div key={l} className={`rounded-xl p-4 ${cls}`}>
              <div className="text-2xl font-bold">{v}</div>
              <div className="text-xs font-medium mt-0.5 opacity-70">{l}</div>
            </div>
          ))}
        </div>
      )}

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      <div className="flex flex-wrap gap-2 mb-4">
        {['','open','under_review','resolved','closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-full border font-medium ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
            {s === '' ? 'All' : s.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : grievances.length === 0 ? (
        <EmptyState icon="🤝" title="No grievances" subtitle="No grievances match your filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Employee','Subject','Category','Priority','Status','Assigned','Date',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grievances.map(g => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium">{g.isAnonymous ? <span className="text-slate-400 italic">Anonymous</span> : g.user?.name}</td>
                  <td className="px-3 py-2.5 max-w-xs truncate">{g.subject}</td>
                  <td className="px-3 py-2.5 text-slate-500">{CATEGORY_LABELS[g.category]}</td>
                  <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLES[g.priority]}`}>{g.priority}</span></td>
                  <td className="px-3 py-2.5"><StatusBadge status={g.status} styles={STATUS_STYLES} /></td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{g.assignee?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-400 text-xs">{formatDate(g.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setDetailId(g.id)} className="px-2.5 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && <DetailModal grievanceId={detailId} hrUsers={adminUsers} onClose={() => setDetailId(null)} onDone={() => { refetch(); setDetailId(null); }} />}
    </div>
  );
}
