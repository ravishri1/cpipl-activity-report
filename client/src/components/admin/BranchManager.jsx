import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  Building2, Plus, Edit2, Trash2, ChevronLeft, ChevronRight,
  MapPin, Users, Calendar, X, Check, AlertCircle, Loader2,
  TreePine,
} from 'lucide-react';
import AlertMessage from '../shared/AlertMessage';
import LoadingSpinner from '../shared/LoadingSpinner';

// ─── Small helpers ──────────────────────────────────────────────────────────
function InputField({ label, value, onChange, placeholder, required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── Branch Modal (Add / Edit) ───────────────────────────────────────────────
function BranchModal({ branch, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: branch?.name || '',
    state: branch?.state || '',
    city: branch?.city || '',
    address: branch?.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.state.trim() || !form.city.trim()) {
      setError('Name, state, and city are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (branch) {
        await api.put(`/branches/${branch.id}`, form);
      } else {
        await api.post('/branches', form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save branch.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {branch ? 'Edit Branch' : 'Add Branch'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <AlertMessage type="error" message={error} />}
          <InputField label="Branch Name" value={form.name}
            onChange={v => setField('name', v)} placeholder="e.g. Mumbai HQ" required />
          <InputField label="State" value={form.state}
            onChange={v => setField('state', v)} placeholder="e.g. Maharashtra" required />
          <InputField label="City" value={form.city}
            onChange={v => setField('city', v)} placeholder="e.g. Mumbai" required />
          <InputField label="Address" value={form.address}
            onChange={v => setField('address', v)} placeholder="Optional full address" />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg
                       hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {branch ? 'Save Changes' : 'Create Branch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Branch Holidays Panel ────────────────────────────────────────────────────
function BranchHolidaysPanel({ branch, onClose }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [addForm, setAddForm] = useState({ name: '', date: '', isOptional: false });
  const [adding, setAdding] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/branches/${branch.id}/holidays?year=${year}`);
      setHolidays(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load holidays.');
    } finally {
      setLoading(false);
    }
  }, [branch.id, year]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.date) {
      setError('Holiday name and date are required.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await api.post(`/branches/${branch.id}/holidays`, addForm);
      setAddForm({ name: '', date: '', isOptional: false });
      setSuccess('Holiday added.');
      setTimeout(() => setSuccess(null), 3000);
      fetchHolidays();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add holiday.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (holidayId) => {
    if (!window.confirm('Delete this branch holiday?')) return;
    try {
      await api.delete(`/branches/${branch.id}/holidays/${holidayId}`);
      setHolidays(h => h.filter(x => x.id !== holidayId));
      setSuccess('Holiday deleted.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete holiday.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-black/40 flex-1" onClick={onClose} />
      <div className="bg-white w-full max-w-lg h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <TreePine className="w-5 h-5 text-green-600" />
                Branch Holidays
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{branch.name} — {branch.city}, {branch.state}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          {/* Year navigation */}
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => setYear(y => y - 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-700 w-12 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs text-slate-500 ml-2">{holidays.length} holiday{holidays.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="p-6 space-y-4 flex-1">
          {error && <AlertMessage type="error" message={error} />}
          {success && <AlertMessage type="success" message={success} />}

          {/* Add holiday form */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Add Holiday</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <InputField label="Holiday Name" value={addForm.name}
                  onChange={v => setAddForm(f => ({ ...f, name: v }))}
                  placeholder="e.g. Diwali" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={addForm.date}
                  onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded"
                    checked={addForm.isOptional}
                    onChange={e => setAddForm(f => ({ ...f, isOptional: e.target.checked }))} />
                  Optional holiday
                </label>
              </div>
            </div>
            <button onClick={handleAdd} disabled={adding}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm
                         rounded-lg hover:bg-green-700 disabled:opacity-50">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Holiday
            </button>
          </div>

          {/* Holiday list */}
          {loading ? (
            <LoadingSpinner />
          ) : holidays.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No branch holidays for {year}.</p>
              <p className="text-xs mt-1">Branch employees follow the global holiday calendar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {holidays.map(h => (
                <div key={h.id}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200
                             rounded-lg hover:border-slate-300 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{h.name}</span>
                      {h.isOptional && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Optional</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN',
                        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(h.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main BranchManager Component ────────────────────────────────────────────
export default function BranchManager() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal/panel state
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState(null);   // null = add, object = edit
  const [holidayBranch, setHolidayBranch] = useState(null); // branch for holiday panel

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/branches');
      setBranches(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleSaved = () => {
    setShowModal(false);
    setEditBranch(null);
    setSuccess('Branch saved successfully.');
    setTimeout(() => setSuccess(null), 3000);
    fetchBranches();
  };

  const handleDeactivate = async (branch) => {
    const action = branch.isActive ? 'deactivate' : 're-activate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} branch "${branch.name}"?`)) return;
    try {
      await api.delete(`/branches/${branch.id}`);
      setSuccess(`Branch ${action}d.`);
      setTimeout(() => setSuccess(null), 3000);
      fetchBranches();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} branch.`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const openAdd = () => { setEditBranch(null); setShowModal(true); };
  const openEdit = (b) => { setEditBranch(b); setShowModal(true); };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="h-full flex flex-col">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Branch Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage office branches and branch-specific holidays
              </p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                       rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm">
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && <AlertMessage type="error" message={error} />}
        {success && <AlertMessage type="success" message={success} />}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Branches', value: branches.length, icon: Building2, color: 'blue' },
            { label: 'Active', value: branches.filter(b => b.isActive).length, icon: Check, color: 'green' },
            { label: 'Total Employees', value: branches.reduce((s, b) => s + (b._count?.users ?? 0), 0), icon: Users, color: 'indigo' },
            { label: 'States Covered', value: new Set(branches.map(b => b.state)).size, icon: MapPin, color: 'purple' },
          ].map(stat => (
            <div key={stat.label} className={`bg-${stat.color}-50 border border-${stat.color}-100
                rounded-xl p-4 flex items-center gap-3`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600 shrink-0`} />
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className={`text-xl font-bold text-${stat.color}-700`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Branch table */}
        {branches.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Building2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-500">No branches yet</p>
            <p className="text-sm mt-1">Add your first branch to get started.</p>
            <button onClick={openAdd}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700">
              <Plus className="w-4 h-4 inline mr-1" /> Add Branch
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employees</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map(branch => (
                  <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{branch.name}</div>
                      {branch.address && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{branch.address}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {branch.city}, {branch.state}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{branch._count?.users ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                        ${branch.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'}`}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setHolidayBranch(branch)}
                          title="Manage branch holidays"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400
                                     hover:text-green-600 transition-colors">
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(branch)}
                          title="Edit branch"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400
                                     hover:text-blue-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeactivate(branch)}
                          title={branch.isActive ? 'Deactivate branch' : 'Re-activate branch'}
                          className={`p-1.5 rounded-lg transition-colors text-slate-400
                            ${branch.isActive
                              ? 'hover:bg-red-50 hover:text-red-500'
                              : 'hover:bg-green-50 hover:text-green-500'}`}>
                          {branch.isActive ? <Trash2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">About Branch Holidays</p>
            <p className="mt-0.5 text-blue-600">
              Branch holidays are added on top of global holidays. Employees without an assigned branch
              follow the global holiday calendar only. Payslip working-day calculations automatically
              merge both sets per employee.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modals / Panels ── */}
      {showModal && (
        <BranchModal
          branch={editBranch}
          onClose={() => { setShowModal(false); setEditBranch(null); }}
          onSaved={handleSaved}
        />
      )}
      {holidayBranch && (
        <BranchHolidaysPanel
          branch={holidayBranch}
          onClose={() => setHolidayBranch(null)}
        />
      )}
    </div>
  );
}
