import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../utils/api';
import {
  CalendarDays, Plus, Trash2, X, Upload, Download,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Pencil, Info,
  ChevronDown, ChevronUp, Users, UserMinus,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LOCATIONS = ['All', 'Mumbai', 'Lucknow'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_COLORS = {
  0: 'bg-red-100 text-red-700',    // Sun
  1: 'bg-slate-100 text-slate-700', // Mon
  2: 'bg-slate-100 text-slate-700', // Tue
  3: 'bg-slate-100 text-slate-700', // Wed
  4: 'bg-slate-100 text-slate-700', // Thu
  5: 'bg-slate-100 text-slate-700', // Fri
  6: 'bg-blue-100 text-blue-700',   // Sat
};

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long' });
}

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(fy) {
  return `Apr ${fy} - Mar ${fy + 1}`;
}

function getFYOptions() {
  const current = getCurrentFY();
  const opts = [];
  for (let y = current - 3; y <= current + 2; y++) opts.push(y);
  return opts;
}

// CSV Parser
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') || header.includes('name') || header.includes('occasion');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    const fields = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    let [date, name, type, location] = fields;
    if (date && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(date)) {
      const parts = date.split(/[-/]/);
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return { date: date || '', name: name || '', type: type || 'General', location: location || 'All' };
  });
}

