import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Ticket,
  Plus,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Tag,
  User,
  Calendar,
} from 'lucide-react';

// --- Constants ---

const CATEGORIES = [
  { value: 'IT', label: 'IT' },
  { value: 'HR', label: 'HR' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Facilities', label: 'Facilities' },
  { value: 'Other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_STYLES = {
  open: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_STYLES = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const CATEGORY_STYLES = {
  IT: 'bg-indigo-100 text-indigo-700',
  HR: 'bg-pink-100 text-pink-700',
  Admin: 'bg-cyan-100 text-cyan-700',
  Facilities: 'bg-amber-100 text-amber-700',
  Other: 'bg-slate-100 text-slate-600',
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

// --- Toast ---

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

// --- New Ticket Modal ---

function NewTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'IT',
    priority: 'medium',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.post('/tickets', {
        subject: form.subject.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            New Support Ticket
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject *
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="Brief summary of your issue"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your issue in detail..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Ticket Detail View ---

function TicketDetail({ ticket, onBack, onUpdate }) {
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      setLoadingComments(true);
      const res = await api.get(`/tickets/${ticket.id}/comments`);
      setComments(res.data.comments || res.data || []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`/tickets/${ticket.id}/comment`, {
        content: newComment.trim(),
        isInternal: false,
      });
      setNewComment('');
      fetchComments();
    } catch {
      // silently handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    try {
      setActionLoading(true);
      await api.put(`/tickets/${ticket.id}/status`, { status: 'open' });
      onUpdate();
    } catch {
      // handled by parent
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <ChevronDown className="w-4 h-4 rotate-90" />
        Back to My Tickets
      </button>

      {/* Ticket Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-slate-400">#{ticket.id}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                }`}
              >
                {STATUS_LABELS[ticket.status] || ticket.status}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.low
                }`}
              >
                {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  CATEGORY_STYLES[ticket.category] || CATEGORY_STYLES.Other
                }`}
              >
                {ticket.category}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-slate-800">{ticket.subject}</h2>
          </div>
          {ticket.status === 'resolved' && (
            <button
              onClick={handleReopen}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              Reopen
            </button>
          )}
        </div>

        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap mb-4">
          {ticket.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Created {formatDateTime(ticket.createdAt)}
          </span>
          {ticket.assignedTo?.name && (
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              Assigned to {ticket.assignedTo.name}
            </span>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-4">
          <MessageSquare className="w-4 h-4" />
          Comments ({comments.length})
        </h3>

        {loadingComments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No comments yet. Be the first to add one.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {comments.map((c) => (
              <div
                key={c.id}
                className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    {c.author?.name || c.authorName || 'Support'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Comment Form */}
        {ticket.status !== 'closed' && (
          <form onSubmit={handleAddComment} className="space-y-2 pt-3 border-t border-slate-100">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows={3}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function MyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets/my');
      setTickets(res.data.tickets || res.data || []);
    } catch (err) {
      addToast('Failed to load tickets', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleTicketCreated = () => {
    fetchTickets();
    addToast('Ticket submitted successfully');
  };

  const handleTicketUpdated = () => {
    fetchTickets();
    addToast('Ticket updated');
    setSelectedTicket(null);
  };

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  };

  // If a ticket is selected, show detail view
  if (selectedTicket) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Toast Stack */}
        <div className="fixed top-4 right-4 z-[60] space-y-2">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </div>
        <TicketDetail
          ticket={selectedTicket}
          onBack={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdated}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <Ticket className="w-7 h-7 text-blue-600" />
            My Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Submit and track your support requests
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Quick Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'all', label: 'All', icon: Ticket, color: 'slate' },
          { key: 'open', label: 'Open', icon: AlertCircle, color: 'yellow' },
          { key: 'in_progress', label: 'In Progress', icon: Clock, color: 'blue' },
          { key: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'green' },
          { key: 'closed', label: 'Closed', icon: X, color: 'slate' },
        ].map(({ key, label, icon: Icon, color }) => {
          const colorMap = {
            yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            slate: 'bg-slate-50 text-slate-600 border-slate-200',
          };
          return (
            <div
              key={key}
              className={`rounded-xl border p-3 text-center ${colorMap[color]}`}
            >
              <p className="text-2xl font-bold">{statusCounts[key]}</p>
              <p className="text-xs font-medium mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Ticket Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-slate-500 text-sm">Loading tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-16 text-slate-400">
          <Ticket className="w-12 h-12 mb-3" />
          <p className="text-base font-medium mb-1">No tickets yet</p>
          <p className="text-sm">Click "New Ticket" to submit your first support request.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            return (
              <div
                key={ticket.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Header */}
                <div
                  className="px-5 py-4 cursor-pointer"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-slate-400">
                          #{ticket.id}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                          }`}
                        >
                          {STATUS_LABELS[ticket.status] || ticket.status}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.low
                          }`}
                        >
                          {ticket.priority?.charAt(0).toUpperCase() +
                            ticket.priority?.slice(1)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            CATEGORY_STYLES[ticket.category] || CATEGORY_STYLES.Other
                          }`}
                        >
                          {ticket.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 truncate">
                        {ticket.subject}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                      {(ticket.commentCount > 0 || ticket._count?.comments > 0) && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {ticket.commentCount || ticket._count?.comments || 0}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatDate(ticket.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleTicketCreated}
        />
      )}
    </div>
  );
}
