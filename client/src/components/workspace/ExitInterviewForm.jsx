import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const RATING_LABELS = { 1: 'Very Poor', 2: 'Poor', 3: 'Average', 4: 'Good', 5: 'Excellent' };

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${value >= n ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400 hover:bg-amber-100'} disabled:cursor-default`}
        >
          {n}
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-slate-500 self-center">{RATING_LABELS[value]}</span>}
    </div>
  );
}

export default function ExitInterviewForm() {
  const { data: interview, loading, error: fetchErr, refetch } = useFetch('/exit-interviews/my', null);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [form, setForm] = useState({
    overallExperience: 0,
    managementRating: 0,
    workEnvironmentRating: 0,
    compensationRating: 0,
    growthRating: 0,
    reasonForLeaving: '',
    bestAspect: '',
    improvementSuggestion: '',
    wouldRejoin: null,
    additionalComments: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      await execute(() => api.put(`/api/exit-interviews/${interview.id}/submit`, form), 'Exit interview submitted. Thank you!');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  if (!interview) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        {fetchErr && <AlertMessage type="error" message={fetchErr} />}
        <EmptyState
          icon="📝"
          title="No Exit Interview Scheduled"
          subtitle="Your exit interview form will appear here once HR creates it."
        />
      </div>
    );
  }

  if (interview.status === 'completed') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-lg font-semibold text-green-800">Exit Interview Submitted</h2>
          <p className="text-sm text-green-600 mt-1">Submitted on {formatDate(interview.submittedAt)}</p>
          <p className="text-sm text-slate-500 mt-3">Thank you for your feedback. We appreciate your time at the company.</p>
        </div>
        {/* Show submitted answers */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Your Responses</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Overall Experience', interview.overallExperience],
              ['Management', interview.managementRating],
              ['Work Environment', interview.workEnvironmentRating],
              ['Compensation', interview.compensationRating],
              ['Growth Opportunities', interview.growthRating],
            ].map(([label, rating]) => (
              <div key={label}>
                <span className="text-slate-500 block text-xs">{label}</span>
                <span className="font-medium">{rating ? `${rating}/5 — ${RATING_LABELS[rating]}` : '—'}</span>
              </div>
            ))}
            <div>
              <span className="text-slate-500 block text-xs">Would Rejoin?</span>
              <span className={`font-medium ${interview.wouldRejoin === true ? 'text-green-600' : interview.wouldRejoin === false ? 'text-red-600' : ''}`}>
                {interview.wouldRejoin === true ? 'Yes' : interview.wouldRejoin === false ? 'No' : '—'}
              </span>
            </div>
          </div>
          {interview.reasonForLeaving && <div className="text-sm"><span className="text-slate-500 block text-xs font-medium mb-0.5">Reason for Leaving</span>{interview.reasonForLeaving}</div>}
          {interview.bestAspect && <div className="text-sm"><span className="text-slate-500 block text-xs font-medium mb-0.5">Best Aspect</span>{interview.bestAspect}</div>}
          {interview.improvementSuggestion && <div className="text-sm"><span className="text-slate-500 block text-xs font-medium mb-0.5">Suggestions for Improvement</span>{interview.improvementSuggestion}</div>}
          {interview.additionalComments && <div className="text-sm"><span className="text-slate-500 block text-xs font-medium mb-0.5">Additional Comments</span>{interview.additionalComments}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Exit Interview</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your feedback helps us improve. All responses are confidential.</p>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      <div className="space-y-6">
        {/* Ratings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Rate Your Experience</h2>
          <div className="space-y-4">
            {[
              ['overallExperience', 'Overall Experience at CPIPL'],
              ['managementRating', 'Management & Leadership'],
              ['workEnvironmentRating', 'Work Environment & Culture'],
              ['compensationRating', 'Compensation & Benefits'],
              ['growthRating', 'Growth & Learning Opportunities'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                <StarRating value={form[key]} onChange={v => set(key, v)} />
              </div>
            ))}
          </div>
        </div>

        {/* Qualitative */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Your Feedback</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Reason for Leaving</label>
              <textarea value={form.reasonForLeaving} onChange={e => set('reasonForLeaving', e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="What was the main reason you decided to leave?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Best Aspect of Working Here</label>
              <textarea value={form.bestAspect} onChange={e => set('bestAspect', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="What did you enjoy most about working at CPIPL?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Suggestions for Improvement</label>
              <textarea value={form.improvementSuggestion} onChange={e => set('improvementSuggestion', e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="What could CPIPL do better?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Would you consider rejoining CPIPL in the future?</label>
              <div className="flex gap-3">
                {[true, false].map(v => (
                  <label key={String(v)} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border ${form.wouldRejoin === v ? (v ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700') : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" checked={form.wouldRejoin === v} onChange={() => set('wouldRejoin', v)} className="hidden" />
                    <span className="text-sm font-medium">{v ? 'Yes' : 'No'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Any Other Comments</label>
              <textarea value={form.additionalComments} onChange={e => set('additionalComments', e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Anything else you'd like to share..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Submitting…' : 'Submit Exit Interview'}
          </button>
        </div>
      </div>
    </div>
  );
}
