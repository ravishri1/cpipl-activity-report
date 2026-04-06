import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import { driveImageUrl, formatDate } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  Users, Search, User, Mail, Phone, Building2, LayoutGrid, List,
  UserCheck, Download, Upload, RefreshCw, ChevronDown, X, Check,
  FileSpreadsheet, AlertTriangle, CheckCircle2, Edit3,
} from 'lucide-react';

// ── CSV helpers ────────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseRow(lines[i]);
    if (vals.every(v => !v)) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

const EXPORT_FIELDS = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'name', label: 'Employee Name' },
  { key: 'email', label: 'Email' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'dateOfJoining', label: 'Date of Joining' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Phone' },
  { key: 'personalEmail', label: 'Personal Email' },
  { key: 'employmentType', label: 'Employment Type' },
  { key: 'employmentStatus', label: 'Employment Status' },
  { key: 'role', label: 'Role' },
  { key: 'reportingManager', label: 'Reporting Manager' },
  { key: 'company', label: 'Company' },
  { key: 'location', label: 'Location' },
  { key: 'bloodGroup', label: 'Blood Group' },
  { key: 'maritalStatus', label: 'Marital Status' },
  { key: 'fatherName', label: 'Father Name' },
  { key: 'spouseName', label: 'Spouse Name' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'religion', label: 'Religion' },
  { key: 'placeOfBirth', label: 'Place of Birth' },
  { key: 'address', label: 'Current Address' },
  { key: 'permanentAddress', label: 'Permanent Address' },
  { key: 'aadhaarNumber', label: 'Aadhaar Number' },
  { key: 'panNumber', label: 'PAN Number' },
  { key: 'passportNumber', label: 'Passport Number' },
  { key: 'passportExpiry', label: 'Passport Expiry' },
  { key: 'drivingLicense', label: 'Driving License' },
  { key: 'uanNumber', label: 'UAN Number' },
  { key: 'bankName', label: 'Bank Name' },
  { key: 'bankAccountNumber', label: 'Bank Account Number' },
  { key: 'bankBranch', label: 'Bank Branch' },
  { key: 'bankIfscCode', label: 'IFSC Code' },
  { key: 'confirmationDate', label: 'Confirmation Date' },
  { key: 'confirmationStatus', label: 'Confirmation Status' },
  { key: 'probationEndDate', label: 'Probation End Date' },
  { key: 'noticePeriodDays', label: 'Notice Period Days' },
  { key: 'previousExperience', label: 'Previous Experience (years)' },
  { key: 'grade', label: 'Grade' },
  { key: 'shift', label: 'Shift' },
  { key: 'emergencyContact', label: 'Emergency Contact' },
  { key: 'isActive', label: 'Active' },
];

