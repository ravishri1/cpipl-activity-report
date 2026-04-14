import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

const STATUS_META = {
  pending_manager: { label: 'Pending Manager', color: 'bg-yellow-100 text-yellow-800' },
  pending_hr:      { label: 'Pending HR',       color: 'bg-blue-100 text-blue-800' },
  notice_period:   { label: 'Notice Period',    color: 'bg-orange-100 text-orange-800' },
  clearance:       { label: 'Clearance',        color: 'bg-purple-100 text-purple-800' },
  fnf_pending:     { label: 'FnF Pending',      color: 'bg-pink-100 text-pink-800' },
  fnf_approved:    { label: 'FnF Approved',     color: 'bg-teal-100 text-teal-800' },
  completed:       { label: 'Completed',        color: 'bg-green-100 text-green-800' },
  rejected:        { label: 'Rejected',         color: 'bg-red-100 text-red-800' },
  cancelled:       { label: 'Withdrawn',        color: 'bg-gray-100 text-gray-600' },
};

const PIPELINE_COLS = [
  { key: 'pending_manager', label: 'Awaiting Manager', icon: '👤' },
  { key: 'pending_hr',      label: 'Awaiting HR',      icon: '🏢' },
  { key: 'notice_period',   label: 'Notice Period',    icon: '📅' },
  { key: 'clearance',       label: 'Clearance',        icon: '✅' },
  { key: 'fnf_pending',     label: 'FnF Pending',      icon: '💰' },
  { key: 'fnf_approved',    label: 'FnF Approved',     icon: '✔️' },
  { key: 'completed',       label: 'Completed',        icon: '🎓' },
];

const ACTIVE_STATUSES = ['pending_manager', 'pending_hr', 'notice_period', 'clearance', 'fnf_pending', 'fnf_approved'];

