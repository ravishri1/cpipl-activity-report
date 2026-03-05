import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

const RISK_LEVELS = {
  low: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
};

const TREND_ICONS = {
  improving: { Icon: TrendingUp, color: 'text-green-600' },
  stable: { Icon: Activity, color: 'text-slate-600' },
  declining: { Icon: TrendingDown, color: 'text-red-600' }
};

function HealthScoreCard({ assetId, healthScore, riskLevel, trend, breakdown }) {
  const riskConfig = RISK_LEVELS[riskLevel] || RISK_LEVELS.medium;
  const trendConfig = TREND_ICONS[trend] || TREND_ICONS.stable;
  const TrendIcon = trendConfig.Icon;

  // Determine color gradient based on score
  let scoreColor = 'text-red-600';
  if (healthScore >= 80) scoreColor = 'text-green-600';
  else if (healthScore >= 60) scoreColor = 'text-yellow-600';
  else if (healthScore >= 40) scoreColor = 'text-orange-600';

  return (
    <div className={`bg-white rounded-lg border ${riskConfig.border} p-6 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Health Score</h3>
        <div className={`p-2 rounded-lg ${riskConfig.bg}`}>
          <Activity className={`w-5 h-5 ${riskConfig.color}`} />
        </div>
      </div>

      {/* Score Circle */}
      <div className="flex justify-center">
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
          <div className="absolute inset-1 rounded-full bg-white flex items-center justify-center">
            <div className="text-center">
              <p className={`text-3xl font-bold ${scoreColor}`}>
                {Math.round(healthScore)}
              </p>
              <p className="text-xs text-slate-600">out of 100</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Level Badge */}
      <div className={`px-3 py-2 rounded-lg ${riskConfig.bg} border ${riskConfig.border}`}>
        <p className={`text-xs font-semibold ${riskConfig.color} text-center uppercase`}>
          Risk Level: {riskLevel}
        </p>
      </div>

      {/* Trend */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <TrendIcon className={`w-4 h-4 ${trendConfig.color}`} />
        <span className="text-slate-600">Status: <span className="font-semibold text-slate-900">{trend.charAt(0).toUpperCase() + trend.slice(1)}</span></span>
      </div>

      {/* Health Breakdown */}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold text-slate-600 uppercase">Score Components</p>
        <div className="space-y-2">
          {[
            { label: 'Asset Age',      value: breakdown?.ageScore ?? null },
            { label: 'Condition',      value: breakdown?.conditionScore ?? null },
            { label: 'Repair History', value: breakdown?.repairHistoryScore ?? null },
            { label: 'Warranty',       value: breakdown?.warrantyScore ?? null },
          ].map((component, idx) => (
            <div key={idx}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">{component.label}</span>
                <span className="font-semibold text-slate-900">
                  {component.value !== null ? component.value : '—'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    component.value === null ? 'bg-slate-300' :
                    component.value >= 80    ? 'bg-green-500' :
                    component.value >= 60    ? 'bg-yellow-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: component.value !== null ? `${component.value}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-3 rounded-lg ${riskConfig.bg} border ${riskConfig.border}`}>
        <p className="text-xs font-semibold text-slate-900 mb-1">Status Update</p>
        <p className={`text-xs ${riskConfig.color}`}>
          {riskLevel === 'low' && 'Asset is operating optimally. Continue scheduled maintenance.'}
          {riskLevel === 'medium' && 'Monitor closely. Plan maintenance within next 30 days.'}
          {riskLevel === 'high' && 'Schedule maintenance immediately. High failure risk detected.'}
          {riskLevel === 'critical' && 'URGENT: Take immediate action to prevent asset failure.'}
        </p>
      </div>
    </div>
  );
}

export default HealthScoreCard;
