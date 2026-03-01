import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Heart, AlertTriangle } from 'lucide-react';

export default function BudgetIndicator({ compact = false, refreshKey = 0 }) {
  const [budget, setBudget] = useState(null);

  useEffect(() => {
    api.get('/points/appreciation-budget')
      .then((res) => setBudget(res.data))
      .catch(() => {});
  }, [refreshKey]);

  if (!budget) return null;

  const pct = Math.max(0, (budget.remaining / budget.total) * 100);
  const color = pct <= 20 ? 'bg-red-500' : pct <= 50 ? 'bg-amber-500' : 'bg-pink-500';

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-full">
        <Heart className="w-3 h-3 text-pink-400" />
        {budget.remaining}/{budget.total}
      </span>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-pink-500" />
          Appreciation Budget
        </span>
        <span className="text-xs text-slate-500">
          {budget.remaining} of {budget.total} pts left
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {budget.warnings > 0 && (
        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {budget.warnings} warning(s) this week - diversify your appreciations
        </p>
      )}
    </div>
  );
}
