import { useState, useRef } from 'react';
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
  TrendingUp, AlertCircle, CheckCircle2, FileText, Upload, Loader2,
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

const TYPE_STYLES = {
  advance: 'bg-green-100 text-green-700 border-green-200',
  reimbursement: 'bg-blue-100 text-blue-700 border-blue-200',
};

const FUND_CATEGORIES = ['travel', 'food', 'office', 'medical', 'other'];

const INITIAL_FORM = { title: '', amount: '', purpose: '', date: '', type: 'advance', category: '', billUrl: '', billDriveId: '' };

export default function MyFundRequests() {
  const { data: requests, loading, error: fetchErr, refetch } = useFetch('/expenses/fund-requests/my', []);
  const { data: myBalance, error: balanceErr } = useFetch('/expenses/fund-balances/my', null);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [expanded, setExpanded] = useState(null);
  const [ackNote, setAckNote] = useState('');
  const [ackId, setAckId] = useState(null);
  const [billUploading, setBillUploading] = useState(false);
  const [billFileName, setBillFileName] = useState('');
  const billInputRef = useRef(null);

  const activeRequests = requests.filter(r => ['approved', 'disbursed', 'acknowledged'].includes(r.status));
  const totalReceived = requests.reduce((sum, r) => sum + (r.disbursedAmount || 0), 0);
  const totalSpent = requests.reduce((sum, r) => sum + (r.spent || 0), 0);
  const outstanding = totalReceived - totalSpent;

  const handleBillUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillUploading(true);
    setBillFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/files/upload', fd);
      const driveUrl = res.data?.file?.driveUrl || res.data?.driveUrl || '';
      const driveId = res.data?.file?.driveFileId || res.data?.driveFileId || '';
      if (!driveUrl) throw new Error('No URL returned');
      setForm(f => ({ ...f, billUrl: driveUrl, billDriveId: driveId }));
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
      setBillFileName('');
    } finally {
      setBillUploading(false);
      e.target.value = '';
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await execute(
        () => api.post('/expenses/fund-requests', {
          title: form.title,
          amount: parseFloat(form.amount),
          purpose: form.purpose || null,
          date: form.date || undefined,
          type: form.type,
          category: form.type === 'reimbursement' ? (form.category || null) : null,
          billUrl: form.type === 'reimbursement' ? (form.billUrl || null) : null,
          billDriveId: form.type === 'reimbursement' ? (form.billDriveId || null) : null,
        }),
        form.type === 'reimbursement' ? 'Reimbursement request submitted!' : 'Fund request submitted!'
      );
      refetch();
      setShowForm(false);
      setForm(INITIAL_FORM);
      setBillFileName('');
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
      {balanceErr && <AlertMessage type="error" message={balanceErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Current balance banner */}
      {myBalance && (
        <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
          <Wallet className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <span className="text-sm text-blue-700 font-medium">Your current fund balance: </span>
            <span className="text-sm font-bold text-blue-800">{formatINR(myBalance.currentBalance || 0)}</span>
            {myBalance.totalDisbursed > 0 && (
              <span className="text-xs text-blue-500 ml-2">(Disbursed: {formatINR(myBalance.totalDisbursed)}, Spent: {formatINR(myBalance.totalSpent)})</span>
            )}
          </div>
        </div>
      )}

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
          <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Request Funds</h3>
              <button type="button" onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setBillFileName(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {saveErr && <AlertMessage type="error" message={saveErr} />}
            <div className="space-y-3">
              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Type *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'advance' }))}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${form.type === 'advance' ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: 'reimbursement' }))}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${form.type === 'reimbursement' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Reimbursement
                  </button>
                </div>
                {form.type === 'reimbursement' && (
                  <p className="text-xs text-slate-500 mt-1">Submit for expenses you have already paid.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder={form.type === 'reimbursement' ? 'e.g. Client visit expenses' : 'e.g. Client Visit Travel Advance'}
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

              {/* Reimbursement-specific fields */}
              {form.type === 'reimbursement' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select category</option>
                      {FUND_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bill / Receipt</label>
                    <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBillUpload} className="hidden" />
                    {form.billUrl ? (
                      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm text-green-700 truncate flex-1">{billFileName || 'Bill uploaded'}</span>
                        <button type="button" onClick={() => { setForm(f => ({ ...f, billUrl: '', billDriveId: '' })); setBillFileName(''); }}
                          className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => billInputRef.current?.click()} disabled={billUploading}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                        {billUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Bill/Receipt (PDF/Image)</>}
                      </button>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{form.type === 'reimbursement' ? 'Description' : 'Purpose'}</label>
                <textarea
                  value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder={form.type === 'reimbursement' ? 'Describe what was spent...' : 'Describe the purpose...'}
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
              <button type="button" onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setBillFileName(''); }} className="px-4 py-2 text-sm text-slate-600 border rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Submitting...' : (form.type === 'reimbursement' ? 'Submit Reimbursement' : 'Submit Request')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <EmptyState icon="💰" title="No fund requests" subtitle="Request advance funds or submit reimbursements for business expenses" />
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-slate-800 truncate">{req.title}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_STYLES[req.type] || TYPE_STYLES.advance}`}>
                      {req.type === 'reimbursement' ? 'Reimbursement' : 'Advance'}
                    </span>
                    <StatusBadge status={req.status} styleMap={FUND_STATUS_STYLES} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span>{formatINR(req.amount)}</span>
                    <span>{formatDate(req.date || req.createdAt)}</span>
                    {req.category && <span className="capitalize">{req.category}</span>}
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
                  {req.billUrl && (
                    <a
                      href={req.billUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs px-2 py-1 text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      View Bill
                    </a>
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
                      <span className="text-slate-500">{req.type === 'reimbursement' ? 'Description' : 'Purpose'}:</span>
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
                        <p className="font-medium text-slate-800">{formatDate(req.disbursedOn)}</p>
                      </div>
                    </div>
                  )}

                  {/* Remaining Balance Bar for acknowledged advances */}
                  {req.type === 'advance' && req.status === 'acknowledged' && req.disbursedAmount > 0 && (
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
