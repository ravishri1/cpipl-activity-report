import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  X,
  Send,
  MessageSquare,
  User,
  ChevronDown,
  Loader2,
  Eye,
  RotateCcw,
  Lock,
  ArrowRight,
  BarChart3,
  Timer,
  Inbox,
  Settings,
} from 'lucide-react';

// --- Constants ---

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'IT', label: 'IT' },
  { value: 'HR', label: 'HR' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Facilities', label: 'Facilities' },
  { value: 'Other', label: 'Other' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
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
    yellow: 'bg-yellow-50 text-yellow-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-50 text-slate-600',
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

// --- Detail Panel ---

function TicketDetailPanel({ ticket, onClose, onUpdate, users }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [assigneeId, setAssigneeId] = useState(ticket.assignedToId || '');
  const [resolution, setResolution] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      setLoadingComments(true);
      const res = await api.get(`/api/tickets/${ticket.id}/comments`);
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
      setSubmittingComment(true);
      await api.post(`/api/tickets/${ticket.id}/comment`, {
        content: newComment.trim(),
        isInternal,
      });
      setNewComment('');
      setIsInternal(false);
      fetchComments();
    } catch {
      // handled silently
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAssign = async () => {
    if (!assigneeId) return;
    try {
      setActionLoading(true);
      await api.put(`/api/tickets/${ticket.id}/assign`, {
        assignedToId: parseInt(assigneeId),
      });
      onUpdate();
    } catch {
      // handled by parent
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setActionLoading(true);
      const body = { status: newStatus };
      if (newStatus === 'resolved' && resolution.trim()) {
        body.resolution = resolution.trim();
      }
      await api.put(`/api/tickets/${ticket.id}/status`, body);
      setShowResolve(false);
      setResolution('');
      onUpdate();
    } catch {
      // handled by parent
    } finally {
      setActionLoading(false);
    }
  };

  const adminUsers = (users || []).filter(
    (u) => u.role === 'admin' || u.role === 'team_lead'
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Ticket #{ticket.id}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                STATUS_STYLES[ticket.status] || STATUS_STYLES.open
              }`}
            >
              {STATUS_LABELS[ticket.status] || ticket.status}
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
          {/* Ticket Info */}
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {ticket.subject}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Requester</p>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {ticket.requester?.name || ticket.requesterName || 'Unknown'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Category</p>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  CATEGORY_STYLES[ticket.category] || CATEGORY_STYLES.Other
                }`}
              >
                {ticket.category}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Priority</p>
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.low
                }`}
              >
                {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1)}
              </span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Created</p>
              <p className="text-sm font-medium text-slate-700">
                {formatDateTime(ticket.createdAt)}
              </p>
            </div>
          </div>

          {/* Assign Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Assignment</h4>
            <div className="flex items-center gap-2">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Unassigned</option>
                {adminUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'admin' ? 'Admin' : 'Team Lead'})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!assigneeId || actionLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Assign
              </button>
            </div>
          </div>

          {/* Status Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Actions</h4>
            <div className="flex flex-wrap gap-2">
              {ticket.status === 'open' && (
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Mark In Progress
                </button>
              )}
              {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                <button
                  onClick={() => setShowResolve(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Resolve
                </button>
              )}
              {ticket.status !== 'closed' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Close
                </button>
              )}
              {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                <button
                  onClick={() => handleStatusChange('open')}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reopen
                </button>
              )}
            </div>

            {/* Resolve with resolution */}
            {showResolve && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Resolution details (optional)..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange('resolved')}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    Confirm Resolve
                  </button>
                  <button
                    onClick={() => {
                      setShowResolve(false);
                      setResolution('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comment Thread */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Comments ({comments.length})
            </h4>

            {loadingComments ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No comments yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg p-3 text-sm ${
                      c.isInternal
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-slate-50 border border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">
                          {c.author?.name || c.authorName || 'Unknown'}
                        </span>
                        {c.isInternal && (
                          <span className="px-1.5 py-0.5 bg-yellow-200 text-yellow-800 text-[10px] font-semibold rounded uppercase flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-600 whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment */}
            <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-slate-100">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-yellow-600 focus:ring-yellow-500"
                  />
                  <Lock className="w-3.5 h-3.5 text-yellow-600" />
                  Internal Note (not visible to employee)
                </label>
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {submittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function TicketManager() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    resolvedThisMonth: 0,
    avgResolutionTime: '0h',
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
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
      const res = await api.get('/api/tickets/admin/stats');
      const data = res.data;
      setStats({
        open: data.open ?? 0,
        inProgress: data.inProgress ?? data.in_progress ?? 0,
        resolvedThisMonth: data.resolvedThisMonth ?? 0,
        avgResolutionTime: data.avgResolutionTime ?? '0h',
      });
    } catch {
      // stats may not be available
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/api/tickets/admin/all${query}`);
      setTickets(res.data.tickets || res.data || []);
    } catch (err) {
      addToast('Failed to load tickets', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, addToast]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.users || res.data || []);
    } catch {
      // users list optional
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchStats();
    fetchUsers();
  }, [fetchTickets, fetchStats, fetchUsers]);

  const handleTicketUpdate = () => {
    fetchTickets();
    fetchStats();
    addToast('Ticket updated successfully');
    // Re-select the updated ticket
    if (selectedTicket) {
      setTimeout(async () => {
        try {
          const params = new URLSearchParams();
          if (statusFilter) params.append('status', statusFilter);
          if (categoryFilter) params.append('category', categoryFilter);
          if (priorityFilter) params.append('priority', priorityFilter);
          const query = params.toString() ? `?${params.toString()}` : '';
          const res = await api.get(`/api/tickets/admin/all${query}`);
          const all = res.data.tickets || res.data || [];
          const updated = all.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
          else setSelectedTicket(null);
        } catch {
          setSelectedTicket(null);
        }
      }, 300);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const subject = (t.subject || '').toLowerCase();
    const requester = (t.requester?.name || t.requesterName || '').toLowerCase();
    return subject.includes(q) || requester.includes(q);
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
            <Ticket className="w-7 h-7 text-blue-600" />
            Helpdesk Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and resolve employee support tickets
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Inbox}
          label="Open Tickets"
          value={stats.open}
          color="yellow"
        />
        <StatCard
          icon={Clock}
          label="In Progress"
          value={stats.inProgress}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Resolved This Month"
          value={stats.resolvedThisMonth}
          color="green"
        />
        <StatCard
          icon={Timer}
          label="Avg Resolution Time"
          value={stats.avgResolutionTime}
          color="slate"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject or requester..."
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
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-slate-500 text-sm">Loading tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Ticket className="w-10 h-10 mb-2" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {/* Actions */}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-slate-500">
                      {ticket.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800 line-clamp-1 max-w-[200px]">
                        {ticket.subject}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {ticket.requester?.name || ticket.requesterName || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          CATEGORY_STYLES[ticket.category] || CATEGORY_STYLES.Other
                        }`}
                      >
                        {ticket.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.low
                        }`}
                      >
                        {ticket.priority?.charAt(0).toUpperCase() +
                          ticket.priority?.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_STYLES[ticket.status] || STATUS_STYLES.open
                        }`}
                      >
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {ticket.assignedTo?.name || ticket.assignedToName || (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDate(ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTicket(ticket);
                        }}
                        className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Result count */}
        {!loading && filteredTickets.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
          users={users}
        />
      )}
    </div>
  );
}
