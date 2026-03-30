import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import { useFetch } from '../../hooks/useFetch';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { Plus, ChevronDown, ChevronRight, Users, CheckCircle, Clock, BarChart3, RefreshCw, Edit2, Lock, Unlock, X, TrendingUp, IndianRupee } from 'lucide-react';

const CYCLE_STATUS_STYLES = {
  draft:  { label: 'Draft',  className: 'bg-slate-100 text-slate-600' },
  active: { label: 'Active', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', className: 'bg-red-100 text-red-600' },
};

const REVIEW_STATUS_STYLES = {
  pending:          { label: 'Pending',          className: 'bg-slate-100 text-slate-600' },
  self_submitted:   { label: 'Self Submitted',   className: 'bg-blue-100 text-blue-700' },
  manager_reviewed: { label: 'Manager Reviewed', className: 'bg-amber-100 text-amber-700' },
  completed:        { label: 'Completed',        className: 'bg-green-100 text-green-700' },
};

const RATING_LABEL = (r) => {
  if (r == null) return '—';
  if (r >= 4.5) return `${r} ⭐ Outstanding`;
  if (r >= 3.5) return `${r} ⭐ Exceeds Expectations`;
  if (r >= 2.5) return `${r} ⭐ Meets Expectations`;
  if (r >= 1.5) return `${r} ⭐ Needs Improvement`;
  return `${r} ⭐ Unsatisfactory`;
};

const DEFAULT_SECTIONS = [
  { id: '1', name: 'Work Quality',  weight: 25, maxScore: 5 },
  { id: '2', name: 'Productivity',  weight: 25, maxScore: 5 },
  { id: '3', name: 'Teamwork',      weight: 20, maxScore: 5 },
  { id: '4', name: 'Initiative',    weight: 20, maxScore: 5 },
  { id: '5', name: 'Attitude',      weight: 10, maxScore: 5 },
];

// ── Create/Edit Cycle Modal ────────────────────────────────────────────────────
function CycleModal({ cycle, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: cycle?.name || '',
    period: cycle?.period || 'annual',
    year: cycle?.year || new Date().getFullYear(),
    startDate: cycle?.startDate || '',
    endDate: cycle?.endDate || '',
    sections: cycle?.templateSections ? JSON.parse(cycle.templateSections) : DEFAULT_SECTIONS,
  });
  const { execute, loading, error } = useApi();

  const handleSave = async () => {
    try {
      const payload = { ...form, templateSections: form.sections };
      if (cycle) {
        await execute(() => api.put(`/appraisals/cycles/${cycle.id}`, payload));
      } else {
        await execute(() => api.post('/appraisals/cycles', payload));
      }
      onSaved();
      onClose();
    } catch {}
  };

  const updateSection = (idx, field, value) => {
    const secs = [...form.sections];
    secs[idx] = { ...secs[idx], [field]: field === 'weight' || field === 'maxScore' ? parseInt(value) || 0 : value };
    setForm(f => ({ ...f, sections: secs }));
  };

  const totalWeight = form.sections.reduce((s, sec) => s + (sec.weight || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{cycle ? 'Edit Cycle' : 'New Appraisal Cycle'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {error && <AlertMessage type="error" message={error} />}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Cycle Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Annual Review 2026"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Period *</label>
              <select
                value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="annual">Annual</option>
                <option value="half_yearly">Half-Yearly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Year *</label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Self-Assessment Opens *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Manager Review Deadline *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Template Sections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Rating Sections</label>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${totalWeight === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                Total weight: {totalWeight}% {totalWeight !== 100 ? '(must = 100%)' : '✓'}
              </span>
            </div>
            <div className="space-y-2">
              {form.sections.map((sec, idx) => (
                <div key={sec.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg px-3 py-2">
                  <input
                    className="col-span-5 border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={sec.name}
                    onChange={e => updateSection(idx, 'name', e.target.value)}
                    placeholder="Section name"
                  />
                  <div className="col-span-3 flex items-center gap-1">
                    <input
                      type="number"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={sec.weight}
                      onChange={e => updateSection(idx, 'weight', e.target.value)}
                      min={0} max={100}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                  <div className="col-span-3 flex items-center gap-1">
                    <span className="text-xs text-slate-400">Max:</span>
                    <input
                      type="number"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={sec.maxScore}
                      onChange={e => updateSection(idx, 'maxScore', e.target.value)}
                      min={1} max={10}
                    />
                  </div>
                  <button
                    onClick={() => setForm(f => ({ ...f, sections: f.sections.filter((_, i) => i !== idx) }))}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setForm(f => ({
                  ...f,
                  sections: [...f.sections, { id: String(Date.now()), name: '', weight: 0, maxScore: 5 }],
                }))}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Section
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || totalWeight !== 100}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : cycle ? 'Save Changes' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Detail Modal (Manager fills in scores) ──────────────────────────────
function ReviewDetailModal({ review, onClose, onSaved, isManagerMode }) {
  const sections = review.cycle?.templateSections ? JSON.parse(review.cycle.templateSections) : [];
  const existingScores = isManagerMode
    ? (review.managerScores ? JSON.parse(review.managerScores) : [])
    : (review.selfScores ? JSON.parse(review.selfScores) : []);

  const [scores, setScores] = useState(
    sections.map(sec => {
      const existing = existingScores.find(s => String(s.sectionId) === String(sec.id));
      return { sectionId: sec.id, score: existing?.score ?? '', comment: existing?.comment ?? '' };
    })
  );
  const [comment, setComment] = useState(isManagerMode ? (review.managerComment || '') : (review.employeeComment || ''));
  const [finalRating, setFinalRating] = useState(review.finalRating ?? '');
  const [hrNotes, setHrNotes] = useState(review.hrNotes || '');
  const { execute, loading, error } = useApi();

  const updateScore = (idx, field, value) => {
    const s = [...scores];
    s[idx] = { ...s[idx], [field]: value };
    setScores(s);
  };

  const handleSubmit = async () => {
    try {
      const endpoint = isManagerMode
        ? `/appraisals/reviews/${review.id}/manager`
        : `/appraisals/reviews/${review.id}/self`;
      const payload = isManagerMode
        ? { scores, comment, finalRating: finalRating !== '' ? parseFloat(finalRating) : undefined }
        : { scores, comment };
      await execute(() => api.put(endpoint, payload));
      onSaved();
      onClose();
    } catch {}
  };

  const handleComplete = async () => {
    try {
      await execute(() => api.put(`/appraisals/reviews/${review.id}/complete`, { finalRating: finalRating !== '' ? parseFloat(finalRating) : undefined, hrNotes }));
      onSaved();
      onClose();
    } catch {}
  };

  const selfScores = review.selfScores ? JSON.parse(review.selfScores) : [];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isManagerMode ? 'Manager Review' : 'View Review'}
            </h2>
            <p className="text-sm text-slate-500">{review.employee?.name} — {review.cycle?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && <AlertMessage type="error" message={error} />}

          {/* Employee info */}
          <div className="bg-slate-50 rounded-xl p-4 flex gap-6 flex-wrap text-sm">
            <div><span className="text-slate-500">Employee:</span> <span className="font-medium">{review.employee?.name}</span></div>
            <div><span className="text-slate-500">Dept:</span> <span className="font-medium">{review.employee?.department || '—'}</span></div>
            <div><span className="text-slate-500">Status:</span> <StatusBadge status={review.status} styles={REVIEW_STATUS_STYLES} /></div>
            {review.selfRating != null && <div><span className="text-slate-500">Self Rating:</span> <span className="font-medium text-blue-600">{review.selfRating}</span></div>}
            {review.managerRating != null && <div><span className="text-slate-500">Mgr Rating:</span> <span className="font-medium text-green-600">{review.managerRating}</span></div>}
          </div>

          {/* Self scores (read-only reference for manager) */}
          {isManagerMode && selfScores.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-700 mb-2">Employee Self-Assessment</p>
              <div className="space-y-1">
                {sections.map(sec => {
                  const ss = selfScores.find(s => String(s.sectionId) === String(sec.id));
                  return (
                    <div key={sec.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{sec.name}</span>
                      <span className="font-medium text-blue-700">{ss?.score ?? '—'}/{sec.maxScore}{ss?.comment ? ` — "${ss.comment}"` : ''}</span>
                    </div>
                  );
                })}
              </div>
              {review.employeeComment && <p className="mt-2 text-xs text-slate-600 italic">"{review.employeeComment}"</p>}
            </div>
          )}

          {/* Score input per section */}
          {(isManagerMode || review.status === 'self_submitted') && sections.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">{isManagerMode ? 'Manager Scores' : ''}</p>
              <div className="space-y-3">
                {sections.map((sec, idx) => (
                  <div key={sec.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{sec.name}</span>
                      <span className="text-xs text-slate-400">Weight: {sec.weight}% · Max: {sec.maxScore}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={0} max={sec.maxScore} step={0.5}
                        value={scores[idx]?.score ?? ''}
                        onChange={e => updateScore(idx, 'score', parseFloat(e.target.value))}
                        disabled={!isManagerMode}
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        placeholder="0"
                      />
                      <input
                        type="text"
                        value={scores[idx]?.comment ?? ''}
                        onChange={e => updateScore(idx, 'comment', e.target.value)}
                        disabled={!isManagerMode}
                        className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                        placeholder="Comment (optional)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall comment */}
          {isManagerMode && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Overall Manager Comment</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Overall feedback for this employee…"
              />
            </div>
          )}

          {/* HR final rating & notes (for complete action) */}
          {isManagerMode && review.status === 'manager_reviewed' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-700">Finalize Review</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Final Rating Override (optional, 0–5)</label>
                  <input
                    type="number" min={0} max={5} step={0.1}
                    value={finalRating}
                    onChange={e => setFinalRating(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={review.managerRating ?? ''}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">HR Notes</label>
                  <input
                    value={hrNotes}
                    onChange={e => setHrNotes(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Finalizing…' : 'Mark as Completed'}
              </button>
            </div>
          )}

          {/* View-only: completed review */}
          {!isManagerMode && review.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-green-700">Review Completed</p>
              {review.finalRating != null && <p className="text-sm text-slate-700">{RATING_LABEL(review.finalRating)}</p>}
              {review.managerComment && <p className="text-sm text-slate-600 italic">"{review.managerComment}"</p>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Close</button>
          {isManagerMode && review.status !== 'completed' && review.status !== 'manager_reviewed' && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit Manager Review'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Increment Modal ────────────────────────────────────────────────────────────
function IncrementModal({ review, onClose, onSaved }) {
  const [form, setForm] = useState({
    newCtcAnnual: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    reason: `Performance increment — ${review?.cycle?.name || 'Appraisal'}`,
  });
  const [salaryData, setSalaryData] = useState(null);
  const { execute, loading, error } = useApi();

  useEffect(() => {
    if (!review?.employeeId) return;
    api.get(`/payroll/salary/${review.employeeId}`)
      .then(r => setSalaryData(r.data))
      .catch(() => {});
  }, [review?.employeeId]);

  const currentCTC = salaryData?.ctcAnnual || 0;
  const newCTC = parseFloat(form.newCtcAnnual) || 0;
  const increment = newCTC - currentCTC;
  const incrementPct = currentCTC > 0 && increment > 0 ? ((increment / currentCTC) * 100).toFixed(2) : null;

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/payroll/increment', {
        userId: review.employeeId,
        newCtcAnnual: newCTC,
        effectiveFrom: form.effectiveFrom,
        reason: form.reason,
        appraisalReviewId: review.id,
      }), `Increment applied! ${incrementPct}% raise.`);
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Propose Salary Increment</h2>
            <p className="text-sm text-slate-500">{review?.employee?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          <div className="bg-slate-50 rounded-xl p-4 flex justify-between text-sm">
            <div><p className="text-slate-500 text-xs">Current CTC (Annual)</p><p className="font-bold text-slate-700">{formatINR(currentCTC)}</p></div>
            {review?.finalRating && <div><p className="text-slate-500 text-xs">Final Rating</p><p className="font-bold text-amber-600">{review.finalRating} / 5</p></div>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">New Annual CTC (₹) *</label>
            <input
              type="number"
              value={form.newCtcAnnual}
              onChange={e => setForm(f => ({ ...f, newCtcAnnual: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={`Current: ${currentCTC}`}
            />
            {incrementPct && (
              <p className="text-sm text-green-600 mt-1">
                +{incrementPct}% increment — {formatINR(increment)} raise — new monthly: {formatINR(newCTC / 12)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Effective From *</label>
            <input
              type="date"
              value={form.effectiveFrom}
              onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Reason</label>
            <input
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !newCTC || !incrementPct}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Applying…' : 'Apply Increment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AppraisalManager() {
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [editCycle, setEditCycle] = useState(null);
  const [expandedCycle, setExpandedCycle] = useState(null);
  const [cycleDetails, setCycleDetails] = useState({});
  const [reviewModal, setReviewModal] = useState(null); // { review, isManagerMode }
  const [incrementModal, setIncrementModal] = useState(null); // { review }
  const [refresh, setRefresh] = useState(0);

  const { data: cycles, loading, error } = useFetch('/appraisals/cycles', [], [refresh]);
  const { execute, loading: actionLoading } = useApi();
  const [actionErr, setActionErr] = useState('');

  const loadCycleDetails = async (cycleId) => {
    try {
      const res = await api.get(`/appraisals/cycles/${cycleId}`);
      setCycleDetails(d => ({ ...d, [cycleId]: res.data }));
    } catch {}
  };

  const toggleExpand = (cycleId) => {
    if (expandedCycle === cycleId) {
      setExpandedCycle(null);
    } else {
      setExpandedCycle(cycleId);
      if (!cycleDetails[cycleId]) loadCycleDetails(cycleId);
    }
  };

  const handleGenerate = async (cycleId) => {
    setActionErr('');
    try {
      const res = await execute(() => api.post(`/appraisals/cycles/${cycleId}/generate`));
      setCycleDetails(d => ({ ...d, [cycleId]: undefined }));
      loadCycleDetails(cycleId);
      setRefresh(r => r + 1);
      alert(res.data?.message || 'Reviews generated.');
    } catch (err) {
      setActionErr(err?.response?.data?.error || 'Failed to generate reviews.');
    }
  };

  const handleStatusChange = async (cycle, newStatus) => {
    setActionErr('');
    try {
      await execute(() => api.put(`/appraisals/cycles/${cycle.id}`, { status: newStatus }));
      setRefresh(r => r + 1);
    } catch (err) {
      setActionErr(err?.response?.data?.error || 'Failed to update status.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appraisal Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create cycles, generate reviews, track progress</p>
        </div>
        <button
          onClick={() => { setEditCycle(null); setShowCycleModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Cycle
        </button>
      </div>

      {error && <AlertMessage type="error" message={error} />}
      {actionErr && <AlertMessage type="error" message={actionErr} />}

      {loading ? <LoadingSpinner /> : cycles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-slate-600">No appraisal cycles yet</p>
          <p className="text-sm mt-1">Create your first cycle to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cycles.map(cycle => {
            const isExpanded = expandedCycle === cycle.id;
            const detail = cycleDetails[cycle.id];
            const reviews = detail?.reviews || [];
            const stats = cycle.reviewStats || {};
            const totalReviews = cycle._count?.reviews || 0;

            return (
              <div key={cycle.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Cycle header */}
                <div className="px-5 py-4 flex items-center gap-4">
                  <button
                    onClick={() => toggleExpand(cycle.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{cycle.name}</h3>
                      <StatusBadge status={cycle.status} styles={CYCLE_STATUS_STYLES} />
                      <span className="text-xs text-slate-500 capitalize">{cycle.period.replace('_', '-')} · {cycle.year}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(cycle.startDate)} → {formatDate(cycle.endDate)}
                      {totalReviews > 0 && ` · ${totalReviews} reviews`}
                    </p>
                  </div>

                  {/* Stats pills */}
                  <div className="hidden sm:flex items-center gap-2">
                    {stats.completed > 0 && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{stats.completed} done</span>}
                    {stats.manager_reviewed > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{stats.manager_reviewed} mgr reviewed</span>}
                    {stats.self_submitted > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{stats.self_submitted} self done</span>}
                    {stats.pending > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{stats.pending} pending</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {cycle.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange(cycle, 'active')}
                        disabled={actionLoading}
                        className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Activate
                      </button>
                    )}
                    {cycle.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleGenerate(cycle.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                        >
                          <Users className="w-3.5 h-3.5" /> Generate Reviews
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Close this cycle? Employees can no longer submit self-assessments.')) handleStatusChange(cycle, 'closed'); }}
                          disabled={actionLoading}
                          className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                        >
                          <Lock className="w-3.5 h-3.5" /> Close
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setEditCycle(cycle); setShowCycleModal(true); }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: reviews table */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {!detail ? (
                      <div className="p-4 text-center text-slate-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Loading reviews…</div>
                    ) : reviews.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-400">
                        No reviews yet. Click "Generate Reviews" to create reviews for all active employees.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reviewer</th>
                              <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                              <th className="px-4 py-2.5 text-center text-xs font-semibold text-blue-500 uppercase tracking-wide">Self</th>
                              <th className="px-4 py-2.5 text-center text-xs font-semibold text-green-600 uppercase tracking-wide">Manager</th>
                              <th className="px-4 py-2.5 text-center text-xs font-semibold text-amber-600 uppercase tracking-wide">Final</th>
                              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviews.map(r => (
                              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-medium text-slate-800">{r.employee?.name}</td>
                                <td className="px-4 py-2.5 text-slate-500">{r.employee?.department || '—'}</td>
                                <td className="px-4 py-2.5 text-slate-500">{r.reviewer?.name || '—'}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <StatusBadge status={r.status} styles={REVIEW_STATUS_STYLES} />
                                </td>
                                <td className="px-4 py-2.5 text-center font-medium text-blue-600">{r.selfRating ?? '—'}</td>
                                <td className="px-4 py-2.5 text-center font-medium text-green-600">{r.managerRating ?? '—'}</td>
                                <td className="px-4 py-2.5 text-center font-bold text-amber-600">{r.finalRating ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => setReviewModal({ review: { ...r, cycle: detail }, isManagerMode: ['self_submitted', 'manager_reviewed'].includes(r.status) })}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      {['self_submitted', 'manager_reviewed'].includes(r.status) ? 'Review →' : 'View'}
                                    </button>
                                    {r.status === 'completed' && (
                                      <button
                                        onClick={() => setIncrementModal({ review: r })}
                                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-lg hover:bg-green-100 flex items-center gap-1"
                                      >
                                        <TrendingUp className="w-3 h-3" /> Increment
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCycleModal && (
        <CycleModal
          cycle={editCycle}
          onClose={() => { setShowCycleModal(false); setEditCycle(null); }}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}

      {reviewModal && (
        <ReviewDetailModal
          review={reviewModal.review}
          isManagerMode={reviewModal.isManagerMode}
          onClose={() => setReviewModal(null)}
          onSaved={() => {
            setCycleDetails(d => ({ ...d, [reviewModal.review.cycleId]: undefined }));
            loadCycleDetails(reviewModal.review.cycleId);
            setRefresh(r => r + 1);
          }}
        />
      )}

      {incrementModal && (
        <IncrementModal
          review={incrementModal.review}
          onClose={() => setIncrementModal(null)}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}
    </div>
  );
}
