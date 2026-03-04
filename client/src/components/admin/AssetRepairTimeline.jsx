import { useState, useMemo } from 'react';
import { ChevronRight, Clock, AlertTriangle, CheckCircle, XCircle, Wrench, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, capitalize } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import StatusBadge from '../shared/StatusBadge';
import { REPAIR_STATUS_STYLES } from '../../utils/constants';

// ─── Status Stepper Component ───
export function RepairStatusStepper({ repair }) {
  const statuses = ['initiated', 'in_transit', 'in_progress', 'ready_for_pickup', 'completed'];
  const currentIndex = statuses.indexOf(repair.status);

  return (
    <div className="flex items-center justify-between my-6">
      {statuses.map((status, index) => (
        <div key={status} className="flex flex-col items-center flex-1">
          {/* Status dot and label */}
          <div className="flex flex-col items-center gap-2 mb-3">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white
              ${index <= currentIndex ? 'bg-blue-500' : 'bg-gray-300'}
            `}>
              {index < currentIndex ? (
                <CheckCircle className="w-6 h-6" />
              ) : index === currentIndex ? (
                <Wrench className="w-6 h-6" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">{capitalize(status.replace(/_/g, ' '))}</span>
          </div>

          {/* Connector line */}
          {index < statuses.length - 1 && (
            <div className={`
              h-1 flex-1 mb-12
              ${index < currentIndex ? 'bg-blue-500' : 'bg-gray-300'}
            `} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Repair Card Component ───
export function RepairCard({ repair, onSelect, isSelected }) {
  const today = new Date().toISOString().slice(0, 10);
  const daysOverdue = Math.max(0, Math.floor((new Date(today) - new Date(repair.expectedReturnDate)) / (1000 * 60 * 60 * 24)));
  const isOverdue = repair.status !== 'completed' && repair.expectedReturnDate < today;
  const urgency = daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'warning' : daysOverdue > 0 ? 'alert' : 'normal';

  return (
    <div
      onClick={() => onSelect(repair)}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
        ${isOverdue && urgency === 'critical' ? 'bg-red-50 border-red-300' : ''}
        ${isOverdue && urgency === 'warning' ? 'bg-yellow-50 border-yellow-300' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-900">{repair.asset.name}</h3>
            {isOverdue && (
              <AlertTriangle className={`w-4 h-4 ${urgency === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
            )}
          </div>
          <p className="text-xs text-gray-600 mb-3">{repair.asset.serialNumber}</p>

          <div className="flex flex-wrap gap-2 items-center mb-3">
            <StatusBadge status={repair.status} styles={REPAIR_STATUS_STYLES} />
            <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded">
              {capitalize(repair.repairType)}
            </span>
            {repair.vendor && <span className="text-xs text-gray-600">{repair.vendor}</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Sent Out:</span>
              <p className="font-medium">{formatDate(repair.sentOutDate)}</p>
            </div>
            <div>
              <span className="text-gray-500">Expected Return:</span>
              <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                {formatDate(repair.expectedReturnDate)}
              </p>
            </div>
          </div>

          {isOverdue && (
            <div className="mt-2 p-2 bg-red-100 text-red-700 text-xs rounded font-medium">
              ⚠️ {daysOverdue} days overdue
            </div>
          )}
        </div>

        {/* Chevron icon */}
        <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ${isSelected ? 'text-blue-500' : ''}`} />
      </div>
    </div>
  );
}

// ─── Repair Detail Panel Component ───
function RepairDetailPanel({ repair, onClose, onStatusChange, onComplete }) {
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const daysOverdue = Math.max(0, Math.floor((new Date(today) - new Date(repair.expectedReturnDate)) / (1000 * 60 * 60 * 24)));

  const nextStatuses = {
    initiated: 'in_transit',
    in_transit: 'in_progress',
    in_progress: 'ready_for_pickup',
    ready_for_pickup: null,
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-40">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{repair.asset.name}</h2>
              <p className="text-sm text-gray-600">{repair.asset.serialNumber}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Status Stepper */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Repair Progress</h3>
            <RepairStatusStepper repair={repair} />
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Status</p>
              <StatusBadge status={repair.status} styles={REPAIR_STATUS_STYLES} />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Repair Type</p>
              <p className="font-semibold text-gray-900">{capitalize(repair.repairType)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Sent Out</p>
              <p className="font-semibold text-gray-900">{formatDate(repair.sentOutDate)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Expected Return</p>
              <p className={`font-semibold ${daysOverdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatDate(repair.expectedReturnDate)}
                {daysOverdue > 0 && <span className="block text-red-600 text-xs mt-1">({daysOverdue} days overdue)</span>}
              </p>
            </div>
          </div>

          {/* Vendor Information */}
          {repair.vendor && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Vendor Details</h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-600">Vendor:</span> <span className="font-medium">{repair.vendor}</span></p>
                {repair.vendorLocation && <p><span className="text-gray-600">Location:</span> <span className="font-medium">{repair.vendorLocation}</span></p>}
                {repair.vendorPhone && <p><span className="text-gray-600">Phone:</span> <span className="font-medium">{repair.vendorPhone}</span></p>}
                {repair.vendorEmail && <p><span className="text-gray-600">Email:</span> <span className="font-medium text-blue-600">{repair.vendorEmail}</span></p>}
              </div>
            </div>
          )}

          {/* Issue & Notes */}
          {repair.issueDescription && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Issue Description</h4>
              <p className="text-sm text-gray-700">{repair.issueDescription}</p>
            </div>
          )}

          {repair.notes && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{repair.notes}</p>
            </div>
          )}

          {/* Costs */}
          {(repair.estimatedCost || repair.actualCost) && (
            <div className="grid grid-cols-2 gap-4">
              {repair.estimatedCost && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Estimated Cost</p>
                  <p className="font-semibold text-blue-900">₹{repair.estimatedCost.toFixed(2)}</p>
                </div>
              )}
              {repair.actualCost && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Actual Cost</p>
                  <p className="font-semibold text-green-900">₹{repair.actualCost.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Timeline History */}
          {repair.timeline && repair.timeline.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <button
                onClick={() => setExpandedTimeline(!expandedTimeline)}
                className="w-full flex items-center justify-between font-semibold text-gray-900"
              >
                <span>Timeline History</span>
                <span>{expandedTimeline ? '▾' : '▸'}</span>
              </button>

              {expandedTimeline && (
                <div className="mt-4 space-y-3">
                  {repair.timeline.map((entry, idx) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <div className="flex-shrink-0 pt-0.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-600">
                          <span className="font-medium text-gray-900 capitalize">{entry.oldStatus.replace(/_/g, ' ')}</span>
                          {' → '}
                          <span className="font-medium text-gray-900 capitalize">{entry.newStatus.replace(/_/g, ' ')}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{formatDate(entry.changedAt)}</p>
                        {entry.notes && <p className="text-xs text-gray-700 mt-1 italic">{entry.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        {repair.status !== 'completed' && (
          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex gap-3">
            {nextStatuses[repair.status] && (
              <button
                onClick={() => onStatusChange(repair.id, nextStatuses[repair.status])}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Update Status
              </button>
            )}
            {repair.status === 'ready_for_pickup' && (
              <button
                onClick={() => onComplete(repair.id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Complete Repair
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main AssetRepairTimeline Component ───
export default function AssetRepairTimeline() {
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  // Fetch all repairs
  const { data: repairs, loading, error, refetch } = useFetch('/api/assets/repairs', []);
  const { execute: updateStatus, loading: updatingStatus } = useApi();
  const { execute: completeRepair, loading: completing } = useApi();

  // Filter repairs
  const filteredRepairs = useMemo(() => {
    let filtered = repairs;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (showOverdueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      filtered = filtered.filter(r => r.status !== 'completed' && r.expectedReturnDate < today);
    }

    return filtered.sort((a, b) => {
      // Priority: overdue > expected return date > created date
      const aPriority = a.expectedReturnDate;
      const bPriority = b.expectedReturnDate;
      return aPriority.localeCompare(bPriority);
    });
  }, [repairs, filterStatus, showOverdueOnly]);

  const handleStatusChange = async (repairId, newStatus) => {
    await updateStatus(
      () => api.put(`/api/assets/repairs/${repairId}/update-status`, { newStatus }),
      'Status updated'
    );
    refetch();
  };

  const handleComplete = async (repairId) => {
    const actualReturnDate = new Date().toISOString().slice(0, 10);
    await completeRepair(
      () => api.post(`/api/assets/repairs/${repairId}/complete`, { actualReturnDate }),
      'Repair completed'
    );
    setSelectedRepair(null);
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Asset Repairs & Maintenance</h1>

        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {['initiated', 'in_transit', 'in_progress', 'ready_for_pickup', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition capitalize ${
                  filterStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Overdue Toggle */}
          <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition">
            <input
              type="checkbox"
              checked={showOverdueOnly}
              onChange={(e) => setShowOverdueOnly(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Overdue Only</span>
          </label>
        </div>
      </div>

      {/* Repairs List */}
      {filteredRepairs.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon="🔧"
            title={showOverdueOnly ? "No overdue repairs" : "No repairs found"}
            subtitle={showOverdueOnly ? "All repairs are on schedule" : "No assets are currently in repair"}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {filteredRepairs.map(repair => (
            <RepairCard
              key={repair.id}
              repair={repair}
              onSelect={setSelectedRepair}
              isSelected={selectedRepair?.id === repair.id}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedRepair && (
        <RepairDetailPanel
          repair={selectedRepair}
          onClose={() => setSelectedRepair(null)}
          onStatusChange={handleStatusChange}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