// ─── Import Preview Modal ────────────────────────────────────────────────────
function ImportModal({ rows, onClose, onConfirm, importing }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-semibold text-slate-800">Import Preview</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{rows.length} holidays</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="overflow-auto flex-1 p-5">
          <p className="text-sm text-slate-500 mb-3">
            Existing holidays on same date+location will be <span className="font-medium text-amber-600">updated</span>. New entries will be <span className="font-medium text-green-600">created</span>.
          </p>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">#</th>
              <th className="px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="px-3 py-2 font-medium text-slate-600">Occasion</th>
              <th className="px-3 py-2 font-medium text-slate-600">Type</th>
              <th className="px-3 py-2 font-medium text-slate-600">Location</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className={!r.date || !r.name ? 'bg-red-50' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.date || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded ${r.type?.toLowerCase() === 'optional' || r.type?.toLowerCase() === 'restricted' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{r.type || 'General'}</span></td>
                  <td className="px-3 py-2 text-slate-600">{r.location || 'All'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-500">
            {rows.filter(r => !r.date || !r.name).length > 0 && (
              <span className="text-amber-600">⚠ {rows.filter(r => !r.date || !r.name).length} rows with missing data will be skipped</span>
            )}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button onClick={onConfirm} disabled={importing} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />{importing ? 'Importing...' : `Import ${rows.length} Holidays`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Import Results Modal ────────────────────────────────────────────────────
function ImportResultsModal({ results, onClose }) {
  if (!results) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" /><h3 className="text-base font-semibold text-slate-800">Import Complete</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-green-700">{results.created}</div><div className="text-xs text-green-600 font-medium">Created</div></div>
            <div className="bg-blue-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-blue-700">{results.updated}</div><div className="text-xs text-blue-600 font-medium">Updated</div></div>
            <div className="bg-slate-50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-slate-500">{results.skipped}</div><div className="text-xs text-slate-500 font-medium">Skipped</div></div>
          </div>
          {results.errors?.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 mb-1"><AlertTriangle className="w-4 h-4" /> Warnings</div>
              <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto">{results.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / Edit Holiday Modal ────────────────────────────────────────────────
function HolidayFormModal({ holiday, onClose, onSaved }) {
  const isEdit = !!holiday;
  const [form, setForm] = useState({
    name: holiday?.name || '',
    date: holiday?.date || '',
    isOptional: holiday?.isOptional || false,
    location: holiday?.location || 'All',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      let result;
      if (isEdit) {
        result = await api.put(`/holidays/${holiday.id}`, form);
      } else {
        result = await api.post('/holidays', form);
      }
      // Close modal first, then refresh data from DB
      onClose();
      await onSaved(result.data, isEdit);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'add'} holiday.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{isEdit ? 'Edit Holiday' : 'Add Holiday'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Occasion</label>
            <input type="text" value={form.name} required placeholder="e.g. Republic Day"
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} required
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <select value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {LOCATIONS.map(loc => (
                <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select value={form.isOptional ? 'optional' : 'general'}
              onChange={e => setForm({ ...form, isOptional: e.target.value === 'optional' })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="general">General Holiday</option>
              <option value="optional">Restricted / Optional Holiday</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Weekly Off Tab ─────────────────────────────────────────────────────────
function WeeklyOffTab() {
  const [subTab, setSubTab] = useState('patterns'); // 'patterns' | 'assignments' | 'blocks'
  const [patterns, setPatterns] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(null); // patternId
  const [addForm, setAddForm] = useState({ name: '', days: [] });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, uRes] = await Promise.all([
        api.get('/holidays/weekly-off-patterns'),
        api.get('/holidays/weekly-off-unassigned'),
      ]);
      setPatterns(pRes.data);
      setUnassigned(uRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load weekly off patterns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddPattern = async (e) => {
    e.preventDefault();
    if (addForm.days.length === 0) { setError('Select at least one day'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post('/holidays/weekly-off-patterns', addForm);
      setSuccess('Pattern created!');
      setShowAddForm(false);
      setAddForm({ name: '', days: [] });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create pattern.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePattern = async (id, name) => {
    if (!window.confirm(`Delete pattern "${name}"?`)) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.delete(`/holidays/weekly-off-patterns/${id}`);
      setSuccess('Pattern deleted.');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete pattern.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (patternId, userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this pattern? They will use the default (Sat+Sun).`)) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.delete(`/holidays/weekly-off-patterns/${patternId}/users/${userId}`);
      setSuccess(`${userName} removed.`);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (selectedUsers.length === 0) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await api.post(`/holidays/weekly-off-patterns/${showAssignModal}/assign`, { userIds: selectedUsers });
      setSuccess(res.data.message);
      setShowAssignModal(null);
      setSelectedUsers([]);
      setSearchQuery('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign employees.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    setAddForm(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day].sort(),
    }));
  };

  // All employees for assign modal (unassigned + employees from other patterns)
  const allActiveEmployees = useMemo(() => {
    const assigned = patterns.flatMap(p => p.users || []);
    const all = [...unassigned, ...assigned];
    const seen = new Set();
    return all.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; }).sort((a, b) => a.name.localeCompare(b.name));
  }, [patterns, unassigned]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return allActiveEmployees;
    const q = searchQuery.toLowerCase();
    return allActiveEmployees.filter(u => u.name.toLowerCase().includes(q) || (u.employeeId || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q));
  }, [allActiveEmployees, searchQuery]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="px-6 py-4 space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <span className="font-semibold">Weekly Off Patterns</span> define which days of the week are off for each employee. Assign a pattern to each employee from their profile or using the + Assign button below.
          These affect attendance, leave calculations, muster, and roster views.
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'patterns', label: 'Patterns' },
          { key: 'assignments', label: 'Assignments (Date Range)' },
          { key: 'blocks', label: 'Holiday Blocks' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${subTab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ASSIGNMENTS sub-tab */}
      {subTab === 'assignments' && (
        <WeeklyOffAssignmentsPanel patterns={patterns} />
      )}

      {/* HOLIDAY BLOCKS sub-tab */}
      {subTab === 'blocks' && (
        <DepartmentHolidayBlocksPanel />
      )}

      {/* PATTERNS sub-tab */}
      {subTab === 'patterns' && <>

      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          {patterns.length} Pattern{patterns.length !== 1 ? 's' : ''} configured
          <span className="text-slate-400 font-normal ml-2">|</span>
          <span className="text-slate-500 font-normal ml-2">{unassigned.length} employees using default (Sat+Sun)</span>
        </h2>
        <button onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Pattern
        </button>
      </div>

      {/* Pattern Cards */}
      {patterns.map(p => (
        <div key={p.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {DAY_NAMES.map((dn, i) => (
                  <span key={i} className={`text-xs font-medium px-2 py-1 rounded ${p.days.includes(i) ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300' : 'bg-slate-50 text-slate-400'}`}>{dn}</span>
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-800">{p.name}</span>
              {p.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500"><Users className="w-4 h-4 inline mr-1" />{p.userCount}</span>
              <button onClick={(e) => { e.stopPropagation(); setShowAssignModal(p.id); setSelectedUsers([]); setSearchQuery(''); }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                + Assign
              </button>
              {!p.isDefault && (
                <button onClick={(e) => { e.stopPropagation(); handleDeletePattern(p.id, p.name); }}
                  className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              {expanded === p.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {expanded === p.id && (
            <div className="border-t border-slate-200 p-4">
              {(p.users || []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No employees assigned to this pattern.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider px-2 pb-1">
                    <span>Name</span><span>ID</span><span>Department</span><span></span>
                  </div>
                  {p.users.map(u => (
                    <div key={u.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center px-2 py-1.5 rounded hover:bg-slate-50">
                      <span className="text-sm text-slate-800">{u.name}</span>
                      <span className="text-sm text-slate-500 font-mono">{u.employeeId || '-'}</span>
                      <span className="text-sm text-slate-500">{u.department}</span>
                      <button onClick={() => handleRemoveUser(p.id, u.id, u.name)}
                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600" title="Remove from pattern">
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Pattern Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">Add Weekly Off Pattern</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddPattern} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pattern Name</label>
                <input type="text" value={addForm.name} required placeholder="e.g. Thu+Sat, Fri+Sun"
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Off Days</label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_NAMES.map((dn, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        addForm.days.includes(i)
                          ? 'bg-orange-100 text-orange-700 border-orange-300'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}>{dn}</button>
                  ))}
                </div>
                {addForm.days.length > 0 && (
                  <p className="text-xs text-slate-500 mt-2">Selected: {addForm.days.map(d => DAY_NAMES[d]).join(', ')}</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving || addForm.days.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Creating...' : 'Create Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Employees Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">
                Assign Employees to {patterns.find(p => p.id === showAssignModal)?.name || 'Pattern'}
              </h3>
              <button onClick={() => { setShowAssignModal(null); setSelectedUsers([]); setSearchQuery(''); }}
                className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, ID, or department..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {filteredEmployees.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No employees found.</p>
              ) : (
                <div className="space-y-1">
                  <label className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer mb-2">
                    <input type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every(u => selectedUsers.includes(u.id))}
                      onChange={e => {
                        if (e.target.checked) setSelectedUsers(filteredEmployees.map(u => u.id));
                        else setSelectedUsers([]);
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-semibold text-blue-700">Select All ({filteredEmployees.length})</span>
                  </label>
                  {filteredEmployees.map(u => (
                    <label key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={selectedUsers.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedUsers(prev => [...prev, u.id]);
                          else setSelectedUsers(prev => prev.filter(id => id !== u.id));
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.employeeId || '-'} | {u.department}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <span className="text-sm text-slate-500">{selectedUsers.length} selected</span>
              <div className="flex gap-3">
                <button onClick={() => { setShowAssignModal(null); setSelectedUsers([]); setSearchQuery(''); }}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                <button onClick={handleAssign} disabled={saving || selectedUsers.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Assigning...' : `Assign ${selectedUsers.length}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

// ─── Weekly Off Assignments Panel ────────────────────────────────────────────
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function WeeklyOffAssignmentsPanel({ patterns }) {
  const [companyId, setCompanyId] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ patternId: '', effectiveFrom: '', effectiveTo: '', targetType: 'employee', userId: '', department: '' });

  useEffect(() => {
    api.get('/companies').then(r => { setCompanies(r.data || []); }).catch(() => {});
    api.get('/users').then(r => {
      const active = (r.data || []).filter(u => u.isActive);
      setEmployees(active);
      const depts = [...new Set(active.map(u => u.department).filter(Boolean))].sort();
      setDepartments(depts);
    }).catch(() => {});
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/holidays/weekly-off-assignments?companyId=${companyId}`);
      setAssignments(res.data || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchAssignments(); }, [companyId]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const payload = {
        patternId: parseInt(form.patternId),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        companyId,
        userId: form.targetType === 'employee' ? parseInt(form.userId) : null,
        department: form.targetType === 'department' ? form.department : null,
      };
      if (editingId) {
        await api.put(`/holidays/weekly-off-assignments/${editingId}`, payload);
      } else {
        await api.post('/holidays/weekly-off-assignments', payload);
      }
      setMsg({ type: 'success', text: 'Saved!' });
      setShowForm(false); setEditingId(null);
      setForm({ patternId: '', effectiveFrom: '', effectiveTo: '', targetType: 'employee', userId: '', department: '' });
      fetchAssignments();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message || 'Save failed' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this assignment?')) return;
    try { await api.delete(`/holidays/weekly-off-assignments/${id}`); fetchAssignments(); } catch { }
  };

  const patternDays = (p) => {
    try { return JSON.parse(p.days).map(d => DAY_NAMES_SHORT[d]).join('+'); } catch { return p.name; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={companyId} onChange={e => setCompanyId(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-xs text-slate-500">{assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setMsg(null); setForm({ patternId: '', effectiveFrom: '', effectiveTo: '', targetType: 'employee', userId: '', department: '' }); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <span>+</span> Add Assignment
        </button>
      </div>

      {msg && <div className={`px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>}

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">{editingId ? 'Edit' : 'New'} Assignment</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Pattern *</label>
              <select value={form.patternId} onChange={e => setForm(f => ({ ...f, patternId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select pattern</option>
                {patterns.map(p => <option key={p.id} value={p.id}>{p.name} ({patternDays(p)})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Apply To *</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, targetType: 'employee', department: '' }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${form.targetType === 'employee' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                  Employee
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, targetType: 'department', userId: '' }))}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${form.targetType === 'department' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}>
                  Department
                </button>
              </div>
            </div>
          </div>
          {form.targetType === 'employee' ? (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Employee *</label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select employee</option>
                {employees.map(u => <option key={u.id} value={u.id}>{u.name} ({u.employeeId || '—'}) {u.department ? `· ${u.department}` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Department *</label>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Effective From *</label>
              <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Effective To (blank = ongoing)</label>
              <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.patternId || !form.effectiveFrom || (form.targetType === 'employee' ? !form.userId : !form.department)}
              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No date-ranged assignments — all employees use their profile pattern or default (Sat+Sun)</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">
                    {a.userId ? (a.user?.name || `User ${a.userId}`) : `Dept: ${a.department}`}
                  </span>
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    {a.pattern?.name} ({patternDays(a.pattern)})
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {a.effectiveFrom} → {a.effectiveTo || 'ongoing'}
                  </span>
                </div>
                {a.userId && a.user?.department && <p className="text-[10px] text-slate-400 mt-0.5">{a.user.employeeId} · {a.user.department}</p>}
              </div>
              <button onClick={() => { setForm({ patternId: String(a.patternId), effectiveFrom: a.effectiveFrom, effectiveTo: a.effectiveTo || '', targetType: a.userId ? 'employee' : 'department', userId: a.userId ? String(a.userId) : '', department: a.department || '' }); setEditingId(a.id); setShowForm(true); setMsg(null); }}
                className="text-xs text-blue-600 hover:underline shrink-0">Edit</button>
              <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:underline shrink-0">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepartmentHolidayBlocksPanel() {
  const [companyId, setCompanyId] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ department: '', date: '', reason: '' });

  useEffect(() => {
    api.get('/companies').then(r => setCompanies(r.data || [])).catch(() => {});
    api.get('/users').then(r => {
      const depts = [...new Set((r.data || []).filter(u => u.isActive && u.department).map(u => u.department))].sort();
      setDepartments(depts);
    }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, hRes] = await Promise.all([
        api.get(`/holidays/dept-holiday-blocks?companyId=${companyId}`),
        api.get('/holidays'),
      ]);
      setBlocks(bRes.data || []);
      setHolidays((hRes.data || []).sort((a, b) => a.date.localeCompare(b.date)));
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [companyId]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.post('/holidays/dept-holiday-blocks', { ...form, companyId });
      setMsg({ type: 'success', text: 'Holiday blocked for department!' });
      setShowForm(false);
      setForm({ department: '', date: '', reason: '' });
      fetchData();
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.message || 'Failed' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this holiday block?')) return;
    try { await api.delete(`/holidays/dept-holiday-blocks/${id}`); fetchData(); } catch { }
  };

  const grouped = blocks.reduce((acc, b) => {
    if (!acc[b.department]) acc[b.department] = [];
    acc[b.department].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Holiday Blocks</strong> — Mark specific holidays as working days for a department. Those employees will not get the day off and absence will count as LOP.
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select value={companyId} onChange={e => setCompanyId(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={() => { setShowForm(true); setMsg(null); setForm({ department: '', date: '', reason: '' }); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700">
          + Block Holiday
        </button>
      </div>

      {msg && <div className={`px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>}

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700">Block Holiday for Department</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Department *</label>
              <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Holiday Date *</label>
              <select value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pick a holiday</option>
                {holidays.map(h => <option key={h.id} value={h.date}>{h.date} — {h.name}</option>)}
                <option value="__custom">Custom date...</option>
              </select>
              {form.date === '__custom' && (
                <input type="date" onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Reason (optional)</label>
            <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Dispatch team working on Diwali"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.department || !form.date || form.date === '__custom'}
              className="px-4 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Block Holiday'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-6">Loading...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No holiday blocks — all departments observe all holidays</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([dept, deptBlocks]) => (
            <div key={dept} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{dept}</span>
                <span className="text-xs text-slate-400 ml-2">{deptBlocks.length} holiday{deptBlocks.length !== 1 ? 's' : ''} blocked</span>
              </div>
              <div className="divide-y divide-slate-50">
                {deptBlocks.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-medium text-red-600 font-mono">{b.date}</span>
                    {b.reason && <span className="text-xs text-slate-500 flex-1">{b.reason}</span>}
                    {!b.reason && <span className="flex-1" />}
                    <button onClick={() => handleDelete(b.id)} className="text-xs text-red-500 hover:underline">Remove</button>
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HolidayManager() {
  const [mainTab, setMainTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'weeklyoff' ? 'weeklyoff' : 'holidays';
  });
  const [fy, setFy] = useState(getCurrentFY());
  const [allHolidays, setAllHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [locationFilter, setLocationFilter] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch holidays for both years in FY (with cache-busting)
  const fetchHolidays = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const cacheBuster = `_t=${Date.now()}`;
      const [res1, res2] = await Promise.all([
        api.get(`/holidays?year=${fy}&${cacheBuster}`),
        api.get(`/holidays?year=${fy + 1}&${cacheBuster}`),
      ]);
      const all = [...res1.data, ...res2.data];
      const fyStart = `${fy}-04-01`;
      const fyEnd = `${fy + 1}-03-31`;
      const filtered = all.filter(h => h.date >= fyStart && h.date <= fyEnd);
      const seen = new Set();
      const unique = filtered.filter(h => { if (seen.has(h.id)) return false; seen.add(h.id); return true; });
      unique.sort((a, b) => a.date.localeCompare(b.date));
      setAllHolidays(unique);
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => { fetchHolidays(); setSelected(new Set()); }, [fy]);

  // Called after add/edit from modal — optimistic update + DB refetch
  const handleSaved = async (record, isEdit) => {
    if (record) {
      if (isEdit) {
        // Optimistic: replace the edited record in the list
        setAllHolidays(prev => prev.map(h => h.id === record.id ? record : h));
      } else {
        // Optimistic: add the new record to the list in sorted order
        setAllHolidays(prev => {
          const updated = [...prev, record];
          updated.sort((a, b) => a.date.localeCompare(b.date));
          return updated;
        });
      }
    }
    // Then refetch from DB in background to ensure consistency
    await fetchHolidays(false);
  };

  // Filter by location
  const locationFiltered = useMemo(() => {
    if (locationFilter === 'All') return allHolidays;
    return allHolidays.filter(h => h.location === 'All' || h.location === locationFilter);
  }, [allHolidays, locationFilter]);

  // Filter by tab
  const generalHolidays = useMemo(() => locationFiltered.filter(h => !h.isOptional), [locationFiltered]);
  const optionalHolidays = useMemo(() => locationFiltered.filter(h => h.isOptional), [locationFiltered]);
  const displayedHolidays = activeTab === 'general' ? generalHolidays : optionalHolidays;

  // Select all / none
  const allSelected = displayedHolidays.length > 0 && displayedHolidays.every(h => selected.has(h.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(displayedHolidays.map(h => h.id)));
  };
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Bulk delete — optimistic removal + DB refetch
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected holiday(s)?`)) return;
    setDeleting(true);
    const idsToDelete = [...selected];
    // Optimistic: remove from list immediately
    setAllHolidays(prev => prev.filter(h => !selected.has(h.id)));
    setSelected(new Set());
    try {
      await Promise.all(idsToDelete.map(id => api.delete(`/holidays/${id}`)));
      // Refetch from DB to confirm
      await fetchHolidays(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete some holidays.');
      // Refetch to restore correct state
      await fetchHolidays(false);
    } finally {
      setDeleting(false);
    }
  };

  // Single delete — optimistic removal + DB refetch
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete holiday "${name}"?`)) return;
    // Optimistic: remove immediately
    setAllHolidays(prev => prev.filter(h => h.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    try {
      await api.delete(`/holidays/${id}`);
      // Refetch from DB to confirm
      await fetchHolidays(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
      // Refetch to restore correct state on error
      await fetchHolidays(false);
    }
  };

  // Export
  const handleExport = () => {
    const holidays = displayedHolidays;
    const csvHeader = 'Date,Occasion,Day,Location,Type';
    const csvRows = holidays.map(h => {
      const name = h.name.includes(',') ? `"${h.name}"` : h.name;
      return `${h.date},${name},${getDayName(h.date)},${h.location || 'All'},${h.isOptional ? 'Optional' : 'General'}`;
    });
    const csv = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holidays-FY${fy}-${fy + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        alert('No valid holiday data found. Expected CSV: Date, Occasion, Type, Location');
        return;
      }
      setImportPreview(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const res = await api.post('/holidays/import', { holidays: importPreview });
      setImportResults(res.data);
      setImportPreview(null);
      // Immediately refetch from DB to show imported holidays
      await fetchHolidays(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-slate-800">Holidays & Weekly Off</h1>
            </div>
            {/* Top-level tab switcher */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden ml-4">
              <button onClick={() => { setMainTab('holidays'); window.location.hash = ''; }}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${mainTab === 'holidays' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                Holiday List
              </button>
              <button onClick={() => { setMainTab('weeklyoff'); window.location.hash = 'weeklyoff'; }}
                className={`px-4 py-1.5 text-sm font-medium border-l border-slate-200 transition-colors ${mainTab === 'weeklyoff' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                Weekly Off
              </button>
            </div>
          </div>
          {/* FY Selector (only shown for holidays tab) */}
          {mainTab === 'holidays' && (
            <select
              value={fy}
              onChange={e => setFy(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-medium text-slate-700"
            >
              {getFYOptions().map(y => (
                <option key={y} value={y}>{getFYLabel(y)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Weekly Off tab content */}
      {mainTab === 'weeklyoff' && <WeeklyOffTab />}

      {/* ── Holiday List content ──────────────────────────────────────────── */}
      {mainTab === 'holidays' && <>
      {/* ── Info Banner ────────────────────────────────────────────────────── */}
      <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          The <span className="font-semibold">Holiday List</span> page displays all the holidays declared for a particular year.
          Holidays defined here are reflected across attendance, leave calculations, and payroll.
          <span className="text-xs text-blue-500 block mt-0.5">
            CSV Format: <code className="bg-blue-100 px-1 rounded">Date, Occasion, Type, Location</code> — Location: All, Mumbai, or Lucknow
          </span>
        </div>
      </div>

      {/* ── Tabs + Actions Row ─────────────────────────────────────────────── */}
      <div className="mx-6 mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center">
          {/* Tab buttons */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setActiveTab('general'); setSelected(new Set()); }}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'general' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {generalHolidays.length} General Holidays
            </button>
            <button
              onClick={() => { setActiveTab('optional'); setSelected(new Set()); }}
              className={`px-5 py-2.5 text-sm font-medium border-l border-slate-200 transition-colors ${
                activeTab === 'optional' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {optionalHolidays.length} Restricted Holidays
            </button>
          </div>
          {/* Add Holiday link */}
          <button onClick={() => setShowForm(true)}
            className="ml-4 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Holiday
          </button>
        </div>
        {/* Right: Import + Export */}
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-white hover:border-slate-300 bg-white">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={handleExport} disabled={displayedHolidays.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 hover:border-blue-300 bg-white font-medium disabled:opacity-40">
            <Download className="w-4 h-4" /> Excel Export
          </button>
        </div>
      </div>

      {/* ── Location Filter ────────────────────────────────────────────────── */}
      <div className="mx-6 mt-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Location:</label>
          <select
            value={locationFilter}
            onChange={e => { setLocationFilter(e.target.value); setSelected(new Set()); }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 text-slate-700"
          >
            <option value="All">All</option>
            <option value="Mumbai">Mumbai</option>
            <option value="Lucknow">Lucknow</option>
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="mx-6 mt-3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="w-10 px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Occasion</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Restricted Holiday</th>
                  <th className="w-20 px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedHolidays.length > 0 ? displayedHolidays.map((h, idx) => {
                  const isPast = h.date < today;
                  return (
                    <tr key={h.id}
                      className={`hover:bg-blue-50/50 transition-colors ${isPast ? 'text-slate-400' : 'text-slate-700'} ${selected.has(h.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggleSelect(h.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>{h.name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDisplay(h.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getDayName(h.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.location === 'All'
                            ? 'bg-purple-100 text-purple-700'
                            : h.location === 'Mumbai'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-teal-100 text-teal-700'
                        }`}>
                          {h.location === 'All' ? 'Mumbai, Lucknow' : h.location}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.isOptional ? (
                          <span className="inline-block w-4 h-4 rounded-full bg-amber-400" title="Restricted"></span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditingHoliday(h)}
                            className="p-1.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(h.id, h.name)}
                            className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="text-slate-400 font-medium">
                        No {activeTab === 'general' ? 'general' : 'restricted'} holidays for {getFYLabel(fy)}
                        {locationFilter !== 'All' ? ` in ${locationFilter}` : ''}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Click "Add Holiday" or import from CSV to get started.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar ──────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shadow-lg z-10">
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-blue-600">{selected.size}</span> holiday(s) selected
          </span>
          <button onClick={handleBulkDelete} disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            <Trash2 className="w-4 h-4" />{deleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {(showForm || editingHoliday) && (
        <HolidayFormModal
          holiday={editingHoliday}
          onClose={() => { setShowForm(false); setEditingHoliday(null); }}
          onSaved={handleSaved}
        />
      )}
      {importPreview && (
        <ImportModal rows={importPreview} onClose={() => setImportPreview(null)} onConfirm={handleImportConfirm} importing={importing} />
      )}
      {importResults && (
        <ImportResultsModal results={importResults} onClose={() => setImportResults(null)} />
      )}
      </>}
    </div>
  );
}
