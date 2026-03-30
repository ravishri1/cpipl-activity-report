import { useState } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { Target, Plus, ChevronDown, ChevronRight, CheckCircle, X, TrendingUp } from 'lucide-react';

const STATUS_STYLES = {
  active:    { label: 'Active',    className: 'bg-blue-100 text-blue-700'   },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  on_hold:   { label: 'On Hold',   className: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
};

const CAT_COLORS = {
  personal: 'bg-blue-50 text-blue-600 border-blue-200',
  team:     'bg-purple-50 text-purple-600 border-purple-200',
  company:  'bg-amber-50 text-amber-600 border-amber-200',
};

function ProgressBar({ value, color = 'bg-blue-500' }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${value >= 100 ? 'bg-green-500' : color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ── Goal Form Modal ────────────────────────────────────────────────────────────
function GoalModal({ goal, quarters, onClose, onSaved }) {
  const defaultQ = quarters?.[0] || '';
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    category: goal?.category || 'personal',
    quarter: goal?.quarter || defaultQ,
    targetDate: goal?.targetDate || '',
  });
  const { execute, loading, error } = useApi();

  const handleSave = async () => {
    try {
      if (goal) {
        await execute(() => api.put(`/goals/${goal.id}`, form), 'Goal updated!');
      } else {
        await execute(() => api.post('/goals', form), 'Goal created!');
      }
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{goal ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Goal Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Complete project X by end of quarter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What does success look like?"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="personal">Personal</option>
                <option value="team">Team</option>
                <option value="company">Company</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Quarter</label>
              <select
                value={form.quarter}
                onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(quarters || []).map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Target Date</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading || !form.title.trim() || !form.quarter}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : goal ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Check-In Modal ─────────────────────────────────────────────────────────────
function CheckInModal({ goal, onClose, onSaved }) {
  const [progress, setProgress] = useState(goal.progress || 0);
  const [note, setNote] = useState('');
  const { execute, loading, error } = useApi();

  const handleSubmit = async () => {
    try {
      await execute(() => api.post(`/goals/${goal.id}/check-in`, { progress, note }), 'Check-in saved!');
      onSaved();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Log Progress</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <p className="text-sm text-slate-600 font-medium truncate">{goal.title}</p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600">Progress</label>
              <span className="text-2xl font-bold text-blue-600">{progress}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={progress}
              onChange={e => setProgress(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
            <ProgressBar value={progress} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="What's been done? Any blockers?"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goal Card ──────────────────────────────────────────────────────────────────
function GoalCard({ goal, onEdit, onCheckIn, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = goal.status === 'completed';

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isCompleted ? 'border-green-200' : 'border-slate-200'}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600 mt-0.5 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${CAT_COLORS[goal.category] || CAT_COLORS.personal}`}>
              {goal.category}
            </span>
            <StatusBadge status={goal.status} styles={STATUS_STYLES} />
            {goal.targetDate && <span className="text-xs text-slate-400">Due {formatDate(goal.targetDate)}</span>}
          </div>
          <p className={`text-sm font-semibold ${isCompleted ? 'text-green-700 line-through' : 'text-slate-800'}`}>{goal.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <ProgressBar value={goal.progress} />
            <span className="text-xs font-bold text-slate-600 w-9 text-right">{goal.progress}%</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isCompleted && (
            <button
              onClick={() => onCheckIn(goal)}
              className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" /> Update
            </button>
          )}
          <button onClick={() => onEdit(goal)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button
            onClick={() => { if (window.confirm('Delete this goal?')) onDelete(goal.id); }}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
          {goal.description && <p className="text-sm text-slate-600">{goal.description}</p>}
          {goal.checkIns?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2">Recent Check-ins</p>
              <div className="space-y-1.5">
                {goal.checkIns.map(ci => (
                  <div key={ci.id} className="flex items-center gap-3 text-xs text-slate-600">
                    <span className="font-bold text-blue-600 w-10">{ci.progress}%</span>
                    <span className="text-slate-400">{new Date(ci.createdAt).toLocaleDateString('en-IN')}</span>
                    {ci.note && <span className="flex-1 truncate italic">{ci.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {goal._count?.checkIns === 0 && <p className="text-xs text-slate-400 italic">No check-ins yet. Click "Update" to log progress.</p>}
        </div>
      )}
    </div>
  );
}

// ── Main: My Goals ─────────────────────────────────────────────────────────────
export default function MyGoals() {
  const [selectedQ, setSelectedQ] = useState('');
  const [goalModal, setGoalModal] = useState(null);
  const [checkInModal, setCheckInModal] = useState(null);
  const [refresh, setRefresh] = useState(0);

  const { data: quarters, loading: qLoading } = useFetch('/goals/quarters', []);

  // Set default quarter once loaded
  const quarter = selectedQ || quarters?.[0] || '';

  const { data: goals, loading, error, refetch } = useFetch(
    quarter ? `/goals/my?quarter=${quarter}` : null,
    [],
    [quarter, refresh]
  );

  const { execute } = useApi();

  const handleDelete = async (id) => {
    try {
      await execute(() => api.delete(`/goals/${id}`), 'Goal deleted.');
      refetch();
    } catch {}
  };

  const active    = (goals || []).filter(g => g.status === 'active');
  const completed = (goals || []).filter(g => g.status === 'completed');
  const other     = (goals || []).filter(g => !['active', 'completed'].includes(g.status));

  const totalGoals = (goals || []).length;
  const avgProgress = totalGoals > 0
    ? Math.round((goals || []).reduce((s, g) => s + g.progress, 0) / totalGoals)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Goals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your quarterly objectives and key results</p>
        </div>
        <div className="flex items-center gap-3">
          {quarters?.length > 0 && (
            <select
              value={quarter}
              onChange={e => setSelectedQ(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {quarters.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          )}
          <button
            onClick={() => setGoalModal({ goal: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Goal
          </button>
        </div>
      </div>

      {/* Summary */}
      {totalGoals > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500">Total Goals</p>
            <p className="text-2xl font-bold text-blue-700">{totalGoals}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500">Completed</p>
            <p className="text-2xl font-bold text-green-700">{completed.length}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500">Avg Progress</p>
            <p className="text-2xl font-bold text-amber-700">{avgProgress}%</p>
          </div>
        </div>
      )}

      {error && <AlertMessage type="error" message={error} />}
      {(loading || qLoading) && <LoadingSpinner />}

      {!loading && !error && totalGoals === 0 && (
        <div className="text-center py-16">
          <Target className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">No goals for {quarter || 'this quarter'}</p>
          <p className="text-sm text-slate-400 mt-1">Set your first goal to start tracking progress</p>
          <button
            onClick={() => setGoalModal({ goal: null })}
            className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            Create First Goal
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Active ({active.length})
          </h2>
          {active.map(g => (
            <GoalCard
              key={g.id} goal={g}
              onEdit={goal => setGoalModal({ goal })}
              onCheckIn={setCheckInModal}
              onDelete={handleDelete}
              onRefresh={() => { refetch(); setRefresh(r => r + 1); }}
            />
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> On Hold / Cancelled ({other.length})
          </h2>
          {other.map(g => (
            <GoalCard
              key={g.id} goal={g}
              onEdit={goal => setGoalModal({ goal })}
              onCheckIn={setCheckInModal}
              onDelete={handleDelete}
              onRefresh={() => { refetch(); setRefresh(r => r + 1); }}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-green-600 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Completed ({completed.length})
          </h2>
          {completed.map(g => (
            <GoalCard
              key={g.id} goal={g}
              onEdit={goal => setGoalModal({ goal })}
              onCheckIn={setCheckInModal}
              onDelete={handleDelete}
              onRefresh={() => { refetch(); setRefresh(r => r + 1); }}
            />
          ))}
        </div>
      )}

      {goalModal && (
        <GoalModal
          goal={goalModal.goal}
          quarters={quarters}
          onClose={() => setGoalModal(null)}
          onSaved={() => { refetch(); setRefresh(r => r + 1); }}
        />
      )}

      {checkInModal && (
        <CheckInModal
          goal={checkInModal}
          onClose={() => setCheckInModal(null)}
          onSaved={() => { refetch(); setRefresh(r => r + 1); }}
        />
      )}
    </div>
  );
}
