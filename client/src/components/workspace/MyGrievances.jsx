import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';

const STATUS_STYLES = {
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
  resolved:     'bg-green-100 text-green-700',
  closed:       'bg-slate-100 text-slate-500',
};

const CATEGORY_LABELS = {
  workplace:    'Workplace',
  harassment:   'Harassment',
  compensation: 'Compensation',
  management:   'Management',
  policy:       'Policy',
  other:        'Other',
};

function NewGrievanceModal({ onClose, onDone }) {
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({ subject: '', description: '', category: 'other', priority: 'normal', isAnonymous: false });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      await execute(() => api.post('/api/grievances', form), 'Grievance submitted.');
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">Raise a Grievance</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <input value={form.subject} onChange={e => set('subject', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Brief summary of your concern" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['low','normal','high'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={5} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe the issue in detail. Include dates, people involved, and any evidence..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isAnonymous} onChange={e => set('isAnonymous', e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-600">Submit anonymously (HR will not see your name)</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !form.subject || !form.description} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentBox({ grievanceId, onDone }) {
  const { execute, loading, error } = useApi();
  const [text, setText] = useState('');

  const handleSubmit = async () => {
    if (!text.trim()) return;
    try {
      await execute(() => api.post(`/api/grievances/${grievanceId}/comments`, { comment: text }), 'Comment added.');
      setText('');
      onDone();
    } catch {}
  };

  return (
    <div className="mt-3 flex gap-2">
      {error && <AlertMessage type="error" message={error} />}
      <input value={text} onChange={e => setText(e.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm" placeholder="Add a comment..." />
      <button onClick={handleSubmit} disabled={loading || !text.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {loading ? '…' : 'Send'}
      </button>
    </div>
  );
}

export default function MyGrievances() {
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { data: grievances, loading, error: fetchErr, refetch } = useFetch('/api/grievances/my', []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Grievances</h1>
          <p className="text-slate-500 text-sm mt-0.5">Raise and track workplace concerns confidentially</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Raise Grievance
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {grievances.length === 0 ? (
        <EmptyState icon="🤝" title="No grievances raised" subtitle="Your concerns are kept confidential. We're here to help." />
      ) : (
        <div className="space-y-3">
          {grievances.map(g => (
            <div key={g.id} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{g.subject}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-slate-400">{CATEGORY_LABELS[g.category]}</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{formatDate(g.createdAt)}</span>
                    {g.isAnonymous && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Anonymous</span>}
                  </div>
                </div>
                <StatusBadge status={g.status} styles={STATUS_STYLES} />
              </div>

              {expanded === g.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-xl space-y-4">
                  <p className="text-sm text-slate-700">{g.description}</p>
                  {g.assignee && <p className="text-xs text-slate-500">Assigned to: <strong>{g.assignee.name}</strong></p>}
                  {g.resolution && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <span className="font-medium text-green-700 block text-xs mb-0.5">RESOLUTION</span>
                      {g.resolution}
                    </div>
                  )}
                  {g.comments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase">Comments</div>
                      {g.comments.map(c => (
                        <div key={c.id} className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {c.user?.name?.charAt(0)}
                          </div>
                          <div className="bg-white rounded-lg px-3 py-2 text-sm border border-slate-100 flex-1">
                            <span className="font-medium text-slate-700 text-xs block">{c.user?.name}</span>
                            {c.comment}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {['open','under_review'].includes(g.status) && (
                    <CommentBox grievanceId={g.id} onDone={refetch} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && <NewGrievanceModal onClose={() => setShowModal(false)} onDone={refetch} />}
    </div>
  );
}
