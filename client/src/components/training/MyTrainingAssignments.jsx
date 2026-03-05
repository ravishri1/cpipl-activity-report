import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, BookMarked, Star, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { formatDate, capitalize } from '../../utils/formatters';

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-800 border-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  assigned: 'bg-yellow-100 text-yellow-800 border-yellow-300'
};

const STATUS_ICONS = {
  not_started: <Clock className="w-4 h-4" />,
  in_progress: <Clock className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
  assigned: <AlertCircle className="w-4 h-4" />
};

export default function MyTrainingAssignments() {
  const { data: assignments, loading, error, refetch } = useFetch('/api/training/my-assignments', []);
  const { execute: updateStatus, loading: updating } = useApi();
  const [expandedId, setExpandedId] = useState(null);

  const handleStatusChange = async (assignmentId, newStatus) => {
    await updateStatus(
      () => api.put(`/api/training/assignments/${assignmentId}`, { status: newStatus }),
      'Status updated!'
    );
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  const grouped = {
    not_started: assignments.filter(a => a.status === 'not_started' || a.status === 'assigned'),
    in_progress: assignments.filter(a => a.status === 'in_progress'),
    completed: assignments.filter(a => a.status === 'completed')
  };

  const mandatoryCount = assignments.filter(a => a.module.isMandatory).length;
  const completedCount = assignments.filter(a => a.status === 'completed').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Trainings</h1>
          <p className="text-gray-600 mt-1">Track your assigned training modules</p>
        </div>
        <BookMarked className="w-12 h-12 text-blue-600" />
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Total Assigned</p>
          <p className="text-3xl font-bold text-gray-900">{assignments.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm font-medium">Mandatory</p>
          <p className="text-3xl font-bold text-red-600">{mandatoryCount}</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No training assigned"
          subtitle="Your assigned trainings will appear here"
        />
      ) : (
        <div className="space-y-4">
          {/* Not Started */}
          {grouped.not_started.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Not Started</h2>
              {grouped.not_started.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}

          {/* In Progress */}
          {grouped.in_progress.length > 0 && (
            <div className="space-y-2 mt-6">
              <h2 className="text-lg font-semibold text-gray-900">In Progress</h2>
              {grouped.in_progress.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {grouped.completed.length > 0 && (
            <div className="space-y-2 mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Completed ✓</h2>
              {grouped.completed.map(assignment => (
                <TrainingAssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  isExpanded={expandedId === assignment.id}
                  onToggleExpand={() => setExpandedId(expandedId === assignment.id ? null : assignment.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrainingAssignmentCard({
  assignment,
  onStatusChange,
  isExpanded,
  onToggleExpand
}) {
  const today = new Date().toISOString().split('T')[0];
  const isDueToday = assignment.dueDate === today;
  const isOverdue = assignment.dueDate && assignment.dueDate < today;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
      <div
        className="p-4 cursor-pointer flex justify-between items-start"
        onClick={onToggleExpand}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded border ${STATUS_COLORS[assignment.status]} flex items-center gap-1`}>
              {STATUS_ICONS[assignment.status]}
              <span className="text-sm font-medium capitalize">{assignment.status.replace(/_/g, ' ')}</span>
            </div>
            {assignment.module.isMandatory && (
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">MANDATORY</span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mt-2">{assignment.module.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{assignment.module.description}</p>

          <div className="flex gap-4 mt-3 text-sm text-gray-600 flex-wrap">
            <span>⏱️ {assignment.module.duration ? `${assignment.module.duration} min` : 'Self-paced'}</span>
            {assignment.dueDate && (
              <span className={isOverdue ? 'text-red-600 font-medium' : isDueToday ? 'text-yellow-600 font-medium' : ''}>
                📅 Due: {formatDate(assignment.dueDate)}
              </span>
            )}
            <span>👨‍🏫 Assigned by: {assignment.assignedBy.name}</span>
          </div>

          {/* Points & Deadline Info */}
          {assignment.module.completionPointsValue && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {assignment.status !== 'completed' && assignment.completionDeadline ? (
                <div className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${
                  new Date(assignment.completionDeadline) < new Date()
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : new Date(assignment.completionDeadline) - new Date() < 7 * 24 * 60 * 60 * 1000
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <Star className="w-3 h-3" />
                  {new Date(assignment.completionDeadline) < new Date()
                    ? '⚠️ Deadline passed'
                    : `${Math.ceil((new Date(assignment.completionDeadline) - new Date()) / (24 * 60 * 60 * 1000))} days to complete`}
                </div>
              ) : null}
              
              {assignment.status !== 'completed' && (
                <div className="flex items-center gap-1 px-3 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium">
                  <Star className="w-3 h-3" />
                  {assignment.module.completionPointsValue} pts available
                </div>
              )}

              {assignment.status === 'completed' && assignment.pointsAwarded > 0 && (
                <div className="flex items-center gap-1 px-3 py-1 rounded bg-green-50 text-green-700 border border-green-200 text-xs font-medium">
                  <Star className="w-3 h-3" />
                  +{assignment.pointsAwarded} pts earned
                </div>
              )}

              {assignment.status === 'completed' && assignment.pointsAwarded === 0 && (
                <div className="flex items-center gap-1 px-3 py-1 rounded bg-gray-50 text-gray-700 border border-gray-200 text-xs font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  Completed after deadline
                </div>
              )}
            </div>
          )}
        </div>

        <button className="text-gray-400 hover:text-gray-600">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
          {assignment.notes && (
            <div>
              <p className="text-sm font-medium text-gray-900">Manager Notes:</p>
              <p className="text-sm text-gray-700 mt-1">{assignment.notes}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {assignment.status !== 'completed' && (
              <>
                {assignment.status === 'not_started' && (
                  <button
                    onClick={() => onStatusChange(assignment.id, 'in_progress')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Start Now
                  </button>
                )}
                {assignment.status === 'in_progress' && (
                  <button
                    onClick={() => onStatusChange(assignment.id, 'completed')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium"
                  >
                    Mark Complete
                  </button>
                )}
              </>
            )}

            {assignment.module.exams && assignment.module.exams.length > 0 && (
              <button className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm font-medium">
                Take Exam
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
