import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Clock, Plus, Edit2, Trash2, Users, UserPlus, Search, X, CheckSquare, Square, ChevronDown, ChevronUp, ShieldOff, UserCheck } from 'lucide-react';

export default function ShiftManagement() {
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' | 'exceptions'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
        <p className="text-gray-600 mt-2">Configure shifts, assign employees, and manage attendance exceptions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'shifts' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Clock size={15} className="inline mr-1.5 -mt-0.5" />
          Shift Definitions
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            activeTab === 'exceptions' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ShieldOff size={15} className="inline mr-1.5 -mt-0.5" />
          Attendance Exceptions
        </button>
      </div>

      {activeTab === 'shifts' ? <ShiftDefinitionsTab /> : <AttendanceExceptionsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tab 1: Shift Definitions (existing functionality)
// ═══════════════════════════════════════════════
function ShiftDefinitionsTab() {
  const { data: shifts, loading, error, refetch } = useFetch('/shifts', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, flexibility: 0, description: ''
  });

  // Assign modal
  const [assignShift, setAssignShift] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignEndDate, setAssignEndDate] = useState('');
  const [expandedShift, setExpandedShift] = useState(null);

  const { data: employees, loading: empLoading } = useFetch(assignShift ? '/users?active=true' : null, []);
  const { data: assignedData, loading: assignedLoading } = useFetch(
    expandedShift ? `/shifts/employee-list?shiftId=${expandedShift}` : null, null
  );

  const filteredEmployees = useMemo(() => {
    if (!employees?.length) return [];
    const q = empSearch.toLowerCase();
    return employees.filter(e =>
      !q || e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  }, [employees, empSearch]);

  const handleAddNew = () => {
    setForm({ name: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, flexibility: 0, description: '' });
    setEditing(null); setShowForm(true);
  };

  const handleEdit = (shift) => { setForm(shift); setEditing(shift.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Shift name is required'); return; }
    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) { alert('Time must be in HH:MM format'); return; }
    const endpoint = editing ? `/shifts/${editing}` : '/shifts';
    const method = editing ? 'put' : 'post';
    try {
      await execute(() => api[method](endpoint, form), editing ? 'Shift updated' : 'Shift created');
      setShowForm(false); refetch();
    } catch {}
  };

  const handleDelete = async (id, count) => {
    if (count > 0) { alert(`Cannot delete shift with ${count} active assignments.`); return; }
    if (!window.confirm('Delete this shift?')) return;
    try { await execute(() => api.delete(`/shifts/${id}`), 'Shift deleted'); refetch(); } catch {}
  };

  const openAssignModal = (shift) => {
    setAssignShift(shift); setSelectedEmpIds(new Set()); setEmpSearch('');
    setAssignDate(new Date().toISOString().split('T')[0]); setAssignEndDate('');
  };

  const toggleEmp = (id) => {
    setSelectedEmpIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleAll = () => {
    if (filteredEmployees.every(e => selectedEmpIds.has(e.id))) {
      setSelectedEmpIds(prev => { const next = new Set(prev); filteredEmployees.forEach(e => next.delete(e.id)); return next; });
    } else {
      setSelectedEmpIds(prev => { const next = new Set(prev); filteredEmployees.forEach(e => next.add(e.id)); return next; });
    }
  };

  const handleBulkAssign = async () => {
    if (selectedEmpIds.size === 0) { alert('Select at least one employee'); return; }
    try {
      await execute(() => api.post('/shifts/bulk-assign', {
        userIds: [...selectedEmpIds], shiftId: assignShift.id,
        effectiveFrom: assignDate, effectiveTo: assignEndDate || undefined, reason: 'Shift Management Assignment',
      }), `${assignShift.name} assigned to ${selectedEmpIds.size} employee(s)`);
      setAssignShift(null); refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition text-sm">
          <Plus size={18} /> New Shift
        </button>
      </div>

      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold">{editing ? 'Edit Shift' : 'New Shift'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Shift Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., General Shift" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Break Duration (minutes)</label>
              <input type="number" value={form.breakDuration} onChange={e => setForm({ ...form, breakDuration: parseInt(e.target.value) })}
                min="0" max="120" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (minutes)</label>
              <input type="number" value={form.flexibility} onChange={e => setForm({ ...form, flexibility: parseInt(e.target.value) })}
                min="0" max="60" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : 'Save Shift'}
            </button>
          </div>
        </div>
      )}

      {/* Shifts List */}
      {shifts.length === 0 && !showForm ? (
        <EmptyState icon="🕒" title="No shifts configured" subtitle="Create a shift to get started" />
      ) : (
        <div className="space-y-4">
          {shifts.map(shift => (
            <div key={shift.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock size={22} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{shift.name}</h3>
                      {shift.description && <p className="text-sm text-gray-500">{shift.description}</p>}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                        <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{shift.startTime} – {shift.endTime}</span>
                        <span>Break: {shift.breakDuration} min</span>
                        {shift.flexibility > 0 && <span>Grace: ±{shift.flexibility} min</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openAssignModal(shift)}
                      className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition text-sm font-medium flex items-center gap-1.5">
                      <UserPlus size={16} /> Assign Employees
                    </button>
                    <button onClick={() => handleEdit(shift)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 size={18} /></button>
                    <button onClick={() => handleDelete(shift.id, shift._count?.shiftAssignments || 0)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button onClick={() => setExpandedShift(prev => prev === shift.id ? null : shift.id)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition">
                    <Users size={16} className="text-gray-400" />
                    <span className="font-medium">{shift._count?.shiftAssignments || 0} employee(s) assigned</span>
                    {expandedShift === shift.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {!shift.isActive && <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">Inactive</span>}
                </div>
              </div>

              {expandedShift === shift.id && (
                <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                  {assignedLoading ? <p className="text-sm text-gray-500 py-2">Loading...</p> :
                    assignedData?.employees?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 mb-2">ASSIGNED EMPLOYEES</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {assignedData.employees.map(emp => (
                            <div key={emp.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">{emp.name?.charAt(0)}</div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{emp.name}</p>
                                <p className="text-[10px] text-gray-500">{emp.employeeId || '-'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-sm text-gray-500 py-2">No employees assigned. Click "Assign Employees" to add.</p>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign Employees Modal */}
      {assignShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Assign Employees to Shift</h3>
                  <p className="text-sm text-gray-600 mt-1"><span className="font-medium text-blue-700">{assignShift.name}</span> ({assignShift.startTime} – {assignShift.endTime})</p>
                </div>
                <button onClick={() => setAssignShift(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
              </div>
              {saveErr && <AlertMessage type="error" message={saveErr} className="mt-3" />}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective From</label>
                  <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective Until (optional)</label>
                  <input type="date" value={assignEndDate} onChange={e => setAssignEndDate(e.target.value)} min={assignDate}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={toggleAll} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  {filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmpIds.has(e.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {empLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> :
                filteredEmployees.length === 0 ? <p className="text-center text-sm text-gray-500 py-8">No employees found</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredEmployees.map(emp => {
                      const sel = selectedEmpIds.has(emp.id);
                      return (
                        <button key={emp.id} onClick={() => toggleEmp(emp.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition border ${sel ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                          {sel ? <CheckSquare size={18} className="text-blue-600 flex-shrink-0" /> : <Square size={18} className="text-gray-300 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{emp.employeeId || '-'}{emp.department ? ` · ${emp.department}` : ''}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              }
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedEmpIds.size > 0 ? <span className="font-medium text-blue-700">{selectedEmpIds.size} selected</span> : 'Select employees'}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setAssignShift(null)} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button onClick={handleBulkAssign} disabled={saving || selectedEmpIds.size === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Assigning...' : `Assign ${selectedEmpIds.size > 0 ? selectedEmpIds.size + ' ' : ''}Employee${selectedEmpIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tab 2: Attendance Exceptions
// ═══════════════════════════════════════════════
function AttendanceExceptionsTab() {
  const { data: exemptList, loading, error: fetchErr, refetch } = useFetch('/shifts/attendance-exceptions', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [showAddModal, setShowAddModal] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reason, setReason] = useState('Management');

  // Fetch all active employees when modal opens
  const { data: allEmployees, loading: empLoading } = useFetch(showAddModal ? '/users?active=true' : null, []);

  // Filter out already-exempt employees and apply search
  const availableEmployees = useMemo(() => {
    if (!allEmployees?.length) return [];
    const exemptIds = new Set((exemptList || []).map(e => e.id));
    const q = empSearch.toLowerCase();
    return allEmployees.filter(e =>
      !exemptIds.has(e.id) &&
      (!q || e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q))
    );
  }, [allEmployees, exemptList, empSearch]);

  const toggleEmp = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleAll = () => {
    if (availableEmployees.every(e => selectedIds.has(e.id))) {
      setSelectedIds(prev => { const next = new Set(prev); availableEmployees.forEach(e => next.delete(e.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); availableEmployees.forEach(e => next.add(e.id)); return next; });
    }
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) { alert('Select at least one employee'); return; }
    try {
      await execute(
        () => api.post('/shifts/attendance-exceptions', { userIds: [...selectedIds], reason }),
        `${selectedIds.size} employee(s) added to attendance exceptions`
      );
      setShowAddModal(false);
      setSelectedIds(new Set());
      refetch();
    } catch {}
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from attendance exceptions? They will be subject to normal attendance rules again.`)) return;
    try {
      await execute(() => api.delete(`/shifts/attendance-exceptions/${userId}`), `${name} removed from exceptions`);
      refetch();
    } catch {}
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldOff size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Attendance Exception Policy</p>
          <p className="text-xs text-amber-700 mt-1">
            Employees in this list are <strong>exempt from all attendance rules</strong>. They will always be marked as Present
            regardless of check-in/out time. No late marks, no short hours, no regularization required.
            Typically used for Directors, Senior Management, or employees with flexible schedules.
          </p>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}
      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Add button */}
      <div className="flex justify-end">
        <button onClick={() => { setShowAddModal(true); setEmpSearch(''); setSelectedIds(new Set()); setReason('Management'); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition text-sm">
          <UserPlus size={18} /> Add Exception
        </button>
      </div>

      {/* Exempt employees list */}
      {(exemptList || []).length === 0 ? (
        <EmptyState icon="🛡️" title="No attendance exceptions" subtitle="Add employees who should bypass attendance rules" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Reason</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {exemptList.map((emp, idx) => (
                <tr key={emp.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'} hover:bg-blue-50/30`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                        <UserCheck size={16} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.designation || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{emp.employeeId || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                      {emp.attendanceExemptReason || 'Management'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleRemove(emp.id, emp.name)}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Exception Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Attendance Exception</h3>
                  <p className="text-sm text-gray-600 mt-1">Select employees to exempt from attendance rules</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-400" /></button>
              </div>
              {saveErr && <AlertMessage type="error" message={saveErr} className="mt-3" />}

              {/* Reason */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Exception Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500">
                  <option>Management</option>
                  <option>Director</option>
                  <option>Senior Management</option>
                  <option>Business Travel</option>
                  <option>Flexible Schedule</option>
                  <option>Consultant</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Search + Select All */}
              <div className="flex items-center gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search employees..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={toggleAll} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  {availableEmployees.length > 0 && availableEmployees.every(e => selectedIds.has(e.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Employee list */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {empLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> :
                availableEmployees.length === 0 ? <p className="text-center text-sm text-gray-500 py-8">No employees available (all may already be exempt)</p> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {availableEmployees.map(emp => {
                      const sel = selectedIds.has(emp.id);
                      return (
                        <button key={emp.id} onClick={() => toggleEmp(emp.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition border ${sel ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                          {sel ? <CheckSquare size={18} className="text-blue-600 flex-shrink-0" /> : <Square size={18} className="text-gray-300 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                            <p className="text-[11px] text-gray-500 truncate">{emp.employeeId || '-'}{emp.department ? ` · ${emp.department}` : ''}{emp.designation ? ` · ${emp.designation}` : ''}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              }
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedIds.size > 0 ? <span className="font-medium text-blue-700">{selectedIds.size} selected</span> : 'Select employees'}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setShowAddModal(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button onClick={handleAdd} disabled={saving || selectedIds.size === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'Adding...' : `Add ${selectedIds.size > 0 ? selectedIds.size + ' ' : ''}Exception${selectedIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
