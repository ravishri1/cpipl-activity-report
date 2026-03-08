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
import { Banknote, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function MyLoans() {
  const { data: loans, loading, error, refetch } = useFetch('/loans/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ loanType: 'personal', amount: '', tenure: 12, reason: '', requestedDate: '' });

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const emi = form.amount && form.tenure ? (parseFloat(form.amount) / parseInt(form.tenure)).toFixed(2) : '—';

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(() => api.post('/loans/request', form), 'Loan request submitted!');
    setShowModal(false); refetch();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Banknote className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">My Loans</h1>
            <p className="text-sm text-slate-500">Salary advances & employee loans</p>
          </div>
        </div>
        <button onClick={() => { setShowModal(true); clearMessages(); }} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Request Loan
        </button>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {error && <AlertMessage type="error" message={error} />}

      {loans.length === 0 ? (
        <EmptyState icon="💰" title="No loans" subtitle="You have no active or past loan records" />
      ) : (
        <div className="space-y-4">
          {loans.map(loan => (
            <div key={loan.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Loan summary row */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-slate-800 capitalize">{loan.loanType} Loan</p>
                    <p className="text-xs text-slate-500">Requested {formatDate(loan.requestedDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Amount</p>
                    <p className="font-bold text-slate-800">{formatINR(loan.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">EMI</p>
                    <p className="font-semibold text-slate-700">{formatINR(loan.emiAmount || 0)}/mo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Balance</p>
                    <p className="font-bold text-emerald-700">{formatINR(loan.outstandingBalance || 0)}</p>
                  </div>
                  <StatusBadge status={loan.status} styles={LOAN_STATUS_STYLES} />
                  <button onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                    {expandedId === loan.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Repayment Schedule */}
              {expandedId === loan.id && loan.repayments?.length > 0 && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Repayment Schedule</p>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <tr>{['#', 'Due Date', 'Amount', 'Paid On', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loan.repayments.map(rep => (
                        <tr key={rep.id} className="text-sm">
                          <td className="px-4 py-2 text-slate-500">{rep.installmentNumber}</td>
                          <td className="px-4 py-2 text-slate-700">{formatDate(rep.dueDate)}</td>
                          <td className="px-4 py-2 font-medium text-slate-800">{formatINR(rep.amount)}</td>
                          <td className="px-4 py-2 text-slate-500">{rep.paidDate ? formatDate(rep.paidDate) : '—'}</td>
                          <td className="px-4 py-2"><StatusBadge status={rep.status} styles={REPAYMENT_STATUS_STYLES} /></td>
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

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Request a Loan</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {saveErr && <AlertMessage type="error" message={saveErr} />}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Loan Type</label>
                <select value={form.loanType} onChange={e => sf('loanType', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {['personal', 'medical', 'education', 'home', 'vehicle', 'salary_advance'].map(t => (
                    <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                <input type="number" min={1000} value={form.amount} onChange={e => sf('amount', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="50000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tenure (months)</label>
                <select value={form.tenure} onChange={e => sf('tenure', parseInt(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {[3, 6, 9, 12, 18, 24, 36].map(t => <option key={t} value={t}>{t} months</option>)}
                </select>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <p className="text-sm text-emerald-700">Estimated EMI: <strong>{form.amount ? `₹${emi}` : '—'}</strong> / month</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea value={form.reason} onChange={e => sf('reason', e.target.value)} rows={3} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Brief reason for loan…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requested Date</label>
                <input type="date" value={form.requestedDate} onChange={e => sf('requestedDate', e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
