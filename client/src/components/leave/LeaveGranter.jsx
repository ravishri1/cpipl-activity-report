import { useState, useMemo, useRef } from 'react';
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
  Download, Upload, FileSpreadsheet,
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
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');

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
            onClick={handleExport}
            disabled={grants.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-40"
            title="Export grants as CSV"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
            title="Bulk import grants from CSV"
          >
            <Upload className="w-4 h-4" />
            Import
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
            <strong>Bulk import/export:</strong> Export current year data as CSV, or import from CSV.
            CSV format: Employee ID, Leave Type Code, Total Granted, Probation Allowance, Joining Month, Notes.
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
          subtitle={`No leave grants assigned for ${getFYLabel(fyYear)}. Click "Grant Leave" or "Import" to assign.`}
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

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          fyYear={fyYear}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); refetch(); }}
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
          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

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

// ─── Import Modal ────────────────────────────────────────
function ImportModal({ fyYear: defaultFY, onClose, onSuccess }) {
  const [importYear, setImportYear] = useState(defaultFY);
  const [csvData, setCsvData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const parseCSV = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parse (handles quoted fields)
      const vals = [];
      let current = '';
      let inQuotes = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      vals.push(current.trim());

      const row = {};
      headers.forEach((h, idx) => {
        // Map common header names to our API field names
        const key = mapHeader(h);
        if (key) row[key] = vals[idx] || '';
      });
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return rows;
  };

  const mapHeader = (h) => {
    const lower = h.toLowerCase().replace(/[\s_-]+/g, '');
    if (['employeeid', 'empid', 'id'].includes(lower)) return 'employeeId';
    if (['name', 'employeename', 'empname'].includes(lower)) return 'name';
    if (['leavetype', 'leavetypecode', 'type', 'code'].includes(lower)) return 'leaveType';
    if (['totalgranted', 'total', 'granted', 'leaves'].includes(lower)) return 'totalGranted';
    if (['probationallowance', 'probation', 'allowance'].includes(lower)) return 'probationAllowance';
    if (['joiningmonth', 'month', 'joinmonth'].includes(lower)) return 'joiningMonth';
    if (['notes', 'note', 'remarks'].includes(lower)) return 'notes';
    return null;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length === 0) {
          setError('No valid data rows found in CSV. Check format.');
          setCsvData(null);
        } else {
          setCsvData(rows);
        }
      } catch {
        setError('Failed to parse CSV file.');
        setCsvData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData || csvData.length === 0) return;
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/leave/admin/grants/bulk-import', {
        rows: csvData,
        fyYear: importYear,
      });
      setResult(res.data);
      // Always trigger refetch after import completes (even if some rows failed)
      if (res.data.success > 0) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'Employee ID,Leave Type Code,Total Granted,Probation Allowance,Joining Month,Notes\nCOLOR001,PL,12,,,"Full year employee"\nCOLOR002,PL,7,1,6,"Mid-year joiner, Sept start"';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Leave_Grant_Template_${getFYLabel(importYear).replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Bulk Import Grants
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Upload a CSV file to assign grants in bulk</p>
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

          {/* FY Year selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Import for Financial Year *</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
                <button onClick={() => setImportYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100">
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-sm font-semibold text-slate-700 px-3 min-w-[100px] text-center">
                  {getFYLabel(importYear)}
                </span>
                <button
                  onClick={() => setImportYear(y => y + 1)}
                  disabled={importYear >= getCurrentFY() + 1}
                  className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Template download */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <p>CSV must have headers: <strong>Employee ID, Leave Type Code, Total Granted</strong> (required).</p>
              <p className="mt-0.5">Optional columns: Probation Allowance, Joining Month (1-12), Notes.</p>
              <p className="mt-0.5">If employee already has a grant for this leave type + year, it will be <strong>updated</strong>.</p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-1.5 inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Download template CSV
              </button>
            </div>
          </div>

          {/* File upload */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-6 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            >
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-500">
                {fileName ? fileName : 'Click to upload CSV file'}
              </span>
            </button>
          </div>

          {/* Preview */}
          {csvData && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Preview: {csvData.length} row{csvData.length !== 1 ? 's' : ''} found
              </p>
              <div className="max-h-40 overflow-y-auto text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-1">#</th>
                      <th className="px-2 py-1">Emp ID</th>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Total</th>
                      <th className="px-2 py-1">Prob.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvData.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1 font-medium">{r.employeeId || r.name || '-'}</td>
                        <td className="px-2 py-1">{r.leaveType || '-'}</td>
                        <td className="px-2 py-1 font-bold">{r.totalGranted || '-'}</td>
                        <td className="px-2 py-1">{r.probationAllowance || '-'}</td>
                      </tr>
                    ))}
                    {csvData.length > 10 && (
                      <tr><td colSpan={5} className="px-2 py-1 text-slate-400 text-center">...and {csvData.length - 10} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className={`rounded-lg border px-3 py-2.5 text-sm ${result.success > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="font-semibold text-slate-800">
                Import complete: {result.success} success, {result.skipped} skipped
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
          )}
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing || !csvData}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing ? `Importing ${csvData?.length || 0} rows...` : `Import ${csvData?.length || 0} Grants`}
            </button>
          )}
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
