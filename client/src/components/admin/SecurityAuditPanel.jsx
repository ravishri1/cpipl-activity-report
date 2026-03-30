import { useState } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import {
  Shield, ShieldAlert, ShieldCheck, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react';

const SEVERITY_STYLES = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High:     'bg-orange-100 text-orange-700 border-orange-200',
  Medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:      'bg-blue-100 text-blue-700 border-blue-200',
  Info:     'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_ICON = {
  Pass: <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
  Fail: <XCircle    className="w-4 h-4 text-red-500 shrink-0" />,
  Warn: <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />,
  Info: <Info       className="w-4 h-4 text-slate-400 shrink-0" />,
};

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
}

export default function SecurityAuditPanel() {
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState({});
  const { execute, loading, error } = useApi();

  const handleRun = async () => {
    try {
      const data = await execute(() => api.get('/security-audit/run'), '');
      setResults(data);
      // Auto-expand categories that have issues
      const autoExpand = {};
      Object.entries(groupBy(data.findings, 'category')).forEach(([cat, items]) => {
        if (items.some(f => ['Fail', 'Warn'].includes(f.status))) autoExpand[cat] = true;
      });
      setExpanded(autoExpand);
    } catch { /* error displayed by useApi */ }
  };

  const toggle = (cat) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));

  const summaryCards = results ? [
    { label: 'Critical', count: results.summary.critical, color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'High',     count: results.summary.high,     color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Medium',   count: results.summary.medium,   color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Low/Info', count: results.summary.low,      color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Passed',   count: results.summary.passed,   color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Total',    count: results.summary.total,    color: 'bg-slate-50 border-slate-200 text-slate-600' },
  ] : [];

  const overallStatus = results
    ? results.summary.critical > 0 ? 'critical'
    : results.summary.high > 0 ? 'high'
    : results.summary.medium > 0 ? 'medium'
    : 'clean'
    : null;

  const statusBanner = {
    critical: { bg: 'bg-red-50 border-red-200', icon: <ShieldAlert className="w-5 h-5 text-red-600" />, text: 'Critical issues found — immediate action required', textColor: 'text-red-800' },
    high:     { bg: 'bg-orange-50 border-orange-200', icon: <ShieldAlert className="w-5 h-5 text-orange-600" />, text: 'High severity issues found — review and fix soon', textColor: 'text-orange-800' },
    medium:   { bg: 'bg-yellow-50 border-yellow-200', icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />, text: 'Some warnings found — review at your convenience', textColor: 'text-yellow-800' },
    clean:    { bg: 'bg-green-50 border-green-200', icon: <ShieldCheck className="w-5 h-5 text-green-600" />, text: 'All checks passed — system looks healthy', textColor: 'text-green-800' },
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50 -mx-6 -mt-6 px-6 py-4 border-b border-slate-200 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Security Audit</h1>
              <p className="text-xs text-slate-500">
                {results
                  ? `Last run: ${new Date(results.runAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'Scan your system for security issues'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning…' : results ? 'Re-run Audit' : 'Run Audit'}
          </button>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {/* Empty state */}
      {!results && !loading && (
        <div className="text-center py-20">
          <Shield className="w-14 h-14 mx-auto mb-4 text-slate-200" />
          <p className="font-semibold text-slate-600 text-lg">No audit run yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Run Audit" to check env vars, API security, auth gaps, and infrastructure health.</p>
        </div>
      )}

      {results && (
        <>
          {/* Overall status banner */}
          {overallStatus && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-4 ${statusBanner[overallStatus].bg}`}>
              {statusBanner[overallStatus].icon}
              <span className={`text-sm font-semibold ${statusBanner[overallStatus].textColor}`}>
                {statusBanner[overallStatus].text}
              </span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {summaryCards.map(({ label, count, color }) => (
              <div key={label} className={`border rounded-xl p-3 text-center ${color}`}>
                <div className="text-2xl font-bold leading-none">{count}</div>
                <div className="text-xs font-medium mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Findings by category */}
          <div className="space-y-3">
            {Object.entries(groupBy(results.findings, 'category')).map(([category, items]) => {
              const issueCount = items.filter(f => ['Fail', 'Warn'].includes(f.status)).length;
              const isExpanded = expanded[category] ?? false;

              return (
                <div key={category} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggle(category)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {issueCount > 0
                        ? <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                        : <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                      }
                      <span className="font-semibold text-slate-800 text-sm">{category}</span>
                      {issueCount > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">
                          {issueCount} issue{issueCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">{items.length} check{items.length > 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {items.map(f => (
                        <div key={f.checkId} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{STATUS_ICON[f.status] || STATUS_ICON.Info}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold text-slate-800">{f.title}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.Info}`}>
                                  {f.severity}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{f.details}</p>
                              {f.fix && (
                                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  <p className="text-xs text-amber-800"><span className="font-semibold">Fix: </span>{f.fix}</p>
                                </div>
                              )}
                              {(f.reference || f.checkId) && (
                                <p className="text-xs text-slate-400 mt-1 font-mono">
                                  {f.checkId}{f.reference ? ` · ${f.reference}` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
