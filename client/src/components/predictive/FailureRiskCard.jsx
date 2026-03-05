import { AlertTriangle, Clock, Zap } from 'lucide-react';

function FailureRiskCard({ prob30, prob60, prob90, confidence, riskFactors = [] }) {
  // Get color based on probability
  const getColor = (prob) => {
    if (prob >= 80) return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' };
    if (prob >= 60) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100' };
    if (prob >= 40) return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100' };
    return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100' };
  };

  const color30 = getColor(prob30);
  const color60 = getColor(prob60);
  const color90 = getColor(prob90);

  const confidenceLevel = confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';
  const confidenceColor = confidence >= 0.8 ? 'text-green-600' : confidence >= 0.6 ? 'text-yellow-600' : 'text-orange-600';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Failure Risk</h3>
        <div className="p-2 rounded-lg bg-red-50">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      </div>

      {/* Confidence Level */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex justify-between items-center">
        <div>
          <p className="text-xs text-slate-600 font-semibold uppercase">Model Confidence</p>
          <p className={`text-lg font-bold ${confidenceColor}`}>{Math.round(confidence * 100)}%</p>
        </div>
        <p className={`text-sm font-semibold ${confidenceColor}`}>{confidenceLevel}</p>
      </div>

      {/* Failure Probability Timeline */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-900">30-60-90 Day Outlook</p>
        
        {/* 30 Days */}
        <div className={`p-3 rounded-lg ${color30.bg} border ${color30.border}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-semibold text-slate-900">30 Days</span>
            </div>
            <span className={`text-lg font-bold ${color30.text}`}>{Math.round(prob30)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                prob30 >= 80 ? 'bg-red-600' :
                prob30 >= 60 ? 'bg-orange-500' :
                prob30 >= 40 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${prob30}%` }}
            />
          </div>
          <p className={`text-xs mt-2 ${color30.text}`}>
            {prob30 >= 80 && '⚠️ Critical: Failure is highly likely'}
            {prob30 >= 60 && prob30 < 80 && '⚠️ High: Monitor continuously'}
            {prob30 >= 40 && prob30 < 60 && '⚡ Medium: Plan maintenance'}
            {prob30 < 40 && '✓ Low: Asset is stable'}
          </p>
        </div>

        {/* 60 Days */}
        <div className={`p-3 rounded-lg ${color60.bg} border ${color60.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-900">60 Days</span>
            <span className={`text-lg font-bold ${color60.text}`}>{Math.round(prob60)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                prob60 >= 80 ? 'bg-red-600' :
                prob60 >= 60 ? 'bg-orange-500' :
                prob60 >= 40 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${prob60}%` }}
            />
          </div>
        </div>

        {/* 90 Days */}
        <div className={`p-3 rounded-lg ${color90.bg} border ${color90.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-900">90 Days</span>
            <span className={`text-lg font-bold ${color90.text}`}>{Math.round(prob90)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                prob90 >= 80 ? 'bg-red-600' :
                prob90 >= 60 ? 'bg-orange-500' :
                prob90 >= 40 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${prob90}%` }}
            />
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      {riskFactors && riskFactors.length > 0 && (
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Risk Factors
          </p>
          <div className="space-y-2">
            {riskFactors.slice(0, 5).map((factor, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-xs font-bold text-slate-500 mt-0.5">•</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-900">{factor.name}</p>
                  <p className="text-xs text-slate-600">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700">
          <span className="font-semibold">ℹ️ Note:</span> Predictions are based on historical repair data and asset characteristics. 
          Schedule preventive maintenance to reduce failure risk.
        </p>
      </div>
    </div>
  );
}

export default FailureRiskCard;
