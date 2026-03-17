import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Clock, Plus, Edit2, Trash2, Users, UserPlus, Search, X, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';

export default function ShiftManagement() {
  const { data: shifts, loading, error, refetch } = useFetch('/shifts', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, flexibility: 0, description: ''
  });

  // Assign modal state
  const [assignShift, setAssignShift] = useState(null); // shift object being assigned
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignEndDate, setAssignEndDate] = useState('');
  const [expandedShift, setExpandedShift] = useState(null); // show assigned employees list

  // Fetch all active employees (only when assign modal opens)
  const { data: employees, loading: empLoading } = useFetch(
    assignShift ? '/users?active=true' : null, []
  );

  // Fetch assigned employees for expanded shift
  const { data: assignedData, loading: assignedLoading, refetch: refetchAssigned } = useFetch(
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
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (shift) => {
    setForm(shift);
    setEditing(shift.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Shift name is required'); return; }
    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) {
      alert('Time must be in HH:MM format'); return;
    }
    const endpoint = editing ? `/shifts/${editing}` : '/shifts';
    const method = editing ? 'put' : 'post';
    try {
      await execute(() => api[method](endpoint, form), editing ? 'Shift updated' : 'Shift created');
      setShowForm(false);
      refetch();
    } catch {}
  };

  const handleDelete = async (id, assignmentCount) => {
    if (assignmentCount > 0) {
      alert(`Cannot delete shift with ${assignmentCount} active assignments. Remove assignments first.`);
      return;
    }
    if (!window.confirm('Are you sure you want to delete this shift?')) return;
    try {
      await execute(() => api.delete(`/shifts/${id}`), 'Shift deleted');
      refetch();
    } catch {}
  };

  // --- Assign modal ---
  const openAssignModal = (shift) => {
    setAssignShift(shift);
    setSelectedEmpIds(new Set());
    setEmpSearch('');
    setAssignDate(new Date().toISOString().split('T')[0]);
    setAssignEndDate('');
  };

  const toggleEmp = (id) => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filteredEmployees.every(e => selectedEmpIds.has(e.id))) {
      setSelectedEmpIds(prev => {
        const next = new Set(prev);
        filteredEmployees.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelectedEmpIds(prev => {
        const next = new Set(prev);
        filteredEmployees.forEach(e => next.add(e.id));
        return next;
      });
    }
  };

  const handleBulkAssign = async () => {
    if (selectedEmpIds.size === 0) { alert('Select at least one employee'); return; }
    try {
      await execute(
        () => api.post('/shifts/bulk-assign', {
          userIds: [...selectedEmpIds],
          shiftId: assignShift.id,
          effectiveFrom: assignDate,
          effectiveTo: assignEndDate || undefined,
          reason: 'Shift Management Assignment',
        }),
        `${assignShift.name} assigned to ${selectedEmpIds.size} employee(s)`
      );
      setAssignShift(null);
      refetch();
    } catch {}
  };

  // Toggle expanded view of assigned employees
  const toggleExpanded = (shiftId) => {
    setExpandedShift(prev => prev === shiftId ? null : shiftId);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-gray-600 mt-2">Configure shifts and assign them to employees</p>
        </div>
        <button onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition">
          <Plus size={20} /> New Shift
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
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., General Shift, Morning, Night"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., Standard office hours"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Break Duration (minutes)</label>
              <input type="number" value={form.breakDuration} onChange={(e) => setForm({ ...form, breakDuration: parseInt(e.target.value) })}
                min="0" max="120"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (minutes)</label>
              <input type="number" value={form.flexibility} onChange={(e) => setForm({ ...form, flexibility: parseInt(e.target.value) })}
                min="0" max="60" placeholder="e.g., 15"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium">
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
          {shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition">
              {/* Shift card header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Shift icon */}
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock size={22} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{shift.name}</h3>
                      {shift.description && <p className="text-sm text-gray-500">{shift.description}</p>}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                        <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {shift.startTime} – {shift.endTime}
                        </span>
                        <span>Break: {shift.breakDuration} min</span>
                        {shift.flexibility > 0 && <span>Grace: ±{shift.flexibility} min</span>}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => openAssignModal(shift)}
                      className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition text-sm font-medium flex items-center gap-1.5"
                      title="Assign employees to this shift">
                      <UserPlus size={16} /> Assign Employees
                    </button>
                    <button onClick={() => handleEdit(shift)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit shift">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(shift.id, shift._count?.shiftAssignments || 0)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete shift">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Employee count + expand toggle */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => toggleExpanded(shift.id)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition"
                  >
                    <Users size={16} className="text-gray-400" />
                    <span className="font-medium">{shift._count?.shiftAssignments || 0} employee(s) assigned</span>
                    {expandedShift === shift.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {!shift.isActive && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">Inactive</span>
                  )}
                </div>
              </div>

              {/* Expanded: show assigned employees */}
              {expandedShift === shift.id && (
                <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                  {assignedLoading ? (
                    <p className="text-sm text-gray-500 py-2">Loading assigned employees...</p>
                  ) : assignedData?.employees?.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500 mb-2">ASSIGNED EMPLOYEES</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {assignedData.employees.map(emp => (
                          <div key={emp.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700">
                              {emp.name?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{emp.name}</p>
                              <p className="text-[10px] text-gray-500">{emp.employeeId || '-'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-2">No employees assigned yet. Click "Assign Employees" to add.</p>
                  )}
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
            {/* Modal header */}
            <div className="p-5 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Assign Employees to Shift</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-blue-700">{assignShift.name}</span> ({assignShift.startTime} – {assignShift.endTime})
                  </p>
                </div>
                <button onClick={() => setAssignShift(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {saveErr && <AlertMessage type="error" message={saveErr} className="mt-3" />}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective From</label>
                  <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective Until (optional)</label>
                  <input type="date" value={assignEndDate} onChange={e => setAssignEndDate(e.target.value)}
                    min={assignDate}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              {/* Search + Select All */}
              <div className="flex items-center gap-2 mt-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search employees..."
                    value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <button onClick={toggleAll}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition whitespace-nowrap">
                  {filteredEmployees.length > 0 && filteredEmployees.every(e => selectedEmpIds.has(e.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Employee list */}
            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              {empLoading ? (
                <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">No employees found</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredEmployees.map(emp => {
                    const isSelected = selectedEmpIds.has(emp.id);
                    return (
                      <button key={emp.id} onClick={() => toggleEmp(emp.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition border ${
                          isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                        }`}>
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
                        ) : (
                          <Square size={18} className="text-gray-300 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {emp.employeeId || '-'}{emp.department ? ` · ${emp.department}` : ''}{emp.designation ? ` · ${emp.designation}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedEmpIds.size > 0 ? (
                  <span className="font-medium text-blue-700">{selectedEmpIds.size} employee{selectedEmpIds.size > 1 ? 's' : ''} selected</span>
                ) : (
                  'Select employees to assign'
                )}
              </span>
              <div className="flex gap-3">
                <button onClick={() => setAssignShift(null)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition">
                  Cancel
                </button>
                <button onClick={handleBulkAssign} disabled={saving || selectedEmpIds.size === 0}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition flex items-center gap-1.5">
                  {saving ? (
                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Assigning...</>
                  ) : (
                    <>Assign {selectedEmpIds.size > 0 ? `${selectedEmpIds.size} Employee${selectedEmpIds.size > 1 ? 's' : ''}` : ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
