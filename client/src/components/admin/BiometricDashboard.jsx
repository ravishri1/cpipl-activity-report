import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import {
  Fingerprint,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  RefreshCw,
  Link,
  Unlink,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Trash2,
  ServerCrash,
  Activity,
  X,
  Download,
} from 'lucide-react';

// ─── Status style maps ────────────────────────────────────────────────────────
const MATCH_STATUS_STYLES = {
  matched:   'bg-green-100 text-green-700 border border-green-200',
  unmatched: 'bg-red-100 text-red-700 border border-red-200',
  ignored:   'bg-gray-100 text-gray-500 border border-gray-200',
};

const PROCESS_STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700 border border-amber-200',
  processed: 'bg-green-100 text-green-700 border border-green-200',
  skipped:   'bg-gray-100 text-gray-500 border border-gray-200',
};

const SYNC_STATUS_STYLES = {
  success: 'text-green-600',
  error:   'text-red-500',
  default: 'text-gray-400',
};

const TABS = [
  { key: 'status',   label: 'Status',           icon: Activity },
  { key: 'punches',  label: 'Punch Log',         icon: Clock },
  { key: 'unmatched',label: 'Unmatched',         icon: AlertTriangle },
  { key: 'devices',  label: 'Devices',           icon: Monitor },
  { key: 'mappings', label: 'Employee Mappings', icon: Users },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Badge({ label, styleClass }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styleClass}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tunnel Status Card ──────────────────────────────────────────────────────
function TunnelStatusCard() {
  const { data: tunnel, loading } = useFetch('/biometric/tunnel-status', null);

  if (loading || !tunnel) return null;

  return (
    <div className={`rounded-xl border p-4 text-sm ${tunnel.connected ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium mb-1">
            {tunnel.connected ? '📡 Tunnel Connected — cpserver SQL Live' : '🔴 Tunnel Disconnected'}
          </p>
          {tunnel.connected ? (
            <div className="text-xs text-indigo-600 space-y-0.5">
              <p><span className="font-medium">Tunnel URL:</span> {tunnel.tunnelUrl}</p>
              <p><span className="font-medium">cpserver Time:</span> {new Date(tunnel.serverTime).toLocaleString()}</p>
              <p className="text-indigo-400">All historical biometric data available via tunnel (unlimited, from cpserver SQL Server)</p>
            </div>
          ) : (
            <p className="text-xs text-red-600">
              {tunnel.error || 'cpserver may be offline. Check BiometricService on cpserver.'}
            </p>
          )}
        </div>
        <span className={`text-2xl ${tunnel.connected ? 'text-green-500' : 'text-red-400'}`}>
          {tunnel.connected ? '●' : '○'}
        </span>
      </div>
    </div>
  );
}

// ─── Tab: Status Overview ─────────────────────────────────────────────────────
function StatusTab() {
  const { data: status, loading, error, refetch } = useFetch('/biometric/status', null);
  const { execute, loading: syncing, error: syncErr, success } = useApi();
  const [lookbackDays, setLookbackDays] = useState(1);
  const [syncingDeviceId, setSyncingDeviceId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testingDeviceId, setTestingDeviceId] = useState(null);

  const handleSyncAll = async () => {
    try {
      await execute(() => api.post('/biometric/sync-all', { lookbackDays }), 'Sync complete!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleSyncDevice = async (deviceId) => {
    setSyncingDeviceId(deviceId);
    try {
      await execute(() => api.post(`/biometric/sync-device/${deviceId}`, { lookbackDays }), 'Device synced!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
    setSyncingDeviceId(null);
  };

  const handleTestConnection = async (deviceId) => {
    setTestingDeviceId(deviceId);
    setTestResult(null);
    try {
      const res = await api.post(`/biometric/test-connection/${deviceId}`);
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ status: 'failed', error: err.response?.data?.error || err.message });
    }
    setTestingDeviceId(null);
  };

  const handleRematch = async () => {
    try {
      await execute(() => api.post('/biometric/rematch'), 'Re-match complete!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error)   return <AlertMessage type="error" message={error} />;
  if (!status) return null;

  return (
    <div className="space-y-6">
      {success && <AlertMessage type="success" message={success} />}
      {syncErr && <AlertMessage type="error" message={syncErr} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Fingerprint} label="Today's Punches"  value={status.todayPunches}   color="blue"  />
        <StatCard icon={AlertTriangle} label="Unmatched Today" value={status.unmatchedToday} color="red"   />
        <StatCard icon={Clock}        label="Pending Process" value={status.pendingProcess}  color="amber" />
        <StatCard icon={Activity}     label="All-time Punches" value={status.totalPunches}  color="purple" />
      </div>

      {/* Sync status banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        <p className="font-medium mb-1">✅ Auto-Sync Active</p>
        <p className="text-xs text-green-600">
          Biometric data syncs automatically from cpserver every 5 minutes via Windows Task Scheduler.
          All punches use greytHR-style alternating IN/OUT logic (1st punch = IN, 2nd = OUT, etc.).
        </p>
      </div>

      {/* Tunnel Status */}
      <TunnelStatusCard />

      {/* Re-match button only */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRematch}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
          >
            <Link className="w-3.5 h-3.5" />
            Re-match unmatched
          </button>
          <p className="text-xs text-slate-400 ml-auto">
            Sync handled by cpserver Task Scheduler (every 5 min)
          </p>
        </div>
      </div>

      {/* Device cards */}
      <div>
        <h3 className="font-semibold text-slate-700 mb-3">Registered Devices</h3>

        {status.devices.length === 0 ? (
          <EmptyState icon="🖥️" title="No devices" subtitle="Register a biometric device in the Devices tab." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {status.devices.map(d => {
              const syncColor = SYNC_STATUS_STYLES[d.lastSyncStatus] ?? SYNC_STATUS_STYLES.default;
              const isSyncingThis = syncingDeviceId === d.id;
              const isTestingThis = testingDeviceId === d.id;
              return (
                <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">SN: {d.serialNumber}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {d.lastSyncAt && (
                    <div className={`mt-2 text-xs ${syncColor}`}>
                      <span className="font-medium">Last sync:</span>{' '}
                      {new Date(d.lastSyncAt).toLocaleString()} — {d.lastSyncMessage}
                    </div>
                  )}
                  {!d.lastSyncAt && (
                    <p className="mt-2 text-xs text-slate-400 italic">Never synced</p>
                  )}
                  {d.isActive && (
                    <p className="mt-2 text-xs text-green-600">● Auto-syncing via cpserver</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Punch Log ───────────────────────────────────────────────────────────
function PunchLogTab({ employees }) {
  const [filters, setFilters] = useState({ date: '', matchStatus: '', processStatus: '', userId: '', page: 1 });
  const [dataSource, setDataSource] = useState('tunnel'); // 'tunnel' = cpserver SQL (all data), 'neon' = recent only
  const query = new URLSearchParams({
    ...(filters.date          && { date: filters.date }),
    ...(filters.matchStatus   && { matchStatus: filters.matchStatus }),
    ...(filters.processStatus && { processStatus: filters.processStatus }),
    ...(filters.userId        && { userId: filters.userId }),
    source: dataSource,
    page: filters.page,
    limit: 50,
  }).toString();

  const { data, loading, error, refetch } = useFetch(`/biometric/punches?${query}`, { punches: [], total: 0 });
  const { execute, loading: reprocessing, error: reprocessErr, success } = useApi();

  const handleReprocess = async (id) => {
    try {
      await execute(() => api.post(`/biometric/punches/${id}/reprocess`), 'Reprocessed!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const exportParams = new URLSearchParams({
        ...(filters.date          && { date: filters.date }),
        ...(filters.matchStatus   && { matchStatus: filters.matchStatus }),
        ...(filters.processStatus && { processStatus: filters.processStatus }),
        ...(filters.userId        && { userId: filters.userId }),
      }).toString();
      const res = await api.get(`/biometric/punches/export?${exportParams}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `punch-log-${filters.date || 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={filters.date}
          onChange={e => setFilters(f => ({ ...f, date: e.target.value, page: 1 }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={filters.userId}
          onChange={e => setFilters(f => ({ ...f, userId: e.target.value, page: 1 }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[220px]"
        >
          <option value="">All employees</option>
          {(employees ?? []).map(emp => (
            <option key={emp.id} value={emp.id}>
              {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
            </option>
          ))}
        </select>
        <select
          value={filters.matchStatus}
          onChange={e => setFilters(f => ({ ...f, matchStatus: e.target.value, page: 1 }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All match status</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="ignored">Ignored</option>
        </select>
        <select
          value={filters.processStatus}
          onChange={e => setFilters(f => ({ ...f, processStatus: e.target.value, page: 1 }))}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">All process status</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="skipped">Skipped</option>
        </select>

        {/* Data Source Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => { setDataSource('tunnel'); setFilters(f => ({ ...f, page: 1 })); }}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${dataSource === 'tunnel' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            📡 All Data (SQL)
          </button>
          <button
            onClick={() => { setDataSource('neon'); setFilters(f => ({ ...f, page: 1 })); }}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${dataSource === 'neon' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            ☁️ Recent (Neon)
          </button>
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
        >
          {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {success      && <AlertMessage type="success" message={success} />}
      {reprocessErr && <AlertMessage type="error"   message={reprocessErr} />}
      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && (
        <>
          <p className="text-xs text-slate-500">{data.total} punch records</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Employee', 'Enroll #', 'Punch Time', 'Direction', 'Device', 'Match', 'Process', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.punches.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">No punches found</td></tr>
                ) : data.punches.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.employee?.name ?? <span className="italic text-slate-400">Unknown</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{p.enrollNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.punchTime}</td>
                    <td className="px-4 py-2.5">
                      {p.direction === 'in'  && <span className="text-green-600 font-medium">IN</span>}
                      {p.direction === 'out' && <span className="text-red-500 font-medium">OUT</span>}
                      {!p.direction          && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{p.device?.name ?? p.deviceSerial}</td>
                    <td className="px-4 py-2.5"><Badge label={p.matchStatus}   styleClass={MATCH_STATUS_STYLES[p.matchStatus]   ?? ''} /></td>
                    <td className="px-4 py-2.5"><Badge label={p.processStatus} styleClass={PROCESS_STATUS_STYLES[p.processStatus] ?? ''} /></td>
                    <td className="px-4 py-2.5">
                      {p.processStatus !== 'processed' && p.matchStatus === 'matched' && (
                        <button
                          onClick={() => handleReprocess(p.id)}
                          disabled={reprocessing}
                          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total > 50 && (
            <div className="flex items-center gap-2 justify-end">
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >← Prev</button>
              <span className="text-sm text-slate-500">Page {filters.page} of {Math.ceil(data.total / 50)}</span>
              <button
                disabled={filters.page >= Math.ceil(data.total / 50)}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab: Unmatched Punches ───────────────────────────────────────────────────
function UnmatchedTab({ employees }) {
  const [date, setDate] = useState('');
  const [assignModal, setAssignModal] = useState(null); // { enrollNumber }
  const [selectedUser, setSelectedUser] = useState('');
  const [saveMapping, setSaveMapping] = useState(true);
  const [search, setSearch] = useState('');

  const query = date ? `?date=${date}` : '';
  const { data: unmatched, loading, error, refetch } = useFetch(`/biometric/unmatched${query}`, []);
  const { execute, loading: assigning, error: assignErr, success, clearMessages } = useApi();

  const filtered = unmatched.filter(u =>
    !search || u.enrollNumber.includes(search)
  );

  const handleAssign = async (punch) => {
    setAssignModal(punch);
    setSelectedUser('');
    clearMessages && clearMessages();
  };

  const handleConfirmAssign = async () => {
    if (!selectedUser || !assignModal) return;
    // We assign the latest punch for this enroll number
    // Find punch id via punch log — we use the enrollNumber directly via assign endpoint
    // The assign endpoint needs a punch ID; we need to get one
    // Fetch unmatched punches for this enroll number
    const res = await execute(
      async () => {
        // Get one punch id for this enroll number
        const punch = await api.get(`/biometric/punches?enrollNumber=${assignModal.enrollNumber}&matchStatus=unmatched&limit=1`);
        const punchId = punch.data.punches?.[0]?.id;
        if (!punchId) throw new Error('No unmatched punch found');
        return api.post(`/biometric/punches/${punchId}/assign`, {
          userId: selectedUser,
          saveMapping,
        });
      },
      'Employee assigned!'
    );
    if (res) {
      setAssignModal(null);
      refetch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter enroll #"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-sm pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {success   && <AlertMessage type="success" message={success} />}
      {assignErr && <AlertMessage type="error" message={assignErr} />}

      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && (
        filtered.length === 0 ? (
          <EmptyState icon="✅" title="No unmatched punches" subtitle="All biometric punches are matched to employees." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Enroll Number', 'Device', 'Punch Count', 'Last Seen', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.enrollNumber} className="border-b border-slate-100 hover:bg-amber-50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{u.enrollNumber}</td>
                    <td className="px-4 py-3 text-slate-500">{u.device ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{u.count}</td>
                    <td className="px-4 py-3 text-slate-500">{u.lastSeen}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAssign(u)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
                      >
                        <Link className="w-3.5 h-3.5" /> Assign Employee
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Assign Enroll # {assignModal.enrollNumber}</h3>
              <button onClick={() => setAssignModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Select the employee this biometric enroll number belongs to.</p>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Employee</label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select employee…</option>
                {(employees ?? []).map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId}) {emp.bioDeviceId ? `— mapped: ${emp.bioDeviceId}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={saveMapping}
                onChange={e => setSaveMapping(e.target.checked)}
                className="rounded"
              />
              Save this mapping for future auto-matching
            </label>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setAssignModal(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssign}
                disabled={!selectedUser || assigning}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {assigning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Devices ─────────────────────────────────────────────────────────────
function DevicesTab() {
  const { data: devices, loading, error, refetch } = useFetch('/biometric/devices', []);
  const { execute, loading: saving, error: saveErr, success, clearMessages } = useApi();
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', device? }
  const emptyForm = { name: '', serialNumber: '', location: '', ipAddress: '', esslUrl: '', apiUser: '', apiPassword: '', apiKey: '', companyCode: '', syncIntervalMin: 5, forceDirection: '' };
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => { setForm(emptyForm); setModal({ mode: 'add' }); clearMessages && clearMessages(); };
  const openEdit = (d) => {
    setForm({ name: d.name, serialNumber: d.serialNumber, location: d.location ?? '', ipAddress: d.ipAddress ?? '', esslUrl: d.esslUrl ?? '', apiUser: d.apiUser ?? '', apiPassword: d.apiPassword ?? '', apiKey: d.apiKey ?? '', companyCode: d.companyCode ?? '', syncIntervalMin: d.syncIntervalMin ?? 5, forceDirection: d.forceDirection ?? '' });
    setModal({ mode: 'edit', device: d });
    clearMessages && clearMessages();
  };

  const handleSave = async () => {
    try {
      if (modal.mode === 'add') {
        await execute(() => api.post('/biometric/devices', form), 'Device added!');
      } else {
        await execute(() => api.put(`/biometric/devices/${modal.device.id}`, form), 'Device updated!');
      }
      refetch();
      setModal(null);
    } catch {
      // Error displayed by useApi
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this device? Punch history will be deleted.')) return;
    try {
      await execute(() => api.delete(`/biometric/devices/${id}`), 'Device removed!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleToggle = async (d) => {
    try {
      await execute(() => api.put(`/biometric/devices/${d.id}`, { isActive: !d.isActive }),
        d.isActive ? 'Device deactivated' : 'Device activated');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{devices.length} registered device{devices.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {success  && <AlertMessage type="success" message={success} />}
      {saveErr  && <AlertMessage type="error"   message={saveErr} />}

      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && devices.length === 0 && (
        <EmptyState icon="🖥️" title="No devices" subtitle="Add your first biometric device to get started." />
      )}

      {!loading && !error && devices.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{d.name}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{d.serialNumber}</p>
                  {d.location && <p className="text-xs text-slate-400 mt-0.5">📍 {d.location}</p>}
                  {d.esslUrl  && <p className="text-xs text-slate-400 mt-0.5 truncate">🔗 {d.esslUrl}</p>}
                  {d.forceDirection && (
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${d.forceDirection === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {d.forceDirection === 'in' ? '→ Entry only' : '← Exit only'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <p className="text-xs text-slate-400">{d._count?.punches ?? 0} punches</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => openEdit(d)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-indigo-600">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => handleToggle(d)} className="flex items-center gap-1 text-xs text-slate-600 hover:text-amber-600">
                  {d.isActive ? <><Unlink className="w-3.5 h-3.5" /> Deactivate</> : <><Link className="w-3.5 h-3.5" /> Activate</>}
                </button>
                <button onClick={() => handleDelete(d.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-800">{modal.mode === 'add' ? 'Add Biometric Device' : 'Edit Device'}</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'name',           label: 'Device Name *',     placeholder: 'Main Entrance Reader' },
                { key: 'serialNumber',   label: 'Serial Number *',   placeholder: 'CUB7240300491' },
                { key: 'location',       label: 'Location',          placeholder: 'Reception' },
                { key: 'ipAddress',      label: 'IP Address',        placeholder: '192.168.2.10' },
                { key: 'esslUrl',        label: 'eSSL Server URL',   placeholder: 'http://192.168.2.222:85' },
                { key: 'apiUser',        label: 'API Username',      placeholder: 'dany' },
                { key: 'apiPassword',    label: 'API Password',      placeholder: '••••••••', type: 'password' },
                { key: 'apiKey',         label: 'API Key',           placeholder: '11' },
                { key: 'companyCode',    label: 'Company Code',      placeholder: 'essl' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <input
                    type={f.type ?? 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sync Interval (minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={form.syncIntervalMin}
                  onChange={e => setForm(v => ({ ...v, syncIntervalMin: parseInt(e.target.value) || 5 }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Direction Override</label>
                <select
                  value={form.forceDirection}
                  onChange={e => setForm(v => ({ ...v, forceDirection: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">Auto-detect (time-based) — single machine</option>
                  <option value="in">Always IN — dedicated entry reader</option>
                  <option value="out">Always OUT — dedicated exit reader</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Use <strong>Auto-detect</strong> for a single machine that handles both entry and exit (e.g. Lucknow).
                  Use <strong>Always IN / Always OUT</strong> for dedicated entry or exit readers (e.g. Mumbai).
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.serialNumber}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {modal.mode === 'add' ? 'Add Device' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Employee Mappings ───────────────────────────────────────────────────
function MappingsTab() {
  const { data: employees, loading, error, refetch } = useFetch('/biometric/mappings', []);
  const { execute, loading: saving } = useApi();
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');

  const filtered = employees.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeId && e.employeeId.toLowerCase().includes(search.toLowerCase())) ||
    (e.bioDeviceId && e.bioDeviceId.includes(search))
  );

  const startEdit = (emp) => { setEditId(emp.id); setEditVal(emp.bioDeviceId ?? ''); };
  const cancelEdit = () => { setEditId(null); setEditVal(''); };

  const saveMapping = async (userId) => {
    try {
      await execute(() => api.put(`/biometric/mappings/${userId}`, { bioDeviceId: editVal || null }), 'Mapping saved!');
      cancelEdit();
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <span className="text-xs text-slate-400">
          {employees.filter(e => e.bioDeviceId).length} / {employees.length} mapped
        </span>
      </div>

      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr>
                {['Employee', 'Employee ID', 'Department', 'Bio Device ID', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-slate-400">No employees found</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{emp.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{emp.employeeId}</td>
                  <td className="px-4 py-2.5 text-slate-500">{emp.department ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {editId === emp.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        placeholder="e.g. 1, 42, EMP001"
                        className="text-sm border border-indigo-300 rounded px-2 py-1 w-36 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        onKeyDown={e => { if (e.key === 'Enter') saveMapping(emp.id); if (e.key === 'Escape') cancelEdit(); }}
                      />
                    ) : emp.bioDeviceId ? (
                      <span className="font-mono text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">{emp.bioDeviceId}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Not mapped</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === emp.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveMapping(emp.id)}
                          disabled={saving}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >Save</button>
                        <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(emp)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {emp.bioDeviceId ? 'Edit' : 'Map'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BiometricDashboard() {
  const [activeTab, setActiveTab] = useState('status');

  // Fetch employees for unmatched tab's assign modal
  const { data: employees } = useFetch('/biometric/mappings', []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-slate-50 pb-4 -mx-6 px-6 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Biometric Integration</h1>
            <p className="text-sm text-slate-500">eSSL eTimetracklite sync & attendance management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-white hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'status'    && <StatusTab />}
        {activeTab === 'punches'   && <PunchLogTab employees={employees} />}
        {activeTab === 'unmatched' && <UnmatchedTab employees={employees} />}
        {activeTab === 'devices'   && <DevicesTab />}
        {activeTab === 'mappings'  && <MappingsTab />}
      </div>
    </div>
  );
}
