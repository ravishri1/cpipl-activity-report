import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Cake,
  PartyPopper,
  Calendar,
  Users,
  AlertTriangle,
  Star,
  ChevronDown,
  X,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatBirthday(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const PRIORITY_STYLES = {
  urgent: {
    border: 'border-l-red-500',
    badge: 'bg-red-100 text-red-700',
    label: 'Urgent',
  },
  important: {
    border: 'border-l-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Important',
  },
  normal: {
    border: 'border-l-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    label: 'Normal',
  },
};

const CATEGORY_STYLES = {
  general: { badge: 'bg-slate-100 text-slate-700', label: 'General' },
  policy: { badge: 'bg-blue-100 text-blue-700', label: 'Policy' },
  event: { badge: 'bg-purple-100 text-purple-700', label: 'Event' },
};

const INITIAL_FORM = {
  title: '',
  content: '',
  category: 'general',
  priority: 'normal',
  expiryDate: '',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnnouncementCard({ announcement, isAdmin, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_STYLES[announcement.priority] || PRIORITY_STYLES.normal;
  const category = CATEGORY_STYLES[announcement.category] || CATEGORY_STYLES.general;
  const contentIsLong = announcement.content && announcement.content.length > 200;

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${priority.border} p-5 transition-shadow hover:shadow-md`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {announcement.title}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${category.badge}`}
            >
              {category.label}
            </span>
            {announcement.priority !== 'normal' && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${priority.badge}`}
              >
                {announcement.priority === 'urgent' && (
                  <AlertTriangle className="w-3 h-3" />
                )}
                {priority.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {relativeTime(announcement.createdAt)}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(announcement)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(announcement.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        <p
          className={`text-sm text-gray-700 whitespace-pre-line leading-relaxed ${
            !expanded && contentIsLong ? 'line-clamp-3' : ''
          }`}
        >
          {announcement.content}
        </p>
        {contentIsLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Footer */}
      {announcement.author && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
            {announcement.author.name
              ? announcement.author.name.charAt(0).toUpperCase()
              : 'A'}
          </div>
          <span className="text-xs text-gray-500">
            {announcement.author.name || 'Admin'}
          </span>
        </div>
      )}
    </div>
  );
}

function AnnouncementForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial || INITIAL_FORM);

  useEffect(() => {
    setForm(initial || INITIAL_FORM);
  }, [initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    onSubmit(form);
  };

  const isEdit = !!(initial && initial.id);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Announcement' : 'New Announcement'}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            placeholder="Announcement title"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content <span className="text-red-500">*</span>
          </label>
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            required
            rows={5}
            placeholder="Write your announcement here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-y"
          />
        </div>

        {/* Category + Priority row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="general">General</option>
              <option value="policy">Policy</option>
              <option value="event">Event</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              name="expiryDate"
              value={form.expiryDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !form.title.trim() || !form.content.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? 'Saving...'
              : isEdit
              ? 'Update Announcement'
              : 'Publish Announcement'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CelebrationCard({ person, type }) {
  const isBirthday = type === 'birthday';

  return (
    <div
      className={`rounded-lg p-3.5 ${
        isBirthday
          ? 'bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100'
          : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
            isBirthday ? 'bg-pink-100' : 'bg-amber-100'
          }`}
        >
          {isBirthday ? (
            <Cake className="w-5 h-5 text-pink-600" />
          ) : (
            <Star className="w-5 h-5 text-amber-600" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {person.name}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {person.department || 'Team Member'}
          </p>
          <p
            className={`text-xs font-medium mt-0.5 ${
              isBirthday ? 'text-pink-600' : 'text-amber-600'
            }`}
          >
            {isBirthday
              ? formatBirthday(person.dateOfBirth)
              : `${person.years} year${person.years !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function CelebrationsPanel({ celebrations, loading }) {
  const { birthdays = [], anniversaries = [] } = celebrations || {};
  const hasBirthdays = birthdays.length > 0;
  const hasAnniversaries = anniversaries.length > 0;
  const hasNone = !hasBirthdays && !hasAnniversaries;

  return (
    <div className="space-y-6">
      {/* Birthdays */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-pink-50 to-purple-50">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-lg">&#127874;</span>
            Birthdays This Month
          </h3>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : hasBirthdays ? (
            <div className="space-y-3">
              {birthdays.map((person) => (
                <CelebrationCard
                  key={person.id}
                  person={person}
                  type="birthday"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No birthdays this month
            </p>
          )}
        </div>
      </div>

      {/* Anniversaries */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-lg">&#127881;</span>
            Work Anniversaries
          </h3>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : hasAnniversaries ? (
            <div className="space-y-3">
              {anniversaries.map((person) => (
                <CelebrationCard
                  key={person.id}
                  person={person}
                  type="anniversary"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No work anniversaries this month
            </p>
          )}
        </div>
      </div>

      {/* Empty state when nothing at all */}
      {!loading && hasNone && (
        <div className="text-center py-6">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            No celebrations this month
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Announcements() {
  const { isAdmin } = useAuth();

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  // Celebrations state
  const [celebrations, setCelebrations] = useState({ birthdays: [], anniversaries: [] });
  const [loadingCelebrations, setLoadingCelebrations] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Error state
  const [error, setError] = useState('');

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoadingAnnouncements(true);
      const res = await api.get('/api/announcements');
      setAnnouncements(
        Array.isArray(res.data) ? res.data : res.data.announcements || []
      );
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setError('Failed to load announcements.');
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  const fetchCelebrations = useCallback(async () => {
    try {
      setLoadingCelebrations(true);
      const res = await api.get('/api/announcements/celebrations');
      setCelebrations(res.data || { birthdays: [], anniversaries: [] });
    } catch (err) {
      console.error('Failed to fetch celebrations:', err);
    } finally {
      setLoadingCelebrations(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    fetchCelebrations();
  }, [fetchAnnouncements, fetchCelebrations]);

  // -----------------------------------------------------------------------
  // CRUD handlers
  // -----------------------------------------------------------------------

  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError('');

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category,
        priority: formData.priority,
      };
      if (formData.expiryDate) {
        payload.expiryDate = formData.expiryDate;
      }

      if (editingAnnouncement) {
        await api.put(`/api/announcements/${editingAnnouncement.id}`, payload);
      } else {
        await api.post('/api/announcements', payload);
      }

      setShowForm(false);
      setEditingAnnouncement(null);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to save announcement.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this announcement?')) {
      return;
    }
    try {
      setError('');
      await api.delete(`/api/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete announcement:', err);
      setError('Failed to delete announcement.');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
  };

  // -----------------------------------------------------------------------
  // Prepare edit form initial values
  // -----------------------------------------------------------------------

  const formInitial = editingAnnouncement
    ? {
        id: editingAnnouncement.id,
        title: editingAnnouncement.title || '',
        content: editingAnnouncement.content || '',
        category: editingAnnouncement.category || 'general',
        priority: editingAnnouncement.priority || 'normal',
        expiryDate: editingAnnouncement.expiryDate
          ? editingAnnouncement.expiryDate.slice(0, 10)
          : '',
      }
    : INITIAL_FORM;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Megaphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-500">
              Stay updated with company news and celebrations
            </p>
          </div>
        </div>

        {isAdmin && !showForm && (
          <button
            onClick={() => {
              setEditingAnnouncement(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto p-0.5 hover:bg-red-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admin form */}
      {isAdmin && showForm && (
        <AnnouncementForm
          initial={formInitial}
          onSubmit={handleSubmit}
          onCancel={handleCancelForm}
          loading={submitting}
        />
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Announcements feed (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {loadingAnnouncements ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-sm border-l-4 border-l-gray-200 p-5"
                >
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                    <div className="space-y-2 pt-2">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-5/6" />
                      <div className="h-3 bg-gray-100 rounded w-4/6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : announcements.length > 0 ? (
            announcements.map((item) => (
              <AnnouncementCard
                key={item.id}
                announcement={item}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No announcements yet
              </h3>
              <p className="text-sm text-gray-500">
                {isAdmin
                  ? 'Create your first announcement to keep everyone informed.'
                  : 'Check back later for company updates and news.'}
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingAnnouncement(null);
                    setShowForm(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Announcement
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Celebrations (1/3) */}
        <div className="lg:col-span-1">
          <CelebrationsPanel
            celebrations={celebrations}
            loading={loadingCelebrations}
          />
        </div>
      </div>
    </div>
  );
}
