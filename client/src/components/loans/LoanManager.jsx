import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { LOAN_STATUS_STYLES, REPAYMENT_STATUS_STYLES } from '../../utils/constants';
import { Banknote, CheckCircle, XCircle, DollarSign, ChevronDown, ChevronUp, X } from 'lucide-react';

export default function LoanManager() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const { data: loans, loading, error, refetch } = useFetch(`/api/loans?status=${statusFilter}`, []);
  const { execute, loading: acting, error: actErr, success, clearMessages } = useApi();
  const [expandedId, setExpandedId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [payModal, setPayModal] = useState(null); // { repaymentId, amount }
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));

  const handleApprove = async (id) => {
    clearMessages();
    await execute(() => api.put(`/api/loans/${id}/approve`), 'Loan approved!');
    refetch();
  };

  const handleDisburse = async (id) => {
    clearMessages();
    const disbursedDate = new Date().toISOString().slice(0, 10);
    await execute(() => api.put(`/api/loans/${id}/disburse`, { disbursedDate }), 'Loan disbursed!');
    refetch();
  };

  const handleReject = async () => {
    clearMessages();
    await execute(() => api.put(`/api/loans/${rejectId}/reject`, { note: rejectNote }), 'Loan rejected.');
    setRejectId(null); setRejectNote(''); refetch();
  };

  const handlePay = async () => {
    clearMessages();
    await execute(() => api.put(`/api/loans/repayment/${payModal.id}/pay`, { paidDate }), 'Payment recorded!');
    setPayModal(null); refetch();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 -mx-6 -mt-6 px-6 py-4 border-b border-slate-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Loan Manager</h1>
              <p className="text-xs text-slate-500">Approve, disburse & track repayments</p>
            </div>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="disbursed">Disbursed</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {actErr && <AlertMessage type="error" message={actErr} />}
      {error && <AlertMessage type="error" message={error} />}

      {loading ? <LoadingSpinner /> : loans.length === 0 ? (
        <EmptyState icon="💰" title="No loans" subtitle="No loan records match the selected filter" />
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <div key={loan.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="font-semibold text-slate-800">{loan.user?.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{loan.loanType?.replace('_', ' ')} — {loan.user?.designation || loan.user?.employeeId}</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-bold text-slate-800">{formatINR(loan.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Tenure</p>
                    <p className="font-semibold text-slate-700">{loan.tenure} mo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="font-bold text-emerald-700">{formatINR(loan.outstandingBalance || 0)}</p>
                  </div>
                  <StatusBadge status={loan.status} styles={LOAN_STATUS_STYLES} />
                  <div className="flex items-center gap-1.5">
                    {loan.status === 'pending' && <>
                      <button onClick={() => handleApprove(loan.id)} disabled={acting} className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => setRejectId(loan.id)} className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>}
                    {loan.status === 'approved' && (
                      <button onClick={() => handleDisburse(loan.id)} disabled={acting} className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                        <DollarSign className="w-3.5 h-3.5" /> Disburse
                      </button>
                    )}
                    {(loan.status === 'disbursed' || loan.status === 'active') && loan.repayments?.length > 0 && (
                      <button onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                        {expandedId === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Repayments */}
              {expandedId === loan.id && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">Repayment Schedule</div>
                  <table className="w-full">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                      <tr>{['#', 'Due Date', 'Amount', 'Status', 'Action'].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loan.repayments.map(rep => (
                        <tr key={rep.id} className="text-sm">
                          <td className="px-4 py-2 text-slate-500">{rep.installmentNumber}</td>
                          <td className="px-4 py-2 text-slate-700">{formatDate(rep.dueDate)}</td>
                          <td className="px-4 py-2 font-medium">{formatINR(rep.amount)}</td>
                          <td className="px-4 py-2"><StatusBadge status={rep.status} styles={REPAYMENT_STATUS_STYLES} /></td>
                          <td className="px-4 py-2">
                            {rep.status === 'pending' && (
                              <button onClick={() => setPayModal(rep)} className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium">Mark Paid</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Reject Loan Request</h3>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Reason (optional)…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handleReject} disabled={acting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {acting ? 'Rejecting…' : 'Reject Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Mark Installment Paid</h3>
              <button onClick={() => setPayModal(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Amount: <strong>{formatINR(payModal.amount)}</strong></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayModal(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={handlePay} disabled={acting} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {acting ? 'Saving…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
