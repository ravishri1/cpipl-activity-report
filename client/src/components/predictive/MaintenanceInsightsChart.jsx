import { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';

function MaintenanceInsightsChart({ assetId, healthHistory = [] }) {
  const [timeRange, setTimeRange] = useState('6');

  // Fetch health trend
  const { 
    data: trendData = null, 
    loading 
  } = useFetch(`/predictions/insights/${assetId}/trend?months=${timeRange}`, null);

  // Use trendData.data array if available, otherwise fall back to passed healthHistory
  const history = trendData?.data || healthHistory || [];

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <BarChart3 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-600 font-medium">No historical data available</p>
        <p className="text-sm text-slate-500">Historical trends will appear as data accumulates</p>
      </div>
    );
  }

  // Find min/max for scaling
  const scores = history.map(h => h.score || h.overallHealthScore || 0);
  const maxScore = Math.max(...scores, 100);
  const minScore = Math.min(...scores, 0);
  const range = maxScore - minScore;

  // Get max bar height
  const maxBarHeight = 200;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">Health Trend History</h2>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="1">Last 1 Month</option>
          <option value="3">Last 3 Months</option>
          <option value="6">Last 6 Months</option>
          <option value="12">Last 12 Months</option>
          <option value="24">Last 24 Months</option>
        </select>
      </div>

      {/* Chart Container */}
      <div className="p-6 space-y-6">
        {/* Chart */}
        <div className="flex items-end justify-between gap-2 h-64">
          {history.map((point, idx) => {
            const score = point.score || point.overallHealthScore || 0;
            const percentage = range > 0 ? ((score - minScore) / range) * 100 : 50;
            const height = (percentage / 100) * maxBarHeight;

            // Determine bar color based on score
            let barColor = 'bg-red-500';
            if (score >= 80) barColor = 'bg-green-500';
            else if (score >= 60) barColor = 'bg-yellow-500';
            else if (score >= 40) barColor = 'bg-orange-500';

            const date = point.date || new Date(point.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
              >
                {/* Bar */}
                <div className="relative h-full w-full flex items-end justify-center">
                  <div
                    className={`w-full ${barColor} rounded-t transition-all group-hover:opacity-75 hover:shadow-lg`}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {Math.round(score)}
                    </div>
                  </div>
                </div>

                {/* Label */}
                <p className="text-xs text-slate-600 text-center font-medium">{date}</p>
              </div>
            );
          })}
        </div>

        {/* Y-Axis Scale */}
        <div className="flex gap-4">
          <div className="text-xs text-slate-600 text-right -ml-8">
            <div>100</div>
            <div style={{ height: '192px' }} className="flex items-between flex-col justify-between">
              <div>75</div>
              <div>50</div>
              <div>25</div>
              <div>0</div>
            </div>
          </div>
          <div className="flex-1"></div>
        </div>

        {/* Legend */}
        <div className="border-t border-slate-200 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { score: 80, label: 'Good (80+)', color: 'bg-green-500' },
            { score: 60, label: 'Fair (60-79)', color: 'bg-yellow-500' },
            { score: 40, label: 'Poor (40-59)', color: 'bg-orange-500' },
            { score: 0, label: 'Critical (<40)', color: 'bg-red-500' }
          ].map((item) => (
            <div key={item.score} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${item.color}`} />
              <span className="text-xs text-slate-600">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        {history.length > 0 && (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Current Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {Math.round(scores[scores.length - 1])}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Average</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold uppercase">Trend</p>
              <p className={`text-2xl font-bold mt-1 ${
                scores[scores.length - 1] > (scores[0] || 0) ? 'text-green-600' :
                scores[scores.length - 1] < (scores[0] || 0) ? 'text-red-600' :
                'text-slate-900'
              }`}>
                {scores[scores.length - 1] > (scores[0] || 0) ? '↑' :
                 scores[scores.length - 1] < (scores[0] || 0) ? '↓' :
                 '→'}
              </p>
            </div>
          </div>
        )}

        {/* Insights */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">Key Insights</p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Health score is calculated from asset age, repair history, and vendor performance</li>
            <li>• Regular maintenance helps maintain consistent health scores</li>
            <li>• Declining trends indicate increased wear and upcoming maintenance needs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceInsightsChart;
