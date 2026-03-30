import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
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

const CATEGORY_LABELS = { technical: 'Technical', soft: 'Soft Skills', language: 'Languages', certification: 'Certifications' };
const CATEGORY_ORDER  = ['technical', 'soft', 'language', 'certification'];

export default function SkillsMatrix() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: matrix, loading, error } = useFetch('/api/skills/matrix', []);

  const filtered = matrix.filter(entry => {
    const matchSearch   = !search || entry.skill.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || entry.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const grouped = filtered.reduce((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Skills Matrix</h1>
        <p className="text-slate-500 text-sm mt-0.5">Skill coverage across the team</p>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {/* Stats */}
      {matrix.length > 0 && (() => {
        const uniqueSkills    = new Set(matrix.map(e => e.skill)).size;
        const uniqueEmployees = new Set(matrix.flatMap(e => e.employees.map(u => u.id))).size;
        const expiring = matrix.reduce((n, e) => n + e.employees.filter(u => u.expiryDate && new Date(u.expiryDate) < new Date(Date.now() + 90 * 86400000)).length, 0);
        return (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              ['Skills Tracked', uniqueSkills, 'bg-blue-50 text-blue-700'],
              ['Employees', uniqueEmployees, 'bg-green-50 text-green-700'],
              ['Expiring (90 days)', expiring, 'bg-amber-50 text-amber-700'],
            ].map(([l, v, cls]) => (
              <div key={l} className={`rounded-xl p-4 ${cls}`}>
                <div className="text-2xl font-bold">{v}</div>
                <div className="text-xs font-medium mt-0.5 opacity-70">{l}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search skill..."
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-48"
        />
        <div className="flex gap-2 flex-wrap">
          {['', ...CATEGORY_ORDER].map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1 text-xs rounded-full border font-medium ${categoryFilter === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'}`}
            >
              {c === '' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <EmptyState icon="🎓" title="No skills found" subtitle="Skills added by employees will appear here" />
      ) : (
        <div className="space-y-6">
          {CATEGORY_ORDER.filter(c => grouped[c]?.length > 0).map(cat => (
            <div key={cat}>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-3">{CATEGORY_LABELS[cat]}</div>
              <div className="space-y-3">
                {grouped[cat].map(entry => (
                  <div key={entry.skill} className={`rounded-xl border p-4 ${CATEGORY_COLORS[entry.category]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-800">{entry.skill}</h3>
                      <span className="text-xs text-slate-400">{entry.employees.length} employee{entry.employees.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.employees.map(emp => (
                        <div key={emp.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-white/60 shadow-sm">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {emp.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-700">{emp.name}</div>
                            {emp.department && <div className="text-[10px] text-slate-400">{emp.department}</div>}
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${LEVEL_STYLES[emp.level]}`}>
                            {emp.level}
                          </span>
                          {emp.expiryDate && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              new Date(emp.expiryDate) < new Date() ? 'bg-red-100 text-red-600' :
                              new Date(emp.expiryDate) < new Date(Date.now() + 90 * 86400000) ? 'bg-amber-100 text-amber-600' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              exp {emp.expiryDate}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
