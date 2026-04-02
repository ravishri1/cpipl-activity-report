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
  IndianRupee, AlertCircle, Users, CheckCircle2, Plus, Upload, Loader2,
  RotateCcw, Wallet, Edit3, Save,
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
  income: 'bg-lime-100 text-lime-700 border-lime-200',
};

const FUND_CATEGORIES = ['travel', 'food', 'office', 'medical', 'other'];
const INCOME_SOURCES = ['Scrap Sale', 'Old Newspaper Sale', 'Old Equipment Sale', 'Deposit Refund', 'Other'];
const STATUS_OPTIONS = ['', 'pending', 'approved', 'rejected', 'disbursed', 'acknowledged', 'settled', 'cancelled'];

const EMPTY_CREATE = {
  userId: '', title: '', amount: '', purpose: '', date: new Date().toISOString().split('T')[0],
  type: 'advance', category: '', billUrl: '', billDriveId: '', incomeSource: '',
};

export default function AdminFundRequests() {
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const queryParts = [];
  if (statusFilter) queryParts.push(`status=${statusFilter}`);
  if (monthFilter) queryParts.push(`month=${monthFilter}`);
  if (typeFilter) queryParts.push(`type=${typeFilter}`);
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
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [billUploading, setBillUploading] = useState(false);
  const [billFileName, setBillFileName] = useState('');
  const billInputRef = useRef(null);
  const { data: employees } = useFetch('/users?active=true', []);

  // Petty Cash — single API call to get fund holder balance
  const { data: fundHolderData, refetch: refetchBalance } = useFetch('/expenses/fund-balances/holder', null);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [balanceVal, setBalanceVal] = useState('');
  const [balanceNotes, setBalanceNotes] = useState('');
  const [newHolderId, setNewHolderId] = useState(null); // only for first-time picker

  const loadAndShowBalance = () => {
    if (fundHolderData?.userId) {
      setBalanceVal(String(fundHolderData.openingBalance || 0));
      setBalanceNotes('');
    }
    setShowBalanceEditor(true);
  };

  const handleSaveBalance = async () => {
    const uid = fundHolderData?.userId || newHolderId;
    if (!uid) return;
    try {
      await execute(
        () => api.put(`/expenses/fund-balances/${uid}`, {
          openingBalance: parseFloat(balanceVal) || 0,
          notes: balanceNotes || null,
        }),
        'Opening balance saved!'
      );
      setShowBalanceEditor(false);
      setNewHolderId(null);
      refetchBalance();
    } catch {
      // Error displayed by useApi
    }
  };

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

  // For reimbursements: approved → settle (pay out)
  const handlePayReimbursement = async (id) => {
    setSettleModal(id);
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

  const handleAcknowledgeIncome = async (id) => {
    if (!window.confirm('Acknowledge this income entry?')) return;
    try {
      await execute(() => api.put(`/expenses/fund-requests/${id}/acknowledge-income`), 'Income acknowledged!');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

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
      setCreateForm(prev => ({ ...prev, billUrl: driveUrl, billDriveId: driveId }));
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
      setBillFileName('');
    } finally {
      setBillUploading(false);
      e.target.value = '';
    }
  };

  const handleCreate = async () => {
    const hasTitle = createForm.type === 'income' ? (createForm.incomeSource || createForm.title.trim()) : createForm.title.trim();
    if (!hasTitle || !createForm.amount) return;
    try {
      const payload = {
        title: createForm.type === 'income'
          ? (createForm.incomeSource ? `${createForm.incomeSource}${createForm.title.trim() ? ' — ' + createForm.title.trim() : ''}` : createForm.title.trim())
          : createForm.title.trim(),
        amount: parseFloat(createForm.amount),
        purpose: createForm.purpose.trim() || null,
        date: createForm.date,
        type: createForm.type,
        category: createForm.type === 'reimbursement' ? (createForm.category || null) : null,
        billUrl: createForm.type !== 'advance' ? (createForm.billUrl || null) : null,
        billDriveId: createForm.type !== 'advance' ? (createForm.billDriveId || null) : null,
      };
      if (createForm.userId) {
        payload.userId = parseInt(createForm.userId);
        await execute(() => api.post('/expenses/fund-requests/admin-create', payload), 'Fund request created!');
      } else {
        await execute(() => api.post('/expenses/fund-requests', payload), 'Fund request created!');
      }
      refetch();
      setShowCreateModal(false);
      setCreateForm(EMPTY_CREATE);
      setBillFileName('');
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

      {/* Fund Holder Balance — always visible */}
      {fundHolderData && fundHolderData.openingBalance ? (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Petty Cash — {fundHolderData.holderName || 'Fund Holder'}</p>
                <div className="flex items-center gap-6 mt-1">
                  <div>
                    <span className="text-xs text-slate-500">Opening</span>
                    <p className="text-lg font-bold text-emerald-700">{formatINR(fundHolderData.openingBalance || 0)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Disbursed</span>
                    <p className="text-lg font-bold text-blue-600">{formatINR(fundHolderData.totalDisbursed || 0)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Spent</span>
                    <p className="text-lg font-bold text-red-600">{formatINR(fundHolderData.totalSpent || 0)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Current Balance</span>
                    <p className="text-lg font-bold text-emerald-800">{formatINR(fundHolderData.currentBalance || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
            <button onClick={loadAndShowBalance} className="text-xs text-emerald-600 hover:text-emerald-800 underline">Edit</button>
          </div>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending Requests" value={pendingCount} />
        <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Active Advances" value={activeAdvances} />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-red-600" />} label="Total Outstanding" value={formatINR(totalOutstanding)} />
        <StatCard icon={<IndianRupee className="w-5 h-5 text-green-600" />} label="Total Disbursed" value={formatINR(disbursedThisMonth)} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Fund Requests</h2>
        <div className="flex items-center gap-2">
          <button onClick={loadAndShowBalance}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-sm">
            <Wallet className="w-4 h-4" /> Opening Balance
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 shadow-sm">
            <Plus className="w-4 h-4" /> Request Fund
          </button>
        </div>
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
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="advance">Advance</option>
          <option value="reimbursement">Reimbursement</option>
          <option value="income">Income</option>
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
                <th className="px-4 py-3">Type</th>
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
                const isReimb = req.type === 'reimbursement';
                const isIncome = req.type === 'income';
                const balance = (req.disbursedAmount || 0) - (req.spent || 0);
                return (
                  <TableRowGroup key={req.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{req.requester?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{req.title}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_STYLES[req.type] || TYPE_STYLES.advance}`}>
                          {isIncome ? 'Income' : isReimb ? 'Reimbursement' : 'Advance'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatINR(req.amount)}</td>
                      <td className="px-4 py-3 text-right">{req.disbursedAmount ? formatINR(req.disbursedAmount) : '-'}</td>
                      <td className="px-4 py-3 text-right">{req.spent ? formatINR(req.spent) : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {(isReimb || isIncome) ? '-' : (req.disbursedAmount ? formatINR(balance) : '-')}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={req.status} styleMap={FUND_STATUS_STYLES} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Income: pending → acknowledge (no approval/disburse cycle) */}
                          {isIncome && req.status === 'pending' && (
                            <button
                              onClick={() => handleAcknowledgeIncome(req.id)}
                              disabled={saving}
                              className="text-xs px-2 py-1 text-lime-700 border border-lime-300 rounded hover:bg-lime-50"
                              title="Acknowledge Income"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Acknowledge
                            </button>
                          )}
                          {req.status === 'pending' && !isIncome && (
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
                          {/* Advance: approved → disburse */}
                          {!isReimb && !isIncome && req.status === 'approved' && (
                            <button
                              onClick={() => { setDisburseModal(req); setDisburseForm(f => ({ ...f, disbursedAmount: req.amount })); }}
                              className="text-xs px-2 py-1 text-purple-600 border border-purple-200 rounded hover:bg-purple-50"
                            >
                              <CreditCard className="w-3.5 h-3.5 inline mr-1" />Disburse
                            </button>
                          )}
                          {/* Reimbursement: approved → pay */}
                          {isReimb && !isIncome && req.status === 'approved' && (
                            <button
                              onClick={() => handlePayReimbursement(req.id)}
                              className="text-xs px-2 py-1 text-green-600 border border-green-200 rounded hover:bg-green-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Pay
                            </button>
                          )}
                          {req.status === 'disbursed' && (
                            <span className="text-xs text-slate-400 italic">Awaiting Ack</span>
                          )}
                          {!isReimb && !isIncome && req.status === 'acknowledged' && (
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
                        <td colSpan={10} className="bg-slate-50 px-6 py-4">
                          <div className="space-y-3 text-sm">
                            {detail.purpose && (
                              <p><span className="text-slate-500">Purpose:</span> {detail.purpose}</p>
                            )}
                            {detail.category && (
                              <p><span className="text-slate-500">Category:</span> <span className="capitalize">{detail.category}</span></p>
                            )}
                            {detail.billUrl && (
                              <p>
                                <span className="text-slate-500">Bill/Receipt:</span>{' '}
                                <a href={detail.billUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Bill</a>
                              </p>
                            )}
                            {detail.reviewNote && (
                              <p><span className="text-slate-500">Review Note:</span> {detail.reviewNote}</p>
                            )}
                            {detail.disbursedAmount > 0 && (
                              <div className="flex gap-4 text-xs">
                                <span>Mode: <strong className="capitalize">{detail.paymentMode?.replace(/_/g, ' ')}</strong></span>
                                {detail.paymentRef && <span>Ref: <strong>{detail.paymentRef}</strong></span>}
                                <span>Disbursed: <strong>{formatDate(detail.disbursedOn)}</strong></span>
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
        <Modal title="Request Fund" onClose={() => { setShowCreateModal(false); setCreateForm(EMPTY_CREATE); setBillFileName(''); }}>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
            {saveErr && <AlertMessage type="error" message={saveErr} />}
            {/* Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Request Type *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreateForm(prev => ({ ...prev, type: 'advance' }))}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${createForm.type === 'advance' ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Advance
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm(prev => ({ ...prev, type: 'reimbursement' }))}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${createForm.type === 'reimbursement' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Reimbursement
                </button>
                <button
                  type="button"
                  onClick={() => setCreateForm(prev => ({ ...prev, type: 'income' }))}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${createForm.type === 'income' ? 'bg-lime-600 text-white border-lime-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Income
                </button>
              </div>
              {createForm.type === 'income' && (
                <p className="text-xs text-slate-500 mt-1">Record money received from other sources (scrap, newspaper, etc.).</p>
              )}
            </div>

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

            {/* Income-specific: Source field */}
            {createForm.type === 'income' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Income Source *</label>
                <select value={createForm.incomeSource} onChange={e => setCreateForm(prev => ({ ...prev, incomeSource: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select source</option>
                  {INCOME_SOURCES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {createForm.type === 'income' ? 'Details / Notes' : 'Title *'}
              </label>
              <input type="text" value={createForm.title} onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={createForm.type === 'income' ? 'e.g. 50 kg scrap sold to Ravi Traders' : createForm.type === 'reimbursement' ? 'e.g. Client travel expenses' : 'e.g. Office supplies advance'} />
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

            {/* Reimbursement-specific fields */}
            {createForm.type === 'reimbursement' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select value={createForm.category} onChange={e => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select category</option>
                    {FUND_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bill / Receipt</label>
                  <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBillUpload} className="hidden" />
                  {createForm.billUrl ? (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span className="text-sm text-green-700 truncate flex-1">{billFileName || 'Bill uploaded'}</span>
                      <button type="button" onClick={() => { setCreateForm(prev => ({ ...prev, billUrl: '', billDriveId: '' })); setBillFileName(''); }}
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

            {/* Income-specific: optional bill upload */}
            {createForm.type === 'income' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supporting Document (optional)</label>
                <input ref={billInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBillUpload} className="hidden" />
                {createForm.billUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-700 truncate flex-1">{billFileName || 'Document uploaded'}</span>
                    <button type="button" onClick={() => { setCreateForm(prev => ({ ...prev, billUrl: '', billDriveId: '' })); setBillFileName(''); }}
                      className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => billInputRef.current?.click()} disabled={billUploading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-lime-400 hover:text-lime-600 transition-colors">
                    {billUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Document (PDF/Image)</>}
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {createForm.type === 'income' ? 'Additional Description' : createForm.type === 'reimbursement' ? 'Description' : 'Purpose'}
              </label>
              <textarea value={createForm.purpose} onChange={e => setCreateForm(prev => ({ ...prev, purpose: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
                placeholder={createForm.type === 'income' ? 'Any additional details...' : createForm.type === 'reimbursement' ? 'Describe what was spent...' : 'Describe the purpose of this fund request...'} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowCreateModal(false); setCreateForm(EMPTY_CREATE); setBillFileName(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={saving || !(createForm.type === 'income' ? (createForm.incomeSource || createForm.title.trim()) : createForm.title.trim()) || !createForm.amount}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Creating...' : createForm.type === 'income' ? 'Record Income' : 'Submit Request'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Opening Balance — inline editor (no modal, no dropdown) */}
      {showBalanceEditor && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
              <Wallet className="w-4 h-4" /> Petty Cash — Opening Balance
            </h3>
            <button onClick={() => setShowBalanceEditor(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          {/* Employee picker — only shown first time when no fund holder exists */}
          {!fundHolderData?.userId && !newHolderId && (
            <div className="mb-3">
              <label className="block text-xs text-slate-600 mb-1">Fund Holder (who manages petty cash?)</label>
              <select value="" onChange={e => { setNewHolderId(parseInt(e.target.value)); setBalanceVal('0'); }}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select employee...</option>
                {(Array.isArray(employees) ? employees : (employees?.users || [])).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}
          {(fundHolderData?.userId || newHolderId) && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-slate-600 mb-1">Amount (₹)</label>
                <input type="number" value={balanceVal} onChange={e => setBalanceVal(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Enter opening balance..." />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-slate-600 mb-1">Note (optional)</label>
                <input type="text" value={balanceNotes} onChange={e => setBalanceNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g., Balance as of March 2026" />
              </div>
              <button onClick={handleSaveBalance} disabled={saving}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
          {currentBalance && (currentBalance.openingBalance || currentBalance.currentBalance) ? (
            <p className="text-xs text-emerald-700 mt-2">
              Current: Opening {formatINR(currentBalance.openingBalance || 0)} | Balance {formatINR(currentBalance.currentBalance || 0)}
            </p>
          ) : null}
        </div>
      )}

      {/* Settle / Pay Modal */}
      {settleModal && (
        <Modal title="Settle / Pay Request" onClose={() => { setSettleModal(null); setSettleNote(''); }}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Settlement Note</label>
              <textarea
                value={settleNote}
                onChange={e => setSettleNote(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                rows={3}
                placeholder="Optional settlement / payment note..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setSettleModal(null); setSettleNote(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={handleSettle} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Processing...' : 'Confirm Payment'}
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
