import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  UserPlus,
  ClipboardList,
  CheckCircle2,
  Circle,
  FileText,
  Monitor,
  Users,
  GraduationCap,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Calendar,
  AlertCircle,
} from 'lucide-react';

const CATEGORIES = ['Documents', 'IT Setup', 'HR Formalities', 'Training'];

const CATEGORY_CONFIG = {
  Documents: { color: 'blue', icon: FileText, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  'IT Setup': { color: 'purple', icon: Monitor, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  'HR Formalities': { color: 'green', icon: Users, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
  Training: { color: 'orange', icon: GraduationCap, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
};

function ProgressBar({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{completed} of {total} tasks</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate, completed) {
  if (completed || !dueDate) return false;
  return new Date(dueDate) < new Date();
}

export default function OnboardingManager() {
  const { user: currentUser } = useAuth();

  // Data state
  const [newJoinees, setNewJoinees] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ task: '', category: 'Documents', dueDate: '', assignedTo: '' });
  const [addingTask, setAddingTask] = useState(false);
  const [togglingTask, setTogglingTask] = useState(null);
  const [creatingDefault, setCreatingDefault] = useState(false);
  const [error, setError] = useState('');

  // Fetch new joinees and all users on mount
  useEffect(() => {
    fetchNewJoinees();
    fetchUsers();
  }, []);

  const fetchNewJoinees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lifecycle/new-joinees');
      setNewJoinees(res.data);
    } catch (err) {
      console.error('Failed to fetch new joinees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchChecklist = async (userId) => {
    try {
      setChecklistLoading(true);
      setError('');
      const res = await api.get(`/lifecycle/onboarding/${userId}`);
      setChecklist(Array.isArray(res.data) ? res.data : res.data.tasks || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setChecklist([]);
      } else {
        console.error('Failed to fetch checklist:', err);
        setError('Failed to load onboarding checklist.');
      }
    } finally {
      setChecklistLoading(false);
    }
  };

  const selectUser = (user) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    setShowUserDropdown(false);
    setSearchQuery('');
    setShowAddTask(false);
    setExpandedCategories({ Documents: true, 'IT Setup': true, 'HR Formalities': true, Training: true });
    fetchChecklist(user.id);
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      setTogglingTask(taskId);
      await api.put(`/lifecycle/onboarding/task/${taskId}`, { completed: !currentStatus });
      await fetchChecklist(selectedUserId);
      // Refresh joinees to update progress
      fetchNewJoinees();
    } catch (err) {
      console.error('Failed to toggle task:', err);
      setError('Failed to update task.');
    } finally {
      setTogglingTask(null);
    }
  };

  const handleCreateDefault = async () => {
    if (!selectedUserId) return;
    try {
      setCreatingDefault(true);
      setError('');
      await api.post(`/lifecycle/onboarding/${selectedUserId}/from-template`);
      await fetchChecklist(selectedUserId);
      fetchNewJoinees();
    } catch (err) {
      console.error('Failed to create default checklist:', err);
      setError(err.response?.data?.error || 'Failed to create default checklist.');
    } finally {
      setCreatingDefault(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskForm.task.trim()) return;
    try {
      setAddingTask(true);
      setError('');
      await api.post(`/lifecycle/onboarding/${selectedUserId}`, {
        tasks: [{
          task: taskForm.task.trim(),
          category: taskForm.category,
          dueDate: taskForm.dueDate || null,
          assignedTo: taskForm.assignedTo || null,
        }],
      });
      setTaskForm({ task: '', category: 'Documents', dueDate: '', assignedTo: '' });
      setShowAddTask(false);
      await fetchChecklist(selectedUserId);
      fetchNewJoinees();
    } catch (err) {
      console.error('Failed to add task:', err);
      setError(err.response?.data?.error || 'Failed to add task.');
    } finally {
      setAddingTask(false);
    }
  };

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Group checklist by category
  const groupedTasks = useMemo(() => {
    const groups = {};
    CATEGORIES.forEach((cat) => { groups[cat] = []; });
    checklist.forEach((task) => {
      const cat = CATEGORIES.includes(task.category) ? task.category : 'HR Formalities';
      groups[cat].push(task);
    });
    return groups;
  }, [checklist]);

  // Summary stats
  const stats = useMemo(() => {
    const total = newJoinees.length;
    const completionRates = newJoinees.map((j) => {
      const t = j.totalTasks || j.onboardingTotal || 0;
      const c = j.completedTasks || j.onboardingCompleted || 0;
      return t > 0 ? (c / t) * 100 : 0;
    });
    const avgCompletion = total > 0 ? Math.round(completionRates.reduce((a, b) => a + b, 0) / total) : 0;
    const fullyOnboarded = completionRates.filter((r) => r === 100).length;
    return { total, avgCompletion, fullyOnboarded };
  }, [newJoinees]);

  // Filter users for dropdown
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return allUsers.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [allUsers, searchQuery]);

  const completedCount = checklist.filter((t) => t.completed || t.completedAt).length;
  const totalCount = checklist.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-indigo-600" />
            Onboarding Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage employee onboarding checklists</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              <p className="text-xs text-slate-500">New Joinees This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.avgCompletion}%</p>
              <p className="text-xs text-slate-500">Avg. Completion Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stats.fullyOnboarded}</p>
              <p className="text-xs text-slate-500">Fully Onboarded</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Joinees Overview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            Recent Joinees (Last 30 Days)
          </h2>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading new joinees...</div>
          ) : newJoinees.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No new joinees in the last 30 days</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {newJoinees.map((joinee) => {
                const t = joinee.totalTasks || joinee.onboardingTotal || 0;
                const c = joinee.completedTasks || joinee.onboardingCompleted || 0;
                const isSelected = selectedUserId === joinee.id || selectedUserId === joinee.userId;
                const uid = joinee.userId || joinee.id;
                return (
                  <div
                    key={uid}
                    onClick={() => {
                      const userObj = allUsers.find((u) => u.id === uid) || {
                        id: uid,
                        name: joinee.name,
                        email: joinee.email,
                        department: joinee.department,
                        designation: joinee.designation,
                      };
                      selectUser(userObj);
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50 shadow-md'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-800">{joinee.name}</p>
                        <p className="text-xs text-slate-500">{joinee.designation || 'Employee'}</p>
                      </div>
                      {c === t && t > 0 && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          Complete
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                      {joinee.department && (
                        <span className="bg-slate-200 px-2 py-0.5 rounded">{joinee.department}</span>
                      )}
                      {joinee.joiningDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(joinee.joiningDate)}
                        </span>
                      )}
                    </div>
                    {t > 0 ? (
                      <ProgressBar completed={c} total={t} />
                    ) : (
                      <p className="text-xs text-slate-400 italic">No checklist created</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Employee Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-500" />
          Select Employee
        </h2>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowUserDropdown(true);
              }}
              onFocus={() => setShowUserDropdown(true)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
          </div>
          {showUserDropdown && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-3 text-sm text-slate-400 text-center">No employees found</div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => selectUser(u)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center justify-between transition-colors ${
                      selectedUserId === u.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    {u.department && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {u.department}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        {/* Click outside to close dropdown */}
        {showUserDropdown && (
          <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
        )}
      </div>

      {/* Checklist View */}
      {selectedUser && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Selected Employee Header */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {selectedUser.name}'s Onboarding Checklist
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedUser.email}
                  {selectedUser.department ? ` - ${selectedUser.department}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {checklist.length === 0 && (
                  <button
                    onClick={handleCreateDefault}
                    disabled={creatingDefault}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <ClipboardList className="w-4 h-4" />
                    {creatingDefault ? 'Creating...' : 'Create Default Checklist'}
                  </button>
                )}
                <button
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>

            {/* Progress summary */}
            {totalCount > 0 && (
              <div className="mt-4">
                <ProgressBar completed={completedCount} total={totalCount} />
              </div>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mx-5 mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Add Task Form */}
          {showAddTask && (
            <div className="mx-5 mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <form onSubmit={handleAddTask} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Task Name *</label>
                    <input
                      type="text"
                      value={taskForm.task}
                      onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                      placeholder="e.g. Submit PAN card copy"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select
                      value={taskForm.category}
                      onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Assigned To</label>
                    <input
                      type="text"
                      value={taskForm.assignedTo}
                      onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      placeholder="e.g. HR Team"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={addingTask}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {addingTask ? 'Adding...' : 'Add Task'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTask(false);
                      setTaskForm({ task: '', category: 'Documents', dueDate: '', assignedTo: '' });
                    }}
                    className="text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Checklist by category */}
          <div className="p-5">
            {checklistLoading ? (
              <div className="text-center py-8 text-slate-400">Loading checklist...</div>
            ) : checklist.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-1">No onboarding checklist found for this employee.</p>
                <p className="text-xs">Click "Create Default Checklist" to generate one, or add tasks manually.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {CATEGORIES.map((category) => {
                  const tasks = groupedTasks[category];
                  if (!tasks || tasks.length === 0) return null;
                  const config = CATEGORY_CONFIG[category];
                  const CategoryIcon = config.icon;
                  const isExpanded = expandedCategories[category] !== false;
                  const catCompleted = tasks.filter((t) => t.completed || t.completedAt).length;

                  return (
                    <div key={category} className={`border ${config.border} rounded-lg overflow-hidden`}>
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${config.bg} hover:opacity-90 transition-opacity`}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className={`w-4 h-4 ${config.text}`} />
                          ) : (
                            <ChevronRight className={`w-4 h-4 ${config.text}`} />
                          )}
                          <CategoryIcon className={`w-5 h-5 ${config.text}`} />
                          <span className={`font-semibold text-sm ${config.text}`}>{category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${config.badge}`}>
                            {catCompleted}/{tasks.length}
                          </span>
                        </div>
                        <div className="w-24">
                          <div className="w-full bg-white/60 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${config.bar} transition-all duration-300`}
                              style={{ width: `${tasks.length > 0 ? (catCompleted / tasks.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </button>

                      {/* Tasks */}
                      {isExpanded && (
                        <div className="divide-y divide-slate-100">
                          {tasks.map((task) => {
                            const isDone = task.completed || !!task.completedAt;
                            const overdue = isOverdue(task.dueDate, isDone);
                            return (
                              <div
                                key={task.id}
                                className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                                  isDone ? 'bg-slate-50/50' : ''
                                }`}
                              >
                                {/* Checkbox */}
                                <button
                                  onClick={() => handleToggleTask(task.id, isDone)}
                                  disabled={togglingTask === task.id}
                                  className="flex-shrink-0 disabled:opacity-50"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  ) : (
                                    <Circle className={`w-5 h-5 ${overdue ? 'text-red-400' : 'text-slate-300'} hover:text-indigo-400 transition-colors`} />
                                  )}
                                </button>

                                {/* Task details */}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                    {task.task || task.name}
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {task.assignedTo && (
                                      <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {task.assignedTo}
                                      </span>
                                    )}
                                    {task.dueDate && (
                                      <span className={`text-xs flex items-center gap-1 ${
                                        overdue ? 'text-red-500 font-medium' : 'text-slate-400'
                                      }`}>
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(task.dueDate)}
                                        {overdue && (
                                          <AlertCircle className="w-3 h-3 text-red-500" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Status badge */}
                                <div className="flex-shrink-0">
                                  {isDone ? (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                      Done
                                    </span>
                                  ) : overdue ? (
                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                                      Overdue
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
