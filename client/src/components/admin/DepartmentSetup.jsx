import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import { Building2, Plus, Pencil, Trash2, X, Check } from 'lucide-react';

export default function DepartmentSetup() {
  const { data: departments, loading, error: fetchErr, refetch } = useFetch('/api/departments/all', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await execute(() => api.post('/api/departments', form), 'Department added!');
      refetch();
      setShowAdd(false);
      setForm({ name: '', description: '' });
    } catch {}
  };

  const handleEdit = async (id) => {
    try {
      await execute(() => api.put(`/api/departments/${id}`, editForm), 'Department updated!');
      refetch();
      setEditId(null);
    } catch {}
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete department "${name}"? This cannot be undone.`)) return;
    try {
      await execute(() => api.delete(`/api/departments/${id}`), 'Department deleted!');
      refetch();
    } catch {}
  };

  const handleToggle = async (dept) => {
    try {
      await execute(() => api.put(`/api/departments/${dept.id}`, { isActive: !dept.isActive }),
        dept.isActive ? 'Deactivated' : 'Activated');
      refetch();
    } catch {}
  };

  const startEdit = (dept) => {
    setEditId(dept.id);
    setEditForm({ name: dept.name, description: dept.description || '' });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" /> Department Setup
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage departments used across employee profiles and credentials</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}
      {success && <AlertMessage type="success" message={success} />}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 border border-blue-200 rounded-xl bg-blue-50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-blue-800">New Department</span>
            <button type="button" onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Accounts, DA Team, PLD" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional short description" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Department list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {departments.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No departments yet. Add one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map(dept => (
                <tr key={dept.id} className={`hover:bg-slate-50 ${!dept.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    {editId === dept.id ? (
                      <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="border border-blue-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus />
                    ) : (
                      <span className="font-medium text-slate-800">{dept.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {editId === dept.id ? (
                      <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        className="border border-blue-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Description" />
                    ) : (
                      dept.description || <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(dept)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${dept.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {editId === dept.id ? (
                        <>
                          <button onClick={() => handleEdit(dept.id)} disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(dept)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(dept.id, dept.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
