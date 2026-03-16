import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../utils/api';
import {
  CalendarDays, Plus, Trash2, X, Upload, Download,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Pencil, Info,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  const m = now.getMonth(); // 0-indexed
  return m >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Apr=3
}

function getFYLabel(fy) {
  return `Apr ${fy} - Mar ${fy + 1}`;
}

function getFYOptions() {
  const current = getCurrentFY();
  const opts = [];
  for (let y = current - 3; y <= current + 2; y++) {
    opts.push(y);
  }
  return opts;
}

// Get months in FY as YYYY-MM strings (Apr thru Mar)
function getFYMonths(fy) {
  const months = [];
  for (let m = 4; m <= 12; m++) months.push(`${fy}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${fy + 1}-${String(m).padStart(2, '0')}`);
  return months;
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
    let [date, name, type] = fields;
    if (date && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(date)) {
      const parts = date.split(/[-/]/);
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return { date: date || '', name: name || '', type: type || 'General' };
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
            Existing holidays on same date will be <span className="font-medium text-amber-600">updated</span>. New dates will be <span className="font-medium text-green-600">created</span>.
          </p>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">#</th>
              <th className="px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="px-3 py-2 font-medium text-slate-600">Occasion</th>
              <th className="px-3 py-2 font-medium text-slate-600">Type</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className={!r.date || !r.name ? 'bg-red-50' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{r.date || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2 text-slate-800">{r.name || <span className="text-red-500">Missing</span>}</td>
                  <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded ${r.type?.toLowerCase() === 'optional' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{r.type || 'General'}</span></td>
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isEdit) {
        await api.put(`/holidays/${holiday.id}`, form);
      } else {
        await api.post('/holidays', form);
      }
      onSaved();
      onClose();
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HolidayManager() {
  const [fy, setFy] = useState(getCurrentFY());
  const [allHolidays, setAllHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general | optional
  const [selected, setSelected] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch holidays for both years in FY (e.g. 2025 + 2026 for FY Apr 2025-Mar 2026)
  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        api.get(`/holidays?year=${fy}`),
        api.get(`/holidays?year=${fy + 1}`),
      ]);
      // Combine and filter to FY range (Apr of fy to Mar of fy+1)
      const all = [...res1.data, ...res2.data];
      const fyStart = `${fy}-04-01`;
      const fyEnd = `${fy + 1}-03-31`;
      const filtered = all.filter(h => h.date >= fyStart && h.date <= fyEnd);
      // Deduplicate by id
      const seen = new Set();
      const unique = filtered.filter(h => { if (seen.has(h.id)) return false; seen.add(h.id); return true; });
      unique.sort((a, b) => a.date.localeCompare(b.date));
      setAllHolidays(unique);
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHolidays(); setSelected(new Set()); }, [fy]);

  // Filtered by tab
  const generalHolidays = useMemo(() => allHolidays.filter(h => !h.isOptional), [allHolidays]);
  const optionalHolidays = useMemo(() => allHolidays.filter(h => h.isOptional), [allHolidays]);
  const displayedHolidays = activeTab === 'general' ? generalHolidays : optionalHolidays;

  // Select all / none
  const allSelected = displayedHolidays.length > 0 && displayedHolidays.every(h => selected.has(h.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedHolidays.map(h => h.id)));
    }
  };
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected holiday(s)?`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map(id => api.delete(`/holidays/${id}`)));
      setSelected(new Set());
      fetchHolidays();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete some holidays.');
    } finally {
      setDeleting(false);
    }
  };

  // Single delete
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete holiday "${name}"?`)) return;
    try {
      await api.delete(`/holidays/${id}`);
      setAllHolidays(prev => prev.filter(h => h.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete.');
    }
  };

  // Export
  const handleExport = () => {
    const holidays = displayedHolidays;
    const csvHeader = 'Date,Occasion,Day,Type';
    const csvRows = holidays.map(h => {
      const name = h.name.includes(',') ? `"${h.name}"` : h.name;
      return `${h.date},${name},${getDayName(h.date)},${h.isOptional ? 'Optional' : 'General'}`;
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
        alert('No valid holiday data found. Expected CSV: Date, Occasion, Type');
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
      fetchHolidays();
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
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-slate-800">Holiday List</h1>
          </div>
          {/* FY Selector */}
          <select
            value={fy}
            onChange={e => setFy(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-medium text-slate-700"
          >
            {getFYOptions().map(y => (
              <option key={y} value={y}>{getFYLabel(y)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Info Banner ────────────────────────────────────────────────────── */}
      <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          The <span className="font-semibold">Holiday List</span> page displays all the holidays declared for a particular year.
          Holidays defined here are reflected across attendance, leave calculations, and payroll.
          <span className="text-xs text-blue-500 block mt-0.5">
            CSV Format: <code className="bg-blue-100 px-1 rounded">Date, Occasion, Type</code> — Dates: YYYY-MM-DD or DD-MM-YYYY, Type: General or Optional
          </span>
        </div>
      </div>

      {/* ── Tabs Row ───────────────────────────────────────────────────────── */}
      <div className="mx-6 mt-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center">
          {/* Tab buttons */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setActiveTab('general'); setSelected(new Set()); }}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {generalHolidays.length} General Holidays
            </button>
            <button
              onClick={() => { setActiveTab('optional'); setSelected(new Set()); }}
              className={`px-5 py-2.5 text-sm font-medium border-l border-slate-200 transition-colors ${
                activeTab === 'optional'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {optionalHolidays.length} Restricted Holidays
            </button>
          </div>

          {/* Add Holiday link */}
          <button
            onClick={() => setShowForm(true)}
            className="ml-4 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
          >
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
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="w-10 px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Occasion</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Day</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="w-20 px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedHolidays.length > 0 ? displayedHolidays.map((h, idx) => {
                  const isPast = h.date < today;
                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-blue-50/50 transition-colors ${isPast ? 'text-slate-400' : 'text-slate-700'} ${selected.has(h.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(h.id)}
                          onChange={() => toggleSelect(h.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>{h.name}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateDisplay(h.date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{getDayName(h.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          h.isOptional
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {h.isOptional ? 'Restricted' : 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingHoliday(h)}
                            className="p-1.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(h.id, h.name)}
                            className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                      <p className="text-slate-400 font-medium">
                        No {activeTab === 'general' ? 'general' : 'restricted'} holidays for {getFYLabel(fy)}
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
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {(showForm || editingHoliday) && (
        <HolidayFormModal
          holiday={editingHoliday}
          onClose={() => { setShowForm(false); setEditingHoliday(null); }}
          onSaved={fetchHolidays}
        />
      )}
      {importPreview && (
        <ImportModal rows={importPreview} onClose={() => setImportPreview(null)} onConfirm={handleImportConfirm} importing={importing} />
      )}
      {importResults && (
        <ImportResultsModal results={importResults} onClose={() => setImportResults(null)} />
      )}
    </div>
  );
}
