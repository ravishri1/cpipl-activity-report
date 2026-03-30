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

function ReviewModal({ req, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [status, setStatus] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');

  const handleSubmit = async () => {
    try {
      await execute(() => api.put(`/api/wfh/${req.id}/review`, { status, reviewNote: reviewNote || undefined }), `WFH ${status}!`);
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Review WFH Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Employee</span><span className="font-medium">{req.user?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{formatDate(req.date)}</span></div>
            {req.reason && <div className="flex justify-between"><span className="text-slate-500">Reason</span><span className="font-medium">{req.reason}</span></div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
            <div className="flex gap-3">
              {['approved','rejected'].map(s => (
                <label key={s} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border ${status === s ? (s === 'approved' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700') : 'border-slate-200'}`}>
                  <input type="radio" name="wfhStatus" value={s} checked={status === s} onChange={() => setStatus(s)} className="hidden" />
                  <span className="capitalize text-sm font-medium">{s}</span>
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
          <button onClick={handleSubmit} disabled={loading} className={`px-4 py-2 text-sm text-white rounded-lg ${status === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}>
            {loading ? 'Saving…' : status === 'approved' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WFHManager() {
  const [activeTab, setActiveTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reviewModal, setReviewModal] = useState(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(currentMonth);

  const reqParams = new URLSearchParams();
  if (statusFilter) reqParams.set('status', statusFilter);
  reqParams.set('month', month);

  const { data: requests, loading, error: fetchErr, refetch } = useFetch(`/api/wfh?${reqParams}`, []);
  const { data: summary, loading: sumLoading, error: sumErr } = useFetch(`/api/wfh/summary/${month}`, null);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">WFH Manager</h1>
        <p className="text-slate-500 text-sm mt-0.5">Review and manage work-from-home requests</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
        {[['requests','Requests'],['summary','Monthly Summary']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${activeTab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-slate-700">Month:</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
      </div>

      {activeTab === 'requests' && (
        <>
          {fetchErr && <AlertMessage type="error" message={fetchErr} />}
          {/* Status filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['','pending','approved','rejected','cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-full border font-medium ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : requests.length === 0 ? (
            <EmptyState icon="🏠" title="No WFH requests" subtitle="No requests match your filters" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Employee','Dept','Date','Reason','Status','Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">{r.user?.name}</div>
                        <div className="text-xs text-slate-400">{r.user?.employeeId}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{r.user?.department}</td>
                      <td className="px-3 py-2.5 font-medium">{formatDate(r.date)}</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">{r.reason || '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} styles={WFH_STATUS_STYLES} /></td>
                      <td className="px-3 py-2.5">
                        {r.status === 'pending' && (
                          <button onClick={() => setReviewModal(r)} className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Review</button>
                        )}
                        {r.status !== 'pending' && r.reviewer && (
                          <span className="text-xs text-slate-400">by {r.reviewer.name}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'summary' && (
        <>
          {sumErr && <AlertMessage type="error" message={sumErr} />}
          {sumLoading ? <LoadingSpinner /> : !summary ? null : summary.employees.length === 0 ? (
            <EmptyState icon="📊" title="No WFH days" subtitle={`No approved WFH in ${month}`} />
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                Total approved WFH days in {month}: <strong>{summary.totalDays}</strong>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Employee','Department','WFH Days','Dates'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.employees.map(e => (
                      <tr key={e.userId} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium">{e.name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{e.department}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-semibold text-xs">{e.count}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs">{e.dates.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {reviewModal && <ReviewModal req={reviewModal} onClose={() => setReviewModal(null)} onDone={refetch} />}
    </div>
  );
}
