import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatINR } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import {
  Plus, ChevronDown, ChevronUp, X, Wallet, IndianRupee,
  TrendingUp, AlertCircle, CheckCircle2, CreditCard, FileText,
} from 'lucide-react';

const FUND_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  disbursed: 'bg-purple-100 text-purple-700 border-purple-200',
  acknowledged: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  settled: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

const INITIAL_FORM = { title: '', amount: '', purpose: '', date: '' };

export default function MyFundRequests() {
  const { data: requests, loading, error: fetchErr, refetch } = useFetch('/expenses/fund-requests/my', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [expanded, setExpanded] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [ackId, setAckId] = useState(null);

  const activeRequests = requests.filter(r => ['approved', 'disbursed', 'acknowledged'].includes(r.status));
  const totalReceived = requests.reduce((sum, r) => sum + (r.disbursedAmount || 0), 0);
  const totalSpent = requests.reduce((sum, r) => sum + (r.spent || 0), 0);
  const outstanding = totalReceived - totalSpent;

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await execute(
        () => api.post('/expenses/fund-requests', {
          ...form,
          amount: parseFloat(form.amount),
        }),
        'Fund request submitted!'
      );
      refetch();
      setShowForm(false);
      setForm(INITIAL_FORM);
    } catch {
      // Error displayed by useApi
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await execute(
        () => api.put(`/expenses/fund-requests/${id}/acknowledge`, { acknowledgeNote: ackNote }),
        'Receipt acknowledged!'
      );
      refetch();
      setAckId(null);
      setAckNote('');
    } catch {
      // Error displayed by useApi
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this fund request?')) return;
    try {
      await execute(() => api.put(`/expenses/fund-requests/${id}/cancel`), 'Request cancelled.');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Wallet className="w-5 h-5 text-blue-600" />} label="Active Advances" value={activeRequests.length} />
        <StatCard icon={<IndianRupee className="w-5 h-5 text-green-600" />} label="Total Received" value={formatINR(totalReceived)} />
        <StatCard icon={<TrendingUp className="w-5 h-5 text-orange-600" />} label="Total Spent" value={formatINR(totalSpent)} />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-red-600" />} label="Outstanding" value={formatINR(outstanding)} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">My Fund Requests</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Request Funds
        </button>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Request Funds</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Client Visit Travel Advance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
                <textarea
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe the purpose..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <EmptyState icon="💰" title="No fund requests" subtitle="Request advance funds for business expenses" />
      ) : (
        <div className="space-y-3">
          {[...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(req => (
            <div key={req.id} className="border rounded-xl bg-white shadow-sm">
              {/* Card Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpanded(expanded === req.id ? null : req.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-800 truncate">{req.title}</span>
                    <StatusBadge status={req.status} styleMap={FUND_STATUS_STYLES} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{formatINR(req.amount)}</span>
                    <span>{formatDate(req.date || req.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {req.status === 'pending' && (
                    <button
                      onClick={e => { e.stopPropagation(); handleCancel(req.id); }}
                      className="text-xs px-2 py-1 text-red-600 border border-red-200 rounded hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  )}
                  {req.status === 'disbursed' && (
                    <button
                      onClick={e => { e.stopPropagation(); setAckId(ackId === req.id ? null : req.id); }}
                      className="text-xs px-2 py-1 text-purple-600 border border-purple-200 rounded hover:bg-purple-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                      Acknowledge Receipt
                    </button>
                  )}
                  {expanded === req.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Acknowledge Inline */}
              {ackId === req.id && (
                <div className="px-4 pb-3 border-t bg-purple-50">
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Optional note..."
                      value={ackNote}
                      onChange={e => setAckNote(e.target.value)}
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleAcknowledge(req.id)}
                      disabled={saving}
                      className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Detail */}
              {expanded === req.id && (
                <div className="border-t px-4 py-3 text-sm space-y-3 bg-slate-50">
                  {req.purpose && (
                    <div>
                      <span className="text-slate-500">Purpose:</span>
                      <p className="text-slate-700 mt-0.5">{req.purpose}</p>
                    </div>
                  )}

                  {req.disbursedAmount > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-500 text-xs">Disbursed</span>
                        <p className="font-medium text-slate-800">{formatINR(req.disbursedAmount)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Payment Mode</span>
                        <p className="font-medium text-slate-800 capitalize">{req.paymentMode?.replace(/_/g, ' ') || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Reference</span>
                        <p className="font-medium text-slate-800">{req.paymentRef || '-'}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Disbursed On</span>
                        <p className="font-medium text-slate-800">{formatDate(req.disbursedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Remaining Balance Bar for acknowledged requests */}
                  {req.status === 'acknowledged' && req.disbursedAmount > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Spent: {formatINR(req.spent || 0)}</span>
                        <span>Remaining: {formatINR((req.remaining != null ? req.remaining : req.disbursedAmount - (req.spent || 0)))}</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, ((req.spent || 0) / req.disbursedAmount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Linked Expenses */}
                  {req.expenses && req.expenses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase mb-1.5">Linked Expenses</h4>
                      <div className="space-y-1">
                        {req.expenses.map(exp => (
                          <div key={exp.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-700">{exp.title || exp.description}</span>
                            </div>
                            <span className="text-slate-600 font-medium">{formatINR(exp.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white border rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
