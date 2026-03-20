import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LeaveApplyModal from './LeaveApplyModal';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  CalendarOff, Plus, Clock, CheckCircle2, XCircle, Ban, Trash2,
  ChevronLeft, ChevronRight, TrendingUp, Calendar, Info, Lock, Shield,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

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

function getCurrentFY() {
  const now = new Date();
  const month = now.getMonth(); // 0=Jan, 3=Apr
  return month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

export default function MyLeave() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: balances, loading: balLoading, error: balErr, refetch: refetchBal } = useFetch(
    `/leave/balance?year=${fyYear}`, [], [fyYear]
  );
  const { data: requests, loading: reqLoading, error: reqErr, refetch: refetchReq } = useFetch(
    `/leave/my?year=${fyYear}&status=${filter}`, [], [fyYear, filter]
  );
  const { execute, loading: actionLoading, error: actionErr, success } = useApi();

  const refetch = () => { refetchBal(); refetchReq(); };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await execute(() => api.delete(`/leave/${id}`), 'Leave request cancelled');
      refetch();
    } catch {
      // Error handled by useApi
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const totalAvailable = balances.reduce((sum, b) => sum + (b.available || 0), 0);
    const totalUsed = balances.reduce((sum, b) => sum + (b.used || 0), 0);
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    return { totalAvailable, totalUsed, pendingCount };
  }, [balances, requests]);

  if (balLoading && reqLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarOff className="w-6 h-6 text-blue-600" />
            Leave Balance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your leaves for {getFYLabel(fyYear)}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* FY Navigation */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
            <button
              onClick={() => setFyYear(y => y - 1)}
              className="p-1.5 rounded hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2 min-w-[90px] text-center">
              {getFYLabel(fyYear)}
            </span>
            <button
              onClick={() => setFyYear(y => y + 1)}
              disabled={fyYear >= getCurrentFY()}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Apply Leave
          </button>
        </div>
      </div>

      {/* Errors */}
      {balErr && <AlertMessage type="error" message={balErr} />}
      {reqErr && <AlertMessage type="error" message={reqErr} />}
      {actionErr && <AlertMessage type="error" message={actionErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Balance Cards — greytHR style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {balances.map((b) => {
          const isUnlimited = b.available === -1; // LOP
          const totalPool = b.opening + b.credited;
          const pct = isUnlimited ? 0 : totalPool > 0 ? Math.min((b.used / totalPool) * 100, 100) : 0;
          const hasFrozen = b.onProbation && b.frozenBalance > 0;
          return (
            <div key={b.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${hasFrozen ? 'border-amber-200' : 'border-slate-200'}`}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {b.leaveType.code}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-700">{b.leaveType.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {b.leaveType.accrualType === 'monthly' && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Monthly
                    </span>
                  )}
                  {b.onProbation && b.probationAllowance !== null && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                      <Shield className="w-3 h-3" />
                      Probation
                    </span>
                  )}
                </div>
              </div>

              {/* Balance display */}
              <div className="px-4 py-3">
                {isUnlimited ? (
                  <>
                    {/* LOP: show used count in red */}
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-bold text-red-600">{b.used}</span>
                      <span className="text-sm text-red-400">LOP Used</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-center">
                      <div className="bg-red-50 rounded-lg py-1.5 px-3">
                        <p className="text-[10px] text-red-400 uppercase font-medium">Total LOP Days</p>
                        <p className="text-sm font-bold text-red-600">{b.used}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-bold text-blue-600">{b.available}</span>
                      <span className="text-sm text-slate-400">days available</span>
                    </div>

                    {/* Frozen balance notice */}
                    {hasFrozen && (
                      <div className="flex items-center gap-1.5 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs text-amber-700">
                          <strong>{b.frozenBalance}</strong> leaves frozen until confirmation
                        </span>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Breakdown — greytHR style */}
                    <div className={`grid gap-1 text-center ${hasFrozen ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      <div className="bg-slate-50 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-slate-400 uppercase font-medium">Opening</p>
                        <p className="text-sm font-bold text-slate-700">{b.opening}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-emerald-500 uppercase font-medium">Credited</p>
                        <p className="text-sm font-bold text-emerald-700">{b.credited}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-red-400 uppercase font-medium">Availed</p>
                        <p className="text-sm font-bold text-red-600">{b.used}</p>
                      </div>
                      {hasFrozen && (
                        <div className="bg-amber-50 rounded-lg py-1.5 px-1">
                          <p className="text-[10px] text-amber-500 uppercase font-medium">Frozen</p>
                          <p className="text-sm font-bold text-amber-600">{b.frozenBalance}</p>
                        </div>
                      )}
                      <div className="bg-blue-50 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-blue-400 uppercase font-medium">Balance</p>
                        <p className="text-sm font-bold text-blue-700">{b.available}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {balances.length === 0 && !balLoading && (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Info className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">No leave types configured for {getFYLabel(fyYear)}</p>
            <p className="text-xs text-slate-400 mt-1">Contact your admin to set up leave types</p>
          </div>
        )}
      </div>

      {/* Accrual info banner */}
      {balances.some(b => b.leaveType.accrualType === 'monthly') && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p>
              <strong>Monthly accrual:</strong> 1 leave is added to your balance on the 1st of every month.
              {getFYLabel(fyYear)} runs from April {fyYear} to March {fyYear + 1}.
            </p>
            {balances.some(b => b.onProbation && b.probationAllowance !== null) && (
              <p className="mt-1 text-amber-700">
                <strong>Probation:</strong> You are on probation. Only {balances.find(b => b.onProbation)?.probationAllowance || 1} leave(s)
                can be used during probation. Remaining accrued leaves will be unlocked after confirmation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            Leave Requests
            {stats.pendingCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                {stats.pendingCount} pending
              </span>
            )}
          </h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value="all">All Requests</option>
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
                <th className="px-4 py-2.5 font-medium text-slate-600">Session</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Reason</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length > 0 ? requests.map((r) => {
                const StatusIcon = statusIcons[r.status] || Clock;
                const sessionLabel = r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full Day';
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                        {r.leaveType.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(r.startDate)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(r.endDate)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{r.days}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.session !== 'full_day' ? 'bg-purple-50 text-purple-600' : 'text-slate-400'}`}>
                        {sessionLabel}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {(r.status === 'pending' || r.status === 'approved') && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={actionLoading}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-50"
                          title="Cancel request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {r.status === 'rejected' && r.reviewNote && (
                        <span className="text-xs text-red-500" title={r.reviewNote}>
                          {r.reviewNote.slice(0, 30)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No leave requests found for {getFYLabel(fyYear)}.
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
          onSuccess={() => { setShowModal(false); refetch(); }}
          balances={balances}
          fyYear={fyYear}
        />
      )}
    </div>
  );
}
