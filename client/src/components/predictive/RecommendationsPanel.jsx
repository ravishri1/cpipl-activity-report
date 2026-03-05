import { useState } from 'react';
import { CheckCircle, Clock, AlertCircle, DollarSign, Wrench, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';

// Match urgency values from healthScoring.js generateRecommendations()
const URGENCY_LEVELS = {
  critical: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100',    icon: AlertCircle },
  high:     { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100', icon: Clock },
  medium:   { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100',   icon: Wrench },
  low:      { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100',  icon: CheckCircle },
};

// Map action keys → display labels
const ACTION_LABELS = {
  repair:                 'Repair Required',
  preventive_maintenance: 'Preventive Maintenance',
  inspection:             'Inspection',
  replacement_evaluation: 'Evaluate Replacement',
  follow_up_vendor:       'Follow Up with Vendor',
};

const ACTION_ICONS = {
  repair:                 Wrench,
  preventive_maintenance: Wrench,
  inspection:             AlertCircle,
  replacement_evaluation: DollarSign,
  follow_up_vendor:       Clock,
};

function RecommendationsPanel({ recommendations, onRefetch }) {
  const [updatingId, setUpdatingId] = useState(null);
  const { execute } = useApi();

  const handleStatusChange = async (recommendationId, newStatus) => {
    setUpdatingId(recommendationId);
    try {
      await execute(
        () => api.put(`/api/predictions/recommendations/${recommendationId}/status`, { status: newStatus }),
        `Recommendation marked as ${newStatus.replace('_', ' ')}`
      );
      onRefetch?.();
    } finally {
      setUpdatingId(null);
    }
  };

  // Group by urgency (critical first)
  const urgencyOrder = ['critical', 'high', 'medium', 'low'];
  const byUrgency = {};
  for (const rec of recommendations) {
    const u = rec.urgency || 'low';
    if (!byUrgency[u]) byUrgency[u] = [];
    byUrgency[u].push(rec);
  }

  // Count by status
  const statusCounts = {
    pending:     recommendations.filter(r => r.status === 'pending').length,
    in_progress: recommendations.filter(r => r.status === 'in_progress').length,
    completed:   recommendations.filter(r => r.status === 'completed').length,
    dismissed:   recommendations.filter(r => r.status === 'dismissed').length,
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Maintenance Recommendations</h2>
            <p className="text-sm text-slate-600 mt-1">
              {statusCounts.pending} pending • {statusCounts.in_progress} in progress • {statusCounts.completed} completed • {statusCounts.dismissed} dismissed
            </p>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-4 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className="text-center">
            <p className="text-xs font-semibold text-slate-600 uppercase">{status.replace('_', ' ')}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Recommendations List */}
      <div className="divide-y divide-slate-200">
        {recommendations.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-slate-600 font-medium">All assets are healthy</p>
            <p className="text-sm text-slate-500">No maintenance recommendations at this time</p>
          </div>
        ) : (
          urgencyOrder.filter(u => byUrgency[u]?.length > 0).map(urgency => {
            const recs = byUrgency[urgency];
            const urgencyConfig = URGENCY_LEVELS[urgency] || URGENCY_LEVELS.low;
            const UrgencyIcon = urgencyConfig.icon;

            return (
              <div key={urgency}>
                {/* Urgency Section Header */}
                <div className={`px-6 py-3 ${urgencyConfig.bg} border-b ${urgencyConfig.border} flex items-center gap-2`}>
                  <UrgencyIcon className={`w-4 h-4 ${urgencyConfig.color}`} />
                  <span className={`text-sm font-semibold ${urgencyConfig.color} uppercase`}>
                    {urgency} Priority ({recs.length})
                  </span>
                </div>

                {/* Recommendations */}
                {recs.map((rec) => {
                  const ActionIcon = ACTION_ICONS[rec.action] || Wrench;
                  const actionLabel = ACTION_LABELS[rec.action] || rec.action?.replace(/_/g, ' ') || 'Maintenance';

                  return (
                    <div key={rec.id} className={`p-4 hover:bg-slate-50 transition-colors ${updatingId === rec.id ? 'opacity-50' : ''}`}>
                      <div className="flex justify-between items-start gap-4">
                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <ActionIcon className="w-5 h-5 text-slate-700" />
                            <h3 className="font-semibold text-slate-900 capitalize">{actionLabel}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${urgencyConfig.badge} ${urgencyConfig.color}`}>
                              {urgency.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-sm text-slate-600 mb-3">{rec.reasoning}</p>

                          {/* Asset & Details */}
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <p className="text-xs text-slate-600 font-semibold">Asset</p>
                              <p className="text-slate-900">{rec.asset?.name || '—'}</p>
                              {rec.asset?.type && (
                                <p className="text-xs text-slate-500">{rec.asset.type}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-semibold">Estimated Cost</p>
                              <p className="text-slate-900 font-medium">
                                {rec.estimatedCost != null ? `₹${rec.estimatedCost.toLocaleString()}` : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-semibold">Failure Risk Reduction</p>
                              <p className="text-slate-900">
                                {rec.failureRiskReduction != null ? `${rec.failureRiskReduction}%` : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-600 font-semibold">Confidence</p>
                              <p className="text-slate-900">
                                {rec.confidenceScore != null ? `${rec.confidenceScore}%` : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              rec.status === 'completed'   ? 'bg-green-100 text-green-700' :
                              rec.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              rec.status === 'dismissed'   ? 'bg-slate-100 text-slate-500' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {(rec.status || 'pending').replace('_', ' ').toUpperCase()}
                            </span>
                            {rec.priority != null && (
                              <span className="text-xs text-slate-500">Priority: {rec.priority}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {rec.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(rec.id, 'in_progress')}
                                disabled={updatingId === rec.id}
                                className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                Start
                              </button>
                              <button
                                onClick={() => handleStatusChange(rec.id, 'dismissed')}
                                disabled={updatingId === rec.id}
                                className="px-3 py-2 text-sm font-medium bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </>
                          )}

                          {rec.status === 'in_progress' && (
                            <button
                              onClick={() => handleStatusChange(rec.id, 'completed')}
                              disabled={updatingId === rec.id}
                              className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              Complete
                            </button>
                          )}

                          {rec.status === 'completed' && (
                            <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded text-center">
                              ✓ Done
                            </span>
                          )}

                          {rec.status === 'dismissed' && (
                            <span className="px-3 py-2 text-sm font-medium text-slate-500 bg-slate-50 rounded text-center">
                              Dismissed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RecommendationsPanel;
