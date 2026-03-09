import React, { useState, useEffect, useCallback } from 'react';
import {
  UserMinus, UserX, Clock, CheckCircle, XCircle, AlertTriangle,
  IndianRupee, Calendar, FileText, MessageSquare, Plus, Search,
  ChevronDown, Loader2, X, ArrowRight, Eye, Edit3,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import WorkspacePendingAlerts from './WorkspacePendingAlerts';

const formatCurrency = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '\u20B90';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_CONFIG = {
  resignation: { label: 'Resignation', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  termination: { label: 'Termination', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  absconding: { label: 'Absconding', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  retirement: { label: 'Retirement', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

const STATUS_CONFIG = {
  initiated: { label: 'Initiated', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: Clock },
  notice_period: { label: 'Notice Period', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Clock },
  fnf_pending: { label: 'FnF Pending', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: IndianRupee },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
};

const STATUS_STEPS = ['initiated', 'notice_period', 'fnf_pending', 'completed'];

const TypeBadge = ({ type }) => {
  const c = TYPE_CONFIG[type] || TYPE_CONFIG.resignation;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.initiated;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <Icon size={12} /> {c.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  </div>
);

const StatusStepper = ({ currentStatus }) => {
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);
  const isCancelled = currentStatus === 'cancelled';
  return (
    <div className="flex items-center gap-1 w-full">
      {STATUS_STEPS.map((step, idx) => {
        const cfg = STATUS_CONFIG[step];
        const isCompleted = !isCancelled && idx < currentIdx;
        const isCurrent = !isCancelled && idx === currentIdx;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isCompleted ? 'bg-green-500 border-green-500 text-white'
                  : isCurrent ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
              }`}>
                {isCompleted ? <CheckCircle size={16} /> : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? 'font-semibold text-blue-700' : 'text-slate-500'}`}>
                {cfg.label}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mt-[-16px] ${isCompleted ? 'bg-green-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
      {isCancelled && (
        <div className="flex flex-col items-center ml-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 border-2 border-red-500 text-white">
            <XCircle size={16} />
          </div>
          <span className="text-[10px] mt-1 font-semibold text-red-700">Cancelled</span>
        </div>
      )}
    </div>
  );
};

export default function SeparationManager() {
  const { user: currentUser } = useAuth();
  const [separations, setSeparations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [selectedSeparation, setSelectedSeparation] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [confirmationsDue, setConfirmationsDue] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const [initiateForm, setInitiateForm] = useState({
    userId: '', type: 'resignation',
    requestDate: new Date().toISOString().split('T')[0],
    lastWorkingDate: '', noticePeriodDays: 30, reason: '',
  });

  const [detailEdits, setDetailEdits] = useState({
    exitInterviewDone: false, exitInterviewNotes: '',
    fnfAmount: '', fnfPaidDate: '', status: '',
  });

  const fetchSeparations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/lifecycle/separations');
      setSeparations(Array.isArray(res.data) ? res.data : res.data.separations || []);
    } catch (err) {
      console.error('Failed to fetch separations:', err);
      setSeparations([]);
    } finally { setLoading(false); }
  }, []);

  const fetchActiveUsers = useCallback(async () => {
    try {
      const res = await api.get('/users?isActive=true');
      setActiveUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error('Failed to fetch active users:', err); }
  }, []);

  const fetchConfirmationsDue = useCallback(async () => {
    try {
      const res = await api.get('/lifecycle/confirmations-due');
      setConfirmationsDue(Array.isArray(res.data) ? res.data : res.data.employees || []);
    } catch (err) {
      console.error('Failed to fetch confirmations due:', err);
      setConfirmationsDue([]);
    }
  }, []);

  useEffect(() => {
    fetchSeparations();
    fetchConfirmationsDue();
  }, [fetchSeparations, fetchConfirmationsDue]);

  const stats = {
    active: separations.filter((s) => s.status !== 'completed' && s.status !== 'cancelled').length,
    noticePeriod: separations.filter((s) => s.status === 'notice_period').length,
    fnfPending: separations.filter((s) => s.status === 'fnf_pending').length,
    completedThisMonth: separations.filter((s) => {
      if (s.status !== 'completed') return false;
      const now = new Date();
      const updated = new Date(s.updatedAt || s.completedAt);
      return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
    }).length,
  };

  const filteredSeparations = separations.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery
      || (s.user?.name || '').toLowerCase().includes(q)
      || (s.user?.employeeId || '').toLowerCase().includes(q)
      || (s.user?.department || '').toLowerCase().includes(q);
    return matchesSearch && (statusFilter === 'all' || s.status === statusFilter);
  });

  const handleOpenInitiate = () => {
    fetchActiveUsers();
    setInitiateForm({
      userId: '', type: 'resignation',
      requestDate: new Date().toISOString().split('T')[0],
      lastWorkingDate: '', noticePeriodDays: 30, reason: '',
    });
    setError('');
    setShowInitiateModal(true);
  };

  const handleInitiateSubmit = async (e) => {
    e.preventDefault();
    if (!initiateForm.userId) { setError('Please select an employee.'); return; }
    if (!initiateForm.lastWorkingDate) { setError('Please set the last working date.'); return; }
    try {
      setSaving(true); setError('');
      await api.post('/lifecycle/separation', {
        userId: parseInt(initiateForm.userId),
        type: initiateForm.type,
        requestDate: initiateForm.requestDate,
        lastWorkingDate: initiateForm.lastWorkingDate,
        noticePeriodDays: parseInt(initiateForm.noticePeriodDays) || 30,
        reason: initiateForm.reason,
      });
      setShowInitiateModal(false);
      fetchSeparations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate separation.');
    } finally { setSaving(false); }
  };

  const openDetail = async (sep) => {
    try {
      const res = await api.get(`/lifecycle/separation/${sep.id}`);
      const data = res.data;
      setSelectedSeparation(data);
      setDetailEdits({
        exitInterviewDone: data.exitInterviewDone || false,
        exitInterviewNotes: data.exitInterviewNotes || '',
        fnfAmount: data.fnfAmount || '',
        fnfPaidDate: data.fnfPaidOn ? data.fnfPaidOn.split('T')[0] : '',
        status: data.status,
      });
      setShowDetailPanel(true);
      setError('');
    } catch (err) { console.error('Failed to fetch separation detail:', err); }
  };

  const handleDetailSave = async () => {
    if (!selectedSeparation) return;
    try {
      setSaving(true); setError('');
      await api.put(`/lifecycle/separation/${selectedSeparation.id}`, {
        exitInterviewDone: detailEdits.exitInterviewDone,
        exitInterviewNotes: detailEdits.exitInterviewNotes,
        fnfAmount: detailEdits.fnfAmount ? parseFloat(detailEdits.fnfAmount) : null,
        fnfPaidOn: detailEdits.fnfPaidDate || null,
        status: detailEdits.status,
      });
      fetchSeparations();
      const refreshed = await api.get(`/lifecycle/separation/${selectedSeparation.id}`);
      setSelectedSeparation(refreshed.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update separation.');
    } finally { setSaving(false); }
  };

  const handleStatusAdvance = async (newStatus) => {
    if (!selectedSeparation) return;
    try {
      setSaving(true);
      await api.put(`/lifecycle/separation/${selectedSeparation.id}`, { status: newStatus });
      setDetailEdits((prev) => ({ ...prev, status: newStatus }));
      fetchSeparations();
      const refreshed = await api.get(`/lifecycle/separation/${selectedSeparation.id}`);
      setSelectedSeparation(refreshed.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status.');
    } finally { setSaving(false); }
  };

  const handleCancelSeparation = async (id) => {
    try {
      setSaving(true);
      await api.put(`/lifecycle/separation/${id}`, { status: 'cancelled' });
      setCancelConfirmId(null);
      fetchSeparations();
      if (selectedSeparation?.id === id) {
        const refreshed = await api.get(`/lifecycle/separation/${id}`);
        setSelectedSeparation(refreshed.data);
        setDetailEdits((prev) => ({ ...prev, status: 'cancelled' }));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to cancel separation.');
    } finally { setSaving(false); }
  };

  const getNextStatus = (current) => {
    const idx = STATUS_STEPS.indexOf(current);
    return idx >= 0 && idx < STATUS_STEPS.length - 1 ? STATUS_STEPS[idx + 1] : null;
  };

  // Auto-compute lastWorkingDate from requestDate + noticePeriodDays
  useEffect(() => {
    if (initiateForm.requestDate && initiateForm.noticePeriodDays) {
      const req = new Date(initiateForm.requestDate);
      req.setDate(req.getDate() + (parseInt(initiateForm.noticePeriodDays) || 30));
      setInitiateForm((prev) => ({ ...prev, lastWorkingDate: req.toISOString().split('T')[0] }));
    }
  }, [initiateForm.requestDate, initiateForm.noticePeriodDays]);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Separation Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee exits, notice periods, and full & final settlements</p>
        </div>
        <button onClick={handleOpenInitiate}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm">
          <Plus size={16} /> Initiate Separation
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserMinus} label="Active Separations" value={stats.active} color="bg-blue-500" />
        <StatCard icon={Clock} label="In Notice Period" value={stats.noticePeriod} color="bg-yellow-500" />
        <StatCard icon={IndianRupee} label="FnF Pending" value={stats.fnfPending} color="bg-orange-500" />
        <StatCard icon={CheckCircle} label="Completed This Month" value={stats.completedThisMonth} color="bg-green-500" />
      </div>

      {/* Google Workspace pending suspension alerts */}
      <div className="px-0 pt-4">
        <WorkspacePendingAlerts />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, or department..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Separations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Separations</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="ml-2 text-slate-500 text-sm">Loading separations...</span>
          </div>
        ) : filteredSeparations.length === 0 ? (
          <div className="text-center py-16">
            <UserMinus size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No separations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-16 z-10">
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Request Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Last Working Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Exit Interview</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSeparations.map((sep) => (
                  <tr key={sep.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{sep.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">
                        {sep.user?.employeeId || '\u2014'}
                        {sep.user?.department ? ` \u00B7 ${sep.user.department}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3"><TypeBadge type={sep.type} /></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(sep.requestDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(sep.lastWorkingDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={sep.status} /></td>
                    <td className="px-4 py-3 text-center">
                      {sep.exitInterviewDone
                        ? <CheckCircle size={18} className="inline text-green-500" />
                        : <Clock size={18} className="inline text-slate-400" />}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(sep)} title="View Details"
                          className="p-1.5 rounded-md hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors">
                          <Eye size={16} />
                        </button>
                        {sep.status !== 'completed' && sep.status !== 'cancelled' && (
                          <button onClick={() => openDetail(sep)} title="Edit"
                            className="p-1.5 rounded-md hover:bg-amber-50 text-slate-500 hover:text-amber-600 transition-colors">
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmations Due */}
      {confirmationsDue.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-800">Confirmations Due</h2>
              <span className="ml-auto text-xs font-medium bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                {confirmationsDue.length}
              </span>
            </div>
            <p className="text-xs text-amber-600 mt-1">Employees nearing end of probation period</p>
          </div>
          <div className="divide-y divide-slate-100">
            {confirmationsDue.map((emp, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-800">{emp.name || emp.user?.name}</p>
                  <p className="text-xs text-slate-500">
                    {emp.employeeId || emp.user?.employeeId || '\u2014'}
                    {(emp.department || emp.user?.department) ? ` \u00B7 ${emp.department || emp.user?.department}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-700">Probation ends: {formatDate(emp.probationEndDate || emp.confirmationDueDate)}</p>
                  {emp.daysRemaining != null && (
                    <p className={`text-xs font-medium ${emp.daysRemaining <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                      {emp.daysRemaining} days remaining
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Initiate Separation Modal */}
      {showInitiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserMinus size={20} className="text-red-600" />
                <h3 className="text-lg font-semibold text-slate-800">Initiate Separation</h3>
              </div>
              <button onClick={() => setShowInitiateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleInitiateSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}
              {/* Employee */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                <div className="relative">
                  <select value={initiateForm.userId}
                    onChange={(e) => setInitiateForm((p) => ({ ...p, userId: e.target.value }))}
                    className="w-full appearance-none border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-8"
                    required>
                    <option value="">Select employee...</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.employeeId ? `(${u.employeeId})` : ''} {u.department ? `\u2014 ${u.department}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Separation Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <label key={key} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-colors text-sm ${
                      initiateForm.type === key
                        ? `${cfg.border} ${cfg.bg} ${cfg.text} font-medium`
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}>
                      <input type="radio" name="separationType" value={key}
                        checked={initiateForm.type === key}
                        onChange={(e) => setInitiateForm((p) => ({ ...p, type: e.target.value }))}
                        className="sr-only" />
                      {cfg.label}
                    </label>
                  ))}
                </div>
              </div>
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Request Date *</label>
                  <input type="date" value={initiateForm.requestDate}
                    onChange={(e) => setInitiateForm((p) => ({ ...p, requestDate: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notice Period (days)</label>
                  <input type="number" value={initiateForm.noticePeriodDays} min="0" max="180"
                    onChange={(e) => setInitiateForm((p) => ({ ...p, noticePeriodDays: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Working Date *</label>
                <input type="date" value={initiateForm.lastWorkingDate}
                  onChange={(e) => setInitiateForm((p) => ({ ...p, lastWorkingDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required />
              </div>
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea value={initiateForm.reason}
                  onChange={(e) => setInitiateForm((p) => ({ ...p, reason: e.target.value }))}
                  rows={3} placeholder="Reason for separation..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInitiateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                  Initiate Separation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Separation Detail Panel (slide-in from right) */}
      {showDetailPanel && selectedSeparation && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="bg-white w-full max-w-2xl shadow-2xl h-full overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Separation Details</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{selectedSeparation.user?.name || 'Employee'}</p>
                </div>
                <button onClick={() => { setShowDetailPanel(false); setSelectedSeparation(null); setError(''); }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}
              {/* Employee Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Name</p>
                    <p className="font-medium text-slate-800">{selectedSeparation.user?.name || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Employee ID</p>
                    <p className="font-medium text-slate-800">{selectedSeparation.user?.employeeId || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Department</p>
                    <p className="font-medium text-slate-800">{selectedSeparation.user?.department || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium text-slate-800">{selectedSeparation.user?.email || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Separation Type</p>
                    <TypeBadge type={selectedSeparation.type} />
                  </div>
                  <div>
                    <p className="text-slate-500">Request Date</p>
                    <p className="font-medium text-slate-800">{formatDate(selectedSeparation.requestDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Last Working Date</p>
                    <p className="font-medium text-slate-800">{formatDate(selectedSeparation.lastWorkingDate)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Notice Period</p>
                    <p className="font-medium text-slate-800">{selectedSeparation.noticePeriodDays ?? 30} days</p>
                  </div>
                </div>
                {selectedSeparation.reason && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <p className="text-slate-500 text-sm">Reason</p>
                    <p className="text-sm text-slate-700 mt-1">{selectedSeparation.reason}</p>
                  </div>
                )}
              </div>

              {/* Status Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <FileText size={16} /> Status Timeline
                </h4>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <StatusStepper currentStatus={selectedSeparation.status} />
                </div>
                {selectedSeparation.status !== 'completed' && selectedSeparation.status !== 'cancelled' && (() => {
                  const next = getNextStatus(selectedSeparation.status);
                  if (!next) return null;
                  return (
                    <div className="mt-3">
                      <button onClick={() => handleStatusAdvance(next)} disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        Move to {STATUS_CONFIG[next].label}
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Exit Interview */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} /> Exit Interview
                </h4>
                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`relative w-10 h-5 rounded-full transition-colors ${detailEdits.exitInterviewDone ? 'bg-green-500' : 'bg-slate-300'}`}
                      onClick={() => setDetailEdits((p) => ({ ...p, exitInterviewDone: !p.exitInterviewDone }))}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        detailEdits.exitInterviewDone ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm text-slate-700">
                      {detailEdits.exitInterviewDone ? 'Interview Completed' : 'Interview Pending'}
                    </span>
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Interview Notes</label>
                    <textarea value={detailEdits.exitInterviewNotes}
                      onChange={(e) => setDetailEdits((p) => ({ ...p, exitInterviewNotes: e.target.value }))}
                      rows={3} placeholder="Notes from exit interview..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                </div>
              </div>

              {/* Full & Final Settlement */}
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <IndianRupee size={16} /> Full & Final Settlement
                </h4>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">FnF Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{'\u20B9'}</span>
                        <input type="number" value={detailEdits.fnfAmount} min="0" step="any" placeholder="0"
                          onChange={(e) => setDetailEdits((p) => ({ ...p, fnfAmount: e.target.value }))}
                          className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      {detailEdits.fnfAmount && (
                        <p className="text-xs text-slate-500 mt-1">{formatCurrency(detailEdits.fnfAmount)}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Paid Date</label>
                      <input type="date" value={detailEdits.fnfPaidDate}
                        onChange={(e) => setDetailEdits((p) => ({ ...p, fnfPaidDate: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  {selectedSeparation.status !== 'completed' && selectedSeparation.status !== 'cancelled' && (
                    cancelConfirmId === selectedSeparation.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-600 font-medium">Cancel this separation?</span>
                        <button onClick={() => handleCancelSeparation(selectedSeparation.id)} disabled={saving}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                          Yes, Cancel
                        </button>
                        <button onClick={() => setCancelConfirmId(null)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200">
                          No
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setCancelConfirmId(selectedSeparation.id)}
                        className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-sm font-medium transition-colors">
                        <XCircle size={16} /> Cancel Separation
                      </button>
                    )
                  )}
                </div>
                <button onClick={handleDetailSave} disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
