import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../utils/api';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  X,
  Eye,
  Zap,
  Users,
  MapPin,
  Info,
} from 'lucide-react';

// ── CSV Parser ──────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.some((v) => v)) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = vals[idx] || '';
      });
      rows.push(row);
    }
  }
  return { headers, rows };
}

// ── Excel Parser ────────────────────────────────
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get raw rows (header:1 returns array of arrays)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length < 2) return { headers: [], rows: [], sheetName };

  // Auto-detect the header row — greytHR exports often have a title row first.
  // The header row is the first row with 3+ non-empty cells that look like column names.
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const nonEmpty = rawRows[i].filter((c) => String(c).trim() !== '').length;
    if (nonEmpty >= 3) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rawRows[headerRowIdx].map((h) => String(h).trim()).filter(Boolean);
  const rows = [];

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const row = {};
    let hasValue = false;
    headers.forEach((h, idx) => {
      let val = rawRow[idx];
      if (val instanceof Date) {
        val = val.toISOString().split('T')[0];
      } else if (val !== null && val !== undefined) {
        val = String(val).trim();
      } else {
        val = '';
      }
      row[h] = val;
      if (val) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }

  return { headers, rows, sheetName, totalSheets: workbook.SheetNames.length, sheetNames: workbook.SheetNames };
}

// ── Steps ───────────────────────────────────────
const STEPS = ['Upload', 'Map Fields', 'Preview', 'Import'];

