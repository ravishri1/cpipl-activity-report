import { useState } from 'react';
import { ShieldAlert, CheckCircle2, ChevronDown, ChevronUp, Mail, Clock, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const urgencyStyle = (days) => {
  if (days === null) return 'text-slate-500';
  if (days === 0) return 'text-amber-600 font-semibold';
  if (days <= 3) return 'text-orange-600 font-bold';
  return 'text-red-600 font-bold';
};

const urgencyLabel = (days) => {
  if (days === null) return 'Date unknown';
  if (days === 0) return 'Due today';
  return `${days}d overdue`;
};

export default function WorkspacePendingAlerts() {
  const { data: pending, loading, refetch } = useFetch('/users/workspace-pending', []);
  const { execute, loading: marking } = useApi();
  const [expanded, setExpanded] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  // Nothing to show
  if (loading || !pending || pending.length === 0) return null;

  const criticalCount = pending.filter((u) => u.daysOverdue !== null && u.daysOverdue > 0).length;

  const handleMarkDone = async (userId) => {
    setMarkingId(userId);
    try {
      await execute(
        () => api.put(`/users/${userId}/workspace-done`),
        'Workspace account marked as suspended.'
      );
      refetch();
    } catch { /* error displayed by useApi */ }
    finally { setMarkingId(null); }
  };

  const handleAutoSuspend = async (userId, email) => {
    if (!window.confirm(`Auto-suspend ${email} in Google Workspace now?`)) return;
    setMarkingId(userId);
    try {
      await execute(
        () => api.post(`/users/${userId}/workspace-suspend-now`),
        `${email} suspended successfully.`
      );
      refetch();
    } catch { /* error displayed by useApi */ }
    finally { setMarkingId(null); }
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 shadow-sm overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
      >
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-amber-800">
            {pending.length} Google Workspace account{pending.length > 1 ? 's' : ''} pending suspension
          </span>
          {criticalCount > 0 && (
            <span className="ml-2 text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-medium">
              {criticalCount} overdue
            </span>
          )}
          <p className="text-xs text-amber-600 mt-0.5">
            HR must manually suspend or delete these accounts in Google Workspace Admin Console
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-amber-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-amber-500 shrink-0" />
        }
      </button>

      {/* Expandable table */}
      {expanded && (
        <div className="border-t border-amber-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-amber-100 text-amber-800 text-xs uppercase tracking-wide">
                <th className="px-4 py-2 text-left font-semibold">Employee</th>
                <th className="px-4 py-2 text-left font-semibold">Workspace Email</th>
                <th className="px-4 py-2 text-left font-semibold">Last Working Date</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {pending.map((emp) => (
                <tr key={emp.id} className="bg-white hover:bg-amber-50 transition-colors">
                  {/* Name + EmpID */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{emp.name}</div>
                    <div className="text-xs text-slate-500">{emp.employeeId || `#${emp.id}`}</div>
                    {emp.department && (
                      <div className="text-xs text-slate-400">{emp.department}</div>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-mono text-xs">{emp.email}</span>
                    </div>
                  </td>

                  {/* Last working date */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-700">{formatDate(emp.lastWorkingDate)}</span>
                    </div>
                  </td>

                  {/* Overdue indicator */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {emp.daysOverdue !== null && emp.daysOverdue > 0 && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className={urgencyStyle(emp.daysOverdue)}>
                        {urgencyLabel(emp.daysOverdue)}
                      </span>
                    </div>
                    {emp.separationType && (
                      <div className="text-xs text-slate-400 capitalize mt-0.5">{emp.separationType}</div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAutoSuspend(emp.id, emp.email)}
                        disabled={marking && markingId === emp.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                          bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Automatically suspend this account in Google Workspace"
                      >
                        {marking && markingId === emp.id ? (
                          <span className="animate-pulse">Working…</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            Auto-Suspend
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleMarkDone(emp.id)}
                        disabled={marking && markingId === emp.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                          bg-slate-200 text-slate-700 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Mark as already done manually"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Done
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer hint */}
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
            <strong>Auto-Suspend</strong> suspends the account directly via Google Workspace API.
            Use <strong>Done</strong> if you've already handled it manually in{' '}
            <a href="https://admin.google.com/ac/users" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">
              admin.google.com
            </a>.
          </div>
        </div>
      )}
    </div>
  );
}
