import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const getCurrentDate = () => new Date().toISOString().slice(0, 10);

export default function OffDayAllowanceManager() {
  const { data: records, loading, error: fetchErr, refetch } = useFetch('/payroll/off-day-allowance', []);
  const { data: employees } = useFetch('/users', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();

  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm] = useState({ userId: '', eligibleFrom: getCurrentDate(), eligibleTo: '', notes: '' });
  const [filter, setFilter] = useState('active'); // active | all | stopped

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditRecord(null);
    setForm({ userId: '', eligibleFrom: getCurrentDate(), eligibleTo: '', notes: '' });
    clearMessages();
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setForm({
      userId: r.userId,
      eligibleFrom: r.eligibleFrom,
      eligibleTo: r.eligibleTo || '',
      notes: r.notes || '',
    });
    clearMessages();
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editRecord) {
        await execute(() => api.put(`/payroll/off-day-allowance/${editRecord.id}`, {
          eligibleFrom: form.eligibleFrom,
          eligibleTo: form.eligibleTo || null,
          notes: form.notes || null,
        }), 'Eligibility updated!');
      } else {
        await execute(() => api.post('/payroll/off-day-allowance', {
          userId: parseInt(form.userId),
          eligibleFrom: form.eligibleFrom,
          eligibleTo: form.eligibleTo || null,
          notes: form.notes || null,
        }), 'Employee assigned to Off-Day Allowance!');
      }
      refetch();
      setShowForm(false);
    } catch {
      // error shown by useApi
    }
  };

  const handleStop = async (id, name) => {
    if (!window.confirm(`Stop off-day allowance for ${name}? Eligibility will end today.`)) return;
    try {
      await execute(() => api.put(`/payroll/off-day-allowance/${id}/stop`), 'Eligibility stopped.');
      refetch();
    } catch {}
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove off-day allowance eligibility for ${name}? This cannot be undone.`)) return;
    try {
      await execute(() => api.delete(`/payroll/off-day-allowance/${id}`), 'Removed.');
      refetch();
    } catch {}
  };

  const today = getCurrentDate();

  const filtered = (records || []).filter(r => {
    const isActive = !r.eligibleTo || r.eligibleTo >= today;
    if (filter === 'active') return isActive;
    if (filter === 'stopped') return !isActive;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Off-Day Allowance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Assign employees to receive extra pay when working on weekends or holidays.
            Formula: <span className="font-medium text-slate-700">(Gross ÷ Days in Month) × Off Days Worked</span>
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          + Assign Employee
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { key: 'active', label: 'Active' },
          { key: 'stopped', label: 'Stopped' },
          { key: 'all', label: 'All' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
              {(records || []).filter(r => {
                const isActive = !r.eligibleTo || r.eligibleTo >= today;
                if (t.key === 'active') return isActive;
                if (t.key === 'stopped') return !isActive;
                return true;
              }).length}
            </span>
          </button>
        ))}
      </div>

      {/* Records Table */}
      {filtered.length === 0 ? (
        <EmptyState icon="🗓️" title="No records" subtitle={filter === 'active' ? 'No employees currently assigned off-day allowance' : 'No records found'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Eligible From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Eligible To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isActive = !r.eligibleTo || r.eligibleTo >= today;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.user?.name}</div>
                        <div className="text-xs text-slate-400">{r.user?.employeeId} · {r.user?.department}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.eligibleFrom)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.eligibleTo ? formatDate(r.eligibleTo) : <span className="text-green-600 font-medium">Ongoing</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isActive ? '● Active' : '○ Stopped'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[160px] truncate">{r.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(r)}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Edit
                          </button>
                          {isActive && (
                            <button
                              onClick={() => handleStop(r.id, r.user?.name)}
                              className="text-xs text-amber-600 hover:underline font-medium"
                            >
                              Stop
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r.id, r.user?.name)}
                            className="text-xs text-red-500 hover:underline font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">ℹ️ How Off-Day Allowance Works</p>
        <ul className="space-y-1 text-xs text-blue-700 list-disc list-inside">
          <li>Assigned employees get extra pay for each off-day or holiday they attend</li>
          <li>System checks attendance: employee must be marked <strong>Present</strong> on that day</li>
          <li>Off-days are determined by their <strong>shift pattern</strong> (weekly offs) + declared holidays</li>
          <li>Formula: <strong>(Gross Salary ÷ Total Days in Month) × Off Days Worked</strong></li>
          <li>Allowance is <strong>automatically calculated</strong> and added when payslips are generated</li>
          <li>Appears as <strong>"Off-Day Allowance"</strong> line item on payslip</li>
        </ul>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">
                {editRecord ? 'Edit Eligibility' : 'Assign Off-Day Allowance'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {saveErr && <AlertMessage type="error" message={saveErr} />}

              {!editRecord && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Employee *</label>
                  <select
                    value={form.userId}
                    onChange={e => setField('userId', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select employee...</option>
                    {(employees || []).map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.employeeId}) — {e.department}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Eligible From *</label>
                  <input
                    type="date"
                    value={form.eligibleFrom}
                    onChange={e => setField('eligibleFrom', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Eligible To <span className="text-slate-400 font-normal">(leave blank = ongoing)</span></label>
                  <input
                    type="date"
                    value={form.eligibleTo}
                    onChange={e => setField('eligibleTo', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setField('notes', e.target.value)}
                  placeholder="e.g. Approved by management for logistics duty"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editRecord && !form.userId) || !form.eligibleFrom}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editRecord ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
