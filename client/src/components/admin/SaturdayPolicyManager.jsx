import { useState, useEffect } from 'react';
import api from '../../utils/api';

const SAT_TYPES = [
  { value: 'all',     label: 'All Saturdays Off',          desc: 'Every Saturday is a weekly off' },
  { value: '2nd_4th', label: '2nd & 4th Saturday Off',     desc: 'Only 2nd and 4th Saturdays off' },
  { value: 'none',    label: 'All Saturdays Working',       desc: 'No Saturday off, all working days' },
];

export default function SaturdayPolicyManager({ companyId, companyName }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ effectiveFrom: '', effectiveTo: '', saturdayType: 'all', description: '' });

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/saturday-policy?companyId=${companyId}`);
      setPolicies(res.data || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { if (companyId) fetchPolicies(); }, [companyId]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      if (editingId) {
        await api.put(`/saturday-policy/${editingId}`, form);
      } else {
        await api.post('/saturday-policy', { ...form, companyId });
      }
      setMsg({ type: 'success', text: editingId ? 'Updated!' : 'Created!' });
      setShowForm(false); setEditingId(null);
      setForm({ effectiveFrom: '', effectiveTo: '', saturdayType: 'all', description: '' });
      fetchPolicies();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this Saturday policy?')) return;
    try {
      await api.delete(`/saturday-policy/${id}`);
      fetchPolicies();
    } catch { }
  };

  const openEdit = (p) => {
    setForm({ effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo || '', saturdayType: p.saturdayType, description: p.description || '' });
    setEditingId(p.id);
    setShowForm(true);
    setMsg(null);
  };

  const typeLabel = (t) => SAT_TYPES.find(s => s.value === t)?.label || t;
  const typeBadge = (t) => ({
    all:     'bg-green-100 text-green-700',
    '2nd_4th': 'bg-amber-100 text-amber-700',
    none:    'bg-red-100 text-red-700',
  }[t] || 'bg-slate-100 text-slate-600');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Saturday Policy — {companyName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Define which Saturdays are off per date range</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setMsg(null); setForm({ effectiveFrom: '', effectiveTo: '', saturdayType: 'all', description: '' }); }}
          className="text-xs font-medium px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Period
        </button>
      </div>

      {msg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Effective From *</label>
              <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Effective To (blank = ongoing)</label>
              <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Saturday Rule *</label>
            <div className="grid grid-cols-3 gap-2">
              {SAT_TYPES.map(t => (
                <button key={t.value} onClick={() => setForm(f => ({ ...f, saturdayType: t.value }))}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all ${form.saturdayType === t.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Description (optional)</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Pre-Diwali policy change"
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.effectiveFrom}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save Policy'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-4">Loading...</p>
      ) : policies.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No Saturday policies configured — payroll uses "All Saturdays Off" by default</p>
      ) : (
        <div className="space-y-2">
          {policies.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadge(p.saturdayType)}`}>{typeLabel(p.saturdayType)}</span>
                  <span className="text-xs text-slate-600 font-medium">
                    {p.effectiveFrom} &rarr; {p.effectiveTo || 'ongoing'}
                  </span>
                </div>
                {p.description && <p className="text-[10px] text-slate-400 mt-1">{p.description}</p>}
              </div>
              <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
