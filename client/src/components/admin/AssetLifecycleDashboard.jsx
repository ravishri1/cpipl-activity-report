import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import {
  LayoutDashboard,
  Trash2,
  Unlink,
  CheckCircle2,
  XCircle,
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronDown,
  X,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'disposals', label: 'Disposals', icon: Trash2 },
  { key: 'detachments', label: 'Detachments', icon: Unlink },
];

const DISPOSAL_STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
};

const DETACHMENT_STATUS_STYLES = {
  pending:  'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
};

const POST_ACTION_LABELS = {
  repair:  'Send for Repair',
  scrap:   'Scrap Asset',
  return:  'Return to Store',
  custody: 'Hold in Custody',
};

const DISPOSAL_TYPE_LABELS = {
  scrap:     'Scrap',
  sell:      'Sell',
  donate:    'Donate',
  return:    'Return to Vendor',
  write_off: 'Write-Off',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status, styles }) {
  const cls = styles[status] || 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ─── Approve Disposal Modal ───────────────────────────────────────────────────

function ApproveDisposalModal({ disposal, onClose, onDone }) {
  const [form, setForm] = useState({ recoveryValue: '', recoveryVendor: '', approvalNotes: '' });
  const { execute, loading, error } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.put(`/api/asset-lifecycle/disposals/${disposal.id}/approve`, {
        recoveryValue: form.recoveryValue ? parseFloat(form.recoveryValue) : undefined,
        recoveryVendor: form.recoveryVendor || undefined,
        approvalNotes: form.approvalNotes || undefined,
      }),
      'Disposal approved'
    );
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Approve Disposal</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <p className="font-medium text-slate-700">{disposal.asset?.name}</p>
            <p className="text-slate-500">
              {DISPOSAL_TYPE_LABELS[disposal.disposalType] || disposal.disposalType} ·{' '}
              Requested by {disposal.creator?.name}
            </p>
            {disposal.disposalReason && (
              <p className="mt-1 text-slate-500 italic">"{disposal.disposalReason}"</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recovery Value (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.recoveryValue}
              onChange={e => setForm(f => ({ ...f, recoveryValue: e.target.value }))}
              placeholder="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recovery Vendor</label>
            <input
              type="text"
              value={form.recoveryVendor}
              onChange={e => setForm(f => ({ ...f, recoveryVendor: e.target.value }))}
              placeholder="Vendor name (optional)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Approval Notes</label>
            <textarea
              value={form.approvalNotes}
              onChange={e => setForm(f => ({ ...f, approvalNotes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <AlertMessage type="error" message={error} />}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Approve Detachment Modal ─────────────────────────────────────────────────

function ApproveDetachmentModal({ request, onClose, onDone }) {
  const [form, setForm] = useState({ postApprovalAction: 'return', approvalNotes: '' });
  const { execute, loading, error } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.put(`/api/asset-lifecycle/detachment-requests/${request.id}/approve`, form),
      'Detachment approved'
    );
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Approve Detachment</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <p className="font-medium text-slate-700">{request.asset?.name}</p>
            <p className="text-slate-500">Requested by {request.requester?.name}</p>
            {request.reason && (
              <p className="mt-1 text-slate-500 italic">"{request.reason}"</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Post-Approval Action *</label>
            <div className="relative">
              <select
                required
                value={form.postApprovalAction}
                onChange={e => setForm(f => ({ ...f, postApprovalAction: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {Object.entries(POST_ACTION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.approvalNotes}
              onChange={e => setForm(f => ({ ...f, approvalNotes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <AlertMessage type="error" message={error} />}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reject Detachment Modal ──────────────────────────────────────────────────

function RejectDetachmentModal({ request, onClose, onDone }) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const { execute, loading, error } = useApi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await execute(
      () => api.put(`/api/asset-lifecycle/detachment-requests/${request.id}/reject`, { approvalNotes }),
      'Detachment rejected'
    );
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Reject Detachment</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg text-sm">
            <p className="font-medium text-slate-700">{request.asset?.name}</p>
            <p className="text-slate-500">Requested by {request.requester?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Rejection</label>
            <textarea
              value={approvalNotes}
              onChange={e => setApprovalNotes(e.target.value)}
              rows={3}
              placeholder="Explain why the request is being rejected..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <AlertMessage type="error" message={error} />}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {loading ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const { data, loading, error } = useFetch('/api/asset-lifecycle/dashboard', null);

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (!data) return null;

  const { summary, pendingActions, metrics } = data;
  const status = summary?.assetsStatus || {};

  return (
    <div className="space-y-6">
      {/* Asset Status Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Asset Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total',       value: summary?.totalAssets || 0,  color: 'bg-slate-50 border-slate-200',   text: 'text-slate-700', icon: Package },
            { label: 'Available',   value: status.available || 0,       color: 'bg-green-50 border-green-200',  text: 'text-green-700', icon: CheckCircle2 },
            { label: 'Assigned',    value: status.assigned || 0,        color: 'bg-blue-50 border-blue-200',    text: 'text-blue-700',  icon: TrendingUp },
            { label: 'Maintenance', value: status.maintenance || 0,     color: 'bg-amber-50 border-amber-200',  text: 'text-amber-700', icon: AlertTriangle },
            { label: 'Retired',     value: status.retired || 0,         color: 'bg-red-50 border-red-200',      text: 'text-red-700',   icon: XCircle },
          ].map(({ label, value, color, text, icon: Icon }) => (
            <div key={label} className={`rounded-xl border p-4 ${color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${text}`} />
              </div>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Actions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Pending Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Detachment Requests', value: pendingActions?.detachmentRequests || 0, color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
            { label: 'Disposal Approvals',  value: pendingActions?.disposalApprovals || 0,  color: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
            { label: 'In Maintenance',      value: pendingActions?.overdueMaintenance || 0, color: 'bg-red-50 border-red-200', text: 'text-red-700' },
          ].map(({ label, value, color, text }) => (
            <div key={label} className={`rounded-xl border p-4 flex items-center gap-4 ${color}`}>
              <Clock className={`w-8 h-8 ${text} flex-shrink-0`} />
              <div>
                <p className={`text-2xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Utilization Rate',   value: `${metrics?.utilizationRate || 0}%`, sub: 'Assigned / Total', color: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
            { label: 'Maintenance Rate',   value: `${metrics?.maintenanceRate || 0}%`,  sub: 'In Maintenance / Total', color: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          ].map(({ label, value, sub, color, text }) => (
            <div key={label} className={`rounded-xl border p-5 ${color}`}>
              <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${text}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Types breakdown */}
      {summary?.assetsByType && Object.keys(summary.assetsByType).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">By Type</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(summary.assetsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-slate-700">{count}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{type.replace(/_/g, ' ')}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Disposals Tab ────────────────────────────────────────────────────────────

function DisposalsTab() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [approvingDisposal, setApprovingDisposal] = useState(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  const { data, loading, error, refetch } = useFetch(
    `/api/asset-lifecycle/disposals?${params}`,
    { disposals: [], total: 0 }
  );

  const disposals = data?.disposals || [];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-sm text-slate-500">{data?.total || 0} records</span>
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && disposals.length === 0 && (
        <EmptyState icon="🗑️" title="No disposal records" subtitle="No asset disposals found for the selected filter" />
      )}

      {!loading && disposals.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Asset', 'Disposal Type', 'Reason', 'Date', 'Requested By', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disposals.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{d.asset?.name || '—'}</p>
                    <p className="text-xs text-slate-400 capitalize">{d.asset?.type || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    {DISPOSAL_TYPE_LABELS[d.disposalType] || d.disposalType}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                    <p className="line-clamp-2">{d.disposalReason || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(d.disposalDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.creator?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.approvalStatus} styles={DISPOSAL_STATUS_STYLES} />
                    {d.approvedBy && d.approver && (
                      <p className="text-[11px] text-slate-400 mt-0.5">by {d.approver.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.approvalStatus === 'pending' && (
                      <button
                        onClick={() => setApprovingDisposal(d)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 border border-green-200"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approvingDisposal && (
        <ApproveDisposalModal
          disposal={approvingDisposal}
          onClose={() => setApprovingDisposal(null)}
          onDone={() => { setApprovingDisposal(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Detachments Tab ──────────────────────────────────────────────────────────

function DetachmentsTab() {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [approvingRequest, setApprovingRequest] = useState(null);
  const [rejectingRequest, setRejectingRequest] = useState(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);
  const { data, loading, error, refetch } = useFetch(
    `/api/asset-lifecycle/detachment-requests?${params}`,
    { requests: [], total: 0 }
  );

  const requests = data?.requests || [];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-sm text-slate-500">{data?.total || 0} records</span>
      </div>

      {loading && <LoadingSpinner />}
      {error && <AlertMessage type="error" message={error} />}

      {!loading && requests.length === 0 && (
        <EmptyState icon="🔗" title="No detachment requests" subtitle="No asset detachment requests found" />
      )}

      {!loading && requests.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Asset', 'Requester', 'Reason', 'Request Date', 'Status', 'Post-Action', 'Reviewed By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{r.asset?.name || '—'}</p>
                    <p className="text-xs text-slate-400 capitalize">{r.asset?.type || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{r.requester?.name || '—'}</p>
                    {r.requester?.email && (
                      <p className="text-xs text-slate-400">{r.requester.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                    <p className="line-clamp-2">{r.reason || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(r.requestDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.requestStatus} styles={DETACHMENT_STATUS_STYLES} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.postApprovalAction
                      ? POST_ACTION_LABELS[r.postApprovalAction] || r.postApprovalAction
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>{r.approver?.name || '—'}</p>
                    {r.approvalNotes && (
                      <p className="text-xs text-slate-400 line-clamp-1 italic">"{r.approvalNotes}"</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.requestStatus === 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setApprovingRequest(r)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 border border-green-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectingRequest(r)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 border border-red-200"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approvingRequest && (
        <ApproveDetachmentModal
          request={approvingRequest}
          onClose={() => setApprovingRequest(null)}
          onDone={() => { setApprovingRequest(null); refetch(); }}
        />
      )}
      {rejectingRequest && (
        <RejectDetachmentModal
          request={rejectingRequest}
          onClose={() => setRejectingRequest(null)}
          onDone={() => { setRejectingRequest(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AssetLifecycleDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <h1 className="text-lg font-bold text-slate-800">Asset Lifecycle</h1>
        <p className="text-sm text-slate-500">Manage disposals, detachment requests, and monitor asset health</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard'   && <DashboardTab />}
      {activeTab === 'disposals'   && <DisposalsTab />}
      {activeTab === 'detachments' && <DetachmentsTab />}
    </div>
  );
}
