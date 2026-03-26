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
  Check, X, ChevronDown, ChevronUp, CreditCard, Clock,
  IndianRupee, AlertCircle, Users, CheckCircle2, FileText, Plus, Upload, Loader2,
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

const STATUS_OPTIONS = ['', 'pending', 'approved', 'rejected', 'disbursed', 'acknowledged', 'settled', 'cancelled'];

export default function AdminFundRequests() {
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const queryParts = [];
  if (statusFilter) queryParts.push(`status=${statusFilter}`);
  if (monthFilter) queryParts.push(`month=${monthFilter}`);
  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  const { data: requests, loading, error: fetchErr, refetch } = useFetch(`/expenses/fund-requests/all${queryStr}`, []);
  const { data: summary, error: summaryErr } = useFetch('/expenses/fund-requests/summary', null);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [expanded, setExpanded] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [disburseModal, setDisburseModal] = useState(null);
  const [disburseForm, setDisburseForm] = useState({ paymentMode: 'bank_transfer', disbursedAmount: '', paymentRef: '', paymentReceiptUrl: '' });
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState('');
  const receiptInputRef = useRef(null);
  const [settleModal, setSettleModal] = useState(null);
  const [settleNote, setSettleNote] = useState('');
  const [detail, setDetail] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ userId: '', title: '', amount: '', purpose: '', date: new Date().toISOString().split('T')[0] });
  const { data: employees } = useFetch('/users?active=true', []);

  // Client-side user name search
  const filteredRequests = userSearch
    ? requests.filter(r => (r.requester?.name || '').toLowerCase().includes(userSearch.toLowerCase()))
    : requests;

  // Stats from summary endpoint
  const pendingCount = summary?.byStatus?.pending || 0;
  const totalOutstanding = summary?.totalOutstanding || 0;
  const disbursedThisMonth = summary?.totalDisbursed || 0;
  const activeAdvances = (summary?.byStatus?.disbursed || 0) + (summary?.byStatus?.acknowledged || 0);

  const handleApprove = async (id) => {
    try {
      await execute(
        () => api.put(`/expenses/fund-requests/${id}/review`, { status: 'approved' }),
        'Request approved!'
      );
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await execute(
        () => api.put(`/expenses/fund-requests/${rejectModal}/review`, { status: 'rejected', reviewNote: rejectNote }),
        'Request rejected.'
      );
      refetch();
      setRejectModal(null);
      setRejectNote('');
    } catch {
      // Error displayed by useApi
    }
  };

  const handleDisburse = async () => {
    if (!disburseModal) return;
    try {
      await execute(
        () => api.put(`/expenses/fund-requests/${disburseModal.id}/disburse`, {
          ...disburseForm,
          disbursedAmount: parseFloat(disburseForm.disbursedAmount),
        }),
        'Funds disbursed!'
      );
      refetch();
      setDisburseModal(null);
      setDisburseForm({ paymentMode: 'bank_transfer', disbursedAmount: '', paymentRef: '', paymentReceiptUrl: '' });
      setReceiptFileName('');
    } catch {
      // Error displayed by useApi
    }
  };

  const handleSettle = async () => {
    if (!settleModal) return;
    try {
      await execute(
        () => api.put(`/expenses/fund-requests/${settleModal}/settle`, { settledNote: settleNote }),
        'Request settled!'
      );
      refetch();
      setSettleModal(null);
      setSettleNote('');
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

  const handleCreate = async () => {
    if (!createForm.title.trim() || !createForm.amount) return;
    try {
      const payload = { title: createForm.title.trim(), amount: parseFloat(createForm.amount), purpose: createForm.purpose.trim() || null, date: createForm.date };
      if (createForm.userId) {
        payload.userId = parseInt(createForm.userId);
        await execute(() => api.post('/expenses/fund-requests/admin-create', payload), 'Fund request created!');
      } else {
        await execute(() => api.post('/expenses/fund-requests', payload), 'Fund request created!');
      }
      refetch();
      setShowCreateModal(false);
      setCreateForm({ userId: '', title: '', amount: '', purpose: '', date: new Date().toISOString().split('T')[0] });
    } catch {
      // Error displayed by useApi
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    setReceiptFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/files/upload', fd);
      const driveUrl = res.data?.file?.driveUrl || res.data?.driveUrl || '';
      if (!driveUrl) throw new Error('No URL returned');
      setDisburseForm(prev => ({ ...prev, paymentReceiptUrl: driveUrl }));
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
      setReceiptFileName('');
    } finally {
      setReceiptUploading(false);
      e.target.value = '';
    }
  };

  const loadDetail = async (id) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    try {
      const res = await api.get(`/expenses/fund-requests/${id}`);
      setDetail(res.data);
    } catch {
      // silent — detail is supplementary
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6">
      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {summaryErr && <AlertMessage type="error" message={summaryErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending Requests" value={pendingCount} />
        <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Active Advances" value={activeAdvances} />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-red-600" />} label="Total Outstanding" value={formatINR(totalOutstanding)} />
        <StatCard icon={<IndianRupee className="w-5 h-5 text-green-600" />} label="Disbursed This Month" value={formatINR(disbursedThisMonth)} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Fund Requests</h2>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 shadow-sm">
          <Plus className="w-4 h-4" /> Request Fund
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Month"
        />
        <input
          type="text"
          value={userSearch}
          onChange={e => setUserSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Search employee..."
        />
      </div>

      {/* Table */}
      {filteredRequests.length === 0 ? (
        <EmptyState icon="💰" title="No fund requests" subtitle="No requests match the current filters" />
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 text-right">Requested</th>
                <th className="px-4 py-3 text-right">Disbursed</th>
                <th className="px-4 py-3 text-right">Spent</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRequests.map(req => {
                const balance = (req.disbursedAmount || 0) - (req.spent || 0);
                return (
                  <TableRowGroup key={req.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{req.requester?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{req.title}</td>
                      <td className="px-4 py-3 text-right">{formatINR(req.amount)}</td>
                      <td className="px-4 py-3 text-right">{req.disbursedAmount ? formatINR(req.disbursedAmount) : '-'}</td>
                      <td className="px-4 py-3 text-right">{req.spent ? formatINR(req.spent) : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">{req.disbursedAmount ? formatINR(balance) : '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} styleMap={FUND_STATUS_STYLES} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(req.id)}
                                disabled={saving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRejectModal(req.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {req.status === 'approved' && (
                            <button
                              onClick={() => { setDisburseModal(req); setDisburseForm(f => ({ ...f, disbursedAmount: req.amount })); }}
                              className="text-xs px-2 py-1 text-purple-600 border border-purple-200 rounded hover:bg-purple-50"
                            >
                              <CreditCard className="w-3.5 h-3.5 inline mr-1" />Disburse
                            </button>
                          )}
                          {req.status === 'disbursed' && (
                            <span className="text-xs text-slate-400 italic">Awaiting Ack</span>
                          )}
                          {req.status === 'acknowledged' && (
                            <button
                              onClick={() => setSettleModal(req.id)}
                              className="text-xs px-2 py-1 text-green-600 border border-green-200 rounded hover:bg-green-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Settle
                            </button>
                          )}
                          {req.status === 'pending' && (
                            <button
                              onClick={() => handleCancel(req.id)}
                              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => loadDetail(req.id)} className="text-slate-400 hover:text-slate-600">
                          {expanded === req.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    {expanded === req.id && detail && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50 px-6 py-4">
                          <div className="space-y-3 text-sm">
                            {detail.purpose && (
                              <p><span className="text-slate-500">Purpose:</span> {detail.purpose}</p>
                            )}
                            {detail.reviewNote && (
                              <p><span className="text-slate-500">Review Note:</span> {detail.reviewNote}</p>
                            )}
                            {detail.disbursedAmount > 0 && (
                              <div className="flex gap-4 text-xs">
                                <span>Mode: <strong className="capitalize">{detail.paymentMode?.replace(/_/g, ' ')}</strong></span>
                                {detail.paymentRef && <span>Ref: <strong>{detail.paymentRef}</strong></span>}
                                <span>Disbursed: <strong>{formatDate(detail.disbursedAt)}</strong></span>
                              </div>
                            )}

                            {/* Linked Expenses */}
                            {detail.expenses && detail.expenses.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Linked Expenses</h4>
                                <table className="w-full text-xs border rounded">
                                  <thead>
                                    <tr className="bg-white text-slate-500">
                                      <th className="px-3 py-1.5 text-left">Description</th>
                                      <th className="px-3 py-1.5 text-left">Date</th>
                                      <th className="px-3 py-1.5 text-right">Amount</th>
                                      <th className="px-3 py-1.5">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {detail.expenses.map(exp => (
                                      <tr key={exp.id}>
                                        <td className="px-3 py-1.5">{exp.title || exp.description}</td>
                                        <td className="px-3 py-1.5">{formatDate(exp.date)}</td>
                                        <td className="px-3 py-1.5 text-right">{formatINR(exp.amount)}</td>
                                        <td className="px-3 py-1.5 text-center"><StatusBadge status={exp.status} styleMap={FUND_STATUS_STYLES} /></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Audit Log */}
                            {detail.logs && detail.logs.length > 0 && (
                              <div>
                                <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">Audit Log</h4>
                                <div className="space-y-1">
                                  {detail.logs.map((log, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                                      <span className="text-slate-400">{formatDate(log.createdAt)}</span>
                                      <span>{log.action}</span>
                                      {log.user?.name && <span className="text-slate-600">by {log.user.name}</span>}
                                      {log.note && <span className="italic">- {log.note}</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </TableRowGroup>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal title="Reject Request" onClose={() => { setRejectModal(null); setRejectNote(''); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rejection Note</label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setRejectModal(null); setRejectNote(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleReject} disabled={saving} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Disburse Modal */}
      {disburseModal && (
        <Modal title="Disburse Funds" onClose={() => setDisburseModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode *</label>
              <select
                value={disburseForm.paymentMode}
                onChange={e => setDisburseForm(f => ({ ...f, paymentMode: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="1"
                value={disburseForm.disbursedAmount}
                onChange={e => setDisburseForm(f => ({ ...f, disbursedAmount: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Reference</label>
              <input
                type="text"
                value={disburseForm.paymentRef}
                onChange={e => setDisburseForm(f => ({ ...f, paymentRef: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Transaction ID / Cheque No."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Receipt</label>
              <input ref={receiptInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleReceiptUpload} className="hidden" />
              {disburseForm.paymentReceiptUrl ? (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 truncate flex-1">{receiptFileName || 'Receipt uploaded'}</span>
                  <button type="button" onClick={() => { setDisburseForm(f => ({ ...f, paymentReceiptUrl: '' })); setReceiptFileName(''); }}
                    className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => receiptInputRef.current?.click()} disabled={receiptUploading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors">
                  {receiptUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Receipt (PDF/Image)</>}
                </button>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDisburseModal(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleDisburse}
                disabled={saving || !disburseForm.disbursedAmount}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Disbursing...' : 'Disburse'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Fund Request Modal */}
      {showCreateModal && (
        <Modal title="Request Fund" onClose={() => setShowCreateModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Request On Behalf Of (optional)</label>
              <select value={createForm.userId} onChange={e => setCreateForm(prev => ({ ...prev, userId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">-- Self (My Request) --</option>
                {(employees || []).filter(u => u.isActive).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.employeeId || u.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input type="text" value={createForm.title} onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Office supplies, Travel advance" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                <input type="number" value={createForm.amount} onChange={e => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" min="1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={createForm.date} onChange={e => setCreateForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
              <textarea value={createForm.purpose} onChange={e => setCreateForm(prev => ({ ...prev, purpose: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Describe the purpose of this fund request..." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !createForm.title.trim() || !createForm.amount}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Settle Modal */}
      {settleModal && (
        <Modal title="Settle Request" onClose={() => { setSettleModal(null); setSettleNote(''); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Settlement Note</label>
              <textarea
                value={settleNote}
                onChange={e => setSettleNote(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="Optional settlement note..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setSettleModal(null); setSettleNote(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSettle} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Settling...' : 'Settle'}
              </button>
            </div>
          </div>
        </Modal>
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

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TableRowGroup({ children }) {
  return <>{children}</>;
}
