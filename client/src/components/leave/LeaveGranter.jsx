import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { formatDate } from '../../utils/formatters';
import {
  Gift, Plus, Trash2, ChevronLeft, ChevronRight, Users, Shield, Clock,
  CheckCircle2, AlertTriangle, Search, X, Info,
} from 'lucide-react';

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

export default function LeaveGranter() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const { data: grants, loading, error: fetchErr, refetch } = useFetch(
    `/leave/admin/grants?year=${fyYear}`, []
  );
  const { execute, loading: saving, error: saveErr, success } = useApi();

  // Group grants by employee
  const grouped = useMemo(() => {
    const map = {};
    for (const g of grants) {
      if (!map[g.userId]) {
        map[g.userId] = { user: g.user, grants: [] };
      }
      map[g.userId].grants.push(g);
    }
    return Object.values(map).filter(g =>
      !search || g.user.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.user.employeeId || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [grants, search]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this leave grant? Balance will reset to default.')) return;
    try {
      await execute(() => api.delete(`/leave/admin/grants/${id}`), 'Grant removed');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Gift className="w-6 h-6 text-blue-600" />
            Leave Granter
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Assign leave policies to employees for {getFYLabel(fyYear)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
            <button onClick={() => setFyYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2 min-w-[90px] text-center">
              {getFYLabel(fyYear)}
            </span>
            <button
              onClick={() => setFyYear(y => y + 1)}
              disabled={fyYear >= getCurrentFY() + 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Grant Leave
          </button>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Info banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700">
          <p><strong>Leave Granter</strong> assigns leave policies to employees with probation rules.</p>
          <p className="mt-1">
            <strong>Probation rule:</strong> During probation, only the "Probation Allowance" number of leaves are usable.
            Remaining leaves accrue monthly (bucket system) but stay frozen until confirmation.
            After confirmation, all accrued past-month leaves unlock instantly.
          </p>
          <p className="mt-1">
            <strong>Mid-year joiners:</strong> Leaves are pro-rated based on joining month.
            e.g., Sept joiner gets 7 leaves (Sept to March = 7 months).
          </p>
        </div>
      </div>

      {/* Search */}
      {grants.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Grants table */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No leave grants"
          subtitle={`No leave grants assigned for ${getFYLabel(fyYear)}. Click "Grant Leave" to assign.`}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ user, grants: userGrants }) => (
            <div key={user.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Employee header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-400">
                      {user.employeeId} · {user.department}
                      {user.dateOfJoining && ` · Joined ${formatDate(user.dateOfJoining)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.confirmationStatus === 'confirmed' || user.confirmationDate ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                      <Clock className="w-3 h-3" /> Probation
                    </span>
                  )}
                </div>
              </div>

              {/* Grants for this employee */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-slate-50/50">
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Leave Type</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Total Granted</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Probation Allowance</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Joining Month (FY)</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Notes</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Granted By</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userGrants.map(g => {
                    const fyMonthNames = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
                    return (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                            {g.leaveType.code}
                          </span>
                          <span className="ml-1.5 text-slate-600">{g.leaveType.name}</span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-800">{g.totalGranted}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1 text-amber-700">
                            <Shield className="w-3 h-3" />
                            {g.probationAllowance} usable
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {g.joiningMonth ? `${fyMonthNames[g.joiningMonth - 1]} (Month ${g.joiningMonth})` : 'Full Year'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[150px] truncate">{g.notes || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">{g.granter?.name}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => handleDelete(g.id)}
                            disabled={saving}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"
                            title="Remove grant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Grant Modal */}
      {showModal && (
        <GrantModal
          fyYear={fyYear}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetch(); }}
        />
      )}
    </div>
  );
}

function GrantModal({ fyYear, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    leaveTypeId: '',
    totalGranted: '',
    probationAllowance: '1',
    joiningMonth: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data, loading } = useFetch(`/leave/admin/employees-for-grant?year=${fyYear}`, {});
  const employees = data?.employees || [];
  const leaveTypes = data?.leaveTypes || [];

  const filtered = useMemo(() => {
    if (!search) return employees;
    const s = search.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(s) ||
      (e.employeeId || '').toLowerCase().includes(s) ||
      (e.department || '').toLowerCase().includes(s)
    );
  }, [employees, search]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    // Auto-fill suggested values based on employee status
    const isConfirmed = user.confirmationStatus === 'confirmed' || !!user.confirmationDate;
    if (user.suggestedJoiningMonth) {
      setForm(f => ({
        ...f,
        joiningMonth: String(user.suggestedJoiningMonth),
        totalGranted: String(user.suggestedTotal),
        probationAllowance: isConfirmed ? String(user.suggestedTotal) : '1',
      }));
    } else {
      setForm(f => ({
        ...f,
        joiningMonth: '',
        totalGranted: '12',
        probationAllowance: isConfirmed ? '12' : '1',
      }));
    }
    setStep(2);
  };

  const isConfirmed = selectedUser && (selectedUser.confirmationStatus === 'confirmed' || !!selectedUser.confirmationDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/leave/admin/grants', {
        userId: selectedUser.id,
        leaveTypeId: parseInt(form.leaveTypeId),
        fyYear,
        totalGranted: parseFloat(form.totalGranted),
        // Confirmed employees: no probation restriction (null). Probation: limit usable leaves.
        probationAllowance: isConfirmed ? null : parseFloat(form.probationAllowance),
        joiningMonth: form.joiningMonth ? parseInt(form.joiningMonth) : null,
        notes: form.notes || null,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to grant leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const fyMonthNames = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Gift className="w-5 h-5 text-blue-600" />
              Grant Leave — {getFYLabel(fyYear)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 1 ? 'Step 1: Select Employee' : `Step 2: Configure for ${selectedUser?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Step 1: Select Employee */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? <LoadingSpinner /> : (
              <>
                <div className="relative mb-4">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, ID, or department..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                  {filtered.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectUser(emp)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-blue-50 text-left transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                        <p className="text-xs text-slate-400">
                          {emp.employeeId} · {emp.department}
                          {emp.dateOfJoining && ` · Joined ${formatDate(emp.dateOfJoining)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {emp.onProbation && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                            <Clock className="w-3 h-3" /> Probation
                          </span>
                        )}
                        {emp.suggestedJoiningMonth && (
                          <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                            Mid-year ({fyMonthNames[emp.suggestedJoiningMonth - 1]})
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-slate-400 py-6 text-sm">No employees found</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: Configure Grant */}
        {step === 2 && selectedUser && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {error && (
              <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Selected employee */}
            <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{selectedUser.name}</p>
                <p className="text-xs text-slate-400">
                  {selectedUser.employeeId} · {selectedUser.department}
                  {selectedUser.dateOfJoining && ` · Joined ${formatDate(selectedUser.dateOfJoining)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setSelectedUser(null); setError(''); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>

            {isConfirmed ? (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-emerald-700">
                  <p><strong>Employee is confirmed.</strong> All granted leaves will be fully available (no probation restriction).</p>
                  {selectedUser.confirmationDate && <p className="mt-0.5">Confirmed on: {formatDate(selectedUser.confirmationDate)}</p>}
                </div>
              </div>
            ) : selectedUser.onProbation ? (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p><strong>Employee is on probation.</strong></p>
                  <p>Only "Probation Allowance" leaves will be usable. Remaining accrued leaves stay frozen until confirmation.</p>
                  {selectedUser.dateOfJoining && <p className="mt-0.5">Joined: {formatDate(selectedUser.dateOfJoining)}</p>}
                </div>
              </div>
            ) : null}

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type *</label>
              <select
                value={form.leaveTypeId}
                onChange={e => setForm({ ...form, leaveTypeId: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.code})
                    {selectedUser.existingGrants?.[lt.id] ? ' — Already granted' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Total Granted */}
            <div className={`grid gap-4 ${isConfirmed ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total Leaves for FY *
                </label>
                <input
                  type="number"
                  value={form.totalGranted}
                  onChange={e => setForm({ ...form, totalGranted: e.target.value })}
                  required
                  min="0"
                  max="365"
                  step="0.5"
                  placeholder="e.g., 12 or 6"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Pro-rated for mid-year joiners. Full year = 12.
                </p>
              </div>
              {!isConfirmed && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Probation Allowance *
                  </label>
                  <input
                    type="number"
                    value={form.probationAllowance}
                    onChange={e => setForm({ ...form, probationAllowance: e.target.value })}
                    required
                    min="0"
                    max="365"
                    step="0.5"
                    placeholder="e.g., 1"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Leaves usable during probation. Rest frozen until confirmation.
                  </p>
                </div>
              )}
            </div>

            {/* Joining Month */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Joining Month (FY)
              </label>
              <select
                value={form.joiningMonth}
                onChange={e => setForm({ ...form, joiningMonth: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="">Full Year (April start)</option>
                {fyMonthNames.map((m, i) => (
                  <option key={i} value={i + 1}>{m} (Month {i + 1})</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Month employee joined in this FY. Leaves accrue from this month only.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="e.g., Mid-year joiner, 6-month probation..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none"
              />
            </div>

            {/* Summary */}
            {form.totalGranted && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Grant Summary</p>
                {isConfirmed ? (
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-700">{form.totalGranted}</p>
                    <p className="text-[10px] text-blue-500">Total leaves for FY (all available via monthly bucket)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-blue-700">{form.totalGranted}</p>
                      <p className="text-[10px] text-blue-500">Total for FY</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{form.probationAllowance}</p>
                      <p className="text-[10px] text-amber-500">During Probation</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">
                        {Math.max(parseFloat(form.totalGranted || 0) - parseFloat(form.probationAllowance || 0), 0)}
                      </p>
                      <p className="text-[10px] text-emerald-500">Unlocked After Confirmation</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.leaveTypeId || !form.totalGranted}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Gift className="w-4 h-4" />
                )}
                {submitting ? 'Granting...' : 'Grant Leave'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
