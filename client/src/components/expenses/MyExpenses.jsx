import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Receipt,
  Plus,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  Wallet,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Upload,
  FileText,
  Image,
  Trash2,
  Sparkles,
  Check,
  ExternalLink,
} from 'lucide-react';
import api from '../../utils/api';

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'food', label: 'Food & Meals' },
  { value: 'medical', label: 'Medical' },
  { value: 'office', label: 'Office Supplies' },
  { value: 'other', label: 'Other' },
];

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected', 'paid'];

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-blue-100 text-blue-700 border-blue-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
};

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

export default function MyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'travel',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    receiptUrl: '',
  });

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/expenses/my');
      setExpenses(res.data.expenses || res.data || []);
    } catch (err) {
      setError('Failed to load expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const stats = {
    total: expenses.length,
    pending: expenses.filter((e) => e.status === 'pending').length,
    approved: expenses.filter((e) => e.status === 'approved').length,
    paid: expenses
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + (e.amount || 0), 0),
  };

  const filteredExpenses =
    activeTab === 'all'
      ? expenses
      : expenses.filter((e) => e.status === activeTab);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || !form.date) {
      setError('Please fill in title, amount, and date');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.post('/expenses', {
        title: form.title.trim(),
        category: form.category,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description.trim(),
        receiptUrl: form.receiptUrl.trim() || null,
      });
      setSuccess('Expense submitted successfully!');
      setForm({
        title: '',
        category: 'travel',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        receiptUrl: '',
      });
      setShowForm(false);
      fetchExpenses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit expense');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 rounded-xl">
            <Receipt className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Expenses</h1>
            <p className="text-sm text-slate-500">Submit and track your expense claims</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium shadow-sm"
        >
          {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Close Form' : 'New Expense'}
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
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Receipt className="w-3.5 h-3.5" />
            Total Submitted
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-amber-500 text-xs font-medium mb-1">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-blue-500 text-xs font-medium mb-1">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-500 text-xs font-medium mb-1">
            <Wallet className="w-3.5 h-3.5" />
            Amount Paid
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</p>
        </div>
      </div>

      {/* Submit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-500" />
            Submit New Expense
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g., Client meeting cab fare"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (₹) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    placeholder="0"
                    min="1"
                    step="0.01"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Brief description of the expense..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Receipt Upload + AI Extraction */}
            <ReceiptUploader
              onExtracted={(extracted, driveUrl) => {
                if (driveUrl) setForm(prev => ({ ...prev, receiptUrl: driveUrl }));
                if (extracted) {
                  setForm(prev => ({
                    ...prev,
                    title: extracted.vendor && !prev.title ? `${extracted.vendor} - ${extracted.description || 'Expense'}` : prev.title,
                    amount: extracted.amount && !prev.amount ? String(extracted.amount) : prev.amount,
                    date: extracted.date || prev.date,
                    category: extracted.category || prev.category,
                    description: extracted.description && !prev.description ? extracted.description : prev.description,
                  }));
                }
              }}
              receiptUrl={form.receiptUrl}
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                {submitting ? 'Submitting...' : 'Submit Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 ml-2 mr-1 flex-shrink-0" />
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab}
              {tab !== 'all' && (
                <span className="ml-1.5 text-xs">
                  ({expenses.filter((e) => e.status === tab).length})
                </span>
              )}
              {tab === 'all' && (
                <span className="ml-1.5 text-xs">({expenses.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Expense List */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              <span className="ml-2 text-sm text-slate-500">Loading expenses...</span>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                {activeTab === 'all'
                  ? 'No expenses submitted yet'
                  : `No ${activeTab} expenses`}
              </p>
              {activeTab === 'all' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  Submit your first expense
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <ExpenseCard key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Receipt Upload + AI Extraction Component ──────────────────────────
function ReceiptUploader({ onExtracted, receiptUrl }) {
  const [files, setFiles] = useState([]); // { file, preview, status, extracted, driveUrl, error }
  const [isDragging, setIsDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_SIZE = 3 * 1024 * 1024; // 3 MB
  const MAX_FILES = 3;

  const addFiles = useCallback((newFiles) => {
    const incoming = Array.from(newFiles).slice(0, MAX_FILES);
    const valid = [];
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        alert(`"${f.name}" is not supported. Use JPEG, PNG, WebP, or PDF.`);
        continue;
      }
      if (f.size > MAX_SIZE) {
        alert(`"${f.name}" is too large. Maximum 3 MB per file.`);
        continue;
      }
      valid.push({
        file: f,
        preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
        status: 'ready', // ready | extracting | done | error
        extracted: null,
        driveUrl: null,
        error: null,
      });
    }
    setFiles(prev => [...prev, ...valid].slice(0, MAX_FILES));
  }, []);

  const removeFile = useCallback((idx) => {
    setFiles(prev => {
      const updated = [...prev];
      if (updated[idx]?.preview) URL.revokeObjectURL(updated[idx].preview);
      updated.splice(idx, 1);
      return updated;
    });
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  // Extract all receipts at once
  const handleExtract = useCallback(async () => {
    if (files.length === 0) return;
    setExtracting(true);

    // Mark all as extracting
    setFiles(prev => prev.map(f => ({ ...f, status: 'extracting' })));

    try {
      const formData = new FormData();
      files.forEach(f => formData.append('receipts', f.file));

      const res = await api.post('/files/extract-receipts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const results = res.data; // array of { fileName, extracted, error, driveFile }
      setFiles(prev => prev.map((f, i) => {
        const result = results[i];
        if (!result) return { ...f, status: 'error', error: 'No result returned' };
        return {
          ...f,
          status: result.error ? 'error' : 'done',
          extracted: result.extracted || null,
          driveUrl: result.driveFile?.driveUrl || null,
          error: result.error || null,
        };
      }));

      // Auto-apply first successful extraction to form
      const firstSuccess = results.find(r => r.extracted && !r.error);
      if (firstSuccess) {
        onExtracted(firstSuccess.extracted, firstSuccess.driveFile?.driveUrl || null);
      }
    } catch (err) {
      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'error',
        error: err.response?.data?.message || 'Extraction failed',
      })));
    } finally {
      setExtracting(false);
    }
  }, [files, onExtracted]);

  // Apply a specific extraction result to the form
  const applyToForm = useCallback((idx) => {
    const f = files[idx];
    if (f?.extracted) onExtracted(f.extracted, f.driveUrl);
  }, [files, onExtracted]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Receipt / Invoice (optional)
      </label>

      {/* Drop zone */}
      {files.length < MAX_FILES && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-violet-500 bg-violet-50'
              : 'border-slate-300 hover:border-violet-400 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-sm text-slate-600 font-medium">
            Drop receipt images or PDFs here
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Up to {MAX_FILES} files, max 3 MB each — JPEG, PNG, WebP, PDF
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {/* Thumbnail */}
              <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
                {f.preview ? (
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-5 h-5 text-red-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{f.file.name}</p>
                <p className="text-xs text-slate-400">
                  {(f.file.size / 1024).toFixed(0)} KB
                  {f.status === 'extracting' && (
                    <span className="ml-2 text-violet-600 font-medium">
                      <Loader2 className="w-3 h-3 inline animate-spin mr-1" />Scanning...
                    </span>
                  )}
                  {f.status === 'done' && (
                    <span className="ml-2 text-green-600 font-medium">
                      <Check className="w-3 h-3 inline mr-0.5" />Extracted
                    </span>
                  )}
                  {f.status === 'error' && (
                    <span className="ml-2 text-red-500 font-medium">
                      <AlertTriangle className="w-3 h-3 inline mr-0.5" />{f.error}
                    </span>
                  )}
                </p>

                {/* Extracted data preview */}
                {f.extracted && (
                  <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {f.extracted.vendor && (
                        <div><span className="text-slate-400">Vendor:</span> <span className="text-slate-700 font-medium">{f.extracted.vendor}</span></div>
                      )}
                      {f.extracted.amount && (
                        <div><span className="text-slate-400">Amount:</span> <span className="text-slate-700 font-medium">₹{f.extracted.amount}</span></div>
                      )}
                      {f.extracted.date && (
                        <div><span className="text-slate-400">Date:</span> <span className="text-slate-700 font-medium">{f.extracted.date}</span></div>
                      )}
                      {f.extracted.category && (
                        <div><span className="text-slate-400">Category:</span> <span className="text-slate-700 font-medium capitalize">{f.extracted.category}</span></div>
                      )}
                    </div>
                    {f.extracted.description && (
                      <p className="text-slate-500 truncate">{f.extracted.description}</p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); applyToForm(idx); }}
                      className="mt-1 text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Apply to expense form
                    </button>
                  </div>
                )}

                {/* Drive link */}
                {f.driveUrl && (
                  <a
                    href={f.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View in Drive
                  </a>
                )}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Extract button */}
          {files.some(f => f.status === 'ready') && (
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {extracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {extracting ? 'Scanning receipts...' : `Scan & Extract (${files.filter(f => f.status === 'ready').length} file${files.filter(f => f.status === 'ready').length !== 1 ? 's' : ''})`}
            </button>
          )}
        </div>
      )}

      {/* Show current receipt URL if set (from extraction or manual) */}
      {receiptUrl && (
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Receipt attached</span>
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="w-3 h-3" />View
          </a>
        </div>
      )}
    </div>
  );
}

function ExpenseCard({ expense }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800 truncate">
              {expense.title}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                CATEGORY_STYLES[expense.category] || CATEGORY_STYLES.other
              }`}
            >
              {expense.category}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(expense.date)}
            </span>
            {expense.createdAt && (
              <span>Submitted {formatDate(expense.createdAt)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-base font-bold text-slate-800">
            {formatCurrency(expense.amount)}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              STATUS_STYLES[expense.status] || STATUS_STYLES.pending
            }`}
          >
            {expense.status === 'pending' && <Clock className="w-3 h-3" />}
            {expense.status === 'approved' && <CheckCircle className="w-3 h-3" />}
            {expense.status === 'rejected' && <XCircle className="w-3 h-3" />}
            {expense.status === 'paid' && <Wallet className="w-3 h-3" />}
            <span className="capitalize">{expense.status}</span>
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {expense.description && (
            <p className="text-sm text-slate-600">{expense.description}</p>
          )}
          {expense.receiptUrl && (
            <p className="text-sm">
              <span className="text-slate-500">Receipt: </span>
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View Receipt
              </a>
            </p>
          )}
          {expense.reviewNote && (
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 font-medium mb-0.5">Review Note</p>
              <p className="text-sm text-slate-700">{expense.reviewNote}</p>
            </div>
          )}
          {expense.paidOn && (
            <p className="text-xs text-green-600 font-medium">
              Paid on {formatDate(expense.paidOn)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
