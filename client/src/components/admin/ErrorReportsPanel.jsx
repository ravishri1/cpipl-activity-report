import { useState } from 'react';
import {
  Bug, AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, ChevronDown, ChevronRight, Loader2, Users, X,
  BarChart3, Zap, Eye, Trash2,
} from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { useApi }   from '../../hooks/useApi';
import api           from '../../utils/api';
import { formatDate, formatDateTime } from '../../utils/formatters';
import StatusBadge    from '../shared/StatusBadge';
import AlertMessage   from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState     from '../shared/EmptyState';
import {
  ERROR_REPORT_STATUS_STYLES,
  ERROR_SEVERITY_STYLES,
} from '../../utils/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'new',       label: 'New',       icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: 'reviewing', label: 'Reviewing', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'all',       label: 'All',       icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { value: 'fixed',     label: 'Fixed',     icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { value: 'dismissed', label: 'Dismissed', icon: <XCircle className="w-3.5 h-3.5" /> },
];

const TYPE_TABS = [
  { value: 'all',    label: 'All Types' },
  { value: 'client', label: 'JS Errors' },
  { value: 'api',    label: 'API Errors' },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${color}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{value ?? 0}</p>
        <p className="text-xs mt-0.5 opacity-70">{label}</p>
      </div>
    </div>
  );
}

// ─── Analysis card (inside detail panel) ─────────────────────────────────────

