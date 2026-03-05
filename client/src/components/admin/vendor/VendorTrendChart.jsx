import React, { useMemo } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';

const LINE_COLORS = {
  trustScore: '#3b82f6',
  onTimePercentage: '#10b981',
  successRate: '#8b5cf6',
  costAccuracyPercent: '#f59e0b'
};

const ChartLine = ({ data, color, label, maxValue = 100, height = 60 }) => {
  if (!data || data.length === 0) return null;

  const points = data.map((value, idx) => ({
    x: (idx / (data.length - 1)) * 100,
    y: ((maxValue - value) / maxValue) * height
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <g key={label}>
      {/* Line */}
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" />
      {/* Fill under line */}
      <path
        d={`${pathD} L 100 ${height} L 0 ${height} Z`}
        fill={color}
        opacity="0.1"
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={`point-${i}`}
          cx={p.x}
          cy={p.y}
          r="2"
          fill={color}
          opacity="0.7"
        />
      ))}
    </g>
  );
};

export default function VendorTrendChart({ trends = [], vendorName = '' }) {
  const chartData = useMemo(() => {
    if (!trends || trends.length === 0) return null;

    const sortedTrends = [...trends].sort((a, b) =>
      new Date(a.month) - new Date(b.month)
    );

    const trustScores = sortedTrends.map(t => t.trustScore || 0);
    const onTimePercentages = sortedTrends.map(t => t.onTimePercentage || 0);
    const successRates = sortedTrends.map(t => t.successRate || 0);
    const costAccuracyPercents = sortedTrends.map(t => t.costAccuracyPercent || 0);

    return {
      labels: sortedTrends.map(t => {
        const date = new Date(t.month);
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }),
      trustScores,
      onTimePercentages,
      successRates,
      costAccuracyPercents,
      months: sortedTrends
    };
  }, [trends]);

  if (!chartData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <Calendar className="w-8 h-8 text-gray-400 mb-3" />
          <p className="text-gray-600">No trend data available</p>
          <p className="text-sm text-gray-500 mt-1">Historical data will appear here</p>
        </div>
      </div>
    );
  }

  const height = 120;
  const width = 100;

  return (
    <div className="space-y-6">
      {/* Trust Score Trend */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Trust Score Trend</h4>
          <TrendingUp className="w-4 h-4 text-blue-600" />
        </div>
        <svg width="100%" height={height + 30} className="overflow-visible">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((line, i) => (
            <g key={`grid-${i}`}>
              <line
                x1="40"
                y1={height - (height * line) / 100}
                x2={width}
                y2={height - (height * line) / 100}
                stroke="#e5e7eb"
                strokeDasharray="2"
              />
              <text
                x="35"
                y={height - (height * line) / 100 + 3}
                fontSize="12"
                fill="#9ca3af"
                textAnchor="end"
              >
                {line}
              </text>
            </g>
          ))}

          {/* Chart lines */}
          <g transform="translate(50, 10)">
            <ChartLine
              data={chartData.trustScores}
              color={LINE_COLORS.trustScore}
              label="Trust Score"
              height={height}
            />
          </g>

          {/* X-axis labels */}
          {chartData.labels.map((label, i) => (
            <text
              key={`label-${i}`}
              x={50 + (i / (chartData.labels.length - 1 || 1)) * (width - 50)}
              y={height + 25}
              fontSize="12"
              fill="#6b7280"
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      {/* Performance Metrics Comparison */}
      <div className="grid grid-cols-1 gap-6">
        {/* On-Time Percentage */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">On-Time Delivery %</h4>
          <svg width="100%" height={height + 30} className="overflow-visible">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((line, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1="40"
                  y1={height - (height * line) / 100}
                  x2={width}
                  y2={height - (height * line) / 100}
                  stroke="#e5e7eb"
                  strokeDasharray="2"
                />
                <text
                  x="35"
                  y={height - (height * line) / 100 + 3}
                  fontSize="12"
                  fill="#9ca3af"
                  textAnchor="end"
                >
                  {line}%
                </text>
              </g>
            ))}

            <g transform="translate(50, 10)">
              <ChartLine
                data={chartData.onTimePercentages}
                color={LINE_COLORS.onTimePercentage}
                label="On-Time"
                height={height}
              />
            </g>

            {chartData.labels.map((label, i) => (
              <text
                key={`label-${i}`}
                x={50 + (i / (chartData.labels.length - 1 || 1)) * (width - 50)}
                y={height + 25}
                fontSize="12"
                fill="#6b7280"
                textAnchor="middle"
              >
                {label}
              </text>
            ))}
          </svg>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Success Rate %</h4>
          <svg width="100%" height={height + 30} className="overflow-visible">
            {[0, 25, 50, 75, 100].map((line, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1="40"
                  y1={height - (height * line) / 100}
                  x2={width}
                  y2={height - (height * line) / 100}
                  stroke="#e5e7eb"
                  strokeDasharray="2"
                />
                <text
                  x="35"
                  y={height - (height * line) / 100 + 3}
                  fontSize="12"
                  fill="#9ca3af"
                  textAnchor="end"
                >
                  {line}%
                </text>
              </g>
            ))}

            <g transform="translate(50, 10)">
              <ChartLine
                data={chartData.successRates}
                color={LINE_COLORS.successRate}
                label="Success Rate"
                height={height}
              />
            </g>

            {chartData.labels.map((label, i) => (
              <text
                key={`label-${i}`}
                x={50 + (i / (chartData.labels.length - 1 || 1)) * (width - 50)}
                y={height + 25}
                fontSize="12"
                fill="#6b7280"
                textAnchor="middle"
              >
                {label}
              </text>
            ))}
          </svg>
        </div>

        {/* Cost Accuracy */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Cost Accuracy %</h4>
          <svg width="100%" height={height + 30} className="overflow-visible">
            {[0, 25, 50, 75, 100].map((line, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1="40"
                  y1={height - (height * line) / 100}
                  x2={width}
                  y2={height - (height * line) / 100}
                  stroke="#e5e7eb"
                  strokeDasharray="2"
                />
                <text
                  x="35"
                  y={height - (height * line) / 100 + 3}
                  fontSize="12"
                  fill="#9ca3af"
                  textAnchor="end"
                >
                  {line}%
                </text>
              </g>
            ))}

            <g transform="translate(50, 10)">
              <ChartLine
                data={chartData.costAccuracyPercents}
                color={LINE_COLORS.costAccuracyPercent}
                label="Cost Accuracy"
                height={height}
              />
            </g>

            {chartData.labels.map((label, i) => (
              <text
                key={`label-${i}`}
                x={50 + (i / (chartData.labels.length - 1 || 1)) * (width - 50)}
                y={height + 25}
                fontSize="12"
                fill="#6b7280"
                textAnchor="middle"
              >
                {label}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.trustScore }}></div>
            <span className="text-xs text-gray-700">Trust Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.onTimePercentage }}></div>
            <span className="text-xs text-gray-700">On-Time %</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.successRate }}></div>
            <span className="text-xs text-gray-700">Success Rate %</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.costAccuracyPercent }}></div>
            <span className="text-xs text-gray-700">Cost Accuracy %</span>
          </div>
        </div>
      </div>
    </div>
  );
}
