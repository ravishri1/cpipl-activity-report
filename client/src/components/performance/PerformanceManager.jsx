import { useState } from 'react';
import { Plus, Star, ChevronDown, ChevronUp, X, Target } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate } from '../../utils/formatters';
import {
  REVIEW_STATUS_STYLES, GOAL_STATUS_STYLES, REVIEW_CYCLE_TYPES, RATING_LABELS
} from '../../utils/constants';

const TAB_REVIEWS = 'reviews';
const TAB_GOALS = 'goals';

const EMPTY_REVIEW = { userId: '', cycleType: 'annual', periodStart: '', periodEnd: '' };

export default function PerformanceManager() {
  const [tab, setTab] = useState(TAB_REVIEWS);
  const [statusFilter, setStatusFilter] = useState('');
  const { data: reviews, loading: rLoading, error: rError, refetch: refetchReviews } =
    useFetch(`/api/performance/reviews${statusFilter ? `?status=${statusFilter}` : ''}`, []);
  const { data: goals, loading: gLoading, error: gError, refetch: refetchGoals } =
    useFetch('/api/performance/goals', []);
  const { data: users } = useFetch('/api/users/directory', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW);
  const [expanded, setExpanded] = useState(null);
  const [ratingModal, setRatingModal] = useState(null); // { reviewId, field }
  const [ratingVal, setRatingVal] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  function setRField(k, v) { setReviewForm(f => ({ ...f, [k]: v })); }

  async function createReview() {
    await execute(() => api.post('/api/performance/reviews', reviewForm), 'Review cycle created!');
    setShowReviewForm(false); setReviewForm(EMPTY_REVIEW); refetchReviews();
  }

  async function advanceStage(reviewId, stage) {
    const endpointMap = {
      manager_review: 'manager-review',
      hr_review: 'hr-review',
      completed: 'complete',
    };
    const ep = endpointMap[stage];
    if (!ep) return;
    if (stage === 'completed') {
      setRatingModal({ reviewId, field: 'final' });
    } else if (stage === 'manager_review') {
      setRatingModal({ reviewId, field: 'manager' });
    } else {
      await execute(() => api.post(`/api/performance/reviews/${reviewId}/${ep}`, {}), 'Stage advanced!');
      refetchReviews();
    }
  }

  async function submitRating() {
    const { reviewId, field } = ratingModal;
    const payload = field === 'manager'
      ? { managerRating: parseFloat(ratingVal), managerFeedback: feedbackText }
      : { finalRating: parseFloat(ratingVal), incrementRecommendation: feedbackText };
    const ep = field === 'manager' ? 'manager-review' : 'complete';
    await execute(() => api.post(`/api/performance/reviews/${reviewId}/${ep}`, payload), 'Rating submitted!');
    setRatingModal(null); setRatingVal(''); setFeedbackText(''); refetchReviews();
  }

  const loading = tab === TAB_REVIEWS ? rLoading : gLoading;
  const error = tab === TAB_REVIEWS ? rError : gError;

  return (
    <div className="p-6">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Performance Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage review cycles, goals, and ratings</p>
          </div>
          {tab === TAB_REVIEWS && (
            <button onClick={() => setShowReviewForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Initiate Review
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
            {[{ id: TAB_REVIEWS, label: 'Review Cycles' }, { id: TAB_GOALS, label: 'All Goals' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === TAB_REVIEWS && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {['pending','self_review','manager_review','hr_review','completed'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {showReviewForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Initiate Review Cycle</h3>
            <button onClick={() => setShowReviewForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
              <select value={reviewForm.userId} onChange={e => setRField('userId', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select employee...</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cycle Type</label>
              <select value={reviewForm.cycleType} onChange={e => setRField('cycleType', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {REVIEW_CYCLE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period Start</label>
              <input type="date" value={reviewForm.periodStart} onChange={e => setRField('periodStart', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Period End</label>
              <input type="date" value={reviewForm.periodEnd} onChange={e => setRField('periodEnd', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createReview} disabled={saving || !reviewForm.userId}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Review Cycle'}
            </button>
            <button onClick={() => setShowReviewForm(false)}
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {!loading && tab === TAB_REVIEWS && (
        <>
          {reviews.length === 0 && <EmptyState icon="📊" title="No review cycles" subtitle="Initiate a review cycle for an employee" />}
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-800">{r.user?.name}</span>
                      <StatusBadge status={r.status} styles={REVIEW_STATUS_STYLES} />
                      <span className="text-xs text-slate-400 capitalize">{r.cycleType?.replace('_', ' ')} review</span>
                    </div>
                    <p className="text-xs text-slate-500">{r.user?.employeeId} · Period: {r.periodStart ? formatDate(r.periodStart) : '—'} → {r.periodEnd ? formatDate(r.periodEnd) : '—'}</p>
                    <div className="mt-2 flex gap-4 text-sm">
                      {r.selfRating && <span className="text-blue-700">Self: <strong>{r.selfRating}/5</strong></span>}
                      {r.managerRating && <span className="text-green-700">Manager: <strong>{r.managerRating}/5</strong></span>}
                      {r.finalRating && <span className="text-purple-700 font-bold">Final: <strong>{r.finalRating}/5</strong></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {r.status === 'pending' && (
                      <button onClick={() => advanceStage(r.id, 'self_review')}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs hover:bg-amber-100">
                        Open Self Review
                      </button>
                    )}
                    {r.status === 'self_review' && r.selfReview && (
                      <button onClick={() => advanceStage(r.id, 'manager_review')}
                        className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs hover:bg-green-100">
                        Submit Manager Review
                      </button>
                    )}
                    {r.status === 'manager_review' && (
                      <button onClick={() => advanceStage(r.id, 'completed')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100">
                        <Star className="w-3.5 h-3.5" /> Finalize
                      </button>
                    )}
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600">
                      {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expanded === r.id && (
                  <div className="border-t border-slate-100 p-5 bg-slate-50 space-y-3 text-sm">
                    {r.selfReview && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-semibold text-blue-700 mb-1">Self Review ({r.selfRating}/5)</p>
                        <p className="text-blue-800">{r.selfReview}</p>
                      </div>
                    )}
                    {r.managerFeedback && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 mb-1">Manager Feedback ({r.managerRating}/5)</p>
                        <p className="text-green-800">{r.managerFeedback}</p>
                      </div>
                    )}
                    {r.incrementRecommendation && (
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs font-semibold text-purple-700 mb-1">Increment Recommendation</p>
                        <p className="text-purple-800">{r.incrementRecommendation}</p>
                      </div>
                    )}
                    {!r.selfReview && !r.managerFeedback && <p className="text-slate-400 text-xs">No review details yet.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === TAB_GOALS && (
        <>
          {goals.length === 0 && <EmptyState icon="🎯" title="No goals" subtitle="Goals added by employees will appear here" />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Employee', 'Goal', 'Status', 'Weightage', 'Target Date', 'Added'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {goals.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{g.user?.name}</p>
                      <p className="text-xs text-slate-400">{g.user?.employeeId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-slate-800">{g.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={g.status} styles={GOAL_STATUS_STYLES} /></td>
                    <td className="px-4 py-3 text-slate-600">{g.weightage ? `${g.weightage}%` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{g.targetDate ? formatDate(g.targetDate) : '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">
                {ratingModal.field === 'manager' ? 'Manager Review & Rating' : 'Final Rating & Increment'}
              </h3>
              <button onClick={() => setRatingModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-2">Rating (1–5)</label>
              <div className="flex gap-2 mb-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setRatingVal(String(n))}
                    className={`w-12 h-12 rounded-full text-sm font-bold border-2 transition-colors flex items-center justify-center gap-0.5
                      ${ratingVal === String(n) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                    {n}<Star className="w-3 h-3" />
                  </button>
                ))}
              </div>
              {ratingVal && (
                <p className="text-xs text-slate-500">{RATING_LABELS[5 - parseInt(ratingVal)]}</p>
              )}
            </div>
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {ratingModal.field === 'manager' ? 'Manager Feedback' : 'Increment Recommendation'}
              </label>
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={ratingModal.field === 'manager' ? 'Detailed feedback for the employee...' : 'e.g. 10% increment recommended based on performance'} />
            </div>
            <div className="flex gap-3">
              <button onClick={submitRating} disabled={saving || !ratingVal}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit Rating'}
              </button>
              <button onClick={() => setRatingModal(null)}
                className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
