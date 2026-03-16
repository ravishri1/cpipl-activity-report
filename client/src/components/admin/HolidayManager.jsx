import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import {
  CalendarDays, Plus, Trash2, Sun, Star,
  ChevronLeft, ChevronRight, X, Building2, Globe, Pencil,
  Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
} from 'lucide-react';

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
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="overflow-auto flex-1 p-5">
          <p className="text-sm text-slate-500 mb-3">
            Existing holidays on same date will be <span className="font-medium text-amber-600">updated</span>. New dates will be <span className="font-medium text-green-600">created</span>.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-600">#</th>
                <th className="px-3 py-2 font-medium text-slate-600">Date</th>
                <th className="px-3 py-2 font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 font-medium text-slate-600">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className={`${!r.date || !r.name ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.date || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      r.type?.toLowerCase() === 'optional' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {r.type || 'Gazetted'}
                    </span>
                  </td>
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
            <button onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : `Import ${rows.length} Holidays`}
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
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-semibold text-slate-800">Import Complete</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{results.created}</div>
              <div className="text-xs text-green-600 font-medium">Created</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{results.updated}</div>
              <div className="text-xs text-blue-600 font-medium">Updated</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-500">{results.skipped}</div>
              <div className="text-xs text-slate-500 font-medium">Skipped</div>
            </div>
          </div>
          {results.errors?.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 mb-1">
                <AlertTriangle className="w-4 h-4" /> Warnings
              </div>
              <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto">
                {results.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Parser Utility ──────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect header
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') || header.includes('name');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map(line => {
    // Simple CSV parse (handles quoted fields)
    const fields = [];
    let current = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());

    let [date, name, type] = fields;

    // Auto-detect DD-MM-YYYY or DD/MM/YYYY and convert to YYYY-MM-DD
    if (date && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(date)) {
      const parts = date.split(/[-/]/);
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    return { date: date || '', name: name || '', type: type || 'Gazetted' };
  });
}

// ─── Branch Holidays Tab ──────────────────────────────────────────────────────
function BranchHolidaysTab() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchHolidays, setBranchHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', isOptional: false });
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Load branches on mount
  useEffect(() => {
    api.get('/branches').then(res => {
      const active = res.data.filter(b => b.isActive);
      setBranches(active);
      if (active.length > 0) setSelectedBranch(active[0]);
    }).catch(console.error);
  }, []);

  // Load branch holidays when branch or year changes
  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    api.get(`/branches/${selectedBranch.id}/holidays?year=${year}`)
      .then(res => setBranchHolidays(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBranch, year]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post(`/branches/${selectedBranch.id}/holidays`, form);
      setForm({ name: '', date: '', isOptional: false });
      setShowAdd(false);
      const res = await api.get(`/branches/${selectedBranch.id}/holidays?year=${year}`);
      setBranchHolidays(res.data);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add holiday.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (holidayId, name) => {
    if (!confirm(`Delete branch holiday "${name}"?`)) return;
    try {
      await api.delete(`/branches/${selectedBranch.id}/holidays/${holidayId}`);
      setBranchHolidays(h => h.filter(x => x.id !== holidayId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
    }
  };

  if (branches.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-slate-500 font-medium">No active branches configured.</p>
        <p className="text-sm mt-1">Add branches in Branch Management first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Branch selector + year nav */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Select Branch</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedBranch?.id || ''}
            onChange={e => {
              const b = branches.find(x => x.id === parseInt(e.target.value));
              setSelectedBranch(b || null);
            }}>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name} — {b.city}, {b.state}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 sm:mt-4">
          <button onClick={() => setYear(y => y - 1)}
            className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-base font-semibold text-slate-700 w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm ml-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Add Branch Holiday — {selectedBranch?.name}
            </h3>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          {addError && (
            <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{addError}</div>
          )}
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input type="text" value={form.name} required placeholder="e.g. Diwali"
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={form.date} required
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
              <input type="checkbox" checked={form.isOptional} className="rounded border-slate-300"
                onChange={e => setForm({ ...form, isOptional: e.target.checked })} />
              Optional
            </label>
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap">
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Holiday table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-10">
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Day</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Holiday</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchHolidays.length > 0 ? branchHolidays.map(h => {
                const isPast = h.date < new Date().toISOString().split('T')[0];
                const dateObj = new Date(h.date + 'T00:00:00');
                return (
                  <tr key={h.id} className={`hover:bg-slate-50 ${isPast ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{h.date}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {h.isOptional
                          ? <Star className="w-3.5 h-3.5 text-amber-500" />
                          : <Sun className="w-3.5 h-3.5 text-green-500" />}
                        <span className="font-medium text-slate-800">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        h.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {h.isOptional ? 'Optional' : 'Branch'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(h.id, h.name)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No branch holidays for {selectedBranch?.name} in {year}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Edit Holiday Modal ───────────────────────────────────────────────────────
function EditHolidayModal({ holiday, onClose, onSaved }) {
  const [form, setForm] = useState({ name: holiday.name, date: holiday.date, isOptional: holiday.isOptional });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.put(`/holidays/${holiday.id}`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update holiday.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Edit Holiday</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Holiday Name</label>
            <input type="text" value={form.name} required
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input type="date" value={form.date} required
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isOptional}
              onChange={e => setForm({ ...form, isOptional: e.target.checked })}
              className="rounded border-slate-300" />
            Optional holiday
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Global Holidays Tab ──────────────────────────────────────────────────────
function GlobalHolidaysTab() {
  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', isOptional: false });
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingHoliday, setEditingHoliday] = useState(null);

  // Import state
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  const fetchHolidays = () => {
    setLoading(true);
    api.get(`/holidays?year=${year}`)
      .then(res => setHolidays(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHolidays(); }, [year]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post('/holidays', form);
      setForm({ name: '', date: '', isOptional: false });
      setShowAdd(false);
      fetchHolidays();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add holiday.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (holidayId, name) => {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    try {
      await api.delete(`/holidays/${holidayId}`);
      setHolidays(h => h.filter(x => x.id !== holidayId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
    }
  };

  // ─── Export CSV ───────────────────────────────────────────────────────────
  const handleExport = () => {
    const csvHeader = 'Date,Name,Type';
    const csvRows = holidays.map(h => {
      const escapedName = h.name.includes(',') ? `"${h.name}"` : h.name;
      return `${h.date},${escapedName},${h.isOptional ? 'Optional' : 'Gazetted'}`;
    });
    const csv = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holidays-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Import CSV ───────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        alert('No valid holiday data found in the file. Expected CSV with columns: Date, Name, Type');
        return;
      }
      setImportPreview(rows);
    };
    reader.readAsText(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const res = await api.post('/holidays/import', { holidays: importPreview });
      setImportResults(res.data);
      setImportPreview(null);
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Year nav + action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)}
            className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-base font-semibold text-slate-700 w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)}
            className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">{holidays.length} holidays</span>

          {/* Import button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300">
            <Upload className="w-4 h-4" /> Import
          </button>

          {/* Export button */}
          <button onClick={handleExport} disabled={holidays.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" /> Export
          </button>

          {/* Add Holiday button */}
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            <Plus className="w-4 h-4" /> Add Holiday
          </button>
        </div>
      </div>

      {/* CSV format hint */}
      {importPreview === null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700 flex items-start gap-2">
          <FileSpreadsheet className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-medium">CSV Format:</span> Date, Name, Type — e.g. <code className="bg-blue-100 px-1 rounded">2026-01-26,Republic Day,Gazetted</code>
            <br />
            Dates can be YYYY-MM-DD or DD-MM-YYYY. Type can be "Gazetted" or "Optional". Existing dates will be updated.
          </div>
        </div>
      )}

      {/* Import preview modal */}
      {importPreview && (
        <ImportModal
          rows={importPreview}
          onClose={() => setImportPreview(null)}
          onConfirm={handleImportConfirm}
          importing={importing}
        />
      )}

      {/* Import results modal */}
      {importResults && (
        <ImportResultsModal
          results={importResults}
          onClose={() => setImportResults(null)}
        />
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Global Holiday</h3>
            <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          {addError && (
            <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg mb-3">{addError}</div>
          )}
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input type="text" value={form.name} required placeholder="e.g. Republic Day"
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={form.date} required
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
              <input type="checkbox" checked={form.isOptional} className="rounded border-slate-300"
                onChange={e => setForm({ ...form, isOptional: e.target.checked })} />
              Optional
            </label>
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Edit holiday modal */}
      {editingHoliday && (
        <EditHolidayModal
          holiday={editingHoliday}
          onClose={() => setEditingHoliday(null)}
          onSaved={() => {
            fetchHolidays();
            setEditingHoliday(null);
          }}
        />
      )}

      {/* Holiday table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-16 z-10">
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Day</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Holiday</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.length > 0 ? holidays.map(h => {
                const isPast = h.date < new Date().toISOString().split('T')[0];
                const dateObj = new Date(h.date + 'T00:00:00');
                return (
                  <tr key={h.id} className={`hover:bg-slate-50 ${isPast ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{h.date}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {h.isOptional
                          ? <Star className="w-3.5 h-3.5 text-amber-500" />
                          : <Sun className="w-3.5 h-3.5 text-blue-500" />}
                        <span className="font-medium text-slate-800">{h.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        h.isOptional ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {h.isOptional ? 'Optional' : 'Gazetted'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingHoliday(h)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600"
                          title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(h.id, h.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                          title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No global holidays for {year}. Click "Add Holiday" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function HolidayManager() {
  const [activeTab, setActiveTab] = useState('global');

  const TABS = [
    { key: 'global', label: 'Global Holidays', icon: Globe },
    { key: 'branch', label: 'Branch Holidays', icon: Building2 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-slate-800">Holiday Manager</h1>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'global' ? <GlobalHolidaysTab /> : <BranchHolidaysTab />}
      </div>
    </div>
  );
}