// ── Import Modal ─────────────────────────────────────────
function ImportModal({ onClose, onDone }) {
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [csvData, setCsvData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState('upsert');
  const [result, setResult] = useState(null);
  const { execute, loading, error, success } = useApi();
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCSV(text);
    if (rows.length === 0) return;
    setCsvData({ headers, rows, filename: file.name });

    try {
      const res = await execute(
        () => api.post('/import/preview', { headers, rows: rows.slice(0, 200) }),
        'CSV parsed successfully'
      );
      setPreview(res);
      setStep('preview');
    } catch {
      // error displayed by useApi
    }
  };

  const handleExecute = async () => {
    if (!csvData || !preview) return;
    try {
      const res = await execute(
        () => api.post('/import/execute', {
          rows: csvData.rows,
          mapping: preview.mapping,
          mode,
        }),
        'Import completed!'
      );
      setResult(res);
      setStep('result');
    } catch {
      // error displayed by useApi
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/import/template');
      const cols = res.data.columns;
      downloadCSV('employee-import-template.csv', cols, []);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Import Employees
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Upload a CSV file with employee data. Existing employees will be matched by email, employee ID, or name.</p>

              <div className="flex items-center gap-3">
                <button onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200">
                  <Download className="w-3.5 h-3.5" /> Download Template
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">Click to select CSV file</p>
                <p className="text-xs text-slate-400 mt-1">Supports .csv files</p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </div>

              {loading && <LoadingSpinner />}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-blue-500 font-medium">Rows</span>
                  <p className="text-lg font-bold text-blue-700">{csvData.rows.length}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-emerald-500 font-medium">Mapped Fields</span>
                  <p className="text-lg font-bold text-emerald-700">{Object.keys(preview.mapping).length}</p>
                </div>
                {preview.unmappedHeaders?.length > 0 && (
                  <div className="bg-amber-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-amber-500 font-medium">Unmapped</span>
                    <p className="text-lg font-bold text-amber-700">{preview.unmappedHeaders.length}</p>
                  </div>
                )}
              </div>

              {/* Field mapping */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Field Mapping</h3>
                <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto bg-slate-50 rounded-lg p-3">
                  {Object.entries(preview.mapping).map(([csv, db]) => (
                    <div key={csv} className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500 truncate">{csv}</span>
                      <span className="text-slate-300">→</span>
                      <span className="font-medium text-emerald-700">{db}</span>
                    </div>
                  ))}
                </div>
                {preview.unmappedHeaders?.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Unmapped columns (will be ignored): {preview.unmappedHeaders.join(', ')}
                  </p>
                )}
              </div>

              {/* Mode selector */}
              <div>
                <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Import Mode</h3>
                <div className="flex items-center gap-2">
                  {[
                    { key: 'upsert', label: 'Create + Update', desc: 'Create new employees & update existing' },
                    { key: 'create', label: 'Create Only', desc: 'Only add new employees' },
                    { key: 'update', label: 'Update Only', desc: 'Only update existing employees' },
                  ].map(m => (
                    <button key={m.key} onClick={() => setMode(m.key)}
                      className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                        mode === m.key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}>
                      <p className={`text-xs font-semibold ${mode === m.key ? 'text-blue-700' : 'text-slate-700'}`}>{m.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              {preview.preview?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-600 uppercase mb-2">Preview (first {preview.preview.length} rows)</h3>
                  <div className="overflow-x-auto bg-slate-50 rounded-lg">
                    <table className="text-xs">
                      <thead>
                        <tr className="bg-slate-100">
                          {Object.keys(preview.preview[0]).map(k => (
                            <th key={k} className="px-2 py-1.5 font-medium text-slate-600 whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row, i) => (
                          <tr key={i} className="border-t border-slate-200">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-2 py-1.5 text-slate-700 whitespace-nowrap max-w-[150px] truncate">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => { setStep('upload'); setPreview(null); setCsvData(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Back</button>
                <button onClick={handleExecute} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Import {csvData.rows.length} rows
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                  <p className="text-xs text-emerald-500">Created</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <RefreshCw className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                  <p className="text-xs text-blue-500">Updated</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <AlertTriangle className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-slate-600">{result.skipped}</p>
                  <p className="text-xs text-slate-400">Skipped</p>
                </div>
              </div>

              {result.errors?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                  <h4 className="text-xs font-semibold text-red-700 mb-2">Errors ({result.errors.length})</h4>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 mb-0.5">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => { onDone(); onClose(); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Bulk Update Modal ────────────────────────────────────
function BulkUpdateModal({ employees, onClose, onDone }) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const { execute, loading, error, success } = useApi();

  const filteredEmps = useMemo(() => {
    if (!bulkSearch) return employees;
    const s = bulkSearch.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(s) || (e.employeeId || '').toLowerCase().includes(s));
  }, [employees, bulkSearch]);

  const handleSelectAll = () => {
    if (selectAll) { setSelected(new Set()); setSelectAll(false); }
    else { setSelected(new Set(filteredEmps.map(e => e.id))); setSelectAll(true); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const BULK_FIELDS = [
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'designation', label: 'Designation', type: 'text' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'shift', label: 'Shift', type: 'text' },
    { key: 'grade', label: 'Grade', type: 'text' },
    { key: 'employmentType', label: 'Employment Type', type: 'select', options: ['full_time', 'part_time', 'contract', 'intern'] },
    { key: 'role', label: 'Role', type: 'select', options: ['member', 'team_lead', 'admin'] },
    { key: 'confirmationStatus', label: 'Confirmation Status', type: 'select', options: ['pending', 'extended', 'confirmed'] },
    { key: 'noticePeriodDays', label: 'Notice Period Days', type: 'number' },
    { key: 'confirmationDate', label: 'Confirmation Date', type: 'date' },
    { key: 'probationEndDate', label: 'Probation End Date', type: 'date' },
  ];

  const selectedField = BULK_FIELDS.find(f => f.key === field);

  const handleBulkUpdate = async () => {
    if (!field || selected.size === 0) return;
    if (!window.confirm(`Update "${selectedField?.label}" to "${value}" for ${selected.size} employees?`)) return;

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const userId of selected) {
        try {
          const payload = {};
          if (selectedField?.type === 'number') payload[field] = parseInt(value);
          else payload[field] = value;
          await api.put(`/users/${userId}/profile`, payload);
          successCount++;
        } catch {
          errorCount++;
        }
      }
      await execute(() => Promise.resolve({ data: { successCount, errorCount } }),
        `Updated ${successCount} employees${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      );
      if (successCount > 0) onDone();
    } catch {
      // handled by useApi
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-600" />
            Bulk Update Employees
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Field + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Field to Update</label>
              <select value={field} onChange={e => { setField(e.target.value); setValue(''); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select field...</option>
                {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">New Value</label>
              {selectedField?.type === 'select' ? (
                <select value={value} onChange={e => setValue(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select value...</option>
                  {selectedField.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                </select>
              ) : selectedField?.type === 'date' ? (
                <input type="date" value={value} onChange={e => setValue(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              ) : selectedField?.type === 'number' ? (
                <input type="number" value={value} onChange={e => setValue(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              ) : (
                <input type="text" value={value} onChange={e => setValue(e.target.value)} placeholder="Enter value..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              )}
            </div>
          </div>

          {/* Employee selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase">Select Employees ({selected.size} selected)</span>
              <div className="flex items-center gap-2">
                <input type="text" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)}
                  placeholder="Search..." className="border border-slate-200 rounded px-2 py-1 text-xs w-32" />
                <button onClick={handleSelectAll} className="text-xs text-blue-600 hover:underline">
                  {selectAll ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg max-h-[300px] overflow-y-auto">
              {filteredEmps.map(emp => (
                <label key={emp.id}
                  className={`flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 ${selected.has(emp.id) ? 'bg-blue-50' : ''}`}>
                  <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)}
                    className="rounded border-slate-300 text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{emp.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{emp.employeeId} · {emp.department}</span>
                  </div>
                  {field && (
                    <span className="text-xs text-slate-400 truncate max-w-[120px]">
                      Current: {emp[field] || '—'}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleBulkUpdate} disabled={loading || !field || !value || selected.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Update {selected.size} employees
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export default function EmployeeDirectory() {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin' || authUser?.role === 'sub_admin' || authUser?.role === 'team_lead';

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [company, setCompany] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'notice_period' | 'separated' | 'terminated' | 'absconding'
  const [confirmationFilter, setConfirmationFilter] = useState('all'); // 'all' | 'confirmed' | 'probation'

  const fetchData = useCallback(async () => {
    try {
      const params = { search, department, company };
      if (isAdmin) { params.status = statusFilter; params.confirmation = confirmationFilter; }
      const [empRes, deptRes] = await Promise.all([
        api.get('/users/directory', { params }),
        api.get('/users/departments'),
      ]);
      setEmployees(empRes.data.users || empRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Directory error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, department, company, isAdmin, statusFilter, confirmationFilter]);

  useEffect(() => {
    api.get('/companies').then((r) => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/users/export', { params: { activeOnly: 'true', department, company } });
      const data = res.data;
      const headers = EXPORT_FIELDS.map(f => f.label);
      const rows = data.map(emp => EXPORT_FIELDS.map(f => {
        if (f.key === 'reportingManager') return emp.reportingManager?.name || '';
        if (f.key === 'company') return emp.company?.shortName || emp.company?.name || '';
        if (f.key === 'isActive') return emp.isActive ? 'Yes' : 'No';
        return emp[f.key] ?? '';
      }));
      downloadCSV(`employees-export-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Employee Directory
          <span className="text-sm font-normal text-slate-400 ml-1">({employees.length}{isAdmin && statusFilter !== 'all' ? ` · ${{ active: 'Current', notice_period: 'Notice Period', separated: 'Resigned', terminated: 'Terminated', absconding: 'Left' }[statusFilter] || statusFilter}` : ''}{isAdmin && confirmationFilter !== 'all' ? ` · ${confirmationFilter === 'probation' ? 'Probation' : 'Confirmed'}` : ''})</span>
        </h1>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Import
            </button>
            <button onClick={() => setShowBulkUpdate(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
              <Edit3 className="w-3.5 h-3.5" /> Bulk Update
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
          ))}
        </select>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {isAdmin && (
          <>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700">
              <option value="all">All Status</option>
              <option value="active">Current</option>
              <option value="notice_period">Notice Period</option>
              <option value="separated">Resigned</option>
              <option value="terminated">Terminated</option>
              <option value="absconding">Left (No Intimation)</option>
            </select>
            <select
              value={confirmationFilter}
              onChange={e => setConfirmationFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700">
              <option value="all">All Confirmation</option>
              <option value="confirmed">Confirmed</option>
              <option value="probation">On Probation</option>
            </select>
          </>
        )}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">No employees found.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Link
              key={emp.id}
              to={`/employee/${emp.id}`}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {(driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl) ? (
                    <img src={driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    emp.name?.charAt(0)?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
                    {emp.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{emp.designation || 'Employee'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span className="text-[11px] text-slate-400">{emp.department}</span>
                    {emp.company?.shortName && (
                      <span className="text-[9px] font-mono bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded ml-1">{emp.company.shortName}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {emp.employeeId && (
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      {emp.employeeId}
                    </span>
                  )}
                  {emp.employmentStatus && emp.employmentStatus !== 'active' && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      emp.employmentStatus === 'separated' ? 'bg-red-100 text-red-600' :
                      emp.employmentStatus === 'terminated' ? 'bg-red-200 text-red-800' :
                      emp.employmentStatus === 'notice_period' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>{emp.employmentStatus.replace('_', ' ')}</span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone className="w-3 h-3" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                </div>
                {emp.reportingManager && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <UserCheck className="w-3 h-3 text-blue-400" />
                    <span>Reports to <span className="text-slate-500 font-medium">{emp.reportingManager.name}</span></span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">ID</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Department</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Designation</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 hidden lg:table-cell">Reports To</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link to={`/employee/${emp.id}`} className="flex items-center gap-2 hover:text-blue-700">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                        {(driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl)
                          ? <img src={driveImageUrl(emp.driveProfilePhotoUrl) || emp.profilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-800">{emp.name}</span>
                      {emp.employmentStatus && emp.employmentStatus !== 'active' && (
                        <span className={`ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          emp.employmentStatus === 'separated' ? 'bg-red-100 text-red-600' :
                          emp.employmentStatus === 'terminated' ? 'bg-red-200 text-red-800' :
                          emp.employmentStatus === 'notice_period' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{emp.employmentStatus.replace('_', ' ')}</span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{emp.employeeId || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{emp.department}</td>
                  <td className="px-4 py-2.5 text-slate-600">{emp.designation || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell">
                    {emp.reportingManager ? (
                      <Link to={`/employee/${emp.reportingManager.id}`} className="text-blue-600 hover:underline text-xs">
                        {emp.reportingManager.name}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={fetchData} />}
      {showBulkUpdate && <BulkUpdateModal employees={employees} onClose={() => setShowBulkUpdate(false)} onDone={fetchData} />}
    </div>
  );
}
