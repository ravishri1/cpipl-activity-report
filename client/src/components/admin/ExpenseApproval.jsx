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
  Download,
  Upload,
  FileSpreadsheet,
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
  settled_in_salary: 'bg-violet-100 text-violet-700 border-violet-200',
};

const CATEGORIES = [
  { value: 'office_expenses', label: 'Office Expenses' },
  { value: 'tea_coffee', label: 'Tea & Coffee Expenses' },
  { value: 'repair_maintenance', label: 'Repair & Maintenance' },
  { value: 'diesel_petrol', label: 'Diesel & Petrol Expenses' },
  { value: 'travel', label: 'Travel Expenses' },
  { value: 'staff_welfare', label: 'Staff Welfare Expenses' },
  { value: 'food', label: 'Food & Meals' },
  { value: 'medical', label: 'Medical' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_STYLES = {
  office_expenses: 'bg-blue-100 text-blue-700',
  tea_coffee: 'bg-amber-100 text-amber-700',
  repair_maintenance: 'bg-red-100 text-red-700',
  diesel_petrol: 'bg-emerald-100 text-emerald-700',
  travel: 'bg-purple-100 text-purple-700',
  staff_welfare: 'bg-teal-100 text-teal-700',
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
  const [settleOnSalary, setSettleOnSalary] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // New expense form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lineItems, setLineItems] = useState([makeEmptyItem()]);
  const [attachments, setAttachments] = useState([]); // [{name, url, driveFileId}]
  const [claimDescription, setClaimDescription] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const csvInputRef = useRef(null);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setLineItems([makeEmptyItem()]);
    setAttachments([]);
    setClaimDescription('');
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
        settleOnSalary: status === 'approved' ? settleOnSalary : false,
      });
      setSuccess(`Expense ${status} successfully${status === 'approved' && settleOnSalary ? ' — will be reimbursed in next payslip' : ''}`);
      setReviewModal(null);
      setReviewNote('');
      setSettleOnSalary(false);
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
        description: claimDescription.trim() || null,
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

  // ─── Bulk Actions ──────────────────────────────
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    const visibleIds = expenses.map(e => e.id);
    setSelectedIds(prev => prev.length === visibleIds.length ? [] : visibleIds);
  };
  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (!window.confirm(`${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} ${selectedIds.length} expense(s)?`)) return;
    setBulkLoading(true);
    try {
      let done = 0, fail = 0;
      for (const id of selectedIds) {
        try {
          if (bulkAction === 'approve') await api.put(`/expenses/${id}/review`, { status: 'approved' });
          else if (bulkAction === 'reject') await api.put(`/expenses/${id}/review`, { status: 'rejected' });
          else if (bulkAction === 'paid') await api.put(`/expenses/${id}/paid`);
          else if (bulkAction === 'delete') await api.delete(`/expenses/${id}`);
          done++;
        } catch { fail++; }
      }
      setSuccess(`${done} expense(s) ${bulkAction}ed${fail > 0 ? `, ${fail} failed` : ''}`);
      setSelectedIds([]);
      setBulkAction('');
      await fetchExpenses();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Bulk action failed'); }
    finally { setBulkLoading(false); }
  };

  // ─── Export CSV ─────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await api.get('/expenses/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `expenses_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
    } catch { setError('Failed to export'); }
  };

  // ─── Import CSV ─────────────────────────────────
  const handleCsvSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { setImportResult({ errors: [{ row: 0, error: 'Need header + data rows' }] }); return; }
      const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
      const fieldMap = { 'ID': 'id', 'Date': 'date', 'Employee Name': 'Employee Name', 'Employee ID': 'Employee ID',
        'Title': 'title', 'Category': 'category', 'Amount': 'amount', 'Status': 'status', 'Description': 'description' };
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
        const obj = {};
        headers.forEach((h, idx) => { const key = fieldMap[h] || h; if (vals[idx]) obj[key] = vals[idx]; });
        rows.push(obj);
      }
      setImportData(rows);
      setImportResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importData.length) return;
    setImportLoading(true);
    try {
      const res = await api.post('/expenses/bulk-import', { rows: importData });
      setImportResult(res.data);
      if (res.data.created > 0 || res.data.updated > 0) fetchExpenses();
    } catch (err) {
      setImportResult({ errors: [{ row: 0, error: err.response?.data?.error || 'Import failed' }] });
    } finally { setImportLoading(false); }
  };

  const downloadTemplate = () => {
    const csv = 'Employee Name,Employee ID,Title,Category,Amount,Date,Status,Description\nAshishkumar Ashok Tavasalkar,,Milk,tea_coffee,128,2025-11-01,approved,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob);
    a.download = 'expense_import_template.csv'; a.click();
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
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { setImportData([]); setImportResult(null); setShowImportModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 shadow-sm">
            <Upload className="w-4 h-4" /> Import / Update
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Expense Claim
          </button>
        </div>
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
          <>
          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg mb-3">
              <span className="text-sm font-medium text-violet-700">{selectedIds.length} selected</span>
              <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
                className="border border-violet-300 rounded-lg px-3 py-1.5 text-sm bg-white">
                <option value="">-- Select Action --</option>
                <option value="approve">✅ Approve All</option>
                <option value="reject">❌ Reject All</option>
                <option value="paid">💰 Mark Paid</option>
                <option value="delete">🗑️ Delete All</option>
              </select>
              <button onClick={handleBulkAction} disabled={!bulkAction || bulkLoading}
                className="px-3 py-1.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                {bulkLoading ? 'Processing...' : 'Apply'}
              </button>
              <button onClick={() => setSelectedIds([])} className="text-sm text-slate-500 hover:text-slate-700 ml-auto">Clear</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={selectedIds.length === expenses.length && expenses.length > 0}
                      onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </th>
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
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(expense.id) ? 'bg-violet-50' : ''}`}
                      onClick={() => setExpandedId(expandedId === expense.id ? null : expense.id)}
                    >
                      <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(expense.id)}
                          onChange={() => toggleSelect(expense.id)}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      </td>
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
          </>
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
          <div className="absolute inset-0 bg-black/40" onClick={() => { setReviewModal(null); setReviewNote(''); setSettleOnSalary(false); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {reviewModal.action === 'approved' ? (
                  <><CheckCircle className="w-5 h-5 text-green-500" /> Approve Expense</>
                ) : (
                  <><XCircle className="w-5 h-5 text-red-500" /> Reject Expense</>
                )}
              </h3>
              <button onClick={() => { setReviewModal(null); setReviewNote(''); setSettleOnSalary(false); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
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

            {reviewModal.action === 'approved' && (
              <label className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors">
                <input
                  type="checkbox"
                  checked={settleOnSalary}
                  onChange={(e) => setSettleOnSalary(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Settle on next salary</p>
                  <p className="text-xs text-emerald-600">Amount will be added as Reimbursement in payslip</p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setReviewModal(null); setReviewNote(''); setSettleOnSalary(false); }} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
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

      {/* Import/Update Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">📥 Import / Update Expenses</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-500">Upload CSV: rows with ID column update existing records, rows without ID create new ones.</p>
            <div className="flex items-center gap-3">
              <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                <Download className="w-3.5 h-3.5" /> Download Template
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                <Download className="w-3.5 h-3.5" /> Export Current Data
              </button>
            </div>
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
              <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 mx-auto px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 shadow-sm">
                <Upload className="w-4 h-4 text-slate-500" /> Choose CSV File
              </button>
              <p className="text-xs text-slate-400 mt-2">Max 500 rows. Rows with ID = update, without ID = create new.</p>
            </div>
            {importData.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{importData.length} rows parsed</span>
                </div>
                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0"><tr>
                      <th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Employee</th>
                      <th className="px-2 py-1 text-left">Title</th><th className="px-2 py-1 text-left">Amount</th>
                      <th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">ID</th>
                    </tr></thead>
                    <tbody>
                      {importData.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-400">{i + 1}</td>
                          <td className="px-2 py-1">{row['Employee Name'] || '-'}</td>
                          <td className="px-2 py-1">{row.title || '-'}</td>
                          <td className="px-2 py-1">₹{row.amount || '0'}</td>
                          <td className="px-2 py-1">{row.date || '-'}</td>
                          <td className="px-2 py-1 text-slate-400">{row.id || 'new'}</td>
                        </tr>
                      ))}
                      {importData.length > 20 && <tr><td colSpan={6} className="px-2 py-1 text-center text-slate-400">...and {importData.length - 20} more</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setImportData([]); setImportResult(null); }} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Clear</button>
                  <button onClick={handleImportSubmit} disabled={importLoading}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Process {importData.length} Rows
                  </button>
                </div>
              </div>
            )}
            {importResult && (
              <div className={`p-3 rounded-lg border ${importResult.errors?.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                {(importResult.created > 0 || importResult.updated > 0) && (
                  <p className="text-sm font-medium text-green-700">✅ {importResult.created > 0 ? `${importResult.created} created` : ''}{importResult.created > 0 && importResult.updated > 0 ? ', ' : ''}{importResult.updated > 0 ? `${importResult.updated} updated` : ''}</p>
                )}
                {importResult.errors?.length > 0 && (
                  <div className="mt-1"><p className="text-sm font-medium text-amber-700">⚠️ {importResult.errors.length} errors:</p>
                    <ul className="mt-1 text-xs text-amber-600 max-h-24 overflow-auto">
                      {importResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
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

                        {/* Description removed — combined description at end */}
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

                {/* Combined Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={claimDescription}
                    onChange={(e) => setClaimDescription(e.target.value)}
                    placeholder="Optional notes about these expenses..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
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
