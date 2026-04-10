import { useState, useCallback } from 'react';
import {
  Wallet, Clock, CheckCircle, XCircle, Banknote, Send, RotateCcw,
  ChevronDown, ChevronUp, Loader2, Search, Filter, X, AlertTriangle,
  CalendarDays, IndianRupee, Users,
} from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatMonth = (m) => {
  try { return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); }
  catch { return m || '—'; }
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',   color: 'amber',  icon: Clock },
  approved: { label: 'Approved',  color: 'blue',   icon: CheckCircle },
  rejected: { label: 'Rejected',  color: 'red',    icon: XCircle },
  released: { label: 'Disbursed', color: 'violet', icon: Banknote },
  repaying: { label: 'Repaying',  color: 'indigo', icon: RotateCcw },
  closed:   { label: 'Closed',    color: 'green',  icon: CheckCircle },
};

const colorCls = {
  amber:  { badge: 'bg-amber-100 text-amber-700',   icon: 'text-amber-500',  bg: 'bg-amber-50' },
  blue:   { badge: 'bg-blue-100 text-blue-700',     icon: 'text-blue-500',   bg: 'bg-blue-50' },
  red:    { badge: 'bg-red-100 text-red-700',       icon: 'text-red-500',    bg: 'bg-red-50' },
  violet: { badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-500', bg: 'bg-violet-50' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', icon: 'text-indigo-500', bg: 'bg-indigo-50' },
  green:  { badge: 'bg-green-100 text-green-700',   icon: 'text-green-500',  bg: 'bg-green-50' },
};

const getCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function SalaryAdvanceManager() {
  const [tab, setTab] = useState('pending'); // pending | all
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [reviewModal, setReviewModal] = useState(null); // { advance, action: 'approved'|'rejected' }
  const [releaseModal, setReleaseModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [releaseForm, setReleaseForm] = useState({ releaseMode: 'bank_transfer', repaymentStart: getCurrentMonth(), releaseNote: '' });

  const { data: pending, loading: pendingLoading, error: pendingErr, refetch: refetchPending } = useFetch('/salary-advances/pending', []);
  const { data: all, loading: allLoading, error: allErr, refetch: refetchAll } = useFetch('/salary-advances/all', []);
  const { execute, loading: acting, error: actErr, success, clearMessages } = useApi();

  const refetch = useCallback(() => { refetchPending(); refetchAll(); }, [refetchPending, refetchAll]);

  const handleReview = async () => {
    if (!reviewModal) return;
    try {
      await execute(() => api.put(`/salary-advances/${reviewModal.advance.id}/review`, {
        status: reviewModal.action,
        approveNote: reviewNote.trim() || null,
        approvedAmount: reviewModal.action === 'approved' && approvedAmount ? parseFloat(approvedAmount) : undefined,
      }), `Advance ${reviewModal.action} successfully`);
      setReviewModal(null); setReviewNote(''); setApprovedAmount('');
      refetch();
    } catch {}
  };

  const handleRelease = async () => {
    if (!releaseModal) return;
    try {
      await execute(() => api.put(`/salary-advances/${releaseModal.id}/release`, {
        releaseMode: releaseForm.releaseMode,
        repaymentStart: releaseForm.repaymentStart,
        releaseNote: releaseForm.releaseNote.trim() || null,
      }), 'Advance disbursed! Repayment schedule created.');
      setReleaseModal(null);
      refetch();
    } catch {}
  };

  const closeReview = () => { setReviewModal(null); setReviewNote(''); setApprovedAmount(''); clearMessages(); };
  const closeRelease = () => { setReleaseModal(null); clearMessages(); };

  const displayList = tab === 'pending' ? pending : all.filter(a => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (search && !a.user?.name?.toLowerCase().includes(search.toLowerCase()) &&
        !a.user?.employeeId?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    pending: all.filter(a => a.status === 'pending').length,
    repaying: all.filter(a => a.status === 'repaying').length,
    totalOutstanding: all.filter(a => ['released', 'repaying'].includes(a.status))
      .reduce((s, a) => {
        const repaid = (a.repayments || []).filter(r => r.status === 'deducted').reduce((x, r) => x + r.amount, 0);
        return s + ((a.approvedAmount || a.amount) - repaid);
      }, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-violet-100 rounded-xl">
          <Wallet className="w-6 h-6 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Salary Advances</h1>
          <p className="text-sm text-slate-500">Review, approve, and track employee salary advances</p>
        </div>
      </div>

      {(actErr || pendingErr || allErr) && <AlertMessage type="error" message={actErr || pendingErr || allErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Awaiting Approval', value: stats.pending, icon: Clock, color: 'amber' },
          { label: 'Active Repayments', value: stats.repaying, icon: RotateCcw, color: 'indigo' },
          { label: 'Total Outstanding', value: formatCurrency(stats.totalOutstanding), icon: IndianRupee, color: 'violet', isAmount: true },
        ].map(stat => {
          const Icon = stat.icon;
          const cls = colorCls[stat.color];
          return (
            <div key={stat.label} className={`${cls.bg} rounded-xl p-4 border border-slate-100`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${cls.icon}`} />
                <span className="text-xs text-slate-500 font-medium">{stat.label}</span>
              </div>
              <p className={`text-2xl font-bold ${cls.icon}`}>{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {[
            { id: 'pending', label: 'Pending Approval', count: stats.pending },
            { id: 'all', label: 'All Advances' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}
              {t.count > 0 && <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters (All tab) */}
      {tab === 'all' && (
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      {(tab === 'pending' ? pendingLoading : allLoading) ? <LoadingSpinner /> : (
        displayList.length === 0 ? (
          <EmptyState icon="💰" title={tab === 'pending' ? 'No pending approvals' : 'No advances found'} subtitle="Everything is up to date" />
        ) : (
          <div className="space-y-3">
            {displayList.map(adv => (
              <AdvanceRow
                key={adv.id}
                advance={adv}
                expanded={expanded === adv.id}
                onToggle={() => setExpanded(expanded === adv.id ? null : adv.id)}
                onApprove={() => { setReviewModal({ advance: adv, action: 'approved' }); setApprovedAmount(String(adv.amount)); }}
                onReject={() => setReviewModal({ advance: adv, action: 'rejected' })}
                onRelease={() => setReleaseModal(adv)}
              />
            ))}
          </div>
        )
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeReview} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {reviewModal.action === 'approved'
                  ? <><CheckCircle className="w-5 h-5 text-green-500" /> Approve Advance</>
                  : <><XCircle className="w-5 h-5 text-red-500" /> Reject Advance</>
                }
              </h3>
              <button onClick={closeReview}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-medium">{reviewModal.advance.user?.name}</span>
                <span className="text-sm font-bold">{formatCurrency(reviewModal.advance.amount)}</span>
              </div>
              <p className="text-xs text-slate-500">{reviewModal.advance.repaymentMonths} months repayment · {reviewModal.advance.reason}</p>
            </div>

            {reviewModal.action === 'approved' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Approved Amount (₹)</label>
                <input type="number" value={approvedAmount} onChange={e => setApprovedAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={`Requested: ${formatCurrency(reviewModal.advance.amount)}`}
                />
                <p className="text-xs text-slate-400 mt-1">Leave unchanged to approve full amount</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Note {reviewModal.action === 'rejected' && <span className="text-red-400">*</span>}
              </label>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={3}
                placeholder={reviewModal.action === 'approved' ? 'Optional approval note...' : 'Reason for rejection...'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" autoFocus />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={closeReview} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={handleReview} disabled={acting || (reviewModal.action === 'rejected' && !reviewNote.trim())}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${reviewModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {reviewModal.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Modal */}
      {releaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeRelease} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-violet-500" /> Disburse Advance
              </h3>
              <button onClick={closeRelease}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm font-medium">{releaseModal.user?.name}</span>
                <span className="text-sm font-bold text-violet-700">{formatCurrency(releaseModal.approvedAmount || releaseModal.amount)}</span>
              </div>
              <p className="text-xs text-slate-500">{releaseModal.repaymentMonths} months repayment plan</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode *</label>
              <select value={releaseForm.releaseMode} onChange={e => setReleaseForm(f => ({ ...f, releaseMode: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Repayment Starts From *</label>
              <input type="month" value={releaseForm.repaymentStart}
                onChange={e => setReleaseForm(f => ({ ...f, repaymentStart: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <p className="text-xs text-slate-400 mt-1">First deduction month in payslip</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input type="text" value={releaseForm.releaseNote}
                onChange={e => setReleaseForm(f => ({ ...f, releaseNote: e.target.value }))}
                placeholder="e.g. Transaction ref, remarks..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This will create a repayment schedule. Deductions will auto-apply during monthly payslip generation.
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={closeRelease} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={handleRelease} disabled={acting || !releaseForm.repaymentStart}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Disburse Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdvanceRow({ advance, expanded, onToggle, onApprove, onReject, onRelease }) {
  const cfg = STATUS_CONFIG[advance.status] || STATUS_CONFIG.pending;
  const cls = colorCls[cfg.color];
  const Icon = cfg.icon;
  const amount = advance.approvedAmount || advance.amount;
  const repaid = (advance.repayments || []).filter(r => r.status === 'deducted').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${cls.bg}`}>
            <Icon className={`w-4 h-4 ${cls.icon}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">{advance.user?.name}</p>
            <p className="text-xs text-slate-400">{advance.user?.employeeId} · {advance.user?.department}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{formatCurrency(amount)}</p>
            <p className="text-xs text-slate-400">{advance.repaymentMonths}m repayment</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls.badge}`}>{cfg.label}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Info label="Requested" value={formatCurrency(advance.amount)} />
            <Info label="Approved" value={advance.approvedAmount ? formatCurrency(advance.approvedAmount) : '—'} />
            <Info label="Repaid" value={formatCurrency(repaid)} />
            <Info label="Remaining" value={formatCurrency(Math.max(amount - repaid, 0))} />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-400 font-medium mb-0.5">Reason</p>
            <p className="text-sm text-slate-700">{advance.reason}</p>
          </div>

          {advance.approveNote && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-400 font-medium mb-0.5">Review Note</p>
              <p className="text-sm text-blue-700">{advance.approveNote}</p>
            </div>
          )}

          {/* Repayment Table */}
          {advance.repayments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Repayment Schedule</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-slate-600">Month</th>
                      <th className="text-right px-3 py-2 text-slate-600">Amount</th>
                      <th className="text-center px-3 py-2 text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advance.repayments.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-3 py-2 text-slate-700">{formatMonth(r.month)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-2 text-center">
                          {r.status === 'deducted'
                            ? <span className="text-green-600 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3" /> Deducted</span>
                            : <span className="text-amber-500">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {advance.status === 'pending' && (
              <>
                <button onClick={onApprove} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={onReject} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
            {advance.status === 'approved' && (
              <button onClick={onRelease} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700">
                <Banknote className="w-3.5 h-3.5" /> Disburse
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
