import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import { Calendar, Trash2, Check } from 'lucide-react';

export default function ShiftAssignment({ userId, userName }) {
  const { data: shifts, loading: shiftsLoading } = useFetch('/shifts', []);
  const { data: assignments, loading: assignLoading, error, refetch } = useFetch(
    `/shifts/employee/${userId}`,
    []
  );
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    shiftId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    reason: 'Manager Decision',
    notes: ''
  });

  const handleAssign = async () => {
    if (!form.shiftId) {
      alert('Please select a shift');
      return;
    }

    await execute(
      () =>
        api.post('/shifts/assign', {
          userId: parseInt(userId),
          shiftId: parseInt(form.shiftId),
          effectiveFrom: form.effectiveFrom,
          reason: form.reason,
          notes: form.notes
        }),
      'Shift assigned successfully'
    );

    if (!saveErr) {
      setShowForm(false);
      setForm({
        shiftId: '',
        effectiveFrom: new Date().toISOString().split('T')[0],
        reason: 'Manager Decision',
        notes: ''
      });
      refetch();
    }
  };

  const handleCancelAssignment = async (assignmentId) => {
    if (window.confirm('Cancel this shift assignment?')) {
      await execute(
        () => api.delete(`/shifts/assignment/${assignmentId}`),
        'Assignment cancelled'
      );
      refetch();
    }
  };

  if (shiftsLoading || assignLoading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  const currentShift = assignments.find(
    (a) =>
      a.status === 'active' &&
      new Date(a.effectiveFrom) <= new Date() &&
      (!a.effectiveTo || new Date(a.effectiveTo) >= new Date())
  );

  const upcomingShifts = assignments.filter((a) => a.status === 'pending');
  const shiftHistory = assignments.filter((a) =>
    ['expired', 'cancelled'].includes(a.status)
  );

  return (
    <div className="space-y-6">
      {/* Current Shift */}
      {currentShift && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-4">Current Shift</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-blue-700">Shift Name</p>
                <p className="text-xl font-bold text-blue-900">
                  {currentShift.shift.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-700">Working Hours</p>
                <p className="text-lg font-bold text-blue-900">
                  {currentShift.shift.startTime} - {currentShift.shift.endTime}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Break Duration</p>
                <p className="font-medium text-blue-900">
                  {currentShift.shift.breakDuration} minutes
                </p>
              </div>
              <div>
                <p className="text-blue-700">Flexibility</p>
                <p className="font-medium text-blue-900">
                  ±{currentShift.shift.flexibility} minutes
                </p>
              </div>
            </div>
            {currentShift.reason && (
              <div className="text-sm">
                <p className="text-blue-700">Assignment Reason</p>
                <p className="font-medium text-blue-900">{currentShift.reason}</p>
              </div>
            )}
            <div className="text-sm">
              <p className="text-blue-700">Effective From</p>
              <p className="font-medium text-blue-900">
                {new Date(currentShift.effectiveFrom).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assign New Shift */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Shift</h3>

        {saveErr && <AlertMessage type="error" message={saveErr} />}
        {success && <AlertMessage type="success" message={success} />}

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          >
            Assign New Shift
          </button>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Shift *
              </label>
              <select
                value={form.shiftId}
                onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a shift...</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.startTime} - {shift.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Effective From
              </label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) =>
                  setForm({ ...form, effectiveFrom: e.target.value })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                If future date selected, status will be pending until effective date
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <select
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>Manager Decision</option>
                <option>Employee Request</option>
                <option>Promotion</option>
                <option>Rotation</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes about this assignment..."
                rows="3"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
              >
                {saving ? 'Assigning...' : 'Assign Shift'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Shifts */}
      {upcomingShifts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Upcoming Shifts
          </h3>
          <div className="space-y-3">
            {upcomingShifts.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-yellow-700">
                      <Calendar size={16} className="inline mr-2" />
                      Effective {new Date(assignment.effectiveFrom).toLocaleDateString()}
                    </p>
                    <p className="text-lg font-bold text-yellow-900 mt-1">
                      {assignment.shift.name}
                    </p>
                    <p className="text-sm text-yellow-800">
                      {assignment.shift.startTime} - {assignment.shift.endTime}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelAssignment(assignment.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift History */}
      {shiftHistory.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Shift History</h3>
          <div className="space-y-2 text-sm">
            {shiftHistory.map((assignment) => (
              <div key={assignment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-900">
                    {assignment.shift.name}
                  </p>
                  <p className="text-gray-600 text-xs">
                    {new Date(assignment.effectiveFrom).toLocaleDateString()} -{' '}
                    {assignment.effectiveTo ? new Date(assignment.effectiveTo).toLocaleDateString() : 'Ongoing'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    assignment.status === 'expired'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-red-200 text-red-700'
                  }`}>
                    {assignment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No shift assignments yet</p>
        </div>
      )}
    </div>
  );
}
