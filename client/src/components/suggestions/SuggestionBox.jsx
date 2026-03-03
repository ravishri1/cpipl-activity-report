import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  MessageSquarePlus,
  Send,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  MessageSquare,
  Clock,
  Eye,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// --- Constants ---

const CATEGORIES = [
  { value: 'general', label: 'General', icon: MessageSquare, color: 'bg-slate-100 text-slate-700' },
  { value: 'improvement', label: 'Improvement', icon: Lightbulb, color: 'bg-amber-100 text-amber-700' },
  { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  { value: 'appreciation', label: 'Appreciation', icon: ThumbsUp, color: 'bg-green-100 text-green-700' },
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

// --- Main Component ---

export default function SuggestionBox() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Form state
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/suggestions/my');
      setSuggestions(res.data.suggestions || res.data || []);
    } catch (err) {
      addToast('Failed to load suggestions', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      addToast('Please enter your suggestion', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await api.post('/suggestions', {
        content: content.trim(),
        category,
      });
      setContent('');
      setCategory('general');
      fetchSuggestions();
      addToast('Suggestion submitted anonymously');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to submit suggestion', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryInfo = (val) => {
    return CATEGORIES.find((c) => c.value === val) || CATEGORIES[0];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Toast Stack */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MessageSquarePlus className="w-7 h-7 text-blue-600" />
          Suggestion Box
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Share your thoughts, ideas, and feedback anonymously
        </p>
      </div>

      {/* Submit Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Anonymous Notice */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Anonymous Submission</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Your name and identity are completely hidden. No one will be able to see who you are. Feel free to share openly.
              </p>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const selected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      selected
                        ? `${cat.color} ring-2 ring-offset-1 ring-blue-400 border-transparent`
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Your Suggestion
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your idea, feedback, or concern..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows={5}
              maxLength={2000}
            />
            <div className="flex justify-end mt-1">
              <span className="text-xs text-slate-400">{content.length}/2000</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Anonymously
            </button>
          </div>
        </form>
      </div>

      {/* My Suggestions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-500" />
          My Submissions
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-slate-500 text-sm">Loading suggestions...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-slate-400">
            <MessageSquarePlus className="w-12 h-12 mb-3" />
            <p className="text-base font-medium mb-1">No suggestions yet</p>
            <p className="text-sm">Use the form above to submit your first suggestion.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const catInfo = getCategoryInfo(suggestion.category);
              const CatIcon = catInfo.icon;
              const isExpanded = expandedId === suggestion.id;

              return (
                <div
                  key={suggestion.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Card Header */}
                  <div
                    className="px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}
                          >
                            <CatIcon className="w-3 h-3" />
                            {catInfo.label}
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
                              Admin Replied
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">
                          {suggestion.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">
                          {formatDate(suggestion.createdAt)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      {/* Full Content */}
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-sm text-slate-600 whitespace-pre-wrap">
                          {suggestion.content}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          Submitted {formatDateTime(suggestion.createdAt)}
                        </p>
                      </div>

                      {/* Admin Reply */}
                      {suggestion.adminReply && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-700">
                              Admin Response
                            </span>
                            {suggestion.repliedAt && (
                              <span className="text-xs text-blue-400 ml-auto">
                                {formatDateTime(suggestion.repliedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {suggestion.adminReply}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
