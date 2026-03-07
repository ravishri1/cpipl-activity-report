import { useState } from 'react';
import { Target, Plus, CheckCircle, X, Edit2 } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import StatusBadge from '../shared/StatusBadge';
import { formatDate } from '../../utils/formatters';
import { GOAL_STATUS_STYLES, REVIEW_STATUS_STYLES, GOAL_STATUSES } from '../../utils/constants';

const TAB_GOALS = 'goals';
const TAB_REVIEWS = 'reviews';

const EMPTY_GOAL = { title: '', description: '', targetDate: '', weightage: '' };

export default function MyPerformance() {
  const [tab, setTab] = useState(TAB_GOALS);
  const { data: goals, loading: gLoading, error: gError, refetch: refetchGoals } = useFetch('/api/performance/goals/my', []);
  const { data: reviews, loading: rLoading, error: rError, refetch: refetchReviews } = useFetch('/api/performance/reviews/my', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);
  const [editGoalId, setEditGoalId] = useState(null);
  const [selfReviewId, setSelfReviewId] = useState(null);
  const [selfReviewText, setSelfReviewText] = useState('');
  const [selfRating, setSelfRating] = useState('');

  function setField(k, v) { setGoalForm(f => ({ ...f, [k]: v })); }

  function openNewGoal() { setGoalForm(EMPTY_GOAL); setEditGoalId(null); setShowGoalForm(true); clearMessages(); }
  function openEditGoal(g) { setGoalForm({ title: g.title, description: g.description || '', targetDate: g.targetDate || '', weightage: g.weightage || '' }); setEditGoalId(g.id); setShowGoalForm(true); clearMessages(); }

  async function saveGoal() {
    if (editGoalId) {
      await execute(() => api.put(`/api/performance/goals/${editGoalId}`, goalForm), 'Goal updated!');
    } else {
      await execute(() => api.post('/api/performance/goals', goalForm), 'Goal added!');
    }
    setShowGoalForm(false); setEditGoalId(null); refetchGoals();
  }

  async function updateGoalStatus(id, status) {
    await execute(() => api.put(`/api/performance/goals/${id}`, { status }), 'Goal status updated!');
    refetchGoals();
  }

  async function submitSelfReview() {
    await execute(
      () => api.post(`/api/performance/reviews/${selfReviewId}/self-review`, { selfReview: selfReviewText, selfRating: parseFloat(selfRating) }),
      'Self review submitted!'
    );
    setSelfReviewId(null); setSelfReviewText(''); setSelfRating(''); refetchReviews();
  }

  const loading = tab === TAB_GOALS ? gLoading : rLoading;
  const error = tab === TAB_GOALS ? gError : rError;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Performance</h1>
            <p className="text-sm text-slate-500 mt-1">Track your goals and review cycles</p>
          </div>
          {tab === TAB_GOALS && (
            <button onClick={openNewGoal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Goal
            </button>
          )}
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
          {[{ id: TAB_GOALS, label: 'My Goals' }, { id: TAB_REVIEWS, label: 'Review Cycles' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && tab === TAB_GOALS && (
        <>
          {goals.length === 0 && !showGoalForm && (
            <EmptyState icon="🎯" title="No goals yet" subtitle="Add goals to track your performance targets" />
          )}

          {showGoalForm && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">{editGoalId ? 'Edit Goal' : 'New Goal'}</h3>
                <button onClick={() => setShowGoalForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Goal Title *</label>
                  <input value={goalForm.title} onChange={e => setField('title', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Improve customer satisfaction score to 4.5" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <textarea value={goalForm.description} onChange={e => setField('description', e.target.value)} rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Target Date</label>
                  <input type="date" value={goalForm.targetDate} onChange={e => setField('targetDate', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Weightage (%)</label>
                  <input type="number" min="0" max="100" value={goalForm.weightage} onChange={e => setField('weightage', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 25" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={saveGoal} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Goal'}
                </button>
                <button onClick={() => setShowGoalForm(false)}
                  className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {goals.map(g => (
              <div key={g.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-slate-800">{g.title}</span>
                      <StatusBadge status={g.status} styles={GOAL_STATUS_STYLES} />
                      {g.weightage && <span className="text-xs text-slate-400 ml-1">{g.weightage}%</span>}
                    </div>
                    {g.description && <p className="text-sm text-slate-500 ml-6">{g.description}</p>}
                    {g.targetDate && <p className="text-xs text-slate-400 ml-6 mt-1">Due: {formatDate(g.targetDate)}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {g.status === 'not_started' && (
                      <button onClick={() => updateGoalStatus(g.id, 'in_progress')}
                        className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">Start</button>
                    )}
                    {g.status === 'in_progress' && (
                      <button onClick={() => updateGoalStatus(g.id, 'completed')}
                        className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded text-xs hover:bg-green-100">
                        <CheckCircle className="w-3 h-3" /> Complete
                      </button>
                    )}
                    <button onClick={() => openEditGoal(g)} className="p-1 text-slate-400 hover:text-slate-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === TAB_REVIEWS && (
        <>
          {reviews.length === 0 && (
            <EmptyState icon="📊" title="No review cycles" subtitle="Your manager will initiate review cycles" />
          )}
          <div className="space-y-4">
            {reviews.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-800">{r.cycleType?.replace('_', ' ')} Review</span>
                      <StatusBadge status={r.status} styles={REVIEW_STATUS_STYLES} />
                    </div>
                    <p className="text-xs text-slate-500">Period: {r.periodStart ? formatDate(r.periodStart) : '—'} → {r.periodEnd ? formatDate(r.periodEnd) : '—'}</p>
                    {r.finalRating && <p className="text-sm font-medium text-green-700 mt-1">Final Rating: {r.finalRating} / 5</p>}
                    {r.managerRating && !r.finalRating && <p className="text-sm text-slate-600 mt-1">Manager Rating: {r.managerRating} / 5</p>}
                    {r.selfReview && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                        <strong>Your self review:</strong> {r.selfReview}
                        {r.selfRating && <span className="ml-2 font-medium">({r.selfRating}/5)</span>}
                      </div>
                    )}
                    {r.managerFeedback && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                        <strong>Manager feedback:</strong> {r.managerFeedback}
                      </div>
                    )}
                  </div>
                </div>
                {r.status === 'self_review' && !r.selfReview && (
                  <button onClick={() => { setSelfReviewId(r.id); setSelfReviewText(''); setSelfRating(''); }}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    <Edit2 className="w-4 h-4" /> Submit Self Review
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {selfReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800">Submit Self Review</h3>
              <button onClick={() => setSelfReviewId(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Your Self Review *</label>
              <textarea value={selfReviewText} onChange={e => setSelfReviewText(e.target.value)} rows={5}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your achievements, challenges, and areas of improvement..." />
            </div>
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-2">Self Rating (1-5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setSelfRating(String(n))}
                    className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition-colors ${selfRating === String(n) ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={submitSelfReview} disabled={saving || !selfReviewText || !selfRating}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit Review'}
              </button>
              <button onClick={() => setSelfReviewId(null)}
                className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
