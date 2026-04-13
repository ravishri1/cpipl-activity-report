import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

const STATUS_STEPS = [
  { key: 'pending_manager', label: 'Submitted',       icon: '📝' },
  { key: 'pending_hr',      label: 'Mgr Approved',    icon: '👤' },
  { key: 'notice_period',   label: 'Notice Period',   icon: '📅' },
  { key: 'clearance',       label: 'Clearance',       icon: '📋' },
  { key: 'fnf_pending',     label: 'FnF Calc',        icon: '💰' },
  { key: 'fnf_approved',    label: 'FnF Approved',    icon: '✅' },
  { key: 'completed',       label: 'Completed',       icon: '🎓' },
];
const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

const CHECKLIST_STATUS_COLOR = { pending: 'bg-gray-100 text-gray-600', done: 'bg-green-100 text-green-700', na: 'bg-gray-50 text-gray-400' };

export default function SeparationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: sep, loading, error: fetchErr, refetch } = useFetch(`/separation/${id}`, null);
  const { data: fnfPreview, loading: fnfLoading, error: fnfErr, refetch: refetchFnF } = useFetch(`/separation/${id}/fnf-preview`, null);
  const { data: sepLetters, loading: lettersLoading, error: lettersErr, refetch: refetchLetters } = useFetch(`/separation/${id}/letters`, []);
  const { execute, loading: acting, error: actErr, success } = useApi();
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  const [hrForm, setHrForm] = useState({ lastWorkingDate: '', type: '', hrNote: '', waiveLeaveExtension: false, salaryHoldDays: 45 });
  const [mgForm, setMgForm] = useState({ action: 'approve', managerNote: '', managerProposedLWD: '' });
  const [fnfOverrides, setFnfOverrides] = useState({});
  const [fnfExcluded, setFnfExcluded] = useState({}); // index → true = excluded from FnF
  const [fnfCustomItems, setFnfCustomItems] = useState([]); // [{label, amount, component}]
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItemDraft, setCustomItemDraft] = useState({ label: '', amount: '', type: 'earning' });
  const [fnfItems, setFnfItems] = useState(null);

  if (loading) return <LoadingSpinner />;
  if (!sep) return <EmptyState icon="🔍" title="Separation not found" subtitle="This record may have been removed." />;

  const currentStepIdx = STATUS_ORDER.indexOf(sep.status);
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  const today = new Date().toISOString().slice(0, 10);
  const holdDue = sep.salaryHoldUntil && today >= sep.salaryHoldUntil && !sep.salaryReleased;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleManagerAction = async () => {
    try {
      await execute(() => api.put(`/separation/${id}/manager-action`, mgForm), 'Action recorded.');
      refetch();
    } catch {}
  };

  const handleHRConfirm = async () => {
    const lwd = hrForm.lastWorkingDate || sep.managerProposedLWD || sep.preferredLWD || sep.expectedLWD;
    if (!lwd) return alert('Please set the official Last Working Day.');
    try {
      await execute(
        () => api.put(`/separation/${id}/hr-confirm`, { ...hrForm, lastWorkingDate: lwd, type: hrForm.type || sep.type }),
        'LWD confirmed. Leaves blocked. Checklist created.'
      );
      refetch();
    } catch {}
  };

  const handleRecalcLWD = async () => {
    try {
      await execute(() => api.put(`/separation/${id}/notice-update`), null);
      refetch();
    } catch {}
  };

  const handleStartClearance = async (force = false) => {
    try {
      await execute(() => api.post(`/separation/${id}/start-clearance`, { force }), 'Clearance stage started.');
      refetch();
    } catch {}
  };

  const handleChecklistUpdate = async (checklistId, status, remarks) => {
    try {
      await execute(() => api.put(`/separation/${id}/checklist/${checklistId}`, { status, remarks }), null);
      refetch();
    } catch {}
  };

  const handleFnFSave = async () => {
    const baseItems = (fnfItems || fnfPreview?.items || [])
      .filter((_, idx) => !fnfExcluded[idx]) // remove excluded items
      .map((item, origIdx) => {
        const actualIdx = (fnfItems || fnfPreview?.items || []).indexOf(item);
        return {
          ...item,
          amount: parseFloat(fnfOverrides[actualIdx] ?? item.amount),
          overriddenBy: (fnfOverrides[actualIdx] !== undefined || fnfExcluded[actualIdx]) ? 1 : 0,
        };
      });
    const customMapped = fnfCustomItems.map(ci => ({
      component: ci.type === 'deduction' ? 'custom_deduction' : 'custom_earning',
      label: ci.label,
      amount: ci.type === 'deduction' ? -Math.abs(parseFloat(ci.amount)) : Math.abs(parseFloat(ci.amount)),
      autoCalculated: false,
      overriddenBy: 1,
    }));
    const items = [...baseItems, ...customMapped];
    try {
      await execute(() => api.post(`/separation/${id}/fnf-save`, { items }), 'FnF saved.');
      refetch();
    } catch {}
  };

  const handleFnFApprove = async () => {
    if (!window.confirm('Approve the Full & Final Settlement? This will notify the employee.')) return;
    try {
      await execute(() => api.post(`/separation/${id}/fnf-approve`), 'FnF approved!');
      refetch();
    } catch {}
  };

  const handleReleaseSalary = async () => {
    if (!window.confirm(`Release the held salary for ${sep.user?.name}? This will notify the employee.`)) return;
    try {
      await execute(() => api.post(`/separation/${id}/release-salary`), 'Salary released!');
      refetch();
    } catch {}
  };

  // handleGenerateDocs is in the Letters tab section below

  const handleComplete = async () => {
    if (!window.confirm('Complete this separation? This will activate the Alumni Portal for the employee.')) return;
    try {
      await execute(() => api.post(`/separation/${id}/complete`), 'Separation completed!');
      navigate('/admin/separations');
    } catch {}
  };

  const handleGenerateDocuments = async () => {
    try {
      await execute(() => api.post(`/separation/${id}/generate-documents`), 'Letters generated successfully!');
      refetch();
      refetchLetters();
    } catch {}
  };

  const handleSeedTemplates = async () => {
    setSeedingTemplates(true);
    try {
      await api.post('/letters/seed-separation-templates');
      alert('Templates created. Now click "Generate Letters" to generate for this employee.');
    } catch (e) {
      alert('Error: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSeedingTemplates(false);
    }
  };

  const handleDownload = async (letterId, format, name) => {
    try {
      const mimeType = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const response = await api.get(`/letters/${letterId}/${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + (e?.response?.data?.error || e.message));
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'checklist', label: `Checklist ${sep.checklist?.length ? `(${sep.checklistProgress?.done || 0}/${sep.checklistProgress?.total || 0})` : ''}` },
    { key: 'fnf', label: 'Full & Final' },
    { key: 'salary', label: 'Salary Hold' },
    ...(sep.type === 'resignation' ? [{ key: 'letters', label: `Letters ${sepLetters?.length ? `(${sepLetters.length})` : ''}` }] : []),
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/separations')} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-gray-800">Separation: {sep.user?.name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
          sep.status === 'completed' ? 'bg-green-100 text-green-700' :
          sep.status.includes('pending') ? 'bg-yellow-100 text-yellow-700' :
          sep.status === 'notice_period' ? 'bg-orange-100 text-orange-700' :
          'bg-blue-100 text-blue-700'
        }`}>{sep.status.replace(/_/g, ' ')}</span>
      </div>

      {actErr && <AlertMessage type="error" message={actErr} />}
      {success && <AlertMessage type="success" message={success} />}
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {/* Alerts */}
      {holdDue && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4 flex items-center justify-between">
          <span className="text-red-800 font-medium text-sm">⏰ 45-day hold period has ended — salary ready to release for {sep.user?.name}</span>
          <button onClick={handleReleaseSalary} disabled={acting} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 ml-4">
            Release Now
          </button>
        </div>
      )}

      {sep.leaveDaysDuringNotice > 0 && sep.status === 'notice_period' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 text-sm text-amber-800">
          ⚠️ Employee took <strong>{sep.leaveDaysDuringNotice} leave day(s)</strong> during notice period.
          LWD extended from <strong>{sep.lastWorkingDate}</strong> to <strong>{sep.adjustedLWD}</strong>.
        </div>
      )}

      {/* Pipeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_STEPS.map((step, i) => {
            const done = currentStepIdx > i;
            const active = currentStepIdx === i;
            const isRejected = sep.status === 'rejected' || sep.status === 'cancelled';
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    isRejected && active ? 'bg-red-100 text-red-700 ring-2 ring-red-300' :
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? '✓' : step.icon}
                  </div>
                  <span className={`text-xs mt-1 text-center whitespace-nowrap ${done || active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mt-[-16px] ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee Info Bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-gray-400 text-xs">Employee</span><p className="font-semibold text-gray-800 mt-0.5">{sep.user?.name}</p></div>
        <div><span className="text-gray-400 text-xs">Department</span><p className="font-medium text-gray-700 mt-0.5">{sep.user?.department}</p></div>
        <div><span className="text-gray-400 text-xs">Designation</span><p className="font-medium text-gray-700 mt-0.5">{sep.user?.designation}</p></div>
        <div><span className="text-gray-400 text-xs">Joined</span><p className="font-medium text-gray-700 mt-0.5">{sep.user?.dateOfJoining || '—'}</p></div>
        <div><span className="text-gray-400 text-xs">Type</span><p className="font-medium text-gray-700 mt-0.5 capitalize">{sep.type}</p></div>
        <div><span className="text-gray-400 text-xs">Notice Period</span><p className="font-medium text-gray-700 mt-0.5">{sep.noticePeriodDays} days</p></div>
        <div>
          <span className="text-gray-400 text-xs">Last Working Day</span>
          <p className="font-medium mt-0.5">
            <span className="text-gray-700">{lwd || 'Not confirmed'}</span>
            {sep.leaveDaysDuringNotice > 0 && <span className="text-xs text-amber-600 ml-1">(+{sep.leaveDaysDuringNotice}d leave)</span>}
          </p>
        </div>
        <div><span className="text-gray-400 text-xs">Days Left in Notice</span><p className={`font-medium mt-0.5 ${sep.daysRemainingInNotice <= 3 ? 'text-red-600' : 'text-gray-700'}`}>{sep.status === 'notice_period' ? `${sep.daysRemainingInNotice ?? '?'} days` : '—'}</p></div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Resignation Timeline</h3>
            <div className="space-y-3">
              <TimelineRow icon="📝" label="Submitted" date={sep.requestDate} by={sep.initiatedBy === 'employee' ? sep.user?.name : 'HR'} note={sep.reason} />
              {sep.managerApprovedAt && <TimelineRow icon="👤" label={`Manager ${sep.status === 'rejected' ? 'Rejected' : 'Approved'}`} date={sep.managerApprovedAt} by={sep.managerApprover?.name} note={sep.managerNote} />}
              {sep.hrConfirmedAt && <TimelineRow icon="🏢" label="HR Confirmed LWD" date={sep.hrConfirmedAt} by={sep.hrConfirmer?.name} note={sep.hrNote} />}
              {sep.leavesBlockedAt && <TimelineRow icon="🚫" label="Leaves Blocked" date={new Date(sep.leavesBlockedAt).toISOString().slice(0, 10)} note="All new leave requests blocked. Leaves during notice = LOP." />}
              {sep.leaveDaysDuringNotice > 0 && <TimelineRow icon="⚠️" label="LWD Extended" date={today} note={`${sep.leaveDaysDuringNotice} leave day(s) taken → LWD extended to ${sep.adjustedLWD}`} highlight />}
              {sep.fnfApprovedAt && <TimelineRow icon="💰" label="FnF Approved" date={sep.fnfApprovedAt} by={sep.fnfApprover?.name} />}
              {sep.salaryReleasedAt && <TimelineRow icon="✅" label="Salary Released" date={sep.salaryReleasedAt} by={sep.salaryReleaser?.name} />}
              {sep.documentsGeneratedAt && <TimelineRow icon="📄" label="Documents Generated" date={new Date(sep.documentsGeneratedAt).toISOString().slice(0, 10)} />}
              {sep.completedAt && <TimelineRow icon="🎓" label="Separation Completed" date={new Date(sep.completedAt).toISOString().slice(0, 10)} />}
            </div>
          </div>

          {sep.pendingAssets?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">⚠️ Pending Asset Returns ({sep.pendingAssets.length})</h3>
              <div className="space-y-1">
                {sep.pendingAssets.map(a => (
                  <div key={a.id} className="flex justify-between text-sm text-amber-700">
                    <span>{a.name} ({a.type})</span>
                    <span className="font-medium">{a.value ? `₹${a.value.toFixed(0)}` : 'No value set'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Checklist ────────────────────────────────────────────────── */}
      {activeTab === 'checklist' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">Clearance Checklist</h3>
            {sep.checklist?.length > 0 && (
              <span className="text-sm text-gray-500">{sep.checklistProgress?.done}/{sep.checklistProgress?.total} done</span>
            )}
          </div>

          {!sep.checklist?.length && (
            <EmptyState icon="📋" title="No checklist yet" subtitle="Checklist is created automatically when clearance starts. Refresh the page if it hasn't appeared." />
          )}

          {['IT', 'Admin', 'Finance', 'Manager', 'HR'].map(dept => {
            const items = sep.checklist?.filter(c => c.department === dept) || [];
            if (!items.length) return null;
            return (
              <div key={dept} className="mb-5">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{dept}</h4>
                <div className="space-y-1">
                  {items.map(item => {
                    const isDone = item.status === 'done';
                    return (
                      <div
                        key={item.id}
                        onClick={() => !acting && handleChecklistUpdate(item.id, isDone ? 'pending' : 'done', item.remarks)}
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border cursor-pointer transition-all select-none
                          ${isDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all
                          ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                          {isDone && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <span className={`flex-1 text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.task}</span>
                        {item.completedBy && <span className="text-xs text-gray-400">{item.completedBy.name}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {sep.status === 'notice_period' && (
            <button onClick={handleStartClearance} disabled={acting} className="mt-4 w-full bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
              Start Clearance Stage
            </button>
          )}

          {/* Progress bar + Proceed to FnF — shown when clearance is active */}
          {sep.status === 'clearance' && sep.checklist?.length > 0 && (() => {
            const total = sep.checklist.length;
            const done = sep.checklist.filter(c => c.status === 'done').length;
            const pending = sep.checklist.filter(c => c.status !== 'done').length;
            const pct = Math.round((done / total) * 100);
            const allClear = pending === 0;
            return (
              <div className="mt-5 border-t border-gray-100 pt-4 space-y-3">
                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Checklist Progress</span>
                    <span className="text-xs font-semibold text-gray-700">{done}/{total} items cleared</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${allClear ? 'bg-green-500' : 'bg-purple-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!allClear && (
                    <p className="text-xs text-amber-600 mt-1.5">
                      ⚠️ {pending} item{pending > 1 ? 's' : ''} not checked — click each row to mark done.
                    </p>
                  )}
                </div>

                {/* Proceed button — only when all items are done/na */}
                {allClear ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-green-800">✅ All clearance items done!</p>
                      <p className="text-xs text-green-600 mt-0.5">You can now proceed to calculate and approve the Full &amp; Final settlement.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('fnf')}
                      className="flex-shrink-0 bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap shadow-sm"
                    >
                      Proceed to FnF →
                    </button>
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed"
                    title="Complete all checklist items first"
                  >
                    Proceed to Full &amp; Final → ({pending} unchecked)
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Tab: Full & Final ─────────────────────────────────────────────── */}
      {activeTab === 'fnf' && (
        <div className="space-y-4">
          {fnfErr && <AlertMessage type="error" message={fnfErr} />}

          {/* Existing approved FnF */}
          {sep.fnfItems?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">Saved FnF Settlement</h3>
                {sep.fnfApprovedAt
                  ? <span className="text-xs text-green-600 font-medium">✅ Approved on {sep.fnfApprovedAt}</span>
                  : <span className="text-xs text-gray-400">Not yet approved</span>}
              </div>
              <FnFTable items={sep.fnfItems} netAmount={sep.fnfNetAmount} />
              {!sep.fnfApprovedAt && (
                <button onClick={handleFnFApprove} disabled={acting} className="mt-4 bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {acting ? 'Approving...' : 'Approve FnF'}
                </button>
              )}
            </div>
          )}

          {/* FnF Preview / Calculator */}
          {!sep.fnfApprovedAt && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800">FnF Calculator</h3>
                {fnfLoading && <span className="text-xs text-gray-400">Calculating...</span>}
              </div>

              {!fnfPreview && !fnfLoading && <p className="text-sm text-gray-500">Set the final LWD first to calculate FnF.</p>}
              {fnfPreview?.manualMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                  ⚠️ No salary structure or payslip found. All amounts are ₹0 — override each item directly or add custom items below.
                </div>
              )}
              {fnfPreview && !fnfPreview.manualMode && fnfPreview.salarySource === 'payslip' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-3 text-xs text-blue-700">
                  ℹ️ Gross calculated from latest payslip (no salary structure). Override amounts if needed.
                </div>
              )}

              {fnfPreview && (
                <>
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 grid grid-cols-3 gap-3">
                    <div><span className="font-medium">Gross Monthly:</span> ₹{fnfPreview.grossMonthly?.toFixed(2)}</div>
                    <div><span className="font-medium">Daily Rate:</span> ₹{fnfPreview.dailyRate?.toFixed(2)}</div>
                    <div><span className="font-medium">LWD:</span> {fnfPreview.lastWorkingDate}</div>
                  </div>

                  <p className="text-xs text-gray-400 mb-2">✏️ Edit amount · ✕ Remove item · All changes are HR overrides</p>

                  <div className="space-y-1 mb-4">
                    {fnfPreview.items?.map((item, idx) => (
                      <div key={idx} className={`flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 ${fnfExcluded[idx] ? 'opacity-40' : ''}`}>
                        {/* Exclude toggle */}
                        <button
                          title={fnfExcluded[idx] ? 'Include this item' : 'Exclude this item'}
                          onClick={() => setFnfExcluded(e => ({ ...e, [idx]: !e[idx] }))}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 border ${fnfExcluded[idx] ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'}`}>
                          {fnfExcluded[idx] ? '+' : '✕'}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm text-gray-700 ${fnfExcluded[idx] ? 'line-through' : ''}`}>{item.label}</p>
                          {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded hidden sm:block ${item.component === 'notice_recovery' || item.component === 'asset_deduction' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {item.component.replace(/_/g, ' ')}
                          </span>
                          <input
                            type="number"
                            disabled={fnfExcluded[idx]}
                            className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                            value={fnfOverrides[idx] !== undefined ? fnfOverrides[idx] : item.amount}
                            onChange={e => setFnfOverrides(o => ({ ...o, [idx]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Custom items */}
                    {fnfCustomItems.map((ci, ci_idx) => (
                      <div key={`custom-${ci_idx}`} className="flex items-center gap-2 py-2 border-b border-blue-100 bg-blue-50 rounded px-2">
                        <button onClick={() => setFnfCustomItems(list => list.filter((_, i) => i !== ci_idx))}
                          className="w-6 h-6 rounded bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 flex items-center justify-center text-xs flex-shrink-0">✕</button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-blue-800 font-medium">{ci.label}</p>
                          <p className="text-xs text-blue-500">Custom — HR added</p>
                        </div>
                        <span className={`text-sm font-semibold ${ci.type === 'deduction' ? 'text-red-600' : 'text-green-700'}`}>
                          {ci.type === 'deduction' ? '−' : '+'}₹{Math.abs(parseFloat(ci.amount || 0)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add Custom Item */}
                  {showCustomItemForm ? (
                    <div className="border border-blue-200 rounded-lg p-3 mb-4 bg-blue-50 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">Add Custom Line Item</p>
                      <input type="text" placeholder="Description (e.g. Gratuity, Bonus, Deduction)" className="w-full border border-blue-200 rounded px-2 py-1 text-sm"
                        value={customItemDraft.label} onChange={e => setCustomItemDraft(d => ({ ...d, label: e.target.value }))} />
                      <div className="flex gap-2">
                        <select className="border border-blue-200 rounded px-2 py-1 text-sm" value={customItemDraft.type}
                          onChange={e => setCustomItemDraft(d => ({ ...d, type: e.target.value }))}>
                          <option value="earning">+ Earning</option>
                          <option value="deduction">− Deduction</option>
                        </select>
                        <input type="number" placeholder="Amount ₹" className="flex-1 border border-blue-200 rounded px-2 py-1 text-sm"
                          value={customItemDraft.amount} onChange={e => setCustomItemDraft(d => ({ ...d, amount: e.target.value }))} />
                        <button onClick={() => {
                          if (!customItemDraft.label || !customItemDraft.amount) return;
                          setFnfCustomItems(l => [...l, { ...customItemDraft }]);
                          setCustomItemDraft({ label: '', amount: '', type: 'earning' });
                          setShowCustomItemForm(false);
                        }} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Add</button>
                        <button onClick={() => setShowCustomItemForm(false)} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCustomItemForm(true)} className="mb-4 text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      + Add custom line item (Gratuity / Bonus / Other)
                    </button>
                  )}

                  {/* Net Total */}
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3 mb-4">
                    <span>Net FnF Payable</span>
                    <span className={`${
                      ((fnfPreview.items?.reduce((s, item, idx) => fnfExcluded[idx] ? s : s + parseFloat(fnfOverrides[idx] ?? item.amount), 0) || 0) +
                       fnfCustomItems.reduce((s, ci) => s + (ci.type === 'deduction' ? -Math.abs(parseFloat(ci.amount||0)) : Math.abs(parseFloat(ci.amount||0))), 0)) >= 0
                      ? 'text-green-700' : 'text-red-600'}`}>
                      ₹{(
                        (fnfPreview.items?.reduce((s, item, idx) => fnfExcluded[idx] ? s : s + parseFloat(fnfOverrides[idx] ?? item.amount), 0) || 0) +
                        fnfCustomItems.reduce((s, ci) => s + (ci.type === 'deduction' ? -Math.abs(parseFloat(ci.amount||0)) : Math.abs(parseFloat(ci.amount||0))), 0)
                      ).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleFnFSave} disabled={acting} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {acting ? 'Saving...' : 'Save FnF'}
                    </button>
                    <button onClick={refetchFnF} disabled={fnfLoading} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                      ↺ Recalculate
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Salary Hold ──────────────────────────────────────────────── */}
      {activeTab === 'salary' && (
        <div className="space-y-4">
          <div className={`border rounded-xl p-5 ${sep.salaryReleased ? 'bg-green-50 border-green-200' : holdDue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-base font-semibold ${sep.salaryReleased ? 'text-green-800' : holdDue ? 'text-red-800' : 'text-amber-800'}`}>
                {sep.salaryReleased ? '✅ Salary Released' : holdDue ? '⏰ Release Due' : '🔒 Salary On Hold'}
              </h3>
              {!sep.salaryReleased && sep.fnfApprovedAt && (
                <button onClick={handleReleaseSalary} disabled={acting}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${holdDue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {acting ? 'Releasing...' : holdDue ? 'Release Now' : 'Release Early'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div><span className="text-xs text-gray-500">Hold Days</span><p className="font-semibold mt-0.5">{sep.salaryHoldDays} days</p></div>
              <div><span className="text-xs text-gray-500">Hold Until</span><p className="font-semibold mt-0.5">{sep.salaryHoldUntil || '—'}</p></div>
              <div><span className="text-xs text-gray-500">Days Remaining</span><p className={`font-semibold mt-0.5 ${sep.daysUntilSalaryRelease <= 0 ? 'text-red-600' : ''}`}>{sep.daysUntilSalaryRelease ?? '—'}</p></div>
              <div><span className="text-xs text-gray-500">Total Held</span><p className="font-semibold mt-0.5">₹{sep.totalHeldAmount?.toFixed(2) || '0'}</p></div>
            </div>

            <div className="bg-white rounded-lg border border-amber-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">Month</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500">Description</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">Days</th>
                    <th className="px-4 py-2 text-right text-xs text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-center text-xs text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sep.salaryHolds?.map(h => (
                    <tr key={h.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-700">{h.month}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{h.description}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{h.heldDays}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">₹{h.heldAmount.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.released ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {h.released ? 'Released' : 'On Hold'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!sep.salaryHolds || sep.salaryHolds.length === 0) && (
                    <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400 text-sm">Save the FnF first to generate the salary hold breakdown.</td></tr>
                  )}
                </tbody>
                {sep.salaryHolds?.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-2.5 font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-gray-800">₹{sep.totalHeldAmount?.toFixed(2)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              📘 <strong>Note:</strong> Salary amounts are <strong>booked in payslips for their respective months</strong> as earned. The hold is only on the payment. Books show full earned amount normally.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab: Letters ─────────────────────────────────────────────────── */}
      {activeTab === 'letters' && sep.type === 'resignation' && (
        <div className="space-y-4">
          {lettersErr && <AlertMessage type="error" message={lettersErr} />}

          {/* Generate section */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">Separation Letters</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSeedTemplates}
                  disabled={seedingTemplates}
                  className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  title="Create default Experience & Relieving Letter templates if not already present"
                >
                  {seedingTemplates ? 'Creating...' : '⚙ Init Templates'}
                </button>
                <button
                  onClick={handleGenerateDocuments}
                  disabled={acting}
                  className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {acting ? 'Generating...' : sep.documentsGenerated ? '↺ Regenerate Letters' : '📄 Generate Letters'}
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Experience Letter and Relieving Letter are generated for resigned employees only.
              Both can be downloaded as PDF or Word (.docx).
            </p>
            {sep.documentsGeneratedAt && (
              <p className="text-xs text-green-600 mt-2">
                ✅ Last generated: {new Date(sep.documentsGeneratedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Letters list */}
          {lettersLoading ? (
            <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
          ) : sepLetters?.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-2xl mb-2">📄</p>
              <p className="text-gray-500 text-sm font-medium">No letters generated yet</p>
              <p className="text-gray-400 text-xs mt-1">Click "Generate Letters" above to create Experience and Relieving Letters</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sepLetters.map(letter => (
                <div key={letter.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          letter.letterType === 'experience' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {letter.letterType === 'experience' ? '🎓 Experience Letter' : '✉️ Relieving Letter'}
                        </span>
                        <span className="text-xs text-gray-400">
                          Generated {new Date(letter.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {letter.generatedByUser && ` by ${letter.generatedByUser.name}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Template: {letter.template?.name}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(letter.id, 'pdf', `${letter.letterType}_${sep.user?.name?.replace(/\s+/g, '_') || 'employee'}`)}
                        className="flex items-center gap-1 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100"
                      >
                        ⬇ PDF
                      </button>
                      <button
                        onClick={() => handleDownload(letter.id, 'docx', `${letter.letterType}_${sep.user?.name?.replace(/\s+/g, '_') || 'employee'}`)}
                        className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100"
                      >
                        ⬇ Word
                      </button>
                    </div>
                  </div>

                  {/* Letter preview */}
                  <details className="mt-3">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">▸ Preview letter content</summary>
                    <div
                      className="mt-3 bg-gray-50 rounded-lg p-4 text-sm border border-gray-100 max-h-64 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: letter.content }}
                    />
                  </details>
                </div>
              ))}
            </div>
          )}

          {/* Next step banner — shown after letters are generated */}
          {sepLetters?.length > 0 && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">✅ Letters ready — what's next?</p>
                <p className="text-xs text-green-600 mt-0.5">
                  {!sep.fnfNetAmount
                    ? 'Go to Full & Final tab to calculate and save the settlement amount.'
                    : !sep.fnfApprovedAt
                    ? 'FnF calculated. Go to Full & Final tab to approve it.'
                    : !sep.salaryReleased
                    ? 'FnF approved. Release salary when hold period ends.'
                    : 'All done — complete the separation from Actions tab.'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab(
                  !sep.fnfNetAmount || !sep.fnfApprovedAt ? 'fnf' :
                  !sep.salaryReleased ? 'salary' : 'actions'
                )}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap ml-4"
              >
                {!sep.fnfNetAmount ? '→ Full & Final' :
                 !sep.fnfApprovedAt ? '→ Approve FnF' :
                 !sep.salaryReleased ? '→ Salary Hold' : '→ Complete'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Actions ──────────────────────────────────────────────────── */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          {/* HR Steps Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-blue-800 mb-3">📋 HR Steps Guide</h3>
            <div className="space-y-2 text-sm text-blue-700">
              {[
                { step: 1, done: !!sep.managerApprovedAt, text: 'Manager approves resignation' },
                { step: 2, done: !!sep.hrConfirmedAt, text: 'HR confirms final LWD + blocks all leaves' },
                { step: 3, done: sep.status !== 'notice_period' && sep.status !== 'pending_manager' && sep.status !== 'pending_hr', text: 'Monitor notice period — LWD auto-extends for any leave taken' },
                { step: 4, done: sep.status !== 'clearance' && STATUS_ORDER.indexOf(sep.status) > STATUS_ORDER.indexOf('notice_period'), text: 'Start clearance once LWD passes — complete all checklist items' },
                { step: 5, done: !!sep.fnfNetAmount, text: 'Calculate FnF (auto-pulled from payroll, leave, assets, expenses)' },
                { step: 6, done: !!sep.fnfApprovedAt, text: 'Approve FnF — employee notified of amount and release date' },
                { step: 7, done: sep.documentsGenerated, text: 'Generate Relieving Letter + Experience Letter' },
                { step: 8, done: sep.salaryReleased, text: `Release salary on/after ${sep.salaryHoldUntil || '45 days from LWD'}` },
                { step: 9, done: sep.status === 'completed', text: 'Complete separation — alumni portal activated' },
              ].map(s => (
                <div key={s.step} className={`flex items-start gap-2 ${s.done ? 'opacity-60' : ''}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${s.done ? 'bg-green-400 text-white' : 'bg-blue-200 text-blue-700'}`}>
                    {s.done ? '✓' : s.step}
                  </span>
                  <span className={s.done ? 'line-through' : ''}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Next Step CTA — always visible, context-aware ── */}
          {sep.status === 'notice_period' && (
            <div className={`rounded-xl p-5 border ${today >= lwd ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-200'}`}>
              <h3 className={`text-base font-semibold mb-1 ${today >= lwd ? 'text-green-800' : 'text-amber-800'}`}>
                {today >= lwd ? '✅ Notice Period Complete — Ready for Clearance' : `⏳ Notice Period — LWD: ${lwd}`}
              </h3>
              <p className={`text-sm mb-3 ${today >= lwd ? 'text-green-700' : 'text-amber-700'}`}>
                {today >= lwd
                  ? 'LWD has passed. Start the clearance stage to complete the separation checklist.'
                  : `LWD not yet reached. For historical records or early exit, use HR Override below.`}
              </p>
              <div className="flex gap-3 flex-wrap">
                {today >= lwd && (
                  <button onClick={() => handleStartClearance(false)} disabled={acting}
                    className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {acting ? 'Starting...' : '🚀 Start Clearance Stage'}
                  </button>
                )}
                <button onClick={() => { if (window.confirm('HR Override: Start clearance before official LWD? This bypasses the date check.')) handleStartClearance(true); }} disabled={acting}
                  className="border border-orange-400 text-orange-700 bg-orange-50 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50">
                  ⚡ HR Override — Force Start
                </button>
              </div>
            </div>
          )}

          {/* Manager Action (if pending_manager) */}
          {sep.status === 'pending_manager' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h3 className="text-base font-semibold text-gray-800">Manager Action</h3>
              <div className="flex gap-3">
                {['approve', 'propose_lwd', 'reject'].map(a => (
                  <button key={a} onClick={() => setMgForm(f => ({ ...f, action: a }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${mgForm.action === a ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
                    {a === 'approve' ? '✅ Approve' : a === 'propose_lwd' ? '📅 Propose LWD' : '❌ Reject'}
                  </button>
                ))}
              </div>
              {mgForm.action === 'propose_lwd' && (
                <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mgForm.managerProposedLWD} onChange={e => setMgForm(f => ({ ...f, managerProposedLWD: e.target.value }))} />
              )}
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Note (optional)" value={mgForm.managerNote} onChange={e => setMgForm(f => ({ ...f, managerNote: e.target.value }))} />
              <button onClick={handleManagerAction} disabled={acting} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {acting ? 'Submitting...' : 'Submit Action'}
              </button>
            </div>
          )}

          {/* HR Confirmation */}
          {['pending_hr', 'pending_manager'].includes(sep.status) && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-gray-800">HR Confirmation</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Official Last Working Day *</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={hrForm.lastWorkingDate || sep.managerProposedLWD || sep.preferredLWD || sep.expectedLWD || ''}
                    onChange={e => setHrForm(f => ({ ...f, lastWorkingDate: e.target.value }))} />
                  {sep.expectedLWD && <p className="text-xs text-gray-400 mt-1">Expected (30-day notice): {sep.expectedLWD}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Separation Type</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={hrForm.type || sep.type} onChange={e => setHrForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="resignation">Resignation</option>
                    <option value="retirement">Retirement</option>
                    <option value="termination">Termination</option>
                    <option value="absconding">Absconding</option>
                  </select>
                </div>
              </div>

              {/* HR Overrides */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">⚙ HR Override Options</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={hrForm.waiveLeaveExtension}
                    onChange={e => setHrForm(f => ({ ...f, waiveLeaveExtension: e.target.checked }))} />
                  <span className="text-sm text-orange-800">
                    <strong>Waive notice extension</strong> — Employee left on exact LWD with no delay, even if leaves were taken during notice period
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-orange-800 font-medium whitespace-nowrap">Salary hold days:</label>
                  <input type="number" min="0" max="90" className="w-20 border border-orange-300 rounded px-2 py-1 text-sm"
                    value={hrForm.salaryHoldDays}
                    onChange={e => setHrForm(f => ({ ...f, salaryHoldDays: e.target.value }))} />
                  <span className="text-xs text-orange-600">(default 45 days; set 0 to release salary immediately)</span>
                </div>
              </div>

              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="HR note (optional)" value={hrForm.hrNote} onChange={e => setHrForm(f => ({ ...f, hrNote: e.target.value }))} />
              <button onClick={handleHRConfirm} disabled={acting}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {acting ? 'Confirming...' : '✅ Confirm LWD & Block Leaves'}
              </button>
            </div>
          )}

          {/* Recalculate LWD (notice period) */}
          {sep.status === 'notice_period' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-gray-800 mb-2">Recalculate LWD</h3>
              <p className="text-sm text-gray-500 mb-3">If the employee has taken leave during notice period, click below to recalculate and extend the LWD.</p>
              <div className="flex gap-3 items-center">
                <button onClick={handleRecalcLWD} disabled={acting} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                  {acting ? 'Recalculating...' : '🔄 Recalculate LWD from Leaves'}
                </button>
                {sep.leaveDaysDuringNotice > 0 && (
                  <span className="text-sm text-amber-600">⚠️ Currently extended by {sep.leaveDaysDuringNotice} day(s)</span>
                )}
              </div>
            </div>
          )}

          {/* Generate Documents */}
          {['fnf_approved', 'completed', 'clearance', 'fnf_pending'].includes(sep.status) && sep.type === 'resignation' && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-gray-800 mb-2">Generate Documents</h3>
              <p className="text-sm text-gray-500 mb-3">
                Experience Letter and Relieving Letter are available in the <strong>Letters tab</strong> above.
                {sep.documentsGenerated && ' ✅ Already generated.'}
              </p>
              <button onClick={() => setActiveTab('letters')} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                📄 Go to Letters Tab
              </button>
            </div>
          )}

          {/* Complete Separation */}
          {sep.status === 'fnf_approved' && sep.salaryReleased && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-green-800 mb-2">Complete Separation</h3>
              <p className="text-sm text-green-700 mb-3">All steps done. Click below to complete the separation. Employee status changes to "Separated" and Alumni Portal access is activated.</p>
              <button onClick={handleComplete} disabled={acting} className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {acting ? 'Completing...' : '🎓 Complete Separation'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Universal Next Tab Button ─────────────────────────────────────── */}
      {(() => {
        const currentIdx = tabs.findIndex(t => t.key === activeTab);
        const nextTab = tabs[currentIdx + 1];
        if (!nextTab) return null;
        return (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveTab(nextTab.key)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              Next: {nextTab.label.replace(/ \(.*\)/, '')} <span>→</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function TimelineRow({ icon, label, date, by, note, highlight }) {
  if (!date) return null;
  return (
    <div className={`flex gap-3 py-2 border-b border-gray-100 last:border-0 ${highlight ? 'bg-amber-50 -mx-2 px-2 rounded' : ''}`}>
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          <span className="text-xs text-gray-400">{date}</span>
          {by && <span className="text-xs text-gray-400">by {by}</span>}
        </div>
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

function FnFTable({ items, netAmount }) {
  return (
    <div>
      <div className="space-y-2 mb-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
            <div>
              <span className="text-gray-700">{item.label}</span>
              {item.note && <p className="text-xs text-gray-400">{item.note}</p>}
            </div>
            <span className={`font-medium ${item.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {item.amount < 0 ? '−' : '+'}₹{Math.abs(item.amount).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3">
        <span>Net FnF</span>
        <span className={netAmount >= 0 ? 'text-green-700' : 'text-red-600'}>₹{(netAmount || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}