function AnalysisCard({ analysis, aiModel }) {
  if (!analysis) return null;
  return (
    <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-blue-800">
          <Zap className="w-4 h-4" /> AI Diagnosis
        </div>
        {aiModel && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-medium whitespace-nowrap">
            <Zap className="w-3 h-3" />
            <code className="font-mono">{aiModel}</code>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">Severity</span>
          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${ERROR_SEVERITY_STYLES[analysis.severity] || ERROR_SEVERITY_STYLES.unknown}`}>
            {analysis.severity || 'unknown'}
          </span>
        </div>
        <div>
          <span className="text-slate-500">Category</span>
          <span className="ml-2 font-medium text-slate-700 capitalize">{analysis.category || '—'}</span>
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium mb-1">Root Cause</p>
        <p className="text-slate-700">{analysis.rootCause}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium mb-1">Suggested Fix</p>
        <p className="text-slate-700 whitespace-pre-line">{analysis.suggestedFix}</p>
      </div>
      {analysis.autoFixable && analysis.autoFixType !== 'none' && (
        <div className="text-xs p-2 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <span className="font-semibold">Auto-fix available:</span> {analysis.autoFixDescription}
        </div>
      )}
      {analysis.userMessage && (
        <div>
          <p className="text-xs text-slate-500 font-medium mb-1">Message for user</p>
          <p className="text-slate-600 italic">"{analysis.userMessage}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Resolution duration helper ───────────────────────────────────────────────

function formatResolutionDuration(createdAt, resolvedAt) {
  if (!createdAt || !resolvedAt) return null;
  const diffMs = new Date(resolvedAt) - new Date(createdAt);
  if (diffMs < 0) return null;
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins  = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins  === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ report, onClose, onUpdated }) {
  const { execute, loading, error, success } = useApi();
  const [analysis, setAnalysis] = useState(
    report.aiAnalysis ? (() => { try { return JSON.parse(report.aiAnalysis); } catch { return null; } })() : null
  );
  const [aiModel,   setAiModel]   = useState(report.aiModel || null);
  const [resolution, setResolution] = useState(report.resolution || '');

  const handleAnalyze = async () => {
    await execute(async () => {
      const res = await api.post(`/error-reports/${report.id}/analyze`);
      setAnalysis(res.data.analysis);
      if (res.data.model) setAiModel(res.data.model);
      return res;
    }, 'Analysis complete!');
    onUpdated();
  };

  const handleSetStatus = async (status) => {
    await execute(
      () => api.put(`/error-reports/${report.id}/status`, { status, resolution }),
      `Marked as ${status}`
    );
    onUpdated();
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this error report permanently?')) return;
    await execute(() => api.delete(`/error-reports/${report.id}`), 'Deleted.');
    onClose();
    onUpdated();
  };

  const affectedUsers = (() => {
    try { return JSON.parse(report.affectedUsers || '[]'); } catch { return []; }
  })();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl">

        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-red-500" />
            <div>
              <h2 className="font-semibold text-slate-800 text-sm leading-tight truncate max-w-xs">
                {report.errorMessage}
              </h2>
              <p className="text-xs text-slate-500">{report.path}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error  && <AlertMessage type="error"   message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-400 mb-1">Status</p>
              <StatusBadge status={report.status} styles={ERROR_REPORT_STATUS_STYLES} />
              {(report.status === 'fixed' || report.status === 'dismissed') && (() => {
                const dur = formatResolutionDuration(report.createdAt, report.resolvedAt);
                return dur ? (
                  <p className="text-xs text-slate-500 mt-1.5">⏱ Resolved in {dur}</p>
                ) : null;
              })()}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-400 mb-1">Type</p>
              <span className="font-medium text-slate-700 uppercase">{report.errorType}</span>
              {report.statusCode && <span className="ml-2 text-slate-500">HTTP {report.statusCode}</span>}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-400 mb-1">Occurrences</p>
              <span className="font-bold text-red-600 text-sm">{report.occurrenceCount || 1}</span>
              <span className="text-slate-400 ml-1">times</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-400 mb-1">First Reported</p>
              <span className="font-medium text-slate-700">{formatDateTime(report.createdAt)}</span>
            </div>
          </div>

          {/* Affected users */}
          {affectedUsers.length > 0 && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-2">
                <Users className="w-3.5 h-3.5" /> Affected Users ({affectedUsers.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {affectedUsers.map((u, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-xs text-slate-600">
                    {u.userEmail || u.userName || `User #${u.userId}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stack trace */}
          {report.stackTrace && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                Stack Trace
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-red-300 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {report.stackTrace}
              </pre>
            </details>
          )}

          {/* Component stack */}
          {report.componentStack && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                Component Stack
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-amber-300 text-xs overflow-auto max-h-36 whitespace-pre-wrap">
                {report.componentStack}
              </pre>
            </details>
          )}

          {/* AI Analysis */}
          <AnalysisCard analysis={analysis} aiModel={aiModel} />

          {/* Resolution note */}
          {(report.status === 'fixed' || report.status === 'dismissed') && resolution && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
              <p className="font-semibold text-slate-700 mb-1">Resolution</p>
              <p className="text-slate-600 whitespace-pre-line text-xs">{resolution}</p>
            </div>
          )}

          {/* Manual resolution note input */}
          {report.status !== 'fixed' && report.status !== 'dismissed' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Resolution Note (optional)
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-200 text-sm p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe what you did to fix this…"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Sticky footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 space-y-2">
          {/* Primary actions row */}
          {report.status !== 'fixed' && report.status !== 'dismissed' && !analysis && (
            <div className="flex gap-2">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Analyze
              </button>
            </div>
          )}

          {/* Secondary actions row */}
          <div className="flex gap-2">
            {report.status !== 'fixed' && (
              <button
                onClick={() => handleSetStatus('fixed')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Fixed
              </button>
            )}
            {report.status !== 'dismissed' && (
              <button
                onClick={() => handleSetStatus('dismissed')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Dismiss
              </button>
            )}
            {(report.status === 'fixed' || report.status === 'dismissed') && (
              <button
                onClick={() => handleSetStatus('new')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reopen
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Error row card ────────────────────────────────────────────────────────────

function ErrorRow({ report, onSelect }) {
  const analysis = (() => {
    try { return report.aiAnalysis ? JSON.parse(report.aiAnalysis) : null; } catch { return null; }
  })();

  return (
    <div
      onClick={() => onSelect(report)}
      className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all group"
    >
      {/* Count badge */}
      <div className="flex-shrink-0 mt-0.5">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
          report.occurrenceCount >= 10 ? 'bg-red-100 text-red-700' :
          report.occurrenceCount >= 3  ? 'bg-orange-100 text-orange-700' :
          'bg-slate-100 text-slate-600'
        }`}>
          {report.occurrenceCount || 1}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <StatusBadge status={report.status} styles={ERROR_REPORT_STATUS_STYLES} />
          {analysis?.severity && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ERROR_SEVERITY_STYLES[analysis.severity] || ERROR_SEVERITY_STYLES.unknown}`}>
              {analysis.severity}
            </span>
          )}
          <span className="text-xs text-slate-400 uppercase font-mono">{report.errorType}</span>
          {report.statusCode && <span className="text-xs text-slate-400">HTTP {report.statusCode}</span>}
        </div>
        <p className="text-sm font-medium text-slate-800 truncate" title={report.errorMessage}>
          {report.errorMessage}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">
          {report.path} · {formatDateTime(report.createdAt)} · {report.userEmail || 'Unknown user'}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors" />
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function ErrorReportsPanel() {
  const [statusFilter, setStatusFilter] = useState('new');
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [selected,     setSelected]     = useState(null);
  const [listKey,      setListKey]      = useState(0); // bump to force refetch

  const statsUrl = `/error-reports/stats`;
  const listUrl  = `/error-reports?status=${statusFilter}&errorType=${typeFilter}&limit=100`;

  const { data: stats,   refetch: refetchStats   } = useFetch(statsUrl, null);
  const { data: payload, loading, error,
          refetch: refetchList } = useFetch(listUrl, null, [statusFilter, typeFilter, listKey]);

  const reports = payload?.reports || [];

  const handleRefresh = () => {
    refetchStats();
    refetchList();
  };

  const handleUpdated = () => {
    setListKey(k => k + 1);
    refetchStats();
    setSelected(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" /> Error Reports
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Unique errors are deduplicated — fix once and it's gone for everyone.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Unique" value={stats.total}
            icon={<Bug className="w-5 h-5 text-slate-500" />}
            color="bg-slate-50 border-slate-200 text-slate-700" />
          <StatCard label="New" value={stats.new}
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            color="bg-red-50 border-red-200 text-red-700" />
          <StatCard label="Reviewing" value={stats.reviewing}
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            color="bg-amber-50 border-amber-200 text-amber-700" />
          <StatCard label="Fixed" value={stats.fixed}
            icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
            color="bg-green-50 border-green-200 text-green-700" />
          <StatCard label="Total Occurrences" value={stats.totalOccurrences}
            icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
            color="bg-blue-50 border-blue-200 text-blue-700" />
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap gap-3">
        {/* Status tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.value !== 'all' && stats && stats[tab.value] > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab.value === 'new' ? 'bg-red-500 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {stats[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === tab.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {error && <AlertMessage type="error" message={error} />}
      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <EmptyState
          icon="✅"
          title="No errors found"
          subtitle={statusFilter === 'all' ? 'No errors have been reported yet.' : `No ${statusFilter} errors.`}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{reports.length} unique error{reports.length !== 1 ? 's' : ''}</p>
          {reports.map(r => (
            <ErrorRow key={r.id} report={r} onSelect={setSelected} />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          report={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
