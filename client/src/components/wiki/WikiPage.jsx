import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  Pin,
  Search,
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  User,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'travel', label: 'Travel' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'food', label: 'Food' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'office_info', label: 'Office Info' },
  { value: 'general', label: 'General' },
];

const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.value !== 'all');

const LOCATIONS = [
  { value: '', label: 'All Locations' },
  { value: 'Miraroad', label: 'Miraroad' },
  { value: 'Lucknow', label: 'Lucknow' },
];

const CATEGORY_STYLES = {
  travel: { badge: 'bg-sky-100 text-sky-700', border: 'border-l-sky-500' },
  contacts: { badge: 'bg-violet-100 text-violet-700', border: 'border-l-violet-500' },
  food: { badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-500' },
  emergency: { badge: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
  office_info: { badge: 'bg-teal-100 text-teal-700', border: 'border-l-teal-500' },
  general: { badge: 'bg-slate-100 text-slate-600', border: 'border-l-slate-400' },
};

const INITIAL_FORM = {
  title: '',
  content: '',
  category: 'general',
  location: 'Miraroad',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Article Card
// ---------------------------------------------------------------------------

function ArticleCard({ article, isAdmin, currentUserId, onEdit, onDelete, onTogglePin }) {
  const [expanded, setExpanded] = useState(false);
  const style = CATEGORY_STYLES[article.category] || CATEGORY_STYLES.general;
  const categoryLabel =
    CATEGORY_OPTIONS.find((c) => c.value === article.category)?.label || article.category;
  const contentIsLong = article.content && article.content.length > 200;

  // Simple markdown-ish rendering: preserve line breaks
  const renderContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${style.border} transition-shadow hover:shadow-sm ${
        article.isPinned ? 'ring-1 ring-amber-200' : ''
      }`}
    >
      {/* Header */}
      <div
        className="px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {article.isPinned && (
              <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{article.title}</h3>
            <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${style.badge}`}>
              {categoryLabel}
            </span>
            {article.location && (
              <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-400 flex-shrink-0">
                <MapPin className="w-2.5 h-2.5" />
                {article.location}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(article); }}
              className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePin(article); }}
                className={`p-1 rounded transition-colors ${article.isPinned ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                title={article.isPinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Preview when collapsed — single line */}
        {!expanded && (
          <p className="mt-1 text-xs text-gray-500 line-clamp-1">{article.content}</p>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {renderContent(article.content)}
          </div>

          {/* Footer */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-[11px] text-gray-400">
            {article.lastEditedBy && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                Last edited by{' '}
                <span className="text-gray-600 font-medium">
                  {article.lastEditedBy.name || article.lastEditedBy.email || 'Unknown'}
                </span>
              </span>
            )}
            {article.author && !article.lastEditedBy && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                Created by{' '}
                <span className="text-gray-600 font-medium">
                  {article.author.name || article.author.email || 'Unknown'}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(article.updatedAt || article.createdAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Form Modal
// ---------------------------------------------------------------------------

function ArticleFormModal({ initial, onSubmit, onClose, loading }) {
  const [form, setForm] = useState(initial || INITIAL_FORM);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(initial || INITIAL_FORM);
  }, [initial]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!form.content.trim()) {
      setError('Content is required.');
      return;
    }
    setError('');
    onSubmit(form);
  };

  const isEdit = !!(initial && initial.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {isEdit ? (
              <Edit3 className="w-5 h-5 text-blue-600" />
            ) : (
              <Plus className="w-5 h-5 text-blue-600" />
            )}
            {isEdit ? 'Edit Article' : 'New Article'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Article title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              maxLength={200}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Write your article content here... (line breaks will be preserved)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-y"
              rows={8}
            />
            <p className="mt-1 text-xs text-gray-400">
              Line breaks will be preserved. Use blank lines to separate paragraphs.
            </p>
          </div>

          {/* Category + Location row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="Miraroad">Miraroad</option>
                <option value="Lucknow">Lucknow</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim() || !form.content.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : isEdit ? 'Update Article' : 'Create Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function WikiPage() {
  const { user, isAdmin } = useAuth();

  // Data
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLocation, setActiveLocation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeCategory && activeCategory !== 'all') {
        params.category = activeCategory;
      }
      if (activeLocation) {
        params.location = activeLocation;
      }
      const res = await api.get('/wiki', { params });
      const data = Array.isArray(res.data) ? res.data : res.data.articles || [];
      setArticles(data);
    } catch (err) {
      console.error('Failed to fetch wiki articles:', err);
      addToast('Failed to load articles', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeLocation, addToast]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // -----------------------------------------------------------------------
  // Filtered + sorted articles
  // -----------------------------------------------------------------------

  const filteredArticles = articles.filter((article) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (article.title && article.title.toLowerCase().includes(q)) ||
      (article.content && article.content.toLowerCase().includes(q))
    );
  });

  // Pinned articles first, then by most recently updated
  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  const handleCreate = async (formData) => {
    try {
      setSubmitting(true);
      await api.post('/wiki', {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        location: formData.location,
      });
      setShowModal(false);
      setEditingArticle(null);
      addToast('Article created successfully');
      fetchArticles();
    } catch (err) {
      console.error('Failed to create article:', err);
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to create article', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (formData) => {
    if (!editingArticle) return;
    try {
      setSubmitting(true);
      await api.put(`/wiki/${editingArticle.id}`, {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        location: formData.location,
      });
      setShowModal(false);
      setEditingArticle(null);
      addToast('Article updated successfully');
      fetchArticles();
    } catch (err) {
      console.error('Failed to update article:', err);
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to update article', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (formData) => {
    if (editingArticle) {
      handleUpdate(formData);
    } else {
      handleCreate(formData);
    }
  };

  const handleEdit = (article) => {
    setEditingArticle(article);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    try {
      await api.delete(`/wiki/${id}`);
      addToast('Article deleted');
      fetchArticles();
    } catch (err) {
      console.error('Failed to delete article:', err);
      addToast('Failed to delete article', 'error');
    }
  };

  const handleTogglePin = async (article) => {
    try {
      await api.put(`/wiki/${article.id}`, {
        title: article.title,
        content: article.content,
        category: article.category,
        location: article.location,
        isPinned: !article.isPinned,
      });
      addToast(article.isPinned ? 'Article unpinned' : 'Article pinned');
      fetchArticles();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      addToast('Failed to update article', 'error');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingArticle(null);
  };

  // -----------------------------------------------------------------------
  // Prepare edit form initial values
  // -----------------------------------------------------------------------

  const formInitial = editingArticle
    ? {
        id: editingArticle.id,
        title: editingArticle.title || '',
        content: editingArticle.content || '',
        category: editingArticle.category || 'general',
        location: editingArticle.location || 'Miraroad',
      }
    : INITIAL_FORM;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toast Stack */}
      <div className="fixed top-4 right-4 z-[60] space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 rounded-xl">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
            <p className="text-xs text-gray-500">Travel, contacts, food & more</p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingArticle(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Search + Location Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Location filter */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={activeLocation}
            onChange={(e) => setActiveLocation(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white appearance-none min-w-[160px]"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 min-w-max">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Articles List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border-l-4 border-l-gray-200 p-5"
            >
              <div className="animate-pulse space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 bg-gray-200 rounded w-16" />
                  <div className="h-5 bg-gray-200 rounded w-20" />
                </div>
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sortedArticles.length > 0 ? (
        <div className="space-y-2">
          {sortedArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              isAdmin={isAdmin}
              currentUserId={user?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {searchQuery ? 'No articles found' : 'No articles yet'}
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'Be the first to contribute! Create an article to share useful information with your team.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                setEditingArticle(null);
                setShowModal(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Article
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      {!loading && sortedArticles.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Showing {sortedArticles.length} article{sortedArticles.length !== 1 ? 's' : ''}
            {activeCategory !== 'all' &&
              ` in ${CATEGORIES.find((c) => c.value === activeCategory)?.label || activeCategory}`}
            {activeLocation && ` at ${activeLocation}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <ArticleFormModal
          initial={formInitial}
          onSubmit={handleSubmit}
          onClose={handleCloseModal}
          loading={submitting}
        />
      )}
    </div>
  );
}
