import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { COMP_OFF_STATUS_STYLES } from '../../utils/constants';
import { AlarmClock, CheckCircle, XCircle, Filter } from 'lucide-react';

export default function CompOffManager() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const { data: requests, loading, error, refetch } = useFetch(`/api/comp-off?status=${statusFilter}`, []);
  const { execute, loading: acting, error: actErr, success, clearMessages } = useApi();
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const handleApprove = async (id) => {
    clearMessages();
    await execute(() => api.put(`/api/comp-off/${id}/approve`), 'Request approved!');
    refetch();
  };

  const handleReject = async (id) => {
    clearMessages();
    await execute(() => api.put(`/api/comp-off/${id}/reject`, { note: rejectNote }), 'Request rejected.');
    setRejectId(null); setRejectNote(''); refetch();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 -mx-6 -mt-6 px-6 py-4 border-b border-slate-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <AlarmClock className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Comp-Off Manager</h1>
              <p className="text-xs text-slate-500">Review earn & redeem requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {actErr && <AlertMessage type="error" message={actErr} />}
      {error && <AlertMessage type="error" message={error} />}

      {loading ? <LoadingSpinner /> : requests.length === 0 ? (
        <EmptyState icon="⏰" title="No requests" subtitle="No comp-off requests match the selected filter" />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
              <tr>{['Employee', 'Type', 'Date', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{r.user?.name}</p>
                    <p className="text-xs text-slate-400">{r.user?.employeeId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.type === 'earn' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.type === 'earn' ? 'Earn' : 'Redeem'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{formatDate(r.workedDate || r.preferredDate)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{r.daysEarned || r.daysToRedeem || 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[180px] truncate">{r.reason || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} styles={COMP_OFF_STATUS_STYLES} /></td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleApprove(r.id)} disabled={acting} className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => setRejectId(r.id)} className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Reject Request</h3>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Reason for rejection (optional)…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleReject(rejectId)} disabled={acting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {acting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
