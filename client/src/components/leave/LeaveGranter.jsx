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
  CheckCircle2, AlertTriangle, Search, X, Info, Pencil, Lock, Unlock,
  Download, Upload, UserCheck, UserX, RotateCcw,
} from 'lucide-react';

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

const fyMonthNames = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

export default function LeaveGranter() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [showModal, setShowModal] = useState(false);
  const [editGrant, setEditGrant] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState('');
  const [showRollover, setShowRollover] = useState(false);
  const [rolloverPreview, setRolloverPreview] = useState(null);
  const [rolloverLoading, setRolloverLoading] = useState(false);

  const { data: grants, loading, error: fetchErr, refetch } = useFetch(
    `/leave/admin/grants?year=${fyYear}`, [], [fyYear]
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

  const handleDelete = async (g) => {
    if (g.isLocked) return alert('This grant is locked for payroll. Unlock it first.');
    if (!window.confirm('Remove this leave grant? Balance will reset to default.')) return;
    try {
      await execute(() => api.delete(`/leave/admin/grants/${g.id}`), 'Grant removed');
      refetch();
    } catch {}
  };

  const handleToggleLock = async (g) => {
    if (!window.confirm(`${g.isLocked ? 'Unlock' : 'Lock'} this grant for payroll?`)) return;
    try {
      await execute(() => api.put(`/leave/admin/grants/${g.id}/lock`), `Grant ${g.isLocked ? 'unlocked' : 'locked'} for payroll`);
      refetch();
    } catch {}
  };

  const handleEditSave = async (grantId, payload) => {
    try {
      await execute(() => api.put(`/leave/admin/grants/${grantId}`, payload), 'Grant updated successfully');
      setEditGrant(null);
      refetch();
    } catch {}
  };

  // ─── FY Rollover ──────────────────────────────────
  const handleRolloverPreview = async () => {
    setRolloverLoading(true);
    try {
      const res = await api.get(`/leave/admin/fy-rollover-preview?year=${fyYear}`);
      setRolloverPreview(res.data);
      setShowRollover(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to load rollover preview');
    } finally {
      setRolloverLoading(false);
    }
  };

  const handleRolloverExecute = async () => {
    if (!window.confirm(`Execute FY rollover for ${getFYLabel(fyYear)}? This will carry forward balances to ${getFYLabel(fyYear + 1)}.`)) return;
    try {
      await execute(() => api.post('/leave/admin/fy-rollover', { year: fyYear }), 'FY rollover completed successfully!');
      setShowRollover(false);
      setRolloverPreview(null);
      refetch();
    } catch {}
  };

  // ─── Export CSV ──────────────────────────────────
  const handleExport = () => {
    if (grants.length === 0) return alert('No grants to export for this year.');
    const headers = ['Employee ID','Employee Name','Department','Leave Type Code','Leave Type Name','Total Granted','Probation Allowance','Joining Month','Notes','Status','FY Year'];
    const rows = grants.map(g => [
      g.user.employeeId || '',
      g.user.name,
      g.user.department || '',
      g.leaveType.code,
      g.leaveType.name,
      g.totalGranted,
      g.probationAllowance || 0,
      g.joiningMonth || '',
      (g.notes || '').replace(/"/g, '""'),
      g.isLocked ? 'Locked' : 'Open',
      fyYear,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Leave_Grants_${getFYLabel(fyYear).replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={handleRolloverPreview}
            disabled={rolloverLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-40"
            title="Carry forward unused leaves to next FY"
          >
            <RotateCcw className={`w-4 h-4 ${rolloverLoading ? 'animate-spin' : ''}`} />
            FY Rollover
          </button>
          <button
            onClick={handleExport}
            disabled={grants.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
            title="Export grants as CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm"
            title="Bulk grant leave to all employees"
          >
            <Users className="w-4 h-4" />
            Bulk Grant
          </button>
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
            <strong>Lock for payroll:</strong> Lock a grant to prevent accidental edits/deletes.
          </p>
          <p className="mt-1">
            <strong>Bulk Grant:</strong> Assign leave to all employees at once. Confirmed employees get full entitlement, probation employees get limited allowance.
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
          subtitle={`No leave grants assigned for ${getFYLabel(fyYear)}. Click "Bulk Grant" or "Grant Leave" to assign.`}
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
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Joining Month</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Notes</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Status</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userGrants.map(g => (
                    <tr key={g.id} className={`hover:bg-slate-50 ${g.isLocked ? 'bg-green-50/30' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                          {g.leaveType.code}
                        </span>
                        <span className="ml-1.5 text-slate-600">{g.leaveType.name}</span>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-800">{g.totalGranted}</td>
                      <td className="px-4 py-2.5">
                        {g.probationAllowance > 0 ? (
                          <span className="flex items-center gap-1 text-amber-700">
                            <Shield className="w-3 h-3" />
                            {g.probationAllowance} usable
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {g.joiningMonth ? `${fyMonthNames[g.joiningMonth - 1]} (Month ${g.joiningMonth})` : 'Full Year'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[150px] truncate" title={g.notes || ''}>{g.notes || '-'}</td>
                      <td className="px-4 py-2.5">
                        {g.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-full">
                            <Unlock className="w-3 h-3" /> Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditGrant(g)}
                            disabled={saving || g.isLocked}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={g.isLocked ? 'Unlock to edit' : 'Edit grant'}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleLock(g)}
                            disabled={saving}
                            className={`p-1.5 rounded-lg disabled:opacity-50 ${
                              g.isLocked
                                ? 'hover:bg-amber-50 text-amber-500 hover:text-amber-700'
                                : 'hover:bg-green-50 text-green-500 hover:text-green-700'
                            }`}
                            title={g.isLocked ? 'Unlock for editing' : 'Lock for payroll'}
                          >
                            {g.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            disabled={saving || g.isLocked}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={g.isLocked ? 'Unlock to delete' : 'Remove grant'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* FY Rollover Modal */}
      {showRollover && rolloverPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  FY Rollover — {getFYLabel(fyYear)} → {getFYLabel(fyYear + 1)}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">Carry forward unused leaves to next financial year</p>
              </div>
              <button onClick={() => { setShowRollover(false); setRolloverPreview(null); }} className="p-1 hover:bg-slate-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b bg-slate-50">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{rolloverPreview.stats.totalEmployees}</div>
                <div className="text-xs text-slate-500">Employees</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{rolloverPreview.stats.totalCarry}</div>
                <div className="text-xs text-slate-500">Days Carry Forward</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{rolloverPreview.stats.totalLapse}</div>
                <div className="text-xs text-slate-500">Days Will Lapse</div>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-auto max-h-[45vh] px-6 py-3">
              {rolloverPreview.preview.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No employees with unused balances to roll over.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase border-b">
                      <th className="py-2 pr-2">Employee</th>
                      <th className="py-2 pr-2">Leave Type</th>
                      <th className="py-2 pr-2 text-right">Available</th>
                      <th className="py-2 pr-2 text-right">Carry</th>
                      <th className="py-2 text-right">Lapse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolloverPreview.preview.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium">{p.userName} <span className="text-slate-400 text-xs">{p.employeeId}</span></td>
                        <td className="py-2 pr-2">{p.leaveTypeCode}</td>
                        <td className="py-2 pr-2 text-right">{p.currentAvailable}</td>
                        <td className="py-2 pr-2 text-right text-green-600 font-semibold">{p.willCarry}</td>
                        <td className="py-2 text-right text-red-500">{p.willLapse > 0 ? p.willLapse : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <button onClick={() => { setShowRollover(false); setRolloverPreview(null); }}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-100">
                Cancel
              </button>
              <button onClick={handleRolloverExecute} disabled={saving || rolloverPreview.preview.length === 0}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-40">
                {saving ? 'Processing...' : 'Execute Rollover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Modal (new) */}
      {showModal && (
        <GrantModal
          fyYear={fyYear}
          existingGrants={grants}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refetch(); }}
        />
      )}

      {/* Edit Modal */}
      {editGrant && (
        <EditGrantModal
          grant={editGrant}
          fyYear={fyYear}
          saving={saving}
          onClose={() => setEditGrant(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Bulk Grant Modal */}
      {showBulk && (
        <BulkGrantModal
          fyYear={fyYear}
          existingGrants={grants}
          onClose={() => setShowBulk(false)}
          onSuccess={() => { setShowBulk(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Edit Grant Modal ────────────────────────────────────
function EditGrantModal({ grant, fyYear, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    totalGranted: String(grant.totalGranted),
    probationAllowance: String(grant.probationAllowance || ''),
    joiningMonth: grant.joiningMonth ? String(grant.joiningMonth) : '',
    notes: grant.notes || '',
  });

  const isConfirmed = grant.user.confirmationStatus === 'confirmed' || !!grant.user.confirmationDate;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(grant.id, {
      totalGranted: parseFloat(form.totalGranted),
      probationAllowance: isConfirmed ? null : parseFloat(form.probationAllowance || 0),
      joiningMonth: form.joiningMonth ? parseInt(form.joiningMonth) : null,
      notes: form.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Edit Grant — {getFYLabel(fyYear)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {grant.user.name} — {grant.leaveType.code} ({grant.leaveType.name})
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* FY Year badge */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Gift className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Financial Year: {getFYLabel(fyYear)}</span>
          </div>

          {isConfirmed && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-700 font-medium">Confirmed employee — no probation restriction</span>
            </div>
          )}

          {/* Total */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Leaves for FY *</label>
            <input
              type="number"
              value={form.totalGranted}
              onChange={e => setForm({ ...form, totalGranted: e.target.value })}
              required min="0" max="365" step="0.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          {/* Probation Allowance */}
          {!isConfirmed && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Probation Allowance *</label>
              <input
                type="number"
                value={form.probationAllowance}
                onChange={e => setForm({ ...form, probationAllowance: e.target.value })}
                required min="0" max="365" step="0.5"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          )}

          {/* Joining Month */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Joining Month (FY)</label>
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
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.totalGranted}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Grant Modal ────────────────────────────────────
function BulkGrantModal({ fyYear, existingGrants, onClose, onSuccess }) {
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [confirmedTotal, setConfirmedTotal] = useState('12');
  const [probTotal, setProbTotal] = useState('12');
  const [probAllowance, setProbAllowance] = useState('1');
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const { data, loading } = useFetch(`/leave/admin/employees-for-grant?year=${fyYear}`, {});
  const employees = data?.employees || [];
  const leaveTypes = data?.leaveTypes || [];

  // Build set of existing grants for quick lookup
  const existingSet = useMemo(() => {
    const set = new Set();
    for (const g of existingGrants || []) set.add(`${g.userId}-${g.leaveTypeId}`);
    return set;
  }, [existingGrants]);

  // Split employees into confirmed and probation
  const { confirmed, probation } = useMemo(() => {
    const conf = [], prob = [];
    for (const emp of employees) {
      const isConf = emp.confirmationStatus === 'confirmed' || !!emp.confirmationDate;
      if (isConf) conf.push(emp);
      else prob.push(emp);
    }
    return { confirmed: conf, probation: prob };
  }, [employees]);

  // When leave type changes, auto-select employees that don't have a grant yet
  const handleLeaveTypeChange = (ltId) => {
    setLeaveTypeId(ltId);
    setResult(null);
    setError('');
    if (!ltId) { setSelected(new Set()); return; }
    const newSel = new Set();
    for (const emp of employees) {
      if (!existingSet.has(`${emp.id}-${parseInt(ltId)}`)) {
        newSel.add(emp.id);
      }
    }
    setSelected(newSel);
  };

  const toggleEmployee = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group) => {
    const groupIds = group.map(e => e.id);
    const allSelected = groupIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      groupIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleBulkGrant = async () => {
    if (!leaveTypeId || selected.size === 0) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const grants = [];
      for (const emp of employees) {
        if (!selected.has(emp.id)) continue;
        const isConf = emp.confirmationStatus === 'confirmed' || !!emp.confirmationDate;
        const total = isConf ? parseFloat(confirmedTotal) : parseFloat(probTotal);
        // Use pro-rated total if mid-year joiner
        const proRatedTotal = emp.suggestedJoiningMonth ? Math.max(total - (emp.suggestedJoiningMonth - 1), 0) : total;
        grants.push({
          userId: emp.id,
          employeeName: emp.name,
          totalGranted: proRatedTotal,
          probationAllowance: isConf ? null : parseFloat(probAllowance),
          joiningMonth: emp.suggestedJoiningMonth || null,
          notes: isConf ? 'Bulk grant (confirmed)' : `Bulk grant (probation, ${probAllowance} allowed)`,
        });
      }
      const res = await api.post('/leave/admin/grants/bulk', {
        grants,
        fyYear,
        leaveTypeId: parseInt(leaveTypeId),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Bulk grant failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedLT = leaveTypes.find(lt => lt.id === parseInt(leaveTypeId));

  const renderEmployeeRow = (emp, isConf) => {
    const hasGrant = leaveTypeId && existingSet.has(`${emp.id}-${parseInt(leaveTypeId)}`);
    const isChecked = selected.has(emp.id);
    const total = isConf ? parseFloat(confirmedTotal || 12) : parseFloat(probTotal || 12);
    const proRated = emp.suggestedJoiningMonth ? Math.max(total - (emp.suggestedJoiningMonth - 1), 0) : total;

    return (
      <tr key={emp.id} className={`text-xs ${hasGrant ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}>
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={!leaveTypeId || hasGrant}
            onChange={() => toggleEmployee(emp.id)}
            className="rounded border-slate-300 text-blue-600"
          />
        </td>
        <td className="px-3 py-2">
          <p className="font-medium text-slate-800">{emp.name}</p>
          <p className="text-[10px] text-slate-400">{emp.employeeId} · {emp.department}</p>
        </td>
        <td className="px-3 py-2 text-center font-bold text-slate-800">{proRated}</td>
        <td className="px-3 py-2 text-center">
          {!isConf ? (
            <span className="text-amber-700 font-medium">{probAllowance} usable</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-center text-slate-500">
          {emp.suggestedJoiningMonth ? `${fyMonthNames[emp.suggestedJoiningMonth - 1]}` : 'Full Year'}
        </td>
        <td className="px-3 py-2 text-center">
          {hasGrant ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Already Granted</span>
          ) : (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">New</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Bulk Grant Leave — {getFYLabel(fyYear)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign leave to all employees at once. Confirmed = full entitlement, Probation = limited allowance.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Config row */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Leave Type *</label>
              <select
                value={leaveTypeId}
                onChange={e => handleLeaveTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Select leave type</option>
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>{lt.code} — {lt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                <UserCheck className="w-3 h-3 inline mr-1 text-emerald-600" />
                Confirmed Total
              </label>
              <input
                type="number"
                value={confirmedTotal}
                onChange={e => setConfirmedTotal(e.target.value)}
                min="0" max="365" step="0.5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                <UserX className="w-3 h-3 inline mr-1 text-amber-600" />
                Probation Total
              </label>
              <input
                type="number"
                value={probTotal}
                onChange={e => setProbTotal(e.target.value)}
                min="0" max="365" step="0.5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                <Shield className="w-3 h-3 inline mr-1 text-amber-600" />
                Probation Usable
              </label>
              <input
                type="number"
                value={probAllowance}
                onChange={e => setProbAllowance(e.target.value)}
                min="0" max="365" step="0.5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                title="How many days a probation employee can actually use"
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-blue-700">
              <p><strong>Confirmed:</strong> Get <strong>{confirmedTotal || 12}</strong> days (pro-rated for mid-year joiners). No probation restriction.</p>
              <p className="mt-0.5"><strong>Probation:</strong> Get <strong>{probTotal || 12}</strong> days total but only <strong>{probAllowance || 1}</strong> usable until confirmed. Rest stays locked.</p>
              <p className="mt-0.5">Already-granted employees are skipped (shown greyed out). Existing grants can be edited individually.</p>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading employees...</div>
          ) : !leaveTypeId ? (
            <div className="py-8 text-center text-slate-400 text-sm">Select a leave type to see employees</div>
          ) : (
            <>
              {/* Confirmed Employees */}
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-50 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-800">
                      Confirmed Employees ({confirmed.length})
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-emerald-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed.length > 0 && confirmed.every(e => selected.has(e.id) || existingSet.has(`${e.id}-${parseInt(leaveTypeId)}`))}
                      onChange={() => toggleGroup(confirmed.filter(e => !existingSet.has(`${e.id}-${parseInt(leaveTypeId)}`)))}
                      className="rounded border-emerald-400 text-emerald-600"
                    />
                    Select all
                  </label>
                </div>
                {confirmed.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No confirmed employees</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase bg-slate-50/80">
                          <th className="px-3 py-1.5 w-8"></th>
                          <th className="px-3 py-1.5 text-left">Employee</th>
                          <th className="px-3 py-1.5 text-center">Total</th>
                          <th className="px-3 py-1.5 text-center">Prob. Limit</th>
                          <th className="px-3 py-1.5 text-center">Join Month</th>
                          <th className="px-3 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {confirmed.map(emp => renderEmployeeRow(emp, true))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Probation Employees */}
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">
                      Probation Employees ({probation.length})
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={probation.length > 0 && probation.every(e => selected.has(e.id) || existingSet.has(`${e.id}-${parseInt(leaveTypeId)}`))}
                      onChange={() => toggleGroup(probation.filter(e => !existingSet.has(`${e.id}-${parseInt(leaveTypeId)}`)))}
                      className="rounded border-amber-400 text-amber-600"
                    />
                    Select all
                  </label>
                </div>
                {probation.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No probation employees</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase bg-slate-50/80">
                          <th className="px-3 py-1.5 w-8"></th>
                          <th className="px-3 py-1.5 text-left">Employee</th>
                          <th className="px-3 py-1.5 text-center">Total</th>
                          <th className="px-3 py-1.5 text-center">Prob. Limit</th>
                          <th className="px-3 py-1.5 text-center">Join Month</th>
                          <th className="px-3 py-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {probation.map(emp => renderEmployeeRow(emp, false))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg border px-3 py-2.5 text-sm ${result.success > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="font-semibold text-slate-800">
                ✅ Bulk grant complete: {result.success} granted, {result.skipped} skipped
              </p>
              {result.errors?.length > 0 && (
                <ul className="mt-1.5 text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-500">
            {leaveTypeId ? `${selected.size} employee${selected.size !== 1 ? 's' : ''} selected` : 'Select a leave type first'}
          </div>
          <div className="flex items-center gap-2">
            {result ? (
              <button
                type="button"
                onClick={onSuccess}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                Done
              </button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={handleBulkGrant}
                  disabled={submitting || !leaveTypeId || selected.size === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  {submitting ? `Granting...` : `Grant to ${selected.size} Employees`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grant Modal (new grant) ────────────────────────────
function GrantModal({ fyYear, existingGrants, onClose, onSuccess }) {
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

  const existingSet = useMemo(() => {
    const set = new Set();
    for (const g of existingGrants || []) {
      set.add(`${g.userId}-${g.leaveTypeId}`);
    }
    return set;
  }, [existingGrants]);

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

  const selectedLeaveTypeAlreadyGranted = selectedUser && form.leaveTypeId
    ? existingSet.has(`${selectedUser.id}-${parseInt(form.leaveTypeId)}`)
    : false;

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
                  {filtered.map(emp => {
                    const grantedCount = leaveTypes.filter(lt => existingSet.has(`${emp.id}-${lt.id}`)).length;
                    const allGranted = grantedCount === leaveTypes.length && leaveTypes.length > 0;
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleSelectUser(emp)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                          allGranted ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">{emp.name}</p>
                          <p className="text-xs text-slate-400">
                            {emp.employeeId} · {emp.department}
                            {emp.dateOfJoining && ` · Joined ${formatDate(emp.dateOfJoining)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {grantedCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              allGranted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {allGranted ? 'All assigned' : `${grantedCount}/${leaveTypes.length} assigned`}
                            </span>
                          )}
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
                    );
                  })}
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
                {leaveTypes.map(lt => {
                  const alreadyGranted = existingSet.has(`${selectedUser.id}-${lt.id}`);
                  return (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.code})
                      {alreadyGranted ? ' — Already assigned' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Already assigned warning */}
            {selectedLeaveTypeAlreadyGranted && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  <p><strong>Already assigned!</strong> This leave type is already granted to {selectedUser.name} for {getFYLabel(fyYear)}.</p>
                  <p className="mt-0.5">Submitting will <strong>update</strong> the existing grant with the new values below.</p>
                </div>
              </div>
            )}

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
                  required min="0" max="365" step="0.5"
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
                    required min="0" max="365" step="0.5"
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
                {submitting ? 'Granting...' : selectedLeaveTypeAlreadyGranted ? 'Update Grant' : 'Grant Leave'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
