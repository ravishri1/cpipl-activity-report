import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const emptyForm = { userId: '', label: '', amount: '', reason: '' };

export default function PayrollAdditions({ month, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const { data: additions, loading, error: fetchErr, refetch } = useFetch(
    `/api/payroll/additions?month=${month}`,
    []
  );

  const { data: employees, loading: empLoading, error: empErr } = useFetch(
    '/api/payroll/salary-list',
    []
  );

  const { execute, loading: saving, error: saveErr, success } = useApi();

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleAdd = async () => {
    if (!form.userId || !form.label || !form.amount) return;
    try {
      await execute(
        () => api.post('/api/payroll/additions', {
          userId: parseInt(form.userId),
          month,
          amount: parseFloat(form.amount),
          label: form.label,
          reason: form.reason || undefined,
        }),
        'Addition added'
      );
      refetch();
      setForm(emptyForm);
      setShowForm(false);
    } catch {
      // error displayed by useApi
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this addition?')) return;
    try {
      await execute(() => api.delete(`/api/payroll/additions/${id}`), 'Addition deleted');
      refetch();
    } catch {
      // error displayed by useApi
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-800">One-Time Payroll Additions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Month: {month} — rewards, bonuses, special payments</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {fetchErr && <AlertMessage type="error" message={fetchErr} />}
          {empErr && <AlertMessage type="error" message={empErr} />}
          {saveErr && <AlertMessage type="error" message={saveErr} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Add button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Payment
            </button>
          )}

          {/* Add form */}
          {showForm && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-green-800">New Addition</p>

              {empLoading ? (
                <LoadingSpinner />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Employee *</label>
                    <select
                      value={form.userId}
                      onChange={e => setField('userId', e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employeeId || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Amount (INR) *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.amount}
                      onChange={e => setField('amount', e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Label *</label>
                    <input
                      type="text"
                      value={form.label}
                      onChange={e => setField('label', e.target.value)}
                      placeholder="e.g. Performance Reward"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Reason (optional)</label>
                    <input
                      type="text"
                      value={form.reason}
                      onChange={e => setField('reason', e.target.value)}
                      placeholder="Brief reason..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.userId || !form.label || !form.amount}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Additions list */}
          {loading ? (
            <LoadingSpinner />
          ) : additions.length === 0 ? (
            <EmptyState
              icon="🎁"
              title="No additions"
              subtitle={`No one-time additions added for ${month} yet`}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                {additions.length} addition{additions.length !== 1 ? 's' : ''} for {month}
              </p>
              {additions.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">
                        {a.user?.name}
                      </span>
                      <span className="text-xs text-slate-400">{a.user?.employeeId}</span>
                      {a.payslipId && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Applied to payslip
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      <span className="font-medium">{a.label}</span>
                      {a.reason && <span className="text-slate-400"> — {a.reason}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Added by {a.createdBy?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-sm font-semibold text-green-600">
                      +{formatINR(a.amount)}
                    </span>
                    {!a.payslipId && (
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete addition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
