import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  Users,
  CheckCircle,
  XCircle,
  IndianRupee,
  Clock,
  Filter,
  Search,
  AlertTriangle,
  Send,
  Eye,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wallet,
  X,
  Plus,
  UserPlus,
  Paperclip,
  Trash2,
  FileText,
} from 'lucide-react';
import api from '../../utils/api';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'paid', label: 'Paid' },
];

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
};

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food & Meals' },
  { value: 'medical', label: 'Medical' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_STYLES = {
  travel: 'bg-purple-100 text-purple-700',
  food: 'bg-orange-100 text-orange-700',
  medical: 'bg-pink-100 text-pink-700',
  office: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-700',
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const EMPTY_FORM = {
  userId: '',
};

const makeEmptyItem = () => ({
  id: Date.now() + Math.random(),
  title: '',
  category: 'travel',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
});

// Lazy imports for fund request tabs
const AdminFundRequests = React.lazy(() => import('./AdminFundRequests'));
const FundLedger = React.lazy(() => import('./FundLedger'));

export default function ExpenseApproval() {
  const [mainTab, setMainTab] = useState('claims'); // 'claims' | 'fund-requests' | 'ledger'
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // New expense form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lineItems, setLineItems] = useState([makeEmptyItem()]);
  const [attachments, setAttachments] = useState([]); // [{name, url, driveFileId}]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setLineItems([makeEmptyItem()]);
    setAttachments([]);
  };

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (monthFilter) params.append('month', monthFilter);
      params.append('_t', Date.now()); // cache-bust
      const res = await api.get(`/expenses/all?${params.toString()}`);
      setExpenses(res.data.expenses || res.data || []);
    } catch (err) {
      setError('Failed to load expense claims');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, monthFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Fetch employees when form opens
  useEffect(() => {
    if (!showForm) return;
    (async () => {
      try {
        const res = await api.get('/users?active=true');
        const list = res.data.users || res.data || [];
        setEmployees(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } catch {
        setEmployees([]);
      }
    })();
  }, [showForm]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = {
    pending: expenses.filter((e) => e.status === 'pending').length,
    approvedThisMonth: expenses.filter((e) => {
      if (e.status !== 'approved' && e.status !== 'paid') return false;
      const d = new Date(e.updatedAt || e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length,
    totalPaid: expenses.filter((e) => e.status === 'paid').length,
    totalAmount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  const filteredExpenses = expenses.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const empName = (e.user?.name || e.employee?.name || e.employeeName || '').toLowerCase();
    const empId = (e.user?.employeeId || e.employee?.employeeId || e.employeeId || '').toLowerCase();
    const title = (e.title || '').toLowerCase();
    return empName.includes(q) || empId.includes(q) || title.includes(q);
  });

  const handleReview = async (id, status) => {
    try {
      setActionLoading(id);
      await api.put(`/expenses/${id}/review`, {
        status,
        reviewNote: reviewNote.trim() || null,
      });
      setSuccess(`Expense ${status} successfully`);
      setReviewModal(null);
      setReviewNote('');
      await fetchExpenses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${status} expense`);
      await fetchExpenses();
      setReviewModal(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      setActionLoading(id);
      await api.put(`/expenses/${id}/paid`, {
        paidOn: new Date().toISOString().split('T')[0],
      });
      setSuccess('Expense marked as paid');
      await fetchExpenses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const openReviewModal = (expense, action) => {
    setReviewModal({ expense, action });
    setReviewNote('');
  };

  const handleFileUpload = async (files) => {
    const newFiles = Array.from(files);
    if (attachments.length + newFiles.length > 10) {
      setError('Maximum 10 files allowed per claim');
      return;
    }
    setUploadingFiles(true);
    const uploaded = [];
    for (const file of newFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'expense');
        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push({
          name: file.name,
          url: res.data.driveUrl,
          driveFileId: res.data.driveFileId,
        });
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err.response?.data?.message || err.message}`);
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploadingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!form.userId) {
      setError('Please select an employee');
      return;
    }
    // Validate all line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.title.trim()) { setError(`Item ${i + 1}: Title is required`); return; }
      if (!item.amount || parseFloat(item.amount) <= 0) { setError(`Item ${i + 1}: Amount must be positive`); return; }
      if (!item.date) { setError(`Item ${i + 1}: Date is required`); return; }
    }

    const totalAmount = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const firstItem = lineItems[0];

    try {
      setSubmitting(true);
      await api.post('/expenses/admin-create', {
        userId: parseInt(form.userId),
        title: lineItems.length === 1 ? firstItem.title : `${firstItem.title} (+${lineItems.length - 1} more)`,
        category: firstItem.category,
        amount: totalAmount,
        date: firstItem.date,
        description: firstItem.description || null,
        items: JSON.stringify(lineItems.map(({ id, ...rest }) => ({ ...rest, amount: parseFloat(rest.amount) || 0 }))),
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
      });
      setSuccess('Expense claim created successfully');
      setShowForm(false);
      resetForm();
      await fetchExpenses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create expense claim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top-level tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
        {[{ key: 'claims', label: '💳 Expense Claims' }, { key: 'fund-requests', label: '💰 Fund Requests' }, { key: 'ledger', label: '📊 Ledger' }].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${mainTab === t.key ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'fund-requests' ? (
        <React.Suspense fallback={<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>}>
          <AdminFundRequests />
        </React.Suspense>
      ) : mainTab === 'ledger' ? (
        <React.Suspense fallback={<div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" /></div>}>
          <FundLedger />
        </React.Suspense>
      ) : (
      <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 rounded-xl">
            <Receipt className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Expense Claims</h1>
            <p className="text-sm text-slate-500">Review and manage employee expense submissions</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Expense Claim
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mb-1">
            <Clock className="w-3.5 h-3.5" />
            Pending Review
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-blue-500 text-xs font-medium mb-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved This Month
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.approvedThisMonth}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-500 text-xs font-medium mb-1">
            <Wallet className="w-3.5 h-3.5" />
            Total Paid
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.totalPaid}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-violet-500 text-xs font-medium mb-1">
            <IndianRupee className="w-3.5 h-3.5" />
            Total Amount
          </div>
          <p className="text-2xl font-bold text-violet-600">{formatCurrency(stats.totalAmount)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee name, ID, or title..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white appearance-none min-w-[150px]"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent min-w-[160px]"
            />
          </div>
          {monthFilter && (
            <button
              onClick={() => setMonthFilter('')}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear Month
            </button>
          )}
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            <span className="ml-2 text-sm text-slate-500">Loading claims...</span>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No expense claims found</p>
            <p className="text-slate-400 text-xs mt-1">
              {statusFilter || monthFilter || searchQuery
                ? 'Try adjusting your filters'
                : 'No claims have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => (
                  <React.Fragment key={expense.id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {expense.user?.name || expense.employee?.name || expense.employeeName || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {expense.user?.employeeId || expense.employee?.employeeId || expense.employeeId || ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 text-sm truncate max-w-[200px]">{expense.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_STYLES[expense.category] || CATEGORY_STYLES.other}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-800">{formatCurrency(expense.amount)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm">{formatDate(expense.date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[expense.status] || STATUS_STYLES.pending}`}>
                          {expense.status === 'pending' && <Clock className="w-3 h-3" />}
                          {expense.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                          {expense.status === 'rejected' && <XCircle className="w-3 h-3" />}
                          {expense.status === 'paid' && <Wallet className="w-3 h-3" />}
                          {expense.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {expense.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleReview(expense.id, 'approved')}
                                disabled={actionLoading === expense.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                {actionLoading === expense.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                Approve
                              </button>
                              <button
                                onClick={() => openReviewModal(expense, 'rejected')}
                                disabled={actionLoading === expense.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}
                          {expense.status === 'approved' && (
                            <button
                              onClick={() => handleMarkPaid(expense.id)}
                              disabled={actionLoading === expense.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Mark Paid"
                            >
                              {actionLoading === expense.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                              Mark Paid
                            </button>
                          )}
                          {(expense.status === 'rejected' || expense.status === 'paid') && (
                            <button
                              onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedId === expense.id && (
                      <tr>
                        <td colSpan={7} className="px-4 py-4 bg-slate-50">
                          <div className="space-y-4 text-sm">
                            {/* Line items breakdown */}
                            {expense.items && (() => {
                              try {
                                const items = JSON.parse(expense.items);
                                if (Array.isArray(items) && items.length > 0) {
                                  return (
                                    <div>
                                      <p className="text-xs text-slate-500 font-medium mb-2">Expense Items ({items.length})</p>
                                      <div className="space-y-1.5">
                                        {items.map((it, i) => (
                                          <div key={i} className="flex items-start gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 ${CATEGORY_STYLES[it.category] || CATEGORY_STYLES.other}`}>
                                              {it.category}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-slate-800 truncate">{it.title}</p>
                                              {it.description && <p className="text-xs text-slate-500 mt-0.5">{it.description}</p>}
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                              <p className="font-semibold text-slate-800">{formatCurrency(it.amount)}</p>
                                              <p className="text-xs text-slate-400">{formatDate(it.date)}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                              } catch { /* ignore parse errors */ }
                              return null;
                            })()}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Description</p>
                                <p className="text-slate-700">{expense.description || 'No description provided'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Attachments</p>
                                {expense.attachments && (() => {
                                  try {
                                    const files = JSON.parse(expense.attachments);
                                    if (Array.isArray(files) && files.length > 0) {
                                      return (
                                        <div className="flex flex-wrap gap-1.5">
                                          {files.map((f, i) => (
                                            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors max-w-[160px]">
                                              <FileText className="w-3 h-3 flex-shrink-0" />
                                              <span className="truncate">{f.name}</span>
                                            </a>
                                          ))}
                                        </div>
                                      );
                                    }
                                  } catch { /* ignore */ }
                                  return null;
                                })()}
                                {expense.receiptUrl && !expense.attachments && (
                                  <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline text-sm">
                                    View Receipt
                                  </a>
                                )}
                                {!expense.attachments && !expense.receiptUrl && (
                                  <p className="text-slate-400">No attachments</p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 font-medium mb-1">Review Note</p>
                                <p className="text-slate-700">{expense.reviewNote || 'No review note'}</p>
                                {expense.paidOn && (
                                  <p className="text-xs text-green-600 font-medium mt-1">Paid on {formatDate(expense.paidOn)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredExpenses.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Showing {filteredExpenses.length} of {expenses.length} claims
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReviewModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {reviewModal.action === 'approved' ? (
                  <><CheckCircle className="w-5 h-5 text-green-500" /> Approve Expense</>
                ) : (
                  <><XCircle className="w-5 h-5 text-red-500" /> Reject Expense</>
                )}
              </h3>
              <button onClick={() => setReviewModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{reviewModal.expense.title}</span>
                <span className="text-sm font-bold text-slate-800">{formatCurrency(reviewModal.expense.amount)}</span>
              </div>
              <p className="text-xs text-slate-500">
                {reviewModal.expense.user?.name || reviewModal.expense.employee?.name || reviewModal.expense.employeeName} - {formatDate(reviewModal.expense.date)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Review Note {reviewModal.action === 'rejected' && <span className="text-red-400">*</span>}
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewModal.action === 'approved' ? 'Optional note for approval...' : 'Reason for rejection...'}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setReviewModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => handleReview(reviewModal.expense.id, reviewModal.action)}
                disabled={actionLoading === reviewModal.expense.id || (reviewModal.action === 'rejected' && !reviewNote.trim())}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  reviewModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading === reviewModal.expense.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {reviewModal.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Expense Claim Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-violet-500" />
                  New Expense Claim
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Submit an expense claim on behalf of an employee</p>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="new-expense-form" onSubmit={handleCreateExpense} className="space-y-5">

                {/* Employee Select */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employee <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.userId}
                    onChange={(e) => setForm({ ...form, userId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''} {emp.department ? `- ${emp.department}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expense Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700">
                      Expense Items <span className="text-red-400">*</span>
                    </label>
                    <span className="text-xs text-slate-400">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, idx) => (
                      <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3 relative">
                        {/* Item number badge */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
                            Item {idx + 1}
                          </span>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Title */}
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => setLineItems((prev) => prev.map((it, i) => i === idx ? { ...it, title: e.target.value } : it))}
                          placeholder="Item title (e.g., Taxi fare to client)"
                          required
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />

                        {/* Category + Amount + Date */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <select
                              value={item.category}
                              onChange={(e) => setLineItems((prev) => prev.map((it, i) => i === idx ? { ...it, category: e.target.value } : it))}
                              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => setLineItems((prev) => prev.map((it, i) => i === idx ? { ...it, amount: e.target.value } : it))}
                              placeholder="Amount"
                              min="0.01"
                              step="0.01"
                              required
                              className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => setLineItems((prev) => prev.map((it, i) => i === idx ? { ...it, date: e.target.value } : it))}
                              required
                              className="w-full px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                          </div>
                        </div>

                        {/* Description */}
                        <textarea
                          value={item.description}
                          onChange={(e) => setLineItems((prev) => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                          placeholder="Optional description..."
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Add item + Total row */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={() => setLineItems((prev) => [...prev, makeEmptyItem()])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                    <div className="text-sm font-semibold text-slate-800">
                      Total: <span className="text-violet-700">
                        {formatCurrency(lineItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-slate-400" />
                      Upload Invoices / Receipts
                      <span className="text-slate-400 font-normal">(optional, max 10 files)</span>
                    </span>
                  </label>

                  {/* Upload area */}
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-violet-400 hover:bg-violet-50/30 transition-colors cursor-pointer"
                    onClick={() => !uploadingFiles && attachments.length < 10 && fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!uploadingFiles && attachments.length < 10) handleFileUpload(e.dataTransfer.files);
                    }}
                  >
                    {uploadingFiles ? (
                      <div className="flex items-center justify-center gap-2 text-violet-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </div>
                    ) : attachments.length >= 10 ? (
                      <p className="text-xs text-slate-400">Maximum 10 files reached</p>
                    ) : (
                      <div className="text-sm text-slate-500">
                        <Paperclip className="w-5 h-5 mx-auto mb-1 text-slate-400" />
                        <span>Click or drag files here</span>
                        <span className="block text-xs text-slate-400 mt-0.5">PDF, JPG, PNG, WebP up to 3 MB each</span>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                  </div>

                  {/* Uploaded file chips */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg max-w-[200px]">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-violet-600 hover:underline" title={file.name}>
                            {file.name}
                          </a>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </form>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50 rounded-b-xl">
              <div className="text-sm text-slate-500">
                {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} · Total:{' '}
                <span className="font-semibold text-slate-700">
                  {formatCurrency(lineItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0))}
                </span>
                {attachments.length > 0 && (
                  <span className="ml-2 text-slate-400">· {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="new-expense-form"
                  disabled={submitting || uploadingFiles}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Claim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
