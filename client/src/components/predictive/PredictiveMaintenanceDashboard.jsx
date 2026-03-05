import { useState } from 'react';
import { TrendingUp, AlertTriangle, Wrench } from 'lucide-react';
import api from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import HealthScoreCard from './HealthScoreCard';
import FailureRiskCard from './FailureRiskCard';
import RecommendationsPanel from './RecommendationsPanel';
import MaintenanceInsightsChart from './MaintenanceInsightsChart';

const RISK_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 0
};

const RISK_COLORS = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100' },
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' }
};

function PredictiveMaintenanceDashboard() {
  const [filterRiskLevel, setFilterRiskLevel] = useState(null);
  const [sortBy, setSortBy] = useState('risk_desc');
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  // Fetch at-risk assets
  const atRiskUrl = filterRiskLevel 
    ? `/api/predictions/at-risk?riskLevel=${filterRiskLevel}&limit=50&sort=${sortBy}`
    : `/api/predictions/at-risk?limit=50&sort=${sortBy}`;
  
  const { 
    data: atRiskAssets = [], 
    loading: loadingAtRisk, 
    error: errorAtRisk, 
    refetch: refetchAtRisk 
  } = useFetch(atRiskUrl, []);

  // Fetch recommendations
  const { 
    data: recommendations = [], 
    loading: loadingRecs, 
    error: errorRecs, 
    refetch: refetchRecs 
  } = useFetch('/api/predictions/recommendations?status=pending&limit=20', []);

  // Get selected asset details
  const selectedAssetUrl = selectedAsset 
    ? `/api/predictions/asset/${selectedAsset}/health`
    : null;
  
  const { 
    data: assetDetails = null, 
    loading: loadingAsset, 
    error: errorAsset 
  } = useFetch(selectedAssetUrl, null);

  const { execute } = useApi();

  // Get risk level for asset
  const getRiskLevel = (probability) => {
    if (probability >= RISK_THRESHOLDS.critical) return 'critical';
    if (probability >= RISK_THRESHOLDS.high) return 'high';
    if (probability >= RISK_THRESHOLDS.medium) return 'medium';
    return 'low';
  };

  // Recalculate all predictions
  const handleRecalculateAll = async () => {
    await execute(
      () => api.post('/api/predictions/recalculate-all'),
      'Predictions recalculation initiated'
    );
    setTimeout(() => {
      refetchAtRisk();
      refetchRecs();
    }, 2000);
  };

  if (loadingAtRisk && !atRiskAssets.length) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Predictive Maintenance</h1>
          <p className="text-slate-600 mt-1">ML-powered asset failure predictions and recommendations</p>
        </div>
        <button
          onClick={handleRecalculateAll}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Recalculate All
        </button>
      </div>

      {/* Alerts */}
      {errorAtRisk && <AlertMessage type="error" message={errorAtRisk} />}
      {errorAsset && <AlertMessage type="error" message={errorAsset} />}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: At-Risk Assets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(RISK_COLORS).map(([level, colors]) => {
              const count = atRiskAssets.filter(a => getRiskLevel(a.prob30) === level).length;
              return (
                <div
                  key={level}
                  onClick={() => setFilterRiskLevel(filterRiskLevel === level ? null : level)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${colors.bg} border ${colors.border} hover:shadow-md`}
                >
                  <p className={`text-sm font-semibold ${colors.text} uppercase`}>{level}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
                  <p className="text-xs text-slate-600 mt-1">{count === 1 ? 'asset' : 'assets'}</p>
                </div>
              );
            })}
          </div>

          {/* At-Risk Assets List */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-900">At-Risk Assets</h2>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="risk_desc">Highest Risk First</option>
                <option value="risk_asc">Lowest Risk First</option>
                <option value="age_desc">Oldest Assets First</option>
              </select>
            </div>

            <div className="divide-y divide-slate-200">
              {atRiskAssets.length === 0 ? (
                <EmptyState 
                  icon="✓" 
                  title="No Assets at Risk" 
                  subtitle="All assets are operating within healthy parameters"
                />
              ) : (
                atRiskAssets.map((asset) => {
                  const riskLevel = getRiskLevel(asset.prob30);
                  const colors = RISK_COLORS[riskLevel];
                  const isSelected = selectedAsset === asset.id;
                  
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAsset(isSelected ? null : asset.id)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-slate-900">{asset.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${colors.badge} ${colors.text}`}>
                              {riskLevel.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{asset.assetTag}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">{Math.round(asset.prob30)}%</p>
                          <p className="text-xs text-slate-600">30-day risk</p>
                        </div>
                      </div>

                      {/* Risk Bars */}
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2 text-xs font-medium">
                          <span className="flex-1">30 days</span>
                          <span className="flex-1">60 days</span>
                          <span className="flex-1">90 days</span>
                        </div>
                        <div className="flex gap-2">
                          {[asset.prob30, asset.prob60, asset.prob90].map((prob, idx) => (
                            <div
                              key={idx}
                              className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"
                            >
                              <div
                                className={`h-full transition-all ${
                                  prob >= 80 ? 'bg-red-600' : 
                                  prob >= 60 ? 'bg-orange-500' : 
                                  prob >= 40 ? 'bg-yellow-500' : 
                                  'bg-green-500'
                                }`}
                                style={{ width: `${prob}%` }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Details Panel */}
        <div className="space-y-6">
          {selectedAsset && assetDetails ? (
            <>
              {/* Health Score Card */}
              <HealthScoreCard
                assetId={selectedAsset}
                healthScore={assetDetails.healthScore}
                riskLevel={assetDetails.riskLevel}
                trend={assetDetails.trend}
              />

              {/* Failure Risk Card */}
              <FailureRiskCard
                assetId={selectedAsset}
                prob30={assetDetails.predictions?.prob30}
                prob60={assetDetails.predictions?.prob60}
                prob90={assetDetails.predictions?.prob90}
                confidence={assetDetails.predictions?.confidence}
                riskFactors={assetDetails.predictions?.riskFactors}
              />

              {/* Asset Details */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                <h3 className="font-semibold text-slate-900">Asset Details</h3>
                <div className="space-y-2 text-sm">
                  {assetDetails.asset && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Type:</span>
                        <span className="font-medium text-slate-900">{assetDetails.asset.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Status:</span>
                        <span className="font-medium text-slate-900">{assetDetails.asset.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Location:</span>
                        <span className="font-medium text-slate-900">{assetDetails.asset.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Value:</span>
                        <span className="font-medium text-slate-900">₹{assetDetails.asset.currentValue?.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState 
              icon="📊" 
              title="Select an Asset" 
              subtitle="Click an asset to view detailed health scores and recommendations"
            />
          )}
        </div>
      </div>

      {/* Recommendations Section */}
      {recommendations.length > 0 && (
        <RecommendationsPanel 
          recommendations={recommendations}
          onRefetch={refetchRecs}
        />
      )}

      {/* Historical Trends */}
      {selectedAsset && assetDetails && (
        <MaintenanceInsightsChart
          assetId={selectedAsset}
          healthHistory={assetDetails.healthHistory || []}
        />
      )}
    </div>
  );
}

export default PredictiveMaintenanceDashboard;