export default function EmployeeImport() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState({ headers: [], rows: [] });
  const [mapping, setMapping] = useState({});
  const [unmapped, setUnmapped] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [preview, setPreview] = useState([]);
  const [importMode, setImportMode] = useState('upsert');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  // ── Step 1: File Upload ──
  const handleFile = useCallback(async (f) => {
    setError('');
    if (!f) return;

    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'tsv', 'txt', 'xlsx', 'xls'].includes(ext)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setFile(f);

    let headers, rows;
    if (['xlsx', 'xls'].includes(ext)) {
      // Parse Excel file
      const buffer = await f.arrayBuffer();
      const result = parseExcel(buffer);
      headers = result.headers;
      rows = result.rows;
    } else {
      // Parse CSV/TSV file
      const text = await f.text();
      const result = parseCSV(text);
      headers = result.headers;
      rows = result.rows;
    }

    if (rows.length === 0) {
      setError('No data rows found in the file.');
      return;
    }

    setRawData({ headers, rows });

    // Get mapping preview from backend
    setLoading(true);
    try {
      const res = await api.post('/import/preview', { headers, rows });
      setMapping(res.data.mapping);
      setUnmapped(res.data.unmappedHeaders);
      setAvailableFields(res.data.availableFields);
      setPreview(res.data.preview);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process file.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Step 2: Field Mapping ──
  const updateMapping = (csvHeader, dbField) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (dbField === '') {
        delete next[csvHeader];
      } else {
        next[csvHeader] = dbField;
      }
      return next;
    });
  };

  const goToPreview = async () => {
    setLoading(true);
    try {
      const res = await api.post('/import/preview', {
        headers: rawData.headers,
        rows: rawData.rows,
      });
      // Override with user's custom mapping
      setPreview(
        rawData.rows.slice(0, 5).map((row) => {
          const mapped = {};
          Object.entries(row).forEach(([key, val]) => {
            const field = mapping[key];
            if (field && val) mapped[field] = val;
          });
          return mapped;
        })
      );
      setStep(2);
    } catch (err) {
      setError('Failed to generate preview.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Preview & Confirm ──
  // Already set preview in goToPreview

  // ── Step 4: Execute Import ──
  const executeImport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/import/execute', {
        rows: rawData.rows,
        mapping,
        mode: importMode,
      });
      setResults(res.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setRawData({ headers: [], rows: [] });
    setMapping({});
    setUnmapped([]);
    setPreview([]);
    setResults(null);
    setError('');
  };

  // ── Download Template ──
  const downloadTemplate = async () => {
    try {
      const res = await api.get('/import/template');
      const cols = res.data.columns;
      const csv = cols.join(',') + '\n';
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_import_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template.');
    }
  };

  // Count mapped fields
  const mappedCount = Object.keys(mapping).length;
  const totalHeaders = rawData.headers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Upload className="w-6 h-6 text-blue-600" />
          Import Employees
        </h1>
        <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === step ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
              : i < step ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="p-0.5"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ══════════════════ STEP 0: Upload ══════════════════ */}
      {step === 0 && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5 mb-2">
              <Info className="w-4 h-4" /> How to export from greytHR
            </h3>
            <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
              <li>Login to <strong>greytHR Admin</strong> → <strong>Employee Information</strong> → <strong>Employee Directory</strong></li>
              <li>Click <strong>Export</strong> or <strong>Download</strong> button (usually top-right)</li>
              <li>Choose <strong>CSV</strong> or <strong>Excel</strong> format → download the file</li>
              <li>Upload the exported file below — <strong>Excel (.xlsx/.xls) and CSV</strong> formats are both supported</li>
            </ol>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          >
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">
              Drag & drop your file here, or <span className="text-blue-600 underline">click to browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports Excel (.xlsx, .xls) and CSV files from greytHR or Google Sheets</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ STEP 1: Map Fields ══════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Field Mapping — {mappedCount}/{totalHeaders} columns mapped
              </h3>
              <span className="text-xs text-slate-400">{rawData.rows.length} rows detected</span>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {rawData.headers.map((h) => (
                <div key={h} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="w-1/3 min-w-0">
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded truncate block">
                      {h}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <div className="flex-1">
                    <select
                      value={mapping[h] || ''}
                      onChange={(e) => updateMapping(h, e.target.value)}
                      className={`w-full text-xs border rounded-lg px-2 py-1.5 ${
                        mapping[h] ? 'border-green-300 bg-green-50 text-green-800' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <option value="">— Skip this column —</option>
                      <optgroup label="Basic Info">
                        <option value="name">Name</option>
                        <option value="email">Email</option>
                        <option value="employeeId">Employee ID</option>
                        <option value="department">Department</option>
                        <option value="designation">Designation</option>
                        <option value="role">Role (admin/team_lead/member)</option>
                      </optgroup>
                      <optgroup label="Personal">
                        <option value="dateOfBirth">Date of Birth</option>
                        <option value="gender">Gender</option>
                        <option value="bloodGroup">Blood Group</option>
                        <option value="maritalStatus">Marital Status</option>
                        <option value="nationality">Nationality</option>
                        <option value="fatherName">Father Name</option>
                        <option value="spouseName">Spouse Name</option>
                        <option value="religion">Religion</option>
                        <option value="placeOfBirth">Place of Birth</option>
                      </optgroup>
                      <optgroup label="Contact">
                        <option value="phone">Phone</option>
                        <option value="personalEmail">Personal Email</option>
                        <option value="address">Address</option>
                        <option value="permanentAddress">Permanent Address</option>
                        <option value="emergencyContact">Emergency Contact</option>
                      </optgroup>
                      <optgroup label="Employment">
                        <option value="dateOfJoining">Date of Joining</option>
                        <option value="employmentType">Employment Type</option>
                        <option value="employmentStatus">Employment Status (Confirmed/Probation/Intern)</option>
                        <option value="reportingManagerName">Reporting Manager</option>
                        <option value="location">Office Location</option>
                        <option value="grade">Grade</option>
                        <option value="shift">Shift</option>
                        <option value="confirmationDate">Confirmation Date</option>
                        <option value="probationEndDate">Probation End Date</option>
                        <option value="noticePeriodDays">Notice Period (Days)</option>
                        <option value="previousExperience">Previous Experience (Years)</option>
                      </optgroup>
                      <optgroup label="Identity">
                        <option value="aadhaarNumber">Aadhaar Number</option>
                        <option value="panNumber">PAN Number</option>
                        <option value="passportNumber">Passport Number</option>
                        <option value="passportExpiry">Passport Expiry</option>
                        <option value="drivingLicense">Driving License</option>
                        <option value="uanNumber">UAN Number</option>
                      </optgroup>
                      <optgroup label="Bank">
                        <option value="bankName">Bank Name</option>
                        <option value="bankAccountNumber">Account Number</option>
                        <option value="bankBranch">Bank Branch</option>
                        <option value="bankIfscCode">IFSC Code</option>
                      </optgroup>
                    </select>
                  </div>
                  {/* Sample value */}
                  <div className="w-1/4 min-w-0 hidden md:block">
                    <span className="text-[11px] text-slate-400 truncate block">
                      {rawData.rows[0]?.[h] || '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import mode */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Import Mode</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'upsert', label: 'Update existing + Create new', desc: 'Match by email/name, update fields, create missing employees' },
                { value: 'update', label: 'Update only', desc: 'Only update existing employees, skip new ones' },
                { value: 'create', label: 'Create only', desc: 'Only create new employees, skip existing ones' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setImportMode(m.value)}
                  className={`flex-1 min-w-[160px] text-left p-3 rounded-lg border text-xs transition-colors ${
                    importMode === m.value
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-medium">{m.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button onClick={reset} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Start Over
            </button>
            <button
              onClick={goToPreview}
              disabled={mappedCount === 0 || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Preview <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ STEP 2: Preview ══════════════════ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-blue-500" />
                Preview (first 5 rows)
              </h3>
              <span className="text-xs text-slate-500">
                {rawData.rows.length} total rows · {mappedCount} fields mapped · Mode: <strong>{importMode}</strong>
              </span>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">#</th>
                    {Object.values(mapping).filter((v, i, a) => a.indexOf(v) === i).map((f) => (
                      <th key={f} className="px-3 py-2 text-left font-medium text-slate-500 whitespace-nowrap">{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      {Object.values(mapping).filter((v, idx, a) => a.indexOf(v) === idx).map((f) => (
                        <td key={f} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {row[f] || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">Ready to import {rawData.rows.length} employees</p>
              <ul className="space-y-0.5 list-disc list-inside">
                {importMode === 'upsert' && <li>Existing employees (matched by email/name) will be updated with new data</li>}
                {importMode === 'upsert' && <li>New employees will be created with default password: <code className="bg-amber-100 px-1 rounded">Welcome@123</code></li>}
                {importMode === 'update' && <li>Only existing employees will be updated. New entries will be skipped.</li>}
                {importMode === 'create' && <li>Only new employees will be created. Existing ones will be skipped.</li>}
                <li>Reporting managers will be matched by name from existing employees</li>
              </ul>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Back to Mapping
            </button>
            <button
              onClick={executeImport}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Execute Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ STEP 3: Results ══════════════════ */}
      {step === 3 && results && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{results.created}</p>
              <p className="text-xs text-green-600 mt-1 font-medium">Created</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{results.updated}</p>
              <p className="text-xs text-blue-600 mt-1 font-medium">Updated</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-slate-500">{results.skipped}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Skipped</p>
            </div>
          </div>

          {/* Success message */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Import Complete!</p>
              <p className="text-xs text-green-700 mt-1">
                {results.created + results.updated} employees processed successfully.
                {results.created > 0 && ` New employees can login with password: Welcome@123`}
              </p>
            </div>
          </div>

          {/* Errors if any */}
          {results.errors?.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100">
                <h3 className="text-xs font-semibold text-red-700">
                  {results.errors.length} row(s) had issues
                </h3>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {results.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 border-b border-slate-50 last:border-0 flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-mono">Row {e.row}</span>
                    <span className="text-red-600">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <RefreshCw className="w-4 h-4" /> Import Another File
            </button>
            <a href="/directory" className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
              <Users className="w-4 h-4" /> View Directory
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
