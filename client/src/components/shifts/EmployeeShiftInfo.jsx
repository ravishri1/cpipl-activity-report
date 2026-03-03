import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import { Clock, AlertCircle } from 'lucide-react';

export default function EmployeeShiftInfo({ userId }) {
  const { data: shiftData, loading } = useFetch(`/api/shifts/employee/${userId}/current`, null);

  if (loading) return <LoadingSpinner />;

  if (!shiftData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle size={20} className="text-gray-400" />
        <span className="text-gray-600 text-sm">No active shift assignment</span>
      </div>
    );
  }

  const { shift, effectiveFrom, reason, notes } = shiftData;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={20} className="text-blue-600" />
        <div>
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Current Shift</p>
          <p className="text-lg font-bold text-blue-900">{shift.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-blue-700 font-medium">Working Hours</p>
          <p className="text-blue-900">
            {shift.startTime} – {shift.endTime}
          </p>
        </div>
        <div>
          <p className="text-blue-700 font-medium">Break Time</p>
          <p className="text-blue-900">{shift.breakDuration} minutes</p>
        </div>
      </div>

      {shift.flexibility > 0 && (
        <div className="text-sm">
          <p className="text-blue-700 font-medium">Flexibility</p>
          <p className="text-blue-900">±{shift.flexibility} minutes</p>
        </div>
      )}

      {reason && reason !== 'Manager Decision' && (
        <div className="text-sm">
          <p className="text-blue-700 font-medium">Assignment Reason</p>
          <p className="text-blue-900">{reason}</p>
        </div>
      )}

      {notes && (
        <div className="text-sm pt-2 border-t border-blue-100">
          <p className="text-blue-700 font-medium">Notes</p>
          <p className="text-blue-900">{notes}</p>
        </div>
      )}

      <div className="text-xs text-blue-700 pt-2 border-t border-blue-100">
        Effective from {new Date(effectiveFrom).toLocaleDateString()}
      </div>
    </div>
  );
}
