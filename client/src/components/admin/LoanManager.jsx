import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const LOAN_STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
};

function ReviewModal({ loan, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [status, setStatus] = useState('approved');
  const [startMonth, setStartMonth] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    try {
      await execute(() => api.put(`/api/loans/${loan.id}/review`, { status, startMonth: startMonth || undefined, notes: notes || undefined }), `Loan ${status}!`);
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Review Loan Request</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Employee</span><span className="font-medium">{loan.user?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-medium text-blue-600">{formatINR(loan.amount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">EMI</span><span className="font-medium">{formatINR(loan.emiAmount)} × {loan.totalEmi} months</span></div>
            {loan.purpose && <div className="flex justify-between"><span className="text-slate-500">Purpose</span><span className="font-medium">{loan.purpose}</span></div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
            <div className="flex gap-3">
              {['approved','rejected'].map(s => (
                <label key={s} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border ${status === s ? (s === 'approved' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700') : 'border-slate-200'}`}>
                  <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="hidden" />
                  <span className="capitalize text-sm font-medium">{s}</span>
                </label>
              ))}
            </div>
          </div>
          {status === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">EMI Start Month</label>
              <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Optional notes..." />
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

function RepayModal({ loan, onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(defaultMonth);
  const [amount, setAmount] = useState(loan.emiAmount);

  const handleSubmit = async () => {
    try {
      await execute(() => api.post(`/api/loans/${loan.id}/repay`, { month, amount }), 'Repayment recorded!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Record EMI Repayment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Employee</span><span className="font-medium">{loan.user?.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Remaining</span><span className="font-medium text-blue-600">{formatINR(loan.remainingAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">EMIs Paid</span><span className="font-medium">{loan.paidEmi} / {loan.totalEmi}</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payroll Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount Deducted</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} step={0.01} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Saving…' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoanManager() {
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewModal, setReviewModal] = useState(null);
  const [repayModal, setRepayModal] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState('loans'); // loans | payroll-due

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [dueMonth, setDueMonth] = useState(currentMonth);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  const { data: loans, loading, error: fetchErr, refetch } = useFetch(`/api/loans?${params}`, []);
  const { data: dueSummary, loading: dueLoading, error: dueErr, refetch: refetchDue } = useFetch(`/api/loans/payroll-due/${dueMonth}`, null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Loan & Advance Manager</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage employee loans and EMI repayments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6">
        {[['loans','All Loans'],['payroll-due','Payroll Due']].map(([k,l]) => (
          <button key={k} onClick={() => setActiveTab(k)} className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${activeTab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {activeTab === 'loans' && (
        <>
          {fetchErr && <AlertMessage type="error" message={fetchErr} />}
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['','pending','active','completed','rejected'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 text-xs rounded-full border font-medium ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? <LoadingSpinner /> : loans.length === 0 ? (
            <EmptyState icon="💳" title="No loans found" subtitle="No loan requests match your filter" />
          ) : (
            <div className="space-y-3">
              {loans.map(loan => (
                <div key={loan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === loan.id ? null : loan.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {loan.user?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{loan.user?.name}</div>
                        <div className="text-xs text-slate-500">{loan.user?.employeeId} · {loan.user?.department}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-slate-800">{formatINR(loan.amount)}</div>
                        <div className="text-xs text-slate-500">{formatINR(loan.emiAmount)}/mo × {loan.totalEmi}</div>
                      </div>
                      <StatusBadge status={loan.status} styles={LOAN_STATUS_STYLES} />
                    </div>
                    <div className="flex gap-2">
                      {loan.status === 'pending' && (
                        <button onClick={e => { e.stopPropagation(); setReviewModal(loan); }} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Review</button>
                      )}
                      {loan.status === 'active' && (
                        <button onClick={e => { e.stopPropagation(); setRepayModal(loan); }} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Record EMI</button>
                      )}
                    </div>
                  </div>

                  {expanded === loan.id && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-xl">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                        {loan.purpose && <div><span className="text-slate-500 block text-xs">Purpose</span>{loan.purpose}</div>}
                        <div><span className="text-slate-500 block text-xs">Remaining</span>{formatINR(loan.remainingAmount)}</div>
                        <div><span className="text-slate-500 block text-xs">EMIs Paid</span>{loan.paidEmi} / {loan.totalEmi}</div>
                        <div><span className="text-slate-500 block text-xs">Start Month</span>{loan.startMonth || '—'}</div>
                        {loan.approver && <div><span className="text-slate-500 block text-xs">Approved By</span>{loan.approver.name}</div>}
                        <div><span className="text-slate-500 block text-xs">Applied</span>{formatDate(loan.createdAt)}</div>
                      </div>
                      {loan.repayments?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Repayment History</div>
                          <div className="space-y-1">
                            {loan.repayments.map(r => (
                              <div key={r.id} className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <span className="text-slate-600">{r.month}</span>
                                <span className="font-medium text-green-600">{formatINR(r.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'payroll-due' && (
        <>
          {dueErr && <AlertMessage type="error" message={dueErr} />}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-slate-700">Month:</label>
            <input type="month" value={dueMonth} onChange={e => setDueMonth(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>

          {dueLoading ? <LoadingSpinner /> : !dueSummary ? null : dueSummary.due.length === 0 ? (
            <EmptyState icon="✅" title="All caught up" subtitle={`No EMI deductions pending for ${dueMonth}`} />
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
                <strong>{dueSummary.count} employees</strong> need EMI deduction for {dueMonth}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Employee','Dept','EMI Amount','Remaining','Paid / Total'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dueSummary.due.map(row => (
                      <tr key={row.loanId} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium">{row.name} <span className="text-slate-400 font-normal">({row.employeeId})</span></td>
                        <td className="px-3 py-2.5 text-slate-500">{row.department}</td>
                        <td className="px-3 py-2.5 font-semibold text-blue-600">{formatINR(row.emiAmount)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{formatINR(row.remainingAmount)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.paidEmi} / {row.totalEmi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {reviewModal && <ReviewModal loan={reviewModal} onClose={() => setReviewModal(null)} onDone={refetch} />}
      {repayModal && <RepayModal loan={repayModal} onClose={() => setRepayModal(null)} onDone={refetch} />}
    </div>
  );
}
