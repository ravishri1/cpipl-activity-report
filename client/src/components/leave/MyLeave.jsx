import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LeaveApplyModal from './LeaveApplyModal';
import {
  CalendarOff,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
} from 'lucide-react';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: Ban,
};

export default function MyLeave() {
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const year = new Date().getFullYear();

  const fetchData = async () => {
    try {
      const [balRes, reqRes] = await Promise.all([
        api.get(`/leave/balance?year=${year}`),
        api.get(`/leave/my?year=${year}&status=${filter}`),
      ]);
      setBalances(balRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      console.error('Leave fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const handleCancel = async (id) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/leave/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel.');
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarOff className="w-6 h-6 text-blue-600" />
          My Leave
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Apply Leave
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {balances.map((b) => {
          const pct = b.total > 0 ? ((b.used / b.total) * 100) : 0;
          return (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700">{b.leaveType.name}</h3>
                <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                  {b.leaveType.code}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl font-bold text-slate-800">{b.balance}</span>
                <span className="text-sm text-slate-400">/ {b.total} remaining</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{b.used} used of {b.total}</p>
            </div>
          );
        })}
      </div>

      {/* Requests table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Leave Requests</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">From</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">To</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Days</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Reason</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length > 0 ? requests.map((r) => {
                const StatusIcon = statusIcons[r.status] || Clock;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                        {r.leaveType.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.startDate}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.endDate}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{r.days}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">{r.reason}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"
                          title="Cancel request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply modal */}
      {showModal && (
        <LeaveApplyModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); }}
          balances={balances}
        />
      )}
    </div>
  );
}
