import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { UserPlus, Edit3, UserX, UserCheck, X, Download, Building2, Globe, Moon, RefreshCw } from 'lucide-react';
import GoogleImportModal from '../google/GoogleImportModal';
import { useAuth } from '../../context/AuthContext';

export default function TeamManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'member', department: 'General', employeeType: 'internal' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setForm({ name: '', email: '', role: 'member', department: 'General', employeeType: 'internal' });
    setEditUser(null);
    setShowForm(false);
    setError('');
  };

  const isInternal = (email) => email?.endsWith('@colorpapers.in');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, form);
      } else {
        // No password needed — Google login only
        await api.post('/users', { ...form, password: 'google-auth-only' });
      }
      fetchUsers();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setEditUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, department: user.department, employeeType: user.employeeType || 'internal' });
    setShowForm(true);
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      fetchUsers();
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const reactivateUser = async (user) => {
    try {
      await api.post(`/users/${user.id}/reactivate`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reactivate user.');
    }
  };

  const formatLastActivity = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Team Management</h1>
        <div className="flex items-center gap-3">
          {currentUser?.email === 'me@colorpapers.in' && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Import from Google
            </button>
          )}
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Add External Employee
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">
              {editUser ? 'Edit Employee' : 'Add External Employee'}
            </h2>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          {!editUser && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Globe className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Add external employees (non-@colorpapers.in) who need access. They'll sign in with their Google account.
                Internal @colorpapers.in employees are auto-registered on first Google login.
              </p>
            </div>
          )}
          {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Google Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@gmail.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                <option value="member">Member</option>
                <option value="team_lead">Team Lead</option>
                <option value="sub_admin">Sub Admin</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee Type</label>
              <select value={form.employeeType} onChange={(e) => setForm({ ...form, employeeType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                <option value="internal">Internal (Permanent)</option>
                <option value="intern">Intern</option>
                <option value="external">External / Contractor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
                {loading ? 'Saving...' : editUser ? 'Update' : 'Add Employee'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Name</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Email</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Type</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Role</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Department</th>
              <th className="text-left px-5 py-3 text-sm font-medium text-slate-600">Status</th>
              <th className="text-right px-5 py-3 text-sm font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                <td className="px-5 py-3 font-medium text-slate-800">{user.name}</td>
                <td className="px-5 py-3 text-sm text-slate-600">{user.email}</td>
                <td className="px-5 py-3">
                  {isInternal(user.email) ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      <Building2 className="w-3 h-3" /> Internal
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <Globe className="w-3 h-3" /> External
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    user.role === 'sub_admin' ? 'bg-indigo-100 text-indigo-700' :
                    user.role === 'team_lead' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{user.role === 'sub_admin' ? 'Sub Admin' : user.role}</span>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">{user.department}</td>
                <td className="px-5 py-3">
                  {user.isHibernated ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <Moon className="w-3 h-3" /> Hibernated
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                  {user.lastActivityAt && (
                    <p className="text-[10px] text-slate-400 mt-0.5">Last active: {formatLastActivity(user.lastActivityAt)}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {user.isHibernated && (
                      <button onClick={() => reactivateUser(user)} title="Reactivate account"
                        className="p-1.5 text-amber-500 hover:text-amber-700 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleEdit(user)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(user)} className="p-1.5 text-slate-400 hover:text-orange-600 transition-colors">
                      {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Google Import Modal */}
      {showImportModal && (
        <GoogleImportModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchUsers}
        />
      )}
    </div>
  );
}
