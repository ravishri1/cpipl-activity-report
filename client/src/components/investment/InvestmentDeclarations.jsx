import { useState } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate, formatINR } from '../../utils/formatters';
import { DECLARATION_STATUS_STYLES } from '../../utils/constants';

export default function InvestmentDeclarations() {
  const [statusFilter, setStatusFilter] = useState('submitted');
  const { data: declarations, loading, error, refetch } =
    useFetch(`/api/investment-declarations?status=${statusFilter}`, []);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [expanded, setExpanded] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  async function handleApprove(id) {
    if (!window.confirm('Approve this investment declaration?')) return;
    await execute(() => api.post(`/api/investment-declarations/${id}/approve`), 'Declaration approved!');
    refetch();
  }

  async function handleReject() {
    await execute(
      () => api.post(`/api/investment-declarations/${rejectId}/reject`, { rejectionNote: rejectNote }),
      'Declaration rejected.'
    );
    setRejectId(null);
    setRejectNote('');
    refetch();
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Investment Declarations (Form 12BB)</h1>
          <p className="text-sm text-slate-500 mt-1">Review and approve employee tax-saving declarations</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {declarations.length === 0 && (
        <EmptyState icon="📋" title="No declarations" subtitle="No declarations match the selected filter" />
      )}

      {declarations.map(d => (
        <div key={d.id} className="bg-white border border-slate-200 rounded-xl mb-4 shadow-sm overflow-hidden">
          <div className="p-5 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-slate-800">
                  {d.user?.name || 'Employee'} — FY {d.financialYear}
                </span>
                <StatusBadge status={d.status} styles={DECLARATION_STATUS_STYLES} />
              </div>
              <p className="text-xs text-slate-500">
                {d.user?.employeeId} · Submitted {d.submittedAt ? formatDate(d.submittedAt) : '—'}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                {[
                  { label: '80C', val: d.total80C },
                  { label: 'HRA', val: d.totalHRA },
                  { label: '80D', val: d.total80D },
                  { label: 'Others', val: (d.total80E || 0) + (d.totalNPS || 0) + (d.total24B || 0) },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400">{item.label}</p>
                    <p className="font-semibold text-slate-700">{formatINR(item.val || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right ml-4">
              <p className="text-xs text-slate-400">Total Declared</p>
              <p className="text-xl font-bold text-green-700">{formatINR(d.totalDeclared || 0)}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
            <button onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              {expanded === d.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded === d.id ? 'Hide details' : 'View all sections'}
            </button>
            {d.status === 'submitted' && (
              <div className="flex gap-2">
                <button onClick={() => { setRejectId(d.id); setRejectNote(''); }}
                  className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => handleApprove(d.id)} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              </div>
            )}
          </div>

          {expanded === d.id && (
            <div className="p-5 border-t border-slate-200 grid grid-cols-2 gap-3 text-sm">
              {[
                ['PPF', d.ppf], ['ELSS', d.elss], ['LIC', d.lic],
                ['Home Loan Principal', d.homeLoanPrincipal], ['NSC', d.nsc],
                ['Tuition Fees', d.tuitionFees], ['Other 80C', d.other80C],
                ['HRA Rent Paid', d.hraRentPaid], ['Landlord', d.landlordName],
                ['Landlord PAN', d.landlordPan],
                ['Mediclaim (Self)', d.mediclaim80D], ['Mediclaim (Parents)', d.parentMediclaim80D],
                ['Education Loan Interest', d.educationLoanInterest80E],
                ['Home Loan Interest (24B)', d.homeLoanInterest24B],
                ['NPS 80CCD(1B)', d.nps80CCDI],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">
                    {isNaN(val) ? val : formatINR(parseFloat(val))}
                  </span>
                </div>
              ) : null)}
              {d.notes && (
                <div className="col-span-2 mt-2 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
                  <strong>Notes:</strong> {d.notes}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Reject Declaration</h3>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
              placeholder="Reason for rejection (optional but recommended)..." />
            <div className="flex gap-3">
              <button onClick={handleReject} disabled={saving}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button onClick={() => setRejectId(null)}
                className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
