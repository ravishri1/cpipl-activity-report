import { useState } from 'react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { Clock, Plus, Edit2, Trash2, Users } from 'lucide-react';

export default function ShiftManagement() {
  const { data: shifts, loading, error, refetch } = useFetch('/api/shifts', []);
  const { execute, loading: saving, error: saveErr, success } = useApi();
  
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    breakDuration: 60,
    flexibility: 0,
    description: ''
  });

  const handleAddNew = () => {
    setForm({
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      breakDuration: 60,
      flexibility: 0,
      description: ''
    });
    setEditing(null);
    setShowForm(true);
  };

  const handleEdit = (shift) => {
    setForm(shift);
    setEditing(shift.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Shift name is required');
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) {
      alert('Time must be in HH:MM format');
      return;
    }

    const endpoint = editing ? `/api/shifts/${editing}` : '/api/shifts';
    const method = editing ? 'put' : 'post';

    await execute(
      () => api[method](endpoint, form),
      editing ? 'Shift updated successfully' : 'Shift created successfully'
    );

    if (!saveErr) {
      setShowForm(false);
      refetch();
    }
  };

  const handleDelete = async (id, assignmentCount) => {
    if (assignmentCount > 0) {
      alert(`Cannot delete shift with ${assignmentCount} active assignments. Deactivate it instead.`);
      return;
    }

    if (window.confirm('Are you sure you want to delete this shift?')) {
      await execute(
        () => api.delete(`/api/shifts/${id}`),
        'Shift deleted successfully'
      );
      refetch();
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-gray-600 mt-2">Configure and manage employee work shifts</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition"
        >
          <Plus size={20} />
          New Shift
        </button>
      </div>

      {/* Alerts */}
      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-xl font-bold">
            {editing ? 'Edit Shift' : 'New Shift'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Morning, Evening, Night"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., Standard office hours"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time (HH:MM) *
              </label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time (HH:MM) *
              </label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Break Duration (minutes)
              </label>
              <input
                type="number"
                value={form.breakDuration}
                onChange={(e) => setForm({ ...form, breakDuration: parseInt(e.target.value) })}
                min="0"
                max="120"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Flexibility (minutes)
              </label>
              <input
                type="number"
                value={form.flexibility}
                onChange={(e) => setForm({ ...form, flexibility: parseInt(e.target.value) })}
                min="0"
                max="60"
                placeholder="e.g., 15 for ±15 min"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
            >
              {saving ? 'Saving...' : 'Save Shift'}
            </button>
          </div>
        </div>
      )}

      {/* Shifts List */}
      {shifts.length === 0 && !showForm ? (
        <EmptyState
          icon="🕒"
          title="No shifts configured"
          subtitle="Create a shift to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{shift.name}</h3>
                  {shift.description && (
                    <p className="text-sm text-gray-600">{shift.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(shift)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit shift"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(shift.id, shift._count?.shiftAssignments || 0)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete shift"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock size={16} className="text-blue-600" />
                  <span>{shift.startTime} - {shift.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>Break: {shift.breakDuration} min</span>
                </div>
                {shift.flexibility > 0 && (
                  <div className="text-gray-600">
                    Flexibility: ±{shift.flexibility} min
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  {shift._count?.shiftAssignments || 0} employees
                </span>
              </div>

              {!shift.isActive && (
                <div className="mt-3 px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">
                  Inactive
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