// Historical separation records — one-time import
const HISTORICAL_SEPARATIONS = [
  { employeeName: 'Vishal gharte',                    separationDate: '2025-04-25', settlementDate: '2025-08-28', resignationDate: '2025-04-23' },
  { employeeName: 'Divyash Chandegra',                separationDate: '2025-07-31', settlementDate: '2025-08-31', resignationDate: '2025-07-01' },
  { employeeName: 'Suraj Hate',                       separationDate: '2025-05-09', settlementDate: '2025-06-30', resignationDate: '2025-04-10' },
  { employeeName: 'Sameer Bhandvilkar',               separationDate: '2025-06-14', settlementDate: '2025-08-07', resignationDate: '2025-05-01' },
  { employeeName: 'Yashshree Kotian',                 separationDate: '2025-06-26', settlementDate: '2025-08-31', resignationDate: '2025-05-20' },
  { employeeName: 'Shubham Arya',                     separationDate: '2025-06-19', settlementDate: '2025-08-07', resignationDate: '2025-06-06' },
  { employeeName: 'Anil Gautam',                      separationDate: '2025-07-31', settlementDate: '2025-07-31', resignationDate: '2025-07-31' },
  { employeeName: 'Rahul Dixit',                      separationDate: '2025-07-31', settlementDate: '2025-07-31', resignationDate: '2025-07-31' },
  { employeeName: 'Anil Kumar',                       separationDate: '2025-07-31', settlementDate: '2025-07-31', resignationDate: '2025-07-31' },
  { employeeName: 'Pankaj kumar',                     separationDate: '2025-10-25', settlementDate: '2025-12-11', resignationDate: '2025-07-28' },
  { employeeName: 'Badal mishra',                     separationDate: '2025-07-14', settlementDate: '2025-08-31', resignationDate: '2025-05-16' },
  { employeeName: 'Pritesh Varose',                   separationDate: '2025-07-14', settlementDate: '2025-07-31', resignationDate: '2025-06-16' },
  { employeeName: 'Mansi Thummar',                    separationDate: '2025-07-31', settlementDate: '2025-08-11', resignationDate: '2025-07-18' },
  { employeeName: 'Viraj Savner',                     separationDate: '2025-07-25', settlementDate: '2025-08-11', resignationDate: '2025-06-24' },
  { employeeName: 'Samiksha Dhuri',                   separationDate: '2025-07-21', settlementDate: '2025-08-11', resignationDate: '2025-06-21' },
  { employeeName: 'Shikha Shukla',                    separationDate: '2025-07-21', settlementDate: '2025-08-11', resignationDate: '2025-06-23' },
  { employeeName: 'Kaustubh Gaikwad',                 separationDate: '2025-07-31', settlementDate: '2025-08-11', resignationDate: '2025-07-03' },
  { employeeName: 'Daniel Sunil Das Kuzhivila',       separationDate: '2025-07-15', settlementDate: '2025-08-11', resignationDate: '2025-07-09' },
  { employeeName: 'Aashutosh Shailendra Patil',       separationDate: '2025-07-23', settlementDate: '2025-08-11', resignationDate: '2025-06-23' },
  { employeeName: 'Nikhil Thorat',                    separationDate: '2025-06-30', settlementDate: '2025-08-31', resignationDate: '2025-05-05' },
  { employeeName: 'Rajendra Ghuge',                   separationDate: '2025-08-30', settlementDate: null,         resignationDate: '2025-08-14' },
  { employeeName: 'Rajan Saroj',                      separationDate: '2025-08-08', settlementDate: '2025-10-31', resignationDate: '2025-07-08' },
  { employeeName: 'Abhishek Yadav',                   separationDate: '2025-08-08', settlementDate: '2025-09-10', resignationDate: '2025-07-08' },
  { employeeName: 'Prashant Kumar Vishwakarma',       separationDate: '2025-08-08', settlementDate: '2025-09-10', resignationDate: '2025-07-10' },
  { employeeName: 'Pratik Singh',                     separationDate: '2025-09-09', settlementDate: '2025-11-08', resignationDate: '2025-08-22' },
  { employeeName: 'Pradnya Vaidya',                   separationDate: '2025-10-31', settlementDate: null,         resignationDate: '2025-09-08' },
  { employeeName: 'Lavita Fernandes',                 separationDate: '2025-10-18', settlementDate: null,         resignationDate: '2025-10-14' },
  { employeeName: 'Sagar Stavarmath',                 separationDate: '2025-10-10', settlementDate: '2025-11-28', resignationDate: '2025-09-08' },
  { employeeName: 'Suraj Parab',                      separationDate: '2025-11-11', settlementDate: '2025-12-29', resignationDate: '2025-09-11' },
  { employeeName: 'Swapnil Parab',                    separationDate: '2025-12-31', settlementDate: '2026-02-19', resignationDate: '2025-11-18' },
  { employeeName: 'Abhilasha Jaiswal',                separationDate: '2025-12-29', settlementDate: '2026-02-13', resignationDate: '2025-10-29' },
  { employeeName: 'Rupali Sharma',                    separationDate: '2025-12-11', settlementDate: null,         resignationDate: 'Absconded' },
  { employeeName: 'Abhishek Sawant',                  separationDate: '2026-01-07', settlementDate: '2026-02-24', resignationDate: '2025-10-04' },
  { employeeName: 'Ajeet Yadav',                      separationDate: '2026-01-17', settlementDate: null,         resignationDate: 'Terminated' },
  { employeeName: 'Shailesh Naik',                    separationDate: '2026-03-31', settlementDate: null,         resignationDate: '2026-01-10' },
];

