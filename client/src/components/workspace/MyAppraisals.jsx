import { useState } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { ClipboardCheck, Star, ChevronDown, ChevronRight, X } from 'lucide-react';

const REVIEW_STATUS_STYLES = {
  pending:          { label: 'Pending Self-Assessment', className: 'bg-amber-100 text-amber-700' },
  self_submitted:   { label: 'Awaiting Manager Review', className: 'bg-blue-100 text-blue-700'   },
  manager_reviewed: { label: 'Manager Reviewed',        className: 'bg-indigo-100 text-indigo-700' },
  completed:        { label: 'Completed',               className: 'bg-green-100 text-green-700'  },
};

const RATING_LABEL = (r) => {
  if (r == null) return null;
  if (r >= 4.5) return 'Outstanding';
  if (r >= 3.5) return 'Exceeds Expectations';
  if (r >= 2.5) return 'Meets Expectations';
  if (r >= 1.5) return 'Needs Improvement';
  return 'Unsatisfactory';
};

const RATING_COLOR = (r) => {
  if (r == null) return 'text-slate-500';
  if (r >= 4.5) return 'text-purple-600';
  if (r >= 3.5) return 'text-blue-600';
  if (r >= 2.5) return 'text-green-600';
  if (r >= 1.5) return 'text-amber-600';
  return 'text-red-600';
};

