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
  { key: 'pending_manager', label: 'Submitted',    icon: '📝' },
  { key: 'pending_hr',      label: 'Mgr Approved', icon: '👤' },
  { key: 'notice_period',   label: 'Notice Period', icon: '📅' },
  { key: 'clearance',       label: 'Clearance',    icon: '📋' },
  { key: 'fnf_pending',     label: 'FnF Calc',     icon: '💰' },
  { key: 'fnf_approved',    label: 'FnF Approved', icon: '✅' },
  { key: 'completed',       label: 'Completed',    icon: '🎓' },
];
const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

export default function SeparationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: sep, loading, error: fetchErr, refetch } = useFetch(`/separation/${id}`, null);
  const { data: fnfPreview, loading: fnfLoading, error: fnfErr, refetch: refetchFnF } = useFetch(`/separation/${id}/fnf-preview`, null);
  const { data: sepLetters, loading: lettersLoading, error: lettersErr, refetch: refetchLetters } = useFetch(`/separation/${id}/letters`, []);
  const { execute, loading: acting, error: actErr, success } = useApi();
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  const [hrForm, setHrForm] = useState({ lastWorkingDate: '', type: '', hrNote: '', waiveLeaveExtension: false, salaryHoldDays: 45, salaryHoldUntil: '' });
  const [mgForm, setMgForm] = useState({ action: 'approve', managerNote: '', managerProposedLWD: '' });
  const [fnfOverrides, setFnfOverrides] = useState({});
  const [fnfExcluded, setFnfExcluded] = useState({});
  const [fnfCustomItems, setFnfCustomItems] = useState([]);
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItemDraft, setCustomItemDraft] = useState({ label: '', amount: '', type: 'earning' });
  const [fnfItems, setFnfItems] = useState(null);

  if (loading) return <LoadingSpinner />;
  if (!sep) return <EmptyState icon="🔍" title="Separation not found" subtitle="This record may have been removed." />;

  const currentStepIdx = STATUS_ORDER.indexOf(sep.status);
  const lwd = sep.adjustedLWD || sep.lastWorkingDate;
  const today = new Date().toISOString().slice(0, 10);
  const holdDue = sep.salaryHoldUntil && today >= sep.salaryHoldUntil && !sep.salaryReleased;

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleManagerAction = async () => {
    try {
      await execute(() => api.put(`/separation/${id}/manager-action`, mgForm), 'Action recorded.');
      refetch();
    } catch {}
  };

  const handleHRConfirm = async () => {
    const lwdVal = hrForm.lastWorkingDate || sep.managerProposedLWD || sep.preferredLWD || sep.expectedLWD;
    if (!lwdVal) return alert('Please set the official Last Working Day.');
    // Use HR-modified settlement date if changed, otherwise keep existing (auto-calculated) value
    const settlementDate = hrForm.salaryHoldUntil || sep.salaryHoldUntil || undefined;
    try {
      await execute(() => api.put(`/separation/${id}/hr-confirm`, {
        ...hrForm,
        lastWorkingDate: lwdVal,
        type: hrForm.type || sep.type,
        salaryHoldUntil: settlementDate,
      }), 'LWD confirmed. Leaves blocked. Checklist created.');
      refetch();
    } catch {}
  };

  const handleStartClearance = async (force = false) => {
    try {
      await execute(() => api.post(`/separation/${id}/start-clearance`, { force }), 'Clearance stage started.');
      refetch();
    } catch {}
  };

  const handleChecklistUpdate = async (checklistId, status) => {
    try {
      await execute(() => api.put(`/separation/${id}/checklist/${checklistId}`, { status }), null);
      refetch();
    } catch {}
  };

  const handleFnFSave = async () => {
    const baseItems = (fnfItems || fnfPreview?.items || [])
      .filter((_, idx) => !fnfExcluded[idx])
      .map((item) => {
        const idx = (fnfItems || fnfPreview?.items || []).indexOf(item);
        return { ...item, amount: parseFloat(fnfOverrides[idx] ?? item.amount), overriddenBy: fnfOverrides[idx] !== undefined ? 1 : 0 };
      });
    const customMapped = fnfCustomItems.map(ci => ({
      component: ci.type === 'deduction' ? 'custom_deduction' : 'custom_earning',
      label: ci.label,
      amount: ci.type === 'deduction' ? -Math.abs(parseFloat(ci.amount)) : Math.abs(parseFloat(ci.amount)),
      autoCalculated: false, overriddenBy: 1,
    }));
    try {
      await execute(() => api.post(`/separation/${id}/fnf-save`, { items: [...baseItems, ...customMapped] }), 'FnF saved.');
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
    if (!window.confirm(`Release the held salary for ${sep.user?.name}?`)) return;
    try {
      await execute(() => api.post(`/separation/${id}/release-salary`), 'Salary released!');
      refetch();
    } catch {}
  };

  const handleGenerateDocuments = async () => {
    try {
      await execute(() => api.post(`/separation/${id}/generate-documents`), 'Letters generated!');
      refetch(); refetchLetters();
    } catch {}
  };

  const handleComplete = async () => {
    if (!window.confirm('Complete this separation? Alumni Portal will be activated for the employee.')) return;
    try {
      await execute(() => api.post(`/separation/${id}/complete`), 'Separation completed!');
      navigate('/admin/separations');
    } catch {}
  };

  const handleSeedTemplates = async () => {
    setSeedingTemplates(true);
    try {
      await api.post('/letters/seed-separation-templates');
      alert('Templates created. Now click "Generate Letters".');
    } catch (e) {
      alert('Error: ' + (e?.response?.data?.error || e.message));
    } finally { setSeedingTemplates(false); }
  };

  const handleDownload = async (letterId, format, name) => {
    try {
      const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const response = await api.get(`/letters/${letterId}/${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const a = document.createElement('a'); a.href = url; a.download = `${name}.${format}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) { alert('Download failed: ' + (e?.response?.data?.error || e.message)); }
  };

  // ── Step helpers ─────────────────────────────────────────────────────────

  const isDone = (statusKey) => STATUS_ORDER.indexOf(sep.status) > STATUS_ORDER.indexOf(statusKey);
  const isCurrent = (statusKey) => sep.status === statusKey;

  const checklistDone = sep.checklist?.filter(c => c.status === 'done').length || 0;
  const checklistTotal = sep.checklist?.length || 0;
  const allClear = checklistTotal > 0 && sep.checklist?.every(c => c.status !== 'pending');

  const fnfNetCalc = () => {
    const base = fnfPreview?.items?.reduce((s, item, idx) => fnfExcluded[idx] ? s : s + parseFloat(fnfOverrides[idx] ?? item.amount), 0) || 0;
    const custom = fnfCustomItems.reduce((s, ci) => s + (ci.type === 'deduction' ? -Math.abs(parseFloat(ci.amount || 0)) : Math.abs(parseFloat(ci.amount || 0))), 0);
    return base + custom;
  };

  // ── Step panel wrapper ───────────────────────────────────────────────────

  const StepPanel = ({ stepKey, stepNum, title, children, alwaysShow = false }) => {
    const done = isDone(stepKey);
    const current = isCurrent(stepKey);
    const locked = !done && !current;

    if (locked && !alwaysShow) return null;

    return (
      <div className={`rounded-xl border transition-all ${
        current ? 'border-blue-400 bg-white shadow-md' :
        done ? 'border-green-200 bg-green-50' :
        'border-gray-200 bg-gray-50 opacity-60'
      }`}>
        {/* Step header */}
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-t-xl ${
          current ? 'bg-blue-600 text-white' :
          done ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            current ? 'bg-white text-blue-600' :
            done ? 'bg-green-500 text-white' :
            'bg-gray-300 text-gray-600'
          }`}>
            {done ? '✓' : stepNum}
          </div>
          <span className={`font-semibold text-sm ${current ? 'text-white' : done ? 'text-green-800' : 'text-gray-500'}`}>{title}</span>
          {done && <span className="ml-auto text-xs text-green-600 font-medium">Done</span>}
          {current && <span className="ml-auto text-xs text-blue-100 font-medium">Action required</span>}
        </div>

        {/* Step content — only show for current or done steps */}
        {(current || done) && children && (
          <div className="px-5 py-4">{children}</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">

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

      {/* Salary hold alert */}
      {holdDue && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-5 py-4 flex items-center justify-between">
          <span className="text-red-800 font-medium text-sm">⏰ 45-day hold ended — salary ready to release for {sep.user?.name}</span>
          <button onClick={handleReleaseSalary} disabled={acting} className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 ml-4">
            Release Now
          </button>
        </div>
      )}

      {sep.leaveDaysDuringNotice > 0 && sep.status === 'notice_period' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 text-sm text-amber-800">
          ⚠️ Employee took <strong>{sep.leaveDaysDuringNotice} leave day(s)</strong> during notice.
          LWD extended from <strong>{sep.lastWorkingDate}</strong> to <strong>{sep.adjustedLWD}</strong>.
        </div>
      )}

      {/* Pipeline stepper */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_STEPS.map((step, i) => {
            const done = currentStepIdx > i;
            const active = currentStepIdx === i;
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-gray-100 text-gray-400'
                  }`}>{done ? '✓' : step.icon}</div>
                  <span className={`text-xs mt-1 text-center whitespace-nowrap ${done || active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Employee info */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span className="text-gray-400 text-xs">Employee</span><p className="font-semibold text-gray-800 mt-0.5">{sep.user?.name}</p></div>
        <div><span className="text-gray-400 text-xs">Department</span><p className="font-medium text-gray-700 mt-0.5">{sep.user?.department}</p></div>
        <div><span className="text-gray-400 text-xs">Type</span><p className="font-medium text-gray-700 mt-0.5 capitalize">{sep.type}</p></div>
        <div><span className="text-gray-400 text-xs">Joined</span><p className="font-medium text-gray-700 mt-0.5">{sep.user?.dateOfJoining || '—'}</p></div>
        <div><span className="text-gray-400 text-xs">Notice Period</span><p className="font-medium text-gray-700 mt-0.5">{sep.noticePeriodDays} days</p></div>
        <div>
          <span className="text-gray-400 text-xs">Last Working Day</span>
          <p className="font-medium mt-0.5 text-gray-700">{lwd || 'Not confirmed'}
            {sep.leaveDaysDuringNotice > 0 && <span className="text-xs text-amber-600 ml-1">(+{sep.leaveDaysDuringNotice}d)</span>}
          </p>
        </div>
        {sep.status === 'notice_period' && (
          <div><span className="text-gray-400 text-xs">Days Left</span><p className={`font-medium mt-0.5 ${sep.daysRemainingInNotice <= 3 ? 'text-red-600' : 'text-gray-700'}`}>{sep.daysRemainingInNotice ?? '?'} days</p></div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          STEP-BY-STEP ACTIONS
      ═══════════════════════════════════════ */}

      {/* STEP 1 — Manager Approval */}
      <StepPanel stepKey="pending_manager" stepNum={1} title="Manager Approves Resignation">
        {isCurrent('pending_manager') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Choose action as manager or on manager's behalf:</p>
            <div className="flex gap-2">
              {['approve', 'propose_lwd', 'reject'].map(a => (
                <button key={a} onClick={() => setMgForm(f => ({ ...f, action: a }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${mgForm.action === a ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {a === 'approve' ? '✅ Approve' : a === 'propose_lwd' ? '📅 Propose LWD' : '❌ Reject'}
                </button>
              ))}
            </div>
            {mgForm.action === 'propose_lwd' && (
              <input type="date" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={mgForm.managerProposedLWD} onChange={e => setMgForm(f => ({ ...f, managerProposedLWD: e.target.value }))} />
            )}
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="Note (optional)" value={mgForm.managerNote} onChange={e => setMgForm(f => ({ ...f, managerNote: e.target.value }))} />
            <button onClick={handleManagerAction} disabled={acting} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {acting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}
        {isDone('pending_manager') && (
          <p className="text-sm text-green-700">✓ Approved on {sep.managerApprovedAt} {sep.managerNote && <span className="text-gray-500">— "{sep.managerNote}"</span>}</p>
        )}
      </StepPanel>

      {/* STEP 2 — HR Confirmation */}
      <StepPanel stepKey="pending_hr" stepNum={2} title="HR Confirms Final LWD & Blocks Leaves">
        {isCurrent('pending_hr') && (
          <div className="space-y-4">
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
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">⚙ HR Override Options</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={hrForm.waiveLeaveExtension} onChange={e => setHrForm(f => ({ ...f, waiveLeaveExtension: e.target.checked }))} />
                <span className="text-sm text-orange-800"><strong>Waive notice extension</strong> — Employee left on exact LWD even if leaves were taken during notice</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="text-sm text-orange-800 font-medium whitespace-nowrap">Salary hold days:</label>
                <input type="number" min="0" max="90" className="w-20 border border-orange-300 rounded px-2 py-1 text-sm"
                  value={hrForm.salaryHoldDays}
                  onChange={e => { setHrForm(f => ({ ...f, salaryHoldDays: e.target.value, salaryHoldUntil: '' })); }} />
                <span className="text-xs text-orange-600">(default 45 days from est. LWD; set 0 for immediate)</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm text-orange-800 font-medium whitespace-nowrap">Settlement (hold until) date:</label>
                <input type="date" className="border border-orange-300 rounded px-2 py-1 text-sm"
                  value={hrForm.salaryHoldUntil || sep.salaryHoldUntil || ''}
                  onChange={e => setHrForm(f => ({ ...f, salaryHoldUntil: e.target.value }))} />
                <span className="text-xs text-orange-600">
                  {hrForm.salaryHoldUntil && hrForm.salaryHoldUntil !== sep.salaryHoldUntil
                    ? 'Modified by HR'
                    : `Auto: Est. LWD (${sep.expectedLWD}) + 45 days`}
                </span>
              </div>
            </div>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="HR note (optional)" value={hrForm.hrNote} onChange={e => setHrForm(f => ({ ...f, hrNote: e.target.value }))} />
            <button onClick={handleHRConfirm} disabled={acting} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {acting ? 'Confirming...' : '✔ Confirm LWD & Block Leaves'}
            </button>
          </div>
        )}
        {isDone('pending_hr') && (
          <p className="text-sm text-green-700">✓ LWD confirmed: <strong>{lwd}</strong> on {sep.hrConfirmedAt}. All leaves blocked.</p>
        )}
      </StepPanel>

      {/* STEP 3 — Notice Period */}
      <StepPanel stepKey="notice_period" stepNum={3} title="Monitor Notice Period">
        {isCurrent('notice_period') && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">LWD</span><strong>{lwd}</strong></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">Days Remaining</span><strong className={sep.daysRemainingInNotice <= 0 ? 'text-green-600' : 'text-gray-800'}>{sep.daysRemainingInNotice <= 0 ? '0 — Ready!' : sep.daysRemainingInNotice}</strong></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">Leave Days Taken</span><strong>{sep.leaveDaysDuringNotice || 0}</strong></div>
            </div>
            <p className="text-xs text-gray-500">Any leave during notice period automatically extends the LWD.</p>
            <div className="pt-1">
              {today >= lwd ? (
                <button onClick={() => handleStartClearance(false)} disabled={acting}
                  className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  {acting ? 'Please wait...' : 'Proceed to Clearance →'}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                    ⏳ Last working day ({lwd}) is not yet reached. Employee is still serving notice period.
                  </p>
                  <button
                    onClick={() => { if (window.confirm(`Employee's LWD is ${lwd} which has not passed yet. Start clearance early?`)) handleStartClearance(true); }}
                    disabled={acting}
                    className="bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {acting ? 'Please wait...' : 'Employee Has Left Early — Start Clearance'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {isDone('notice_period') && (
          <p className="text-sm text-green-700">✓ Notice period completed. LWD: <strong>{lwd}</strong></p>
        )}
      </StepPanel>

      {/* STEP 4 — Clearance Checklist */}
      <StepPanel stepKey="clearance" stepNum={4} title={`Clearance Checklist ${checklistTotal > 0 ? `(${checklistDone}/${checklistTotal})` : ''}`}>
        {isCurrent('clearance') && (
          <div className="space-y-4">
            {/* Progress bar */}
            {checklistTotal > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span><span>{checklistDone}/{checklistTotal} done</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${allClear ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.round((checklistDone / checklistTotal) * 100)}%` }} />
                </div>
              </div>
            )}

            {!sep.checklist?.length && <p className="text-sm text-gray-400">Loading checklist...</p>}

            {['IT', 'Admin', 'Finance', 'Manager', 'HR'].map(dept => {
              const items = sep.checklist?.filter(c => c.department === dept) || [];
              if (!items.length) return null;
              return (
                <div key={dept}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{dept}</p>
                  <div className="space-y-1">
                    {items.map(item => {
                      const done = item.status === 'done';
                      return (
                        <div key={item.id} onClick={() => !acting && handleChecklistUpdate(item.id, done ? 'pending' : 'done')}
                          className={`flex items-center gap-3 py-2.5 px-3 rounded-lg border cursor-pointer transition-all select-none ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                            {done && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span className={`flex-1 text-sm ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.task}</span>
                          {item.completedBy && <span className="text-xs text-gray-400">{item.completedBy.name}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {allClear && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">✅ All items cleared — ready for FnF!</p>
                  <p className="text-xs text-green-600 mt-0.5">Proceed to calculate the Full & Final settlement below.</p>
                </div>
              </div>
            )}
          </div>
        )}
        {isDone('clearance') && (
          <p className="text-sm text-green-700">✓ All {checklistTotal} clearance items completed.</p>
        )}
      </StepPanel>

      {/* STEP 5 — FnF Calculation */}
      <StepPanel stepKey="fnf_pending" stepNum={5} title="Calculate Full & Final Settlement">
        {(isCurrent('fnf_pending') || isDone('fnf_pending')) && (
          <div className="space-y-4">
            {fnfErr && <AlertMessage type="error" message={fnfErr} />}

            {/* Saved FnF */}
            {sep.fnfItems?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">Saved Settlement</p>
                  {sep.fnfApprovedAt
                    ? <span className="text-xs text-green-600 font-medium">✅ Approved {sep.fnfApprovedAt}</span>
                    : <span className="text-xs text-gray-400">Not yet approved</span>}
                </div>
                <FnFTable items={sep.fnfItems} netAmount={sep.fnfNetAmount} />
              </div>
            )}

            {/* Calculator — only show if not yet approved */}
            {!sep.fnfApprovedAt && (
              <>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">FnF Calculator</p>
                  {fnfPreview?.manualMode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-800">
                      ⚠️ No salary structure found. Amounts are ₹0 — override each item or add custom items.
                    </div>
                  )}
                  {fnfPreview?.isHistorical && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-sm text-purple-800">
                      📋 Historical record — this separation was initiated before April 2026. The 45-day salary hold check is bypassed; HR can override amounts freely.
                    </div>
                  )}
                  {fnfPreview && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs text-gray-600 space-y-1">
                      <div className="flex flex-wrap gap-6">
                        <span><strong>LWD:</strong> {fnfPreview.lastWorkingDate}</span>
                        <span><strong>Gross Monthly:</strong> ₹{fnfPreview.grossMonthly?.toFixed(2)}</span>
                        <span><strong>Daily Rate:</strong> ₹{fnfPreview.dailyRate?.toFixed(2)}/day</span>
                      </div>
                      {fnfPreview.formula && (
                        <p className="text-indigo-700 font-medium">Formula: {fnfPreview.formula}</p>
                      )}
                      {fnfPreview.lwdMonth && (
                        <p className="text-blue-700">
                          Salary for <strong>{fnfPreview.lwdMonth}</strong> will appear in payslip with <strong>"On Hold"</strong> status until{' '}
                          <strong>{fnfPreview.salaryReleaseDate}</strong> (45 days after LWD).
                          {fnfPreview.isHistorical && ' For historical records, HR can release immediately.'}
                        </p>
                      )}
                      <p className="text-orange-600 text-xs">Note: Notice period recovery is not auto-deducted — LWD confirmed by HR is treated as the mutually agreed date. Add a custom deduction below if recovery applies.</p>
                    </div>
                  )}

                  {fnfPreview?.items?.map((item, idx) => (
                    <div key={idx} className={`flex items-center gap-2 py-2 border-b border-gray-100 last:border-0 ${fnfExcluded[idx] ? 'opacity-40' : ''}`}>
                      <button title={fnfExcluded[idx] ? 'Include' : 'Exclude'} onClick={() => setFnfExcluded(e => ({ ...e, [idx]: !e[idx] }))}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 border ${fnfExcluded[idx] ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100'}`}>
                        {fnfExcluded[idx] ? '+' : '✕'}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-gray-700 ${fnfExcluded[idx] ? 'line-through' : ''}`}>{item.label}</p>
                        {item.note && <p className="text-xs text-gray-400">{item.note}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded hidden sm:block ${item.amount < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{item.component.replace(/_/g, ' ')}</span>
                      <input type="number" disabled={fnfExcluded[idx]}
                        className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-blue-500 disabled:opacity-40"
                        value={fnfOverrides[idx] !== undefined ? fnfOverrides[idx] : item.amount}
                        onChange={e => setFnfOverrides(o => ({ ...o, [idx]: e.target.value }))} />
                    </div>
                  ))}

                  {fnfCustomItems.map((ci, ci_idx) => (
                    <div key={`c-${ci_idx}`} className="flex items-center gap-2 py-2 border-b border-blue-100 bg-blue-50 rounded px-2">
                      <button onClick={() => setFnfCustomItems(l => l.filter((_, i) => i !== ci_idx))}
                        className="w-6 h-6 rounded bg-red-50 text-red-500 border border-red-200 flex items-center justify-center text-xs flex-shrink-0">✕</button>
                      <div className="flex-1"><p className="text-sm text-blue-800 font-medium">{ci.label}</p><p className="text-xs text-blue-500">Custom</p></div>
                      <span className={`text-sm font-semibold ${ci.type === 'deduction' ? 'text-red-600' : 'text-green-700'}`}>
                        {ci.type === 'deduction' ? '−' : '+'}₹{Math.abs(parseFloat(ci.amount || 0)).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {showCustomItemForm ? (
                    <div className="border border-blue-200 rounded-lg p-3 mt-2 bg-blue-50 space-y-2">
                      <p className="text-xs font-semibold text-blue-800">Add Custom Line Item</p>
                      <input type="text" placeholder="e.g. Gratuity, Bonus, Deduction" className="w-full border border-blue-200 rounded px-2 py-1 text-sm"
                        value={customItemDraft.label} onChange={e => setCustomItemDraft(d => ({ ...d, label: e.target.value }))} />
                      <div className="flex gap-2">
                        <select className="border border-blue-200 rounded px-2 py-1 text-sm" value={customItemDraft.type} onChange={e => setCustomItemDraft(d => ({ ...d, type: e.target.value }))}>
                          <option value="earning">+ Earning</option>
                          <option value="deduction">− Deduction</option>
                        </select>
                        <input type="number" placeholder="Amount ₹" className="flex-1 border border-blue-200 rounded px-2 py-1 text-sm"
                          value={customItemDraft.amount} onChange={e => setCustomItemDraft(d => ({ ...d, amount: e.target.value }))} />
                        <button onClick={() => { if (!customItemDraft.label || !customItemDraft.amount) return; setFnfCustomItems(l => [...l, { ...customItemDraft }]); setCustomItemDraft({ label: '', amount: '', type: 'earning' }); setShowCustomItemForm(false); }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Add</button>
                        <button onClick={() => setShowCustomItemForm(false)} className="border border-gray-300 text-gray-600 px-3 py-1 rounded text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCustomItemForm(true)} className="mt-2 text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100">
                      + Add custom item (Gratuity / Bonus / Other)
                    </button>
                  )}

                  {fnfPreview && (
                    <>
                      <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-3 mt-3">
                        <span>Net FnF Payable</span>
                        <span className={fnfNetCalc() >= 0 ? 'text-green-700' : 'text-red-600'}>₹{fnfNetCalc().toFixed(2)}</span>
                      </div>
                      <div className="flex gap-3 mt-3">
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
              </>
            )}
          </div>
        )}
      </StepPanel>

      {/* STEP 6 — FnF Approval */}
      <StepPanel stepKey="fnf_approved" stepNum={6} title="Approve Full & Final Settlement">
        {isCurrent('fnf_approved') && (
          <div className="space-y-3">
            {sep.fnfItems?.length > 0 ? (
              <>
                <FnFTable items={sep.fnfItems} netAmount={sep.fnfNetAmount} />
                {!sep.fnfApprovedAt && (
                  <button onClick={handleFnFApprove} disabled={acting} className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {acting ? 'Approving...' : '✅ Approve FnF — Notify Employee'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">Save FnF in Step 5 first before approving.</p>
            )}
          </div>
        )}
        {isDone('fnf_approved') && (
          <p className="text-sm text-green-700">✓ FnF approved on {sep.fnfApprovedAt}. Net: <strong>₹{sep.fnfNetAmount?.toFixed(2)}</strong></p>
        )}
      </StepPanel>

      {/* STEP 7 — Generate Letters (resignation only) */}
      {sep.type === 'resignation' && (
        <StepPanel stepKey="fnf_approved" stepNum={7} title="Generate Relieving & Experience Letters">
          {(isDone('fnf_pending') || isCurrent('fnf_approved') || isDone('fnf_approved')) && (
            <div className="space-y-3">
              {lettersErr && <AlertMessage type="error" message={lettersErr} />}
              <div className="flex gap-2">
                <button onClick={handleSeedTemplates} disabled={seedingTemplates} className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {seedingTemplates ? 'Creating...' : '⚙ Init Templates'}
                </button>
                <button onClick={handleGenerateDocuments} disabled={acting} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {acting ? 'Generating...' : sep.documentsGenerated ? '↺ Regenerate' : '📄 Generate Letters'}
                </button>
              </div>
              {lettersLoading ? <p className="text-sm text-gray-400">Loading...</p> : sepLetters?.map(letter => (
                <div key={letter.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${letter.letterType === 'experience' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {letter.letterType === 'experience' ? '🎓 Experience Letter' : '✉️ Relieving Letter'}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">Generated {new Date(letter.generatedAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload(letter.id, 'pdf', `${letter.letterType}_${sep.user?.name?.replace(/\s+/g, '_')}`)}
                      className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100">⬇ PDF</button>
                    <button onClick={() => handleDownload(letter.id, 'docx', `${letter.letterType}_${sep.user?.name?.replace(/\s+/g, '_')}`)}
                      className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100">⬇ Word</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StepPanel>
      )}

      {/* STEP 8 — Release Salary */}
      <StepPanel stepKey="fnf_approved" stepNum={sep.type === 'resignation' ? 8 : 7} title="Release Held Salary">
        {(isDone('fnf_pending') || isCurrent('fnf_approved') || isDone('fnf_approved')) && sep.salaryHoldUntil && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">Hold Until</span><strong>{sep.salaryHoldUntil}</strong></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">Days Remaining</span><strong className={sep.daysUntilSalaryRelease <= 0 ? 'text-green-600' : 'text-gray-800'}>{sep.daysUntilSalaryRelease <= 0 ? 'Ready' : sep.daysUntilSalaryRelease}</strong></div>
              <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-500 block">Total Held</span><strong>₹{sep.totalHeldAmount?.toFixed(2) || '0'}</strong></div>
            </div>
            {sep.salaryReleased ? (
              <p className="text-sm text-green-700">✅ Salary released on {sep.salaryReleasedAt}</p>
            ) : (
              <button onClick={handleReleaseSalary} disabled={acting || !sep.fnfApprovedAt}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${holdDue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {acting ? 'Releasing...' : holdDue ? '🔓 Release Now' : '🔓 Release Early'}
              </button>
            )}
          </div>
        )}
      </StepPanel>

      {/* STEP 9 — Complete */}
      <StepPanel stepKey="completed" stepNum={sep.type === 'resignation' ? 9 : 8} title="Complete Separation">
        {sep.salaryReleased && sep.fnfApprovedAt && !isCurrent('completed') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">All steps complete. Click below to close this separation and activate the Alumni Portal for {sep.user?.name}.</p>
            <button onClick={handleComplete} disabled={acting} className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {acting ? 'Completing...' : '🎓 Complete Separation & Activate Alumni'}
            </button>
          </div>
        )}
        {isCurrent('completed') && (
          <p className="text-sm text-green-700">✓ Separation completed. Alumni portal is active for {sep.user?.name}.</p>
        )}
      </StepPanel>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function FnFTable({ items, netAmount }) {
  if (!items?.length) return null;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-sm">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
          <span className="text-gray-700">{item.label}</span>
          <span className={`font-medium ${item.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
            {item.amount < 0 ? '−' : '+'}₹{Math.abs(item.amount).toFixed(2)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 font-bold">
        <span>Net FnF</span>
        <span className={netAmount >= 0 ? 'text-green-700' : 'text-red-600'}>₹{netAmount?.toFixed(2)}</span>
      </div>
    </div>
  );
}
