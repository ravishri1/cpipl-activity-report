import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  UserCheck, Clock, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  X, Loader2, Calendar, History, User, Search,
} from 'lucide-react';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import { CONFIRMATION_STATUS_STYLES } from '../../utils/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function DueBadge({ dateStr }) {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
      {Math.abs(days)}d overdue
    </span>;
  if (days === 0)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium animate-pulse">Due today</span>;
  if (days <= 7)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Due in {days}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{days}d left</span>;
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────
function ExtendModal({ employee, onClose, onDone }) {
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (!newDueDate) { setError('Please select a new due date.'); return; }
    if (!reason.trim()) { setError('Please provide a reason for extension.'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/confirmation/${employee.id}/extend`, { newDueDate, reason });
      onDone('Confirmation due date extended successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to extend confirmation.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Extend Confirmation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
            <p className="font-medium text-slate-800">{employee.name}</p>
            <p className="text-xs mt-0.5">Current due date: <strong>{employee.confirmationDate || 'N/A'}</strong></p>
          </div>
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Due Date <span className="text-red-500">*</span>
            </label>
            <input type="date" min={minDateStr}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Reason for extending the confirmation period..."
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg
                       hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Extend Confirmation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ employee, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/confirmation/${employee.id}/confirm`);
      onDone('Employee confirmed! Benefits unlocked and insurance card created.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to confirm employee.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Confirm Employment</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Confirming: {employee.name}</p>
                <p className="text-xs text-green-700 mt-1">
                  This will permanently confirm this employee. The following actions will be taken:
                </p>
                <ul className="text-xs text-green-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Employee status set to <strong>confirmed</strong></li>
                  <li>Benefits unlocked (<code>benefitsUnlocked = true</code>)</li>
                  <li>Confirmation letter sent by email</li>
                  <li>Insurance card placeholder created</li>
                  <li>Admin team notified to complete insurance setup</li>
                </ul>
              </div>
            </div>
          </div>
          {error && <AlertMessage type="error" message={error} />}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg
                       hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <CheckCircle2 className="w-4 h-4" />
            Confirm Employee
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Drawer ───────────────────────────────────────────────────────────
function HistoryDrawer({ employee, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/confirmation/${employee.id}/history`)
      .then(res => setHistory(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load history.'))
      .finally(() => setLoading(false));
  }, [employee.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-black/40 flex-1" onClick={onClose} />
      <div className="bg-white w-full max-w-md h-full overflow-y-auto flex flex-col shadow-2xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" /> Extension History
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{employee.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>
        <div className="p-6 flex-1">
          {loading && <LoadingSpinner />}
          {error && <AlertMessage type="error" message={error} />}
          {!loading && !error && history.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No extensions recorded.</p>
            </div>
          )}
          {!loading && history.length > 0 && (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-6">
                {history.map((ext, idx) => (
                  <div key={ext.id} className="relative pl-10">
                    <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-sm" />
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-amber-800">
                          Extension #{history.length - idx}
                        </p>
                        <span className="text-xs text-slate-400 shrink-0">
                          {new Date(ext.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-amber-700 space-y-1">
                        <p><span className="text-slate-500">Previous due:</span> <strong>{ext.previousDueDate}</strong></p>
                        <p><span className="text-slate-500">New due:</span> <strong>{ext.newDueDate}</strong></p>
                        {ext.reason && <p><span className="text-slate-500">Reason:</span> {ext.reason}</p>}
                        {ext.extender && <p><span className="text-slate-500">Extended by:</span> {ext.extender.name}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Employee Row ─────────────────────────────────────────────────────────────
function EmployeeRow({ emp, onExtend, onConfirm, onHistory }) {
  const days = daysUntil(emp.confirmationDate);
  const isOverdue = days !== null && days < 0;
  const isDueToday = days === 0;
  const isDueSoon = days !== null && days > 0 && days <= 7;

  return (
    <tr className={`border-b border-slate-100 transition-colors
      ${isOverdue ? 'bg-red-50 hover:bg-red-100' :
        isDueToday ? 'bg-amber-50 hover:bg-amber-100' :
        isDueSoon ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50'}`}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{emp.name}</p>
            <p className="text-xs text-slate-400">{emp.employeeId} · {emp.designation || 'N/A'}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">
        {emp.department || '—'}
      </td>
      <td className="px-5 py-4">
        <div className="text-sm text-slate-700">{emp.confirmationDate || '—'}</div>
        <DueBadge dateStr={emp.confirmationDate} />
      </td>
      <td className="px-5 py-4">
        {emp.confirmationStatus && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
            ${CONFIRMATION_STATUS_STYLES[emp.confirmationStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {emp.confirmationStatus}
          </span>
        )}
      </td>
      <td className="px-5 py-4">
        <p className="text-xs text-slate-600">{emp.reportingManager?.name || '—'}</p>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onHistory(emp)}
            title="View extension history"
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
            <History className="w-4 h-4" />
          </button>
          <button onClick={() => onExtend(emp)}
            title="Extend confirmation period"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700
                       hover:bg-amber-200 transition-colors">
            Extend
          </button>
          <button onClick={() => onConfirm(emp)}
            title="Confirm employee"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700
                       hover:bg-green-200 transition-colors flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main ConfirmationManager ─────────────────────────────────────────────────
export default function ConfirmationManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals/drawers
  const [extendTarget, setExtendTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/confirmation/due');
      setEmployees(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load confirmation data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleDone = (msg) => {
    setExtendTarget(null);
    setConfirmTarget(null);
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
    fetchEmployees();
  };

  // Derived / filtered list
  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.employeeId || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.confirmationStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const overdue = employees.filter(e => daysUntil(e.confirmationDate) < 0).length;
  const dueToday = employees.filter(e => daysUntil(e.confirmationDate) === 0).length;
  const dueSoon = employees.filter(e => { const d = daysUntil(e.confirmationDate); return d > 0 && d <= 7; }).length;

  return (
    <div className="h-full flex flex-col">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Confirmation Workflow</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage 6-month employment confirmations for internal employees
              </p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by name or ID..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-blue-500 bg-white"
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="extended">Extended</option>
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <AlertMessage type="error" message={error} />}
        {success && <AlertMessage type="success" message={success} />}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Pending', value: employees.length, icon: Clock, color: 'blue' },
            { label: 'Overdue', value: overdue, icon: AlertTriangle, color: 'red' },
            { label: 'Due Today', value: dueToday, icon: Calendar, color: 'amber' },
            { label: 'Due This Week', value: dueSoon, icon: ChevronRight, color: 'yellow' },
          ].map(stat => (
            <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-100
                rounded-xl p-4 flex items-center gap-3`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600 shrink-0`} />
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className={`text-xl font-bold text-${stat.color}-700`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <UserCheck className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-500">
              {employees.length === 0 ? 'No confirmations pending' : 'No matches found'}
            </p>
            <p className="text-sm mt-1">
              {employees.length === 0
                ? 'All internal employees are confirmed or have future confirmation dates.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {overdue > 0 && (
              <div className="flex items-center gap-2 px-5 py-2.5 bg-red-50 border-b border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">
                  {overdue} employee{overdue > 1 ? 's are' : ' is'} overdue for confirmation — action required.
                </p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Employee', 'Department', 'Due Date', 'Status', 'Reporting Manager', 'Actions'].map(h => (
                      <th key={h}
                        className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide
                          ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <EmployeeRow
                      key={emp.id}
                      emp={emp}
                      onExtend={setExtendTarget}
                      onConfirm={setConfirmTarget}
                      onHistory={setHistoryTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-500">
                Showing {filtered.length} of {employees.length} employee{employees.length !== 1 ? 's' : ''} pending confirmation
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals / Drawers ── */}
      {extendTarget && (
        <ExtendModal
          employee={extendTarget}
          onClose={() => setExtendTarget(null)}
          onDone={handleDone}
        />
      )}
      {confirmTarget && (
        <ConfirmModal
          employee={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={handleDone}
        />
      )}
      {historyTarget && (
        <HistoryDrawer
          employee={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
