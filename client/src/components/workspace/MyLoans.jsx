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

function RequestModal({ onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({ amount: '', purpose: '', emiAmount: '', totalEmi: '', startMonth: '', notes: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalRepay = form.emiAmount && form.totalEmi ? (parseFloat(form.emiAmount) * parseInt(form.totalEmi)).toFixed(2) : null;

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/api/loans', form), 'Loan request submitted!');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Request Loan / Advance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <AlertMessage type="error" message={error} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loan Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} min={1} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="50000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">EMI Amount (₹) *</label>
              <input type="number" value={form.emiAmount} onChange={e => set('emiAmount', e.target.value)} min={1} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="5000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">No. of EMIs *</label>
              <input type="number" value={form.totalEmi} onChange={e => set('totalEmi', e.target.value)} min={1} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Start Month</label>
              <input type="month" value={form.startMonth} onChange={e => set('startMonth', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {totalRepay && (
            <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm text-blue-700">
              Total repayment: <strong>{formatINR(parseFloat(totalRepay))}</strong>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
            <input type="text" value={form.purpose} onChange={e => set('purpose', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Medical emergency, home repair, etc." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Additional Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyLoans() {
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { data: loans, loading, error: fetchErr, refetch } = useFetch('/api/loans/my', []);
  const { execute, loading: cancelling, error: cancelErr } = useApi();

  const hasActive = loans.some(l => ['pending','active','approved'].includes(l.status));

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this loan request?')) return;
    try {
      await execute(() => api.put(`/api/loans/${id}/cancel`), 'Request cancelled.');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Loans & Advances</h1>
          <p className="text-slate-500 text-sm mt-0.5">Request and track salary advances</p>
        </div>
        {!hasActive && (
          <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Request Loan
          </button>
        )}
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {cancelErr && <AlertMessage type="error" message={cancelErr} />}

      {hasActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700">
          You have an active/pending loan. Please repay it fully before requesting a new one.
        </div>
      )}

      {loans.length === 0 ? (
        <EmptyState icon="💳" title="No loans yet" subtitle="Submit a loan or salary advance request" />
      ) : (
        <div className="space-y-3">
          {loans.map(loan => (
            <div key={loan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === loan.id ? null : loan.id)}>
                <div>
                  <div className="font-semibold text-slate-800">{formatINR(loan.amount)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{loan.purpose || 'No purpose specified'} · {formatDate(loan.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-sm">
                    <div className="text-slate-600">{formatINR(loan.emiAmount)}/mo × {loan.totalEmi}</div>
                    <div className="text-xs text-slate-400">{loan.paidEmi} paid · {formatINR(loan.remainingAmount)} remaining</div>
                  </div>
                  <StatusBadge status={loan.status} styles={LOAN_STATUS_STYLES} />
                  {loan.status === 'pending' && (
                    <button onClick={e => { e.stopPropagation(); handleCancel(loan.id); }} disabled={cancelling} className="px-2.5 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Cancel</button>
                  )}
                </div>
              </div>

              {expanded === loan.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-xl">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                    <div><span className="text-slate-500 block text-xs">Start Month</span>{loan.startMonth || '—'}</div>
                    <div><span className="text-slate-500 block text-xs">Approved By</span>{loan.approver?.name || '—'}</div>
                    {loan.notes && <div><span className="text-slate-500 block text-xs">Notes</span>{loan.notes}</div>}
                  </div>
                  {loan.repayments?.length > 0 && (
                    <>
                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Repayment Progress</span>
                          <span>{Math.round((loan.paidEmi / loan.totalEmi) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${Math.round((loan.paidEmi / loan.totalEmi) * 100)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        {loan.repayments.map(r => (
                          <div key={r.id} className="flex justify-between text-xs bg-white rounded px-3 py-2 border border-slate-100">
                            <span>{r.month}</span>
                            <span className="font-medium text-green-600">- {formatINR(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <RequestModal onClose={() => setShowModal(false)} onDone={refetch} />}
    </div>
  );
}