// ── helper: add calendar days to YYYY-MM-DD ──────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dayOfMonth(dateStr) {
  return dateStr ? new Date(dateStr).getDate() : null;
}
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SeparationManager() {
  const navigate = useNavigate();
  const [view, setView] = useState('pipeline');
  const [filter, setFilter] = useState('active');
  const [showInitiateForm, setShowInitiateForm] = useState(false);
  const [formStep, setFormStep] = useState('basic'); // 'basic' | 'lwd_review'
  const [lwdChoice, setLwdChoice] = useState(null);  // null | 'confirm' | 'override'
  const [settlementOverride, setSettlementOverride] = useState('');
  const [form, setForm] = useState({ userId: '', type: 'resignation', requestDate: new Date().toISOString().slice(0, 10), lastWorkingDate: '', reason: '' });

  const { data: separations, loading, error: fetchErr, refetch } = useFetch('/separation', []);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  // Derived: selected employee + auto-calculated LWD
  const selectedUser = users.find(u => String(u.id) === String(form.userId));
  const noticeDays = selectedUser?.noticePeriodDays || 30;
  const autoLWD = form.requestDate ? addDaysStr(form.requestDate, noticeDays) : '';
  const effectiveLWD = lwdChoice === 'override' ? (form.lastWorkingDate || '') : (lwdChoice === 'confirm' ? autoLWD : '');
  // Settlement/hold date: HR override if set, else estimated LWD + 45 days
  const salaryHoldUntilCalc = autoLWD ? addDaysStr(autoLWD, 45) : '';
  const salaryHoldUntil = settlementOverride || salaryHoldUntilCalc;
  const lastMonthDays = effectiveLWD ? dayOfMonth(effectiveLWD) : null;

  const filtered = filter === 'active'
    ? separations.filter(s => ACTIVE_STATUSES.includes(s.status))
    : filter === 'completed'
    ? separations.filter(s => s.status === 'completed')
    : separations;

  const openInitiateForm = async () => {
    setShowInitiateForm(true);
    setFormStep('basic');
    setLwdChoice(null);
    if (users.length === 0) {
      setUsersLoading(true);
      try {
        const res = await api.get('/users?fields=id,name,employeeId,department,employmentStatus,isActive,noticePeriodDays');
        setUsers(res.data || []);
      } catch {
        // ignore — dropdown will be empty
      } finally {
        setUsersLoading(false);
      }
    }
  };

  const closeInitiateForm = () => {
    setShowInitiateForm(false);
    setFormStep('basic');
    setLwdChoice(null);
    setSettlementOverride('');
    setForm({ userId: '', type: 'resignation', requestDate: new Date().toISOString().slice(0, 10), lastWorkingDate: '', reason: '' });
  };

  const handleNextToLWD = () => {
    if (!form.userId || !form.requestDate) return;
    setLwdChoice(null);
    // Pre-fill settlement date with auto-calculated value so HR sees it and can change
    setSettlementOverride(autoLWD ? addDaysStr(autoLWD, 45) : '');
    setFormStep('lwd_review');
  };

  const handleInitiate = async () => {
    if (!form.userId || !effectiveLWD) return;
    const payload = {
      userId: parseInt(form.userId),
      type: form.type,
      requestDate: form.requestDate,
      reason: form.reason,
      lastWorkingDate: effectiveLWD,
      noticePeriodDays: noticeDays,
      ...(settlementOverride ? { salaryHoldUntil: settlementOverride } : {}),
    };
    try {
      await execute(() => api.post('/separation', payload), 'Separation initiated.');
      refetch();
      closeInitiateForm();
    } catch {}
  };

  const byStatus = (status) => filtered.filter(s => s.status === status);
  const today = new Date().toISOString().slice(0, 10);

  const handleImport = async (records) => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await api.post('/separation/bulk-import', { records });
      setImportResult(res.data);
      refetch();
    } catch (err) {
      setImportResult({ message: err.response?.data?.error || 'Import failed', errors: [] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Separation Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage employee resignations and exit process</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(v => v === 'pipeline' ? 'list' : 'pipeline')}
            className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            {view === 'pipeline' ? '📋 List View' : '🗂 Pipeline View'}
          </button>
          <button
            onClick={() => {
              if (!window.confirm('Import 35 historical separation records? Existing records will be skipped.')) return;
              handleImport(HISTORICAL_SEPARATIONS);
            }}
            disabled={importing}
            className="border border-blue-300 text-blue-700 px-3 py-2 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50">
            {importing ? 'Importing…' : '⬆ Import History'}
          </button>
          <button onClick={openInitiateForm}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
            + Initiate Separation
          </button>
        </div>
      </div>

      {/* Thin loading bar */}
      {loading && <div className="h-1 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 animate-pulse w-2/3" /></div>}

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}
      {importResult && (
        <div className={`rounded-lg px-4 py-3 text-sm border ${importResult.errors?.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          <strong>{importResult.message}</strong>
          {importResult.errors?.length > 0 && (
            <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
              {importResult.errors.map((e, i) => <li key={i}>{e.name}: {e.error}</li>)}
            </ul>
          )}
          <button onClick={() => setImportResult(null)} className="ml-4 text-xs underline opacity-70">Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active', count: separations.filter(s => ACTIVE_STATUSES.includes(s.status)).length, color: 'text-blue-600' },
          { label: 'In Notice Period', count: separations.filter(s => s.status === 'notice_period').length, color: 'text-orange-600' },
          { label: 'Pending FnF', count: separations.filter(s => ['fnf_pending', 'clearance'].includes(s.status)).length, color: 'text-pink-600' },
          { label: 'Salary On Hold', count: separations.filter(s => !s.salaryReleased && s.salaryHoldUntil && today >= s.salaryHoldUntil).length, color: 'text-amber-600', alert: true },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border p-4 ${s.alert && s.count > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{loading ? '—' : s.count}</p>
            {s.alert && s.count > 0 && <p className="text-xs text-amber-600 mt-1">⏰ Ready to release</p>}
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${filter === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Initiate Form — multi-step */}
      {showInitiateForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {['Basic Details', 'Confirm LWD', 'Submit'].map((label, i) => {
              const stepIdx = formStep === 'basic' ? 0 : 1;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${active ? 'font-semibold text-gray-800' : done ? 'text-green-700' : 'text-gray-400'}`}>{label}</span>
                  {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Basic Details ─────────────────────────────────────── */}
          {formStep === 'basic' && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Step 1 — Basic Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.userId}
                    onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} disabled={usersLoading}>
                    <option value="">{usersLoading ? 'Loading employees...' : 'Select employee...'}</option>
                    {users.filter(u => u.employmentStatus === 'active' || u.isActive).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.employeeId || 'No ID'}) — {u.department}</option>
                    ))}
                  </select>
                  {selectedUser && (
                    <p className="text-xs text-gray-500 mt-1">Notice period: <strong>{noticeDays} days</strong></p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="resignation">Resignation</option>
                    <option value="retirement">Retirement</option>
                    <option value="termination">Termination</option>
                    <option value="absconding">Absconding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.type === 'resignation' ? 'Resignation Date' : 'Separation Date'} *
                  </label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.requestDate} onChange={e => setForm(f => ({ ...f, requestDate: e.target.value }))} />
                  {form.requestDate && selectedUser && (
                    <p className="text-xs text-blue-600 mt-1">
                      Auto LWD = {fmt(autoLWD)} ({noticeDays} days notice)
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2}
                    value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleNextToLWD} disabled={!form.userId || !form.requestDate}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  Next: Review Last Working Date →
                </button>
                <button onClick={closeInitiateForm} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </>
          )}

          {/* ── STEP 2: LWD Review & Confirm ─────────────────────────────── */}
          {formStep === 'lwd_review' && (
            <>
              <h2 className="text-base font-semibold text-gray-800">Step 2 — Confirm Last Working Date</h2>

              {/* Employee summary */}
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 flex flex-wrap gap-5">
                <span><strong>Employee:</strong> {selectedUser?.name} ({selectedUser?.employeeId})</span>
                <span><strong>Type:</strong> <span className="capitalize">{form.type}</span></span>
                <span><strong>{form.type === 'resignation' ? 'Resigned' : 'Separation'} on:</strong> {fmt(form.requestDate)}</span>
                <span><strong>Notice:</strong> {noticeDays} days</span>
              </div>

              {/* Auto-calculated LWD box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-1">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">System Calculated Last Working Date</p>
                <p className="text-2xl font-bold text-blue-800">{fmt(autoLWD)}</p>
                <p className="text-xs text-blue-500">{form.requestDate} + {noticeDays} days notice = {autoLWD}</p>
              </div>

              {/* LWD Confirmation question */}
              {lwdChoice === null && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Is <strong>{fmt(autoLWD)}</strong> the final Last Working Date?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setLwdChoice('confirm')}
                      className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                      ✅ Yes, {fmt(autoLWD)} is final
                    </button>
                    <button onClick={() => { setLwdChoice('override'); setForm(f => ({ ...f, lastWorkingDate: '' })); }}
                      className="bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">
                      ✏️ No, set a different date
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmed with auto LWD */}
              {lwdChoice === 'confirm' && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 space-y-3">
                  <p className="text-sm font-semibold text-green-800">✅ LWD Confirmed: {fmt(autoLWD)}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
                    <div><p className="text-xs text-gray-400">Last Working Date</p><p className="font-semibold">{fmt(autoLWD)}</p></div>
                    <div>
                      <p className="text-xs text-gray-400">Settlement Date (hold until)</p>
                      <p className="font-semibold text-amber-700">{fmt(salaryHoldUntil)}</p>
                      <p className="text-xs text-gray-400">Est. LWD + 45 days</p>
                    </div>
                    <div><p className="text-xs text-gray-400">Final Month Days Worked</p><p className="font-semibold">{lastMonthDays} days</p></div>
                  </div>
                  <div className="flex items-center gap-3 pt-1 border-t border-green-200 flex-wrap">
                    <label className="text-xs text-green-800 font-medium whitespace-nowrap">Settlement (hold until) date:</label>
                    <input type="date" className="border border-green-300 rounded px-2 py-1 text-sm"
                      value={settlementOverride}
                      onChange={e => setSettlementOverride(e.target.value)} />
                    <span className="text-xs text-green-600">
                      {settlementOverride !== salaryHoldUntilCalc ? 'Modified by HR' : 'Auto: Est. LWD + 45 days'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">FnF formula: Gross ÷ 30 × {lastMonthDays} days = last month salary</p>
                  <button onClick={() => setLwdChoice(null)} className="text-xs text-gray-500 underline">Change answer</button>
                </div>
              )}

              {/* Override with custom LWD */}
              {lwdChoice === 'override' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">✏️ Enter the agreed Last Working Date</p>
                    <p className="text-xs text-amber-700">This date was agreed between HR and the employee. The system will treat it as the official LWD — no notice recovery penalty will be applied.</p>
                    <div className="flex items-center gap-3">
                      <input type="date" className="border border-amber-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400"
                        value={form.lastWorkingDate}
                        onChange={e => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))} />
                      {form.lastWorkingDate && (
                        <span className="text-sm font-medium text-gray-700">{fmt(form.lastWorkingDate)}</span>
                      )}
                    </div>
                  </div>

                  {form.lastWorkingDate && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 space-y-3">
                      <p className="text-sm font-semibold text-blue-800">Updated dates based on agreed LWD</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
                        <div><p className="text-xs text-gray-400">Agreed LWD (Actual)</p><p className="font-semibold text-blue-800">{fmt(form.lastWorkingDate)}</p></div>
                        <div>
                          <p className="text-xs text-gray-400">Settlement Date (hold until)</p>
                          <p className="font-semibold text-amber-700">{fmt(salaryHoldUntil)}</p>
                          <p className="text-xs text-gray-400">{settlementOverride ? 'HR override' : `Est. LWD (${fmt(autoLWD)}) + 45d`}</p>
                        </div>
                        <div><p className="text-xs text-gray-400">Final Month Days Worked</p><p className="font-semibold">{lastMonthDays} days</p></div>
                      </div>
                      <div className="flex items-center gap-3 pt-1 border-t border-blue-200 flex-wrap">
                        <label className="text-xs text-blue-800 font-medium whitespace-nowrap">Settlement (hold until) date:</label>
                        <input type="date" className="border border-blue-300 rounded px-2 py-1 text-sm"
                          value={settlementOverride}
                          onChange={e => setSettlementOverride(e.target.value)} />
                        <span className="text-xs text-blue-600">
                          {settlementOverride !== salaryHoldUntilCalc ? 'Modified by HR' : 'Auto: Est. LWD + 45 days'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">FnF formula: Gross ÷ 30 × {lastMonthDays} days = last month salary</p>
                      {autoLWD !== form.lastWorkingDate && (
                        <p className="text-xs text-gray-400">
                          (System had calculated {fmt(autoLWD)} — overridden by HR to {fmt(form.lastWorkingDate)})
                        </p>
                      )}
                    </div>
                  )}

                  <button onClick={() => setLwdChoice(null)} className="text-xs text-gray-500 underline">Change answer</button>
                </div>
              )}

              {/* Submit row */}
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => { setFormStep('basic'); setLwdChoice(null); }}
                  className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                  ← Back
                </button>
                {lwdChoice && (lwdChoice === 'confirm' || (lwdChoice === 'override' && form.lastWorkingDate)) && (
                  <button onClick={handleInitiate} disabled={saving}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {saving ? 'Initiating...' : `Submit — ${form.type.charAt(0).toUpperCase() + form.type.slice(1)}`}
                  </button>
                )}
                <button onClick={closeInitiateForm} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 ml-auto">Cancel</button>
              </div>
            </>
          )}

        </div>
      )}

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_COLS.map(col => {
              const cards = byStatus(col.key);
              return (
                <div key={col.key} className="w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-sm font-semibold text-gray-700">{col.icon} {col.label}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{loading ? '…' : cards.length}</span>
                  </div>
                  <div className="space-y-2 min-h-24">
                    {loading ? (
                      <div className="h-16 bg-gray-100 animate-pulse rounded-xl border border-dashed border-gray-200" />
                    ) : cards.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">Empty</div>
                    ) : (
                      cards.map(s => <SepCard key={s.id} sep={s} today={today} onClick={() => navigate(`/admin/separations/${s.id}`)} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon="📋" title="No separations found" subtitle="No records match the current filter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Employee', 'Type', 'Status', 'Confirmed LWD', 'Notice Left', 'FnF', 'Salary Hold', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(s => {
                    const sm = STATUS_META[s.status] || { label: s.status, color: 'bg-gray-100 text-gray-600' };
                    const lwd = s.adjustedLWD || s.lastWorkingDate;
                    const daysLeft = lwd ? Math.max(0, Math.round((new Date(lwd) - new Date(today)) / 86400000)) : null;
                    const holdDue = s.salaryHoldUntil && today >= s.salaryHoldUntil && !s.salaryReleased;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/separations/${s.id}`)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{s.user?.name}</div>
                          <div className="text-xs text-gray-400">{s.user?.employeeId} · {s.user?.department}</div>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-600 text-xs">{s.type}</td>
                        <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sm.color}`}>{sm.label}</span></td>
                        <td className="px-4 py-3 text-gray-700 text-xs">{lwd || '—'}{s.leaveDaysDuringNotice > 0 && <span className="text-amber-600 ml-1">+{s.leaveDaysDuringNotice}d</span>}</td>
                        <td className="px-4 py-3 text-xs">
                          {s.status === 'notice_period' && daysLeft !== null
                            ? <span className={daysLeft <= 3 ? 'text-red-600 font-medium' : daysLeft <= 7 ? 'text-orange-600' : 'text-gray-600'}>{daysLeft}d</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {s.fnfTotal ? <span className="text-gray-700">₹{Math.abs(s.fnfTotal).toFixed(0)}</span> : '—'}
                          {s.fnfApprovedAt && <span className="text-green-600 ml-1">✓</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {s.salaryHoldUntil
                            ? s.salaryReleased
                              ? <span className="text-green-600">✅ Released</span>
                              : holdDue
                              ? <span className="text-red-600 font-medium">⏰ Due</span>
                              : <span className="text-amber-600">🔒 {s.salaryHoldUntil}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-3"><span className="text-blue-600 text-xs hover:underline">View →</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SepCard({ sep, today, onClick }) {
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  const daysLeft = lwd ? Math.max(0, Math.round((new Date(lwd) - new Date(today)) / 86400000)) : null;
  const holdDue = sep.salaryHoldUntil && today >= sep.salaryHoldUntil && !sep.salaryReleased;

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">
          {sep.user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-700">{sep.user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{sep.user?.designation || sep.user?.department}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-500">
          <span>LWD</span>
          <span className="font-medium text-gray-700">{lwd || 'TBD'}</span>
        </div>

        {sep.leaveDaysDuringNotice > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-700 text-center">
            ⚠️ Extended +{sep.leaveDaysDuringNotice}d (leave)
          </div>
        )}

        {daysLeft !== null && sep.status === 'notice_period' && (
          <div className="flex justify-between">
            <span className="text-gray-500">Days left</span>
            <span className={`font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-500' : 'text-gray-700'}`}>{daysLeft}d</span>
          </div>
        )}

        {holdDue && (
          <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-red-700 text-center font-medium">
            ⏰ Salary release due!
          </div>
        )}

        {!holdDue && sep.salaryHoldUntil && !sep.salaryReleased && (
          <div className="flex justify-between">
            <span className="text-gray-500">Hold until</span>
            <span className="text-amber-600 font-medium">{sep.salaryHoldUntil}</span>
          </div>
        )}

        {sep.checklistProgress && sep.checklistProgress.total > 0 && (
          <div>
            <div className="flex justify-between text-gray-500 mb-0.5">
              <span>Checklist</span>
              <span>{sep.checklistProgress.done}/{sep.checklistProgress.total}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(sep.checklistProgress.done / sep.checklistProgress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
