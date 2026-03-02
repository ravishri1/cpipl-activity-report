import { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
} from 'lucide-react';

export default function LeaveApproval() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [reviewNote, setReviewNote] = useState({});

  const fetchPending = async () => {
    try {
      const res = await api.get('/leave/pending');
      setRequests(res.data);
    } catch (err) {
      console.error('Pending leave error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleReview = async (id, status) => {
    setActionLoading(id);
    try {
      await api.put(`/leave/${id}/review`, {
        status,
        reviewNote: reviewNote[id] || '',
      });
      fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to review request.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <ClipboardCheck className="w-6 h-6 text-blue-600" />
        Leave Requests
        {requests.length > 0 && (
          <span className="ml-2 px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
            {requests.length} pending
          </span>
        )}
      </h1>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <p className="text-slate-500">No pending leave requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Employee info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.user.name}</p>
                      <p className="text-xs text-slate-400">{r.user.employeeId} · {r.user.department}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-[10px] uppercase text-slate-400 font-medium">Type</p>
                      <p className="text-sm font-medium text-slate-700">{r.leaveType.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400 font-medium">From</p>
                      <p className="text-sm text-slate-700">{r.startDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400 font-medium">To</p>
                      <p className="text-sm text-slate-700">{r.endDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-400 font-medium">Days</p>
                      <p className="text-sm font-bold text-slate-800">{r.days}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] uppercase text-slate-400 font-medium mb-0.5">Reason</p>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{r.reason}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:w-48">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400">Note (optional)</span>
                  </div>
                  <textarea
                    value={reviewNote[r.id] || ''}
                    onChange={(e) => setReviewNote({ ...reviewNote, [r.id]: e.target.value })}
                    placeholder="Add a note..."
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-none"
                  />
                  <button
                    onClick={() => handleReview(r.id, 'approved')}
                    disabled={actionLoading === r.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview(r.id, 'rejected')}
                    disabled={actionLoading === r.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