// ── Self-Assessment Form Modal ─────────────────────────────────────────────────
function SelfAssessmentModal({ review, onClose, onSaved }) {
  const sections = review.cycle?.templateSections ? JSON.parse(review.cycle.templateSections) : [];
  const existing = review.selfScores ? JSON.parse(review.selfScores) : [];

  const [scores, setScores] = useState(
    sections.map(sec => {
      const ex = existing.find(s => String(s.sectionId) === String(sec.id));
      return { sectionId: sec.id, score: ex?.score ?? '', comment: ex?.comment ?? '' };
    })
  );
  const [comment, setComment] = useState(review.employeeComment || '');
  const { execute, loading, error } = useApi();

  const updateScore = (idx, field, value) => {
    const s = [...scores];
    s[idx] = { ...s[idx], [field]: value };
    setScores(s);
  };

  const allScored = scores.every(s => s.score !== '' && s.score >= 0);

  const handleSubmit = async () => {
    try {
      await execute(() => api.put(`/appraisals/reviews/${review.id}/self`, {
        scores: scores.map(s => ({ ...s, score: parseFloat(s.score) })),
        comment,
      }));
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Self-Assessment</h2>
            <p className="text-sm text-slate-500">{review.cycle?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
            Rate yourself honestly on each section. Your manager will review your scores and provide their own assessment.
          </div>

          {sections.map((sec, idx) => (
            <div key={sec.id} className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700">{sec.name}</span>
                <span className="text-xs text-slate-400">Weight: {sec.weight}% · Score 1–{sec.maxScore}</span>
              </div>

              {/* Star-style buttons */}
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: sec.maxScore }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => updateScore(idx, 'score', n)}
                    className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all ${
                      scores[idx]?.score >= n
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {scores[idx]?.score !== '' && (
                  <span className="ml-2 text-sm text-blue-600 font-medium">
                    {scores[idx].score}/{sec.maxScore}
                  </span>
                )}
              </div>

              <input
                type="text"
                value={scores[idx]?.comment ?? ''}
                onChange={e => updateScore(idx, 'comment', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief comment (optional)"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Overall Comment (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Summarise your achievements, challenges and goals for next period…"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !allScored}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title={!allScored ? 'Please score all sections' : ''}
          >
            {loading ? 'Submitting…' : 'Submit Self-Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Card (expanded view) ────────────────────────────────────────────────
function ReviewCard({ review, onAssess }) {
  const [expanded, setExpanded] = useState(false);
  const sections = review.cycle?.templateSections ? JSON.parse(review.cycle.templateSections) : [];
  const selfScores = review.selfScores ? JSON.parse(review.selfScores) : [];
  const managerScores = review.managerScores ? JSON.parse(review.managerScores) : [];

  const isPending   = review.status === 'pending';
  const isCycleActive = review.cycle?.status === 'active';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-800">{review.cycle?.name}</span>
            <StatusBadge status={review.status} styles={REVIEW_STATUS_STYLES} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">
            {review.cycle?.period?.replace('_', '-')} · {review.cycle?.year}
            {review.reviewer?.name && ` · Reviewer: ${review.reviewer.name}`}
          </p>
        </div>

        {/* Ratings */}
        <div className="hidden sm:flex items-center gap-4 text-sm">
          {review.selfRating != null && (
            <div className="text-center">
              <p className="text-xs text-slate-400">Self</p>
              <p className="font-bold text-blue-600">{review.selfRating}</p>
            </div>
          )}
          {review.managerRating != null && (
            <div className="text-center">
              <p className="text-xs text-slate-400">Manager</p>
              <p className="font-bold text-green-600">{review.managerRating}</p>
            </div>
          )}
          {review.finalRating != null && (
            <div className="text-center">
              <p className="text-xs text-slate-400">Final</p>
              <p className={`text-xl font-black ${RATING_COLOR(review.finalRating)}`}>{review.finalRating}</p>
            </div>
          )}
        </div>

        {/* Action button */}
        {isPending && isCycleActive && (
          <button
            onClick={() => onAssess(review)}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            <ClipboardCheck className="w-4 h-4" /> Start Assessment
          </button>
        )}
        {review.status === 'self_submitted' && isCycleActive && (
          <button
            onClick={() => onAssess(review)}
            className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200"
          >
            Edit Submission
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Cycle dates */}
          <div className="flex gap-6 text-xs text-slate-500">
            <span>Period: <strong>{formatDate(review.cycle?.startDate)}</strong> → <strong>{formatDate(review.cycle?.endDate)}</strong></span>
          </div>

          {/* Section scores comparison */}
          {sections.length > 0 && (selfScores.length > 0 || managerScores.length > 0) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase">Section</th>
                    <th className="py-2 text-right text-xs font-semibold text-slate-500 uppercase">Weight</th>
                    <th className="py-2 text-right text-xs font-semibold text-blue-500 uppercase">Self</th>
                    <th className="py-2 text-right text-xs font-semibold text-green-600 uppercase">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(sec => {
                    const ss = selfScores.find(s => String(s.sectionId) === String(sec.id));
                    const ms = managerScores.find(s => String(s.sectionId) === String(sec.id));
                    return (
                      <tr key={sec.id} className="border-b border-slate-50">
                        <td className="py-2 text-slate-700">{sec.name}</td>
                        <td className="py-2 text-right text-slate-400">{sec.weight}%</td>
                        <td className="py-2 text-right font-medium text-blue-600">
                          {ss?.score != null ? `${ss.score}/${sec.maxScore}` : '—'}
                          {ss?.comment && <span className="block text-xs text-slate-400 font-normal">{ss.comment}</span>}
                        </td>
                        <td className="py-2 text-right font-medium text-green-600">
                          {ms?.score != null ? `${ms.score}/${sec.maxScore}` : '—'}
                          {ms?.comment && <span className="block text-xs text-slate-400 font-normal">{ms.comment}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Comments */}
          {review.employeeComment && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-600 mb-1">Your Comment</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.employeeComment}</p>
            </div>
          )}
          {review.managerComment && (
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-600 mb-1">Manager's Comment</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.managerComment}</p>
            </div>
          )}

          {/* Final result */}
          {review.status === 'completed' && review.finalRating != null && (
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Final Rating</p>
              <p className={`text-4xl font-black mb-1 ${RATING_COLOR(review.finalRating)}`}>{review.finalRating}</p>
              <p className={`text-sm font-semibold ${RATING_COLOR(review.finalRating)}`}>{RATING_LABEL(review.finalRating)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main: My Appraisals ────────────────────────────────────────────────────────
export default function MyAppraisals() {
  const [assessModal, setAssessModal] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data: reviews, loading, error } = useFetch('/appraisals/my', [], [refresh]);

  const pending   = (reviews || []).filter(r => r.status === 'pending' && r.cycle?.status === 'active');
  const inProgress = (reviews || []).filter(r => ['self_submitted', 'manager_reviewed'].includes(r.status));
  const completed  = (reviews || []).filter(r => r.status === 'completed');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Appraisals</h1>
        <p className="text-sm text-slate-500 mt-0.5">View your performance reviews and submit self-assessments</p>
      </div>

      {error && <AlertMessage type="error" message={error} />}
      {loading ? <LoadingSpinner /> : (reviews || []).length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-slate-600">No appraisal reviews yet</p>
          <p className="text-sm mt-1">Your HR team will create appraisal cycles and assign reviews</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Action Required ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map(r => (
                  <ReviewCard key={r.id} review={r} onAssess={setAssessModal} />
                ))}
              </div>
            </div>
          )}

          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-3">
                {inProgress.map(r => (
                  <ReviewCard key={r.id} review={r} onAssess={setAssessModal} />
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Completed ({completed.length})
              </h2>
              <div className="space-y-3">
                {completed.map(r => (
                  <ReviewCard key={r.id} review={r} onAssess={setAssessModal} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {assessModal && (
        <SelfAssessmentModal
          review={assessModal}
          onClose={() => setAssessModal(null)}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}
    </div>
  );
}
