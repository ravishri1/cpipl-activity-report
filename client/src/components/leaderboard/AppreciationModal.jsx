import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Heart, X, AlertTriangle, Loader2, Send } from 'lucide-react';

export default function AppreciationModal({ receiver, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [budget, setBudget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/points/appreciation-budget')
      .then((res) => setBudget(res.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/points/appreciate', {
        receiverId: receiver.id,
        reason: reason.trim(),
      });
      setResult(res.data);
      if (res.data.success && onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send appreciation.');
    } finally {
      setSubmitting(false);
    }
  };

  const minLen = 20;
  const charCount = reason.trim().length;
  const isValid = charCount >= minLen;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-slate-800">Appreciate {receiver.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Budget Bar */}
        {budget && (
          <div className="px-5 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Weekly Budget</span>
              <span>{budget.remaining} of {budget.total} pts remaining</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budget.remaining <= budget.total * 0.2
                    ? 'bg-red-500'
                    : budget.remaining <= budget.total * 0.5
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.max(0, (budget.remaining / budget.total) * 100)}%` }}
              />
            </div>
            {budget.warnings > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {budget.warnings} warning(s) this week
              </p>
            )}
          </div>
        )}

        {/* Result View */}
        {result?.success ? (
          <div className="p-5">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <Heart className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-medium text-green-800">Appreciation sent!</p>
              <p className="text-sm text-green-600 mt-1">
                +{result.appreciation.points} points awarded to {receiver.name}
              </p>
              <p className="text-xs text-green-500 mt-1">
                Budget remaining: {result.budgetRemaining} pts
              </p>
            </div>
            {result.warning && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {result.warning}
                </p>
              </div>
            )}
            {result.penalty && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-red-800">
                  -{result.penalty.amount} points: {result.penalty.message}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-5">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Why do you appreciate {receiver.name?.split(' ')[0]}?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe how this person helped build the team or system... (min 20 characters)"
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${isValid ? 'text-green-600' : 'text-slate-400'}`}>
                {charCount}/{minLen} characters
              </span>
              {budget && (
                <span className="text-xs text-slate-400">
                  +{budget.pointsPerAppreciation} pts to {receiver.name?.split(' ')[0]}
                </span>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting || (budget && budget.remaining < budget.pointsPerAppreciation)}
                className="flex-1 py-2 text-sm text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Appreciation
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
