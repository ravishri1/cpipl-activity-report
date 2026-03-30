import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';

const SCORE_EMOJIS = ['', '😟', '😕', '😐', '😊', '🤩'];
const SCORE_LABELS = ['', 'Rough week', 'Below average', 'Average', 'Good week', 'Amazing week!'];
const SCORE_COLORS = ['', 'bg-red-100 text-red-600', 'bg-orange-100 text-orange-600', 'bg-amber-100 text-amber-600', 'bg-green-100 text-green-600', 'bg-emerald-100 text-emerald-700'];

export default function WeeklyPulse() {
  const { data, loading, error: fetchErr, refetch } = useFetch('/api/pulse/my', null);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const thisWeek = data?.thisWeek;
  const displayScore = thisWeek && !submitted ? thisWeek.score : score;

  const handleSubmit = async () => {
    if (!score) return;
    try {
      await execute(() => api.post('/api/pulse', { score, comment: comment || undefined }), "Thanks for sharing! 🙌");
      setSubmitted(true);
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Weekly Pulse</h1>
        <p className="text-slate-500 text-sm mt-0.5">How was your week? Takes 10 seconds.</p>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* This week's check-in */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-slate-800">This Week</h2>
          {thisWeek && !submitted && (
            <span className="text-xs text-slate-400">Already submitted — you can update it</span>
          )}
        </div>

        <div className="flex justify-center gap-3 mb-4">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => setScore(n)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                (submitted ? score : (thisWeek?.score || 0)) === n
                  ? 'border-blue-400 bg-blue-50 scale-110'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">{SCORE_EMOJIS[n]}</span>
              <span className="text-xs font-medium text-slate-500">{n}</span>
            </button>
          ))}
        </div>

        {displayScore > 0 && (
          <p className="text-center text-sm font-medium text-slate-600 mb-4">{SCORE_LABELS[displayScore]}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Anything on your mind? <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={comment || (submitted ? '' : (thisWeek?.comment || ''))}
            onChange={e => setComment(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Share a highlight or a challenge from this week..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || (!score && !thisWeek)}
          className="mt-3 w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Submitting…' : thisWeek && !submitted ? 'Update My Pulse' : 'Submit Pulse'}
        </button>
      </div>

      {/* History */}
      {data?.responses?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">My Last 12 Weeks</h2>
          <div className="flex flex-wrap gap-2">
            {data.responses.map(r => (
              <div key={r.id} className={`rounded-lg px-3 py-2 text-sm ${SCORE_COLORS[r.score]}`}>
                <div className="font-medium">{r.week.replace('-W', ' · W')}</div>
                <div className="flex items-center gap-1">
                  <span>{SCORE_EMOJIS[r.score]}</span>
                  <span className="font-semibold">{r.score}/5</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
