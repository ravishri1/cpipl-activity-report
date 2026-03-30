import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const LEVEL_STYLES = {
  beginner:     'bg-slate-100 text-slate-500',
  intermediate: 'bg-blue-100 text-blue-600',
  advanced:     'bg-amber-100 text-amber-700',
  expert:       'bg-purple-100 text-purple-700',
};

const CATEGORY_COLORS = {
  technical:    'bg-blue-50 border-blue-200',
  soft:         'bg-green-50 border-green-200',
  language:     'bg-pink-50 border-pink-200',
  certification:'bg-amber-50 border-amber-200',
};

function SkillModal({ skill, onClose, onDone }) {
  const isEdit = Boolean(skill?.id);
  const { execute, loading, error } = useApi();
  const [form, setForm] = useState({
    skill:       skill?.skill       || '',
    category:    skill?.category    || 'technical',
    level:       skill?.level       || 'intermediate',
    certifiedBy: skill?.certifiedBy || '',
    certDate:    skill?.certDate    || '',
    expiryDate:  skill?.expiryDate  || '',
    notes:       skill?.notes       || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      if (isEdit) {
        await execute(() => api.put(`/api/skills/${skill.id}`, form), 'Skill updated!');
      } else {
        await execute(() => api.post('/api/skills', form), 'Skill added!');
      }
      onDone();
      onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-semibold text-slate-800">{isEdit ? 'Edit Skill' : 'Add Skill / Certification'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-4 space-y-3">
          {error && <AlertMessage type="error" message={error} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Skill / Certification Name *</label>
            <input value={form.skill} onChange={e => set('skill', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="React.js, Excel, Hindi, AWS Certified..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['technical','soft','language','certification'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proficiency Level</label>
              <select value={form.level} onChange={e => set('level', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['beginner','intermediate','advanced','expert'].map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Certifying Body</label>
            <input value={form.certifiedBy} onChange={e => set('certifiedBy', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="AWS, Google, Coursera, etc." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cert Date</label>
              <input type="date" value={form.certDate} onChange={e => set('certDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !form.skill} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            {loading ? 'Saving…' : isEdit ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MySkills() {
  const [modal, setModal] = useState(null); // null | 'new' | skill-object
  const { data: skills, loading, error: fetchErr, refetch } = useFetch('/api/skills/my', []);
  const { execute, loading: deleting, error: deleteErr } = useApi();

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await execute(() => api.delete(`/api/skills/${id}`), 'Skill deleted.');
      refetch();
    } catch {}
  };

  const grouped = skills.reduce((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const CATEGORY_ORDER = ['technical','soft','language','certification'];
  const CATEGORY_LABELS = { technical: 'Technical', soft: 'Soft Skills', language: 'Languages', certification: 'Certifications' };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Skills & Certifications</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your professional profile at a glance</p>
        </div>
        <button onClick={() => setModal('new')} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Add Skill
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {deleteErr && <AlertMessage type="error" message={deleteErr} />}

      {skills.length === 0 ? (
        <EmptyState icon="🎓" title="No skills added" subtitle="Add your technical skills, languages, and certifications" />
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.filter(c => grouped[c]?.length > 0).map(cat => (
            <div key={cat}>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">{CATEGORY_LABELS[cat]}</div>
              <div className="flex flex-wrap gap-2">
                {grouped[cat].map(s => (
                  <div key={s.id} className={`rounded-xl border p-3 min-w-[160px] ${CATEGORY_COLORS[s.category]}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-medium text-slate-800 text-sm">{s.skill}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setModal(s)} className="text-slate-400 hover:text-blue-600 text-xs">✎</button>
                        <button onClick={() => handleDelete(s.id, s.skill)} disabled={deleting} className="text-slate-400 hover:text-red-500 text-xs">×</button>
                      </div>
                    </div>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full mt-1 font-medium capitalize ${LEVEL_STYLES[s.level]}`}>{s.level}</span>
                    {s.certifiedBy && <div className="text-xs text-slate-400 mt-1">{s.certifiedBy}</div>}
                    {s.expiryDate && <div className="text-xs text-amber-600 mt-0.5">Expires {formatDate(s.expiryDate)}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <SkillModal skill={modal === 'new' ? null : modal} onClose={() => setModal(null)} onDone={refetch} />}
    </div>
  );
}
