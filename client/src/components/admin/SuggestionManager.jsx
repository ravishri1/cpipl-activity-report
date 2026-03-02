import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquarePlus,
  Search,
  Filter,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
  MessageSquare,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Eye,
  Trash2,
  BarChart3,
  Inbox,
  Clock,
  Star,
  Zap,
  User,
  Building2,
  ChevronDown,
  ChevronUp,
  Tag,
} from 'lucide-react';

// --- Constants ---

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'implemented', label: 'Implemented' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'appreciation', label: 'Appreciation' },
];

const STATUS_STYLES = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  reviewed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  acknowledged: 'bg-green-100 text-green-700 border-green-200',
  implemented: 'bg-purple-100 text-purple-700 border-purple-200',
};

const STATUS_LABELS = {
  new: 'New',
  reviewed: 'Reviewed',
  acknowledged: 'Acknowledged',
  implemented: 'Implemented',
};

const CATEGORY_STYLES = {
  general: 'bg-slate-100 text-slate-700',
  improvement: 'bg-amber-100 text-amber-700',
  complaint: 'bg-red-100 text-red-700',
  appreciation: 'bg-green-100 text-green-700',
};

const CATEGORY_ICONS = {
  general: MessageSquare,
  improvement: Lightbulb,
  complaint: AlertTriangle,
  appreciation: ThumbsUp,
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// --- Toast Component ---

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span>{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-80">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// --- Stat Card ---

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colorMap[color] || colorMap.slate}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

// --- Reply Panel ---

function ReplyPanel({ suggestion, onClose, onUpdate, addToast }) {
  const [adminReply, setAdminReply] = useState(suggestion.adminReply || '');
  const [status, setStatus] = useState(suggestion.status || 'reviewed');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!adminReply.trim()) {
      addToast('Please enter a reply', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await api.put(`/suggestions/${suggestion.id}/reply`, {
        adminReply: adminReply.trim(),
        status,
      });
      addToast('Reply sent successfully');
      onUpdate();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send reply', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const CatIcon = CATEGORY_ICONS[suggestion.category] || MessageSquare;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquarePlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Suggestion #{suggestion.id}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                STATUS_STYLES[suggestion.status] || STATUS_STYLES.new
              }`}
            >
              {STATUS_LABELS[suggestion.status] || suggestion.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Submitter Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Submitted By</p>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {suggestion.submitter?.name || suggestion.submitterName || 'Unknown'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Department</p>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {suggestion.submitter?.department || suggestion.department || 'N/A'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Category</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  CATEGORY_STYLES[suggestion.category] || CATEGORY_STYLES.general
                }`}
              >
                <CatIcon className="w-3 h-3" />
                {suggestion.category?.charAt(0).toUpperCase() + suggestion.category?.slice(1)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Submitted</p>
              <p className="text-sm font-medium text-slate-700">
                {formatDateTime(suggestion.createdAt)}
              </p>
            </div>
          </div>

          {/* Suggestion Content */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Suggestion</h4>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {suggestion.content}
            </p>
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSubmitReply} className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Send className="w-4 h-4" />
              Admin Reply
            </h4>

            {/* Status Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Update Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      status === opt.value
                        ? `${STATUS_STYLES[opt.value]} ring-2 ring-offset-1 ring-blue-400 border-transparent`
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reply Text */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Response Message
              </label>
              <textarea
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="Write your response to this suggestion..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                rows={5}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!adminReply.trim() || submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Reply
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function SuggestionManager() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    reviewed: 0,
    acknowledged: 0,
    implemented: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/suggestions/stats');
      const data = res.data;
      setStats({
        total: data.total ?? 0,
        new: data.new ?? data.byStatus?.new ?? 0,
        reviewed: data.reviewed ?? data.byStatus?.reviewed ?? 0,
        acknowledged: data.acknowledged ?? data.byStatus?.acknowledged ?? 0,
        implemented: data.implemented ?? data.byStatus?.implemented ?? 0,
      });
    } catch {
      // stats may not be available
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/suggestions${query}`);
      setSuggestions(res.data.suggestions || res.data || []);
    } catch (err) {
      addToast('Failed to load suggestions', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, addToast]);

  useEffect(() => {
    fetchSuggestions();
    fetchStats();
  }, [fetchSuggestions, fetchStats]);

  const handleSuggestionUpdate = () => {
    fetchSuggestions();
    fetchStats();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this suggestion?')) return;
    try {
      setDeletingId(id);
      await api.delete(`/suggestions/${id}`);
      addToast('Suggestion deleted');
      fetchSuggestions();
      fetchStats();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete suggestion', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Client-side search filtering
  const filteredSuggestions = suggestions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const content = (s.content || '').toLowerCase();
    const name = (s.submitter?.name || s.submitterName || '').toLowerCase();
    const dept = (s.submitter?.department || s.department || '').toLowerCase();
    return content.includes(q) || name.includes(q) || dept.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Toast Stack */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquarePlus className="w-7 h-7 text-blue-600" />
            Suggestion Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and respond to employee suggestions
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={BarChart3}
          label="Total"
          value={stats.total}
          color="slate"
        />
        <StatCard
          icon={Inbox}
          label="New"
          value={stats.new}
          color="blue"
        />
        <StatCard
          icon={Eye}
          label="Reviewed"
          value={stats.reviewed}
          color="yellow"
        />
        <StatCard
          icon={CheckCircle}
          label="Acknowledged"
          value={stats.acknowledged}
          color="green"
        />
        <StatCard
          icon={Zap}
          label="Implemented"
          value={stats.implemented}
          color="purple"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by content, submitter, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-4 h-4" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-slate-500 text-sm">Loading suggestions...</span>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <MessageSquarePlus className="w-10 h-10 mb-2" />
            <p className="text-sm">No suggestions found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredSuggestions.map((suggestion) => {
              const CatIcon = CATEGORY_ICONS[suggestion.category] || MessageSquare;

              return (
                <div
                  key={suggestion.id}
                  className="px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Content Area */}
                    <div className="flex-1 min-w-0">
                      {/* Badges Row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">
                          #{suggestion.id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            CATEGORY_STYLES[suggestion.category] || CATEGORY_STYLES.general
                          }`}
                        >
                          <CatIcon className="w-3 h-3" />
                          {suggestion.category?.charAt(0).toUpperCase() +
                            suggestion.category?.slice(1)}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_STYLES[suggestion.status] || STATUS_STYLES.new
                          }`}
                        >
                          {STATUS_LABELS[suggestion.status] || suggestion.status}
                        </span>
                        {suggestion.adminReply && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                            <MessageSquare className="w-3 h-3" />
                            Replied
                          </span>
                        )}
                      </div>

                      {/* Content Preview */}
                      <p className="text-sm text-slate-700 line-clamp-2 mb-2">
                        {suggestion.content}
                      </p>

                      {/* Submitter Info */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {suggestion.submitter?.name || suggestion.submitterName || 'Unknown'}
                        </span>
                        {(suggestion.submitter?.department || suggestion.department) && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {suggestion.submitter?.department || suggestion.department}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(suggestion.createdAt)}
                        </span>
                      </div>

                      {/* Existing Reply Preview */}
                      {suggestion.adminReply && (
                        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <p className="text-xs text-blue-600 line-clamp-1">
                            <span className="font-semibold">Reply:</span> {suggestion.adminReply}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setSelectedSuggestion(suggestion)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View & Reply"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(suggestion.id)}
                        disabled={deletingId === suggestion.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Result Count */}
        {!loading && filteredSuggestions.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Showing {filteredSuggestions.length} of {suggestions.length} suggestions
          </div>
        )}
      </div>

      {/* Reply Panel */}
      {selectedSuggestion && (
        <ReplyPanel
          suggestion={selectedSuggestion}
          onClose={() => setSelectedSuggestion(null)}
          onUpdate={handleSuggestionUpdate}
          addToast={addToast}
        />
      )}
    </div>
  );
}
