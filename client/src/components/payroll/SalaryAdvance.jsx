import { useState } from 'react';
import {
  Wallet, Clock, CheckCircle, XCircle, Banknote, ArrowLeft,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, Send, RefreshCw,
  CalendarDays, IndianRupee, RotateCcw,
} from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatMonth = (m) => {
  try { return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  catch { return m; }
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending Approval', color: 'amber',  icon: Clock },
  approved:  { label: 'Approved',         color: 'blue',   icon: CheckCircle },
  rejected:  { label: 'Rejected',         color: 'red',    icon: XCircle },
  released:  { label: 'Disbursed',        color: 'violet', icon: Banknote },
  repaying:  { label: 'Repaying',         color: 'indigo', icon: RotateCcw },
  closed:    { label: 'Closed',           color: 'green',  icon: CheckCircle },
};

const colorCls = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700' },
};

export default function SalaryAdvance() {
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ amount: '', reason: '', repaymentMonths: '3' });
  const { data: advances, loading, error: fetchErr, refetch } = useFetch('/api/salary-advances/my', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const activeAdvance = advances.find(a => ['pending', 'approved', 'released', 'repaying'].includes(a.status));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    try {
      await execute(() => api.post('/api/salary-advances', {
        amount: parseFloat(form.amount),
        reason: form.reason,
        repaymentMonths: parseInt(form.repaymentMonths),
      }), 'Advance request submitted successfully!');
      setForm({ amount: '', reason: '', repaymentMonths: '3' });
      setShowForm(false);
      refetch();
    } catch {}
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this advance request?')) return;
    try {
      await execute(() => api.delete(`/api/salary-advances/${id}`), 'Advance request cancelled.');
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 rounded-xl">
            <Wallet className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Salary Advance</h1>
            <p className="text-sm text-slate-500">Request and track salary advances</p>
          </div>
        </div>
        {!activeAdvance && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Request Advance
          </button>
        )}
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Active Advance Banner */}
      {activeAdvance && (
        <ActiveAdvanceBanner advance={activeAdvance} onCancel={handleCancel} cancelLoading={saving} />
      )}

      {/* Request Form */}
      {showForm && !activeAdvance && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-800">New Advance Request</h2>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount Required (₹) *</label>
                <input
                  type="number" min="1000" step="500"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 20000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Repay Over (months) *</label>
                <select
                  value={form.repaymentMonths}
                  onChange={e => setForm(f => ({ ...f, repaymentMonths: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {[1,2,3,4,5,6,9,12].map(m => (
                    <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview */}
            {form.amount > 0 && (
              <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 text-sm">
                <p className="text-violet-700 font-medium">Repayment Preview</p>
                <p className="text-violet-600">
                  ₹{Math.ceil(parseFloat(form.amount || 0) / parseInt(form.repaymentMonths))} / month
                  × {form.repaymentMonths} months = {formatCurrency(parseFloat(form.amount || 0))}
                </p>
                <p className="text-xs text-violet-500 mt-0.5">Amount will be deducted from monthly salary</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Purpose *</label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Briefly explain why you need this advance..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                required
              />
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Advance approval is subject to manager review. Repayments will be automatically deducted from your monthly salary starting from the disbursement month.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                Cancel
              </button>
              <button type="submit" disabled={saving || !form.amount || !form.reason}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      {advances.length === 0 && !showForm ? (
        <EmptyState icon="💰" title="No advance requests" subtitle="Request a salary advance using the button above" />
      ) : (
        <div className="space-y-3">
          {advances.map(adv => (
            <AdvanceCard
              key={adv.id}
              advance={adv}
              expanded={expanded === adv.id}
              onToggle={() => setExpanded(expanded === adv.id ? null : adv.id)}
              onCancel={handleCancel}
              cancelLoading={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveAdvanceBanner({ advance, onCancel, cancelLoading }) {
  const cfg = STATUS_CONFIG[advance.status] || STATUS_CONFIG.pending;
  const cls = colorCls[cfg.color];
  const Icon = cfg.icon;
  const amount = advance.approvedAmount || advance.amount;
  const repaid = (advance.repayments || []).filter(r => r.status === 'deducted').reduce((s, r) => s + r.amount, 0);
  const remaining = amount - repaid;

  return (
    <div className={`rounded-xl border-2 ${cls.border} ${cls.bg} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-white`}>
            <Icon className={`w-5 h-5 ${cls.text}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Advance</p>
            <p className={`text-2xl font-bold ${cls.text}`}>{formatCurrency(amount)}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cls.badge}`}>{cfg.label}</span>
      </div>
      {advance.status === 'repaying' && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Repaid: {formatCurrency(repaid)}</span>
            <span>Remaining: {formatCurrency(remaining)}</span>
          </div>
          <div className="w-full bg-white rounded-full h-2 border border-slate-200">
            <div
              className={`h-2 rounded-full ${cls.text.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min((repaid / amount) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Started {formatMonth(advance.repaymentStart)} — {advance.repaymentMonths} month plan
          </p>
        </div>
      )}
      {['pending', 'approved'].includes(advance.status) && (
        <div className="mt-3">
          <button onClick={() => onCancel(advance.id)} disabled={cancelLoading}
            className="text-xs text-red-600 hover:text-red-700 underline">
            Cancel Request
          </button>
        </div>
      )}
    </div>
  );
}

function AdvanceCard({ advance, expanded, onToggle, onCancel, cancelLoading }) {
  const cfg = STATUS_CONFIG[advance.status] || STATUS_CONFIG.pending;
  const cls = colorCls[cfg.color];
  const Icon = cfg.icon;
  const amount = advance.approvedAmount || advance.amount;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${cls.bg}`}>
            <Icon className={`w-4 h-4 ${cls.text}`} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">{formatCurrency(amount)}</p>
            <p className="text-xs text-slate-500">{advance.repaymentMonths} months • {advance.reason?.slice(0, 40)}{advance.reason?.length > 40 ? '…' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls.badge}`}>{cfg.label}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Info label="Requested" value={formatCurrency(advance.amount)} />
            <Info label="Approved" value={advance.approvedAmount ? formatCurrency(advance.approvedAmount) : '—'} />
            <Info label="Repayment" value={`${advance.repaymentMonths} months`} />
            <Info label="Starts" value={advance.repaymentStart ? formatMonth(advance.repaymentStart) : 'Pending'} />
          </div>

          {advance.reason && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-0.5">Reason</p>
              <p className="text-sm text-slate-700">{advance.reason}</p>
            </div>
          )}

          {advance.approveNote && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-500 font-medium mb-0.5">Reviewer Note</p>
              <p className="text-sm text-blue-700">{advance.approveNote}</p>
            </div>
          )}

          {/* Repayment Schedule */}
          {advance.repayments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Repayment Schedule</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600">Month</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advance.repayments.map((r, i) => (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-3 py-2 text-slate-700 flex items-center gap-1.5">
                          <CalendarDays className="w-3 h-3 text-slate-400" />
                          {formatMonth(r.month)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-2 text-center">
                          {r.status === 'deducted'
                            ? <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> Deducted</span>
                            : <span className="text-amber-500">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {['pending', 'approved'].includes(advance.status) && (
            <button onClick={() => onCancel(advance.id)} disabled={cancelLoading}
              className="text-xs text-red-600 hover:text-red-700 underline">
              Cancel this request
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
