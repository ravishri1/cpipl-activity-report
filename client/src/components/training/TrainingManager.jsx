import { useState } from 'react';
import { Users, CheckCircle, Clock, AlertCircle, Trash2, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';

const STATUS_STYLES = {
  assigned: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-200 text-yellow-800' },
  in_progress: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-800' },
  completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-200 text-green-800' }
};

export default function TrainingManager() {
  const { data: teamProgress, loading: loadingTeam, error: teamError, refetch: refetchTeam } = useFetch('/training/team-progress', []);
  const { data: trainingModules, loading: loadingModules } = useFetch('/training/modules', []);
  const { execute, loading: assigning, error: assignErr, success } = useApi();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [selectedModule, setSelectedModule] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Get unique employees from team progress
  const employees = [...new Map(
    teamProgress.map(item => [item.assignedTo.id, item.assignedTo])
  ).values()];

  // Group assignments by employee
  const employeeData = employees.map(emp => ({
    employee: emp,
    assignments: teamProgress.filter(t => t.assignedTo.id === emp.id),
    completed: teamProgress.filter(t => t.assignedTo.id === emp.id && t.status === 'completed').length,
    inProgress: teamProgress.filter(t => t.assignedTo.id === emp.id && t.status === 'in_progress').length,
    notStarted: teamProgress.filter(t => t.assignedTo.id === emp.id && (t.status === 'assigned' || t.status === 'not_started')).length
  }));

  // Filter by status if needed
  const filteredEmployeeData = filterStatus === 'all'
    ? employeeData
    : employeeData.filter(ed => {
        if (filterStatus === 'completed') return ed.completed > 0;
        if (filterStatus === 'in_progress') return ed.inProgress > 0;
        if (filterStatus === 'not_started') return ed.notStarted > 0;
        return true;
      });

  const handleToggleEmployee = (empId) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(empId)) {
      newSelected.delete(empId);
    } else {
      newSelected.add(empId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleBulkAssign = async () => {
    if (selectedEmployees.size === 0 || !selectedModule) {
      alert('Please select at least one employee and a training module');
      return;
    }

    const assignments = Array.from(selectedEmployees).map(empId => ({
      moduleId: selectedModule,
      assignedToId: empId,
      dueDate: dueDate || null,
      notes: notes || null
    }));

    try {
      for (const assignment of assignments) {
        await api.post('/training/assign', assignment);
      }
      setShowAssignModal(false);
      setSelectedEmployees(new Set());
      setSelectedModule(null);
      setDueDate('');
      setNotes('');
      refetchTeam();
      // Show success message
      alert(`Training assigned to ${selectedEmployees.size} employee(s)`);
    } catch (err) {
      alert('Error assigning training: ' + (err.response?.data?.message || err.message));
    }
  };

  const loading = loadingTeam || loadingModules;

  if (loading) return <LoadingSpinner />;
  if (teamError) return <AlertMessage type="error" message={typeof teamError === 'string' ? teamError : (teamError?.message || 'An error occurred')} />;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Training Management</h1>
        <p className="text-gray-600">Assign training modules to your team members and track their progress</p>
      </div>

      {assignErr && <AlertMessage type="error" message={assignErr} />}

      {/* Action Bar */}
      <div className="mb-6 flex justify-between items-center gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            + Assign Training
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployeeData.map(({ employee, assignments, completed, inProgress, notStarted }) => (
          <div key={employee.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{employee.name}</h3>
              <p className="text-sm text-gray-600">{employee.email}</p>
              {employee.department && (
                <p className="text-xs text-gray-500 mt-1">📍 {employee.department}</p>
              )}
            </div>

            {/* Progress Summary */}
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Total Assigned</span>
                <span className="font-bold text-gray-900">{assignments.length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-yellow-600 font-medium">Not Started</span>
                <span className="font-bold text-yellow-600">{notStarted}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-600 font-medium">In Progress</span>
                <span className="font-bold text-blue-600">{inProgress}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 font-medium">Completed</span>
                <span className="font-bold text-green-600">{completed}</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-600 h-full transition-all"
                  style={{ width: assignments.length > 0 ? `${(completed / assignments.length) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {assignments.length > 0 ? `${completed}/${assignments.length} completed` : 'No trainings assigned'}
              </p>
            </div>

            {/* Recent Assignments */}
            {assignments.length > 0 && (
              <div className="px-4 pb-4 space-y-2 max-h-48 overflow-y-auto">
                {assignments.slice(0, 3).map(assignment => {
                  const statusInfo = STATUS_STYLES[assignment.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div key={assignment.id} className={`p-2 rounded border ${statusInfo.bg} border-gray-200`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 text-xs">
                          <p className="font-semibold text-gray-900 truncate">{assignment.module?.title}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
                            <span className={statusInfo.color}>
                              {assignment.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {assignment.dueDate && (
                            <p className="text-gray-500 mt-1">Due: {formatDate(assignment.dueDate)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {assignments.length > 3 && (
                  <p className="text-xs text-gray-500 text-center p-2">
                    +{assignments.length - 3} more
                  </p>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => {
                  handleToggleEmployee(employee.id);
                }}
                className={`w-full px-3 py-2 rounded-lg font-medium transition ${
                  selectedEmployees.has(employee.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {selectedEmployees.has(employee.id) ? '✓ Selected' : 'Select'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployeeData.length === 0 && (
        <EmptyState
          icon="👥"
          title="No Team Members"
          subtitle="You don't have any team members assigned yet"
        />
      )}

      {/* Bulk Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Assign Training to Team</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedEmployees(new Set());
                    setSelectedModule(null);
                    setDueDate('');
                    setNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
                >
                  ✕
                </button>
              </div>
              {selectedEmployees.size > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {selectedEmployees.size} employee{selectedEmployees.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Select Training Module */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Training Module *
                </label>
                <select
                  value={selectedModule || ''}
                  onChange={(e) => setSelectedModule(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Choose a module...</option>
                  {trainingModules.map(mod => (
                    <option key={mod.id} value={mod.id}>
                      {mod.title}
                      {mod.isMandatory ? ' (Mandatory)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notes for Team (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any specific instructions or notes for your team..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Selected Employees List */}
              {selectedEmployees.size > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Employees to Assign ({selectedEmployees.size})
                  </label>
                  <div className="bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto space-y-2">
                    {employees.map(emp => (
                      selectedEmployees.has(emp.id) && (
                        <div key={emp.id} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-gray-900">{emp.name}</span>
                          <span className="text-gray-500">({emp.email})</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Warning if no module selected */}
              {(!selectedModule || selectedEmployees.size === 0) && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                  ⚠️ Please select a training module and at least one employee
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleBulkAssign}
                  disabled={assigning || !selectedModule || selectedEmployees.size === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {assigning ? 'Assigning...' : 'Assign to Team'}
                </button>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedEmployees(new Set());
                    setSelectedModule(null);
                    setDueDate('');
                    setNotes('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">{employeeData.length}</div>
          <div className="text-sm font-medium text-gray-600">Team Members</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600 mb-1">
            {employeeData.reduce((sum, ed) => sum + ed.notStarted, 0)}
          </div>
          <div className="text-sm font-medium text-gray-600">Not Started</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-1">
            {employeeData.reduce((sum, ed) => sum + ed.inProgress, 0)}
          </div>
          <div className="text-sm font-medium text-gray-600">In Progress</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600 mb-1">
            {employeeData.reduce((sum, ed) => sum + ed.completed, 0)}
          </div>
          <div className="text-sm font-medium text-gray-600">Completed</div>
        </div>
      </div>
    </div>
  );
}
