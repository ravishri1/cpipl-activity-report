import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Star,
  Award
} from 'lucide-react';
import { formatDate, formatINR } from '../../../utils/formatters';

const TIER_COLORS = {
  platinum: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  gold: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  silver: { bg: 'bg-gray-100', border: 'border-gray-300', badge: 'bg-gray-200 text-gray-700' },
  bronze: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' }
};

const getTrustScoreBg = (score) => {
  if (score >= 85) return 'bg-green-100 text-green-700';
  if (score >= 75) return 'bg-blue-100 text-blue-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const MetricCard = ({ label, value, icon: Icon, trend, unit = '', severity = 'normal' }) => {
  const isBad = severity === 'bad' && trend === 'down';
  const isGood = severity === 'good' && trend === 'up';
  
  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toFixed(1) : value}{unit}
          </p>
        </div>
        <div className={`p-2 rounded-lg ${
          isGood ? 'bg-green-100' : isBad ? 'bg-red-100' : 'bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 ${
            isGood ? 'text-green-600' : isBad ? 'text-red-600' : 'text-gray-600'
          }`} />
        </div>
      </div>
      {trend && (
        <div className={`mt-2 text-xs flex items-center ${
          trend === 'up' ? (severity === 'good' ? 'text-green-600' : 'text-red-600') : 
          'text-green-600'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {trend === 'up' ? 'Increasing' : 'Decreasing'} this period
        </div>
      )}
    </div>
  );
};

const PerformanceGauge = ({ score, label }) => {
  const percentage = (score / 100) * 360;
  const color = getTrustScoreBg(score);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-gray-200">
      <div className="relative w-32 h-32 mb-4">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          {/* Score circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={score >= 85 ? '#16a34a' : score >= 75 ? '#3b82f6' : score >= 60 ? '#eab308' : '#dc2626'}
            strokeWidth="8"
            strokeDasharray={`${(score / 100) * 282.7} 282.7`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className={`text-3xl font-bold ${getTrustScoreBg(score)}`}>{score}</span>
          <span className="text-xs text-gray-600">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-gray-700 text-center">{label}</p>
    </div>
  );
};

export default function VendorPerformanceCard({ vendor, metrics, performanceScore }) {
  if (!vendor) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <p className="text-gray-500 text-center">Select a vendor to view details</p>
      </div>
    );
  }

  const tierColor = TIER_COLORS[vendor.tier?.toLowerCase() || 'bronze'];
  const hasMetrics = metrics && metrics.length > 0;
  const recentMetrics = hasMetrics ? metrics.slice(0, 1)[0] : null;

  return (
    <div className="space-y-6">
      {/* Header with Tier Badge */}
      <div className={`${tierColor.bg} border ${tierColor.border} rounded-lg p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{vendor.vendorName}</h3>
            <p className="text-sm text-gray-600 mt-1">Category: {vendor.category || 'Unspecified'}</p>
          </div>
          <div className={`${tierColor.badge} px-3 py-1 rounded-full text-sm font-semibold`}>
            <span className="flex items-center">
              <Award className="w-4 h-4 mr-1" />
              {vendor.tier?.toUpperCase() || 'BRONZE'}
            </span>
          </div>
        </div>
        {vendor.location && (
          <p className="text-sm text-gray-700">📍 {vendor.location}</p>
        )}
        {vendor.contactPersonEmail && (
          <p className="text-sm text-gray-700 mt-1">✉️ {vendor.contactPersonEmail}</p>
        )}
      </div>

      {/* Trust Score Gauge */}
      {performanceScore && (
        <PerformanceGauge 
          score={performanceScore.trustScore || 0} 
          label="Overall Trust Score"
        />
      )}

      {/* Performance Metrics Grid */}
      {performanceScore && (
        <div className="grid grid-cols-2 gap-4">
          <MetricCard
            label="On-Time Delivery"
            value={performanceScore.onTimePercentage || 0}
            icon={Clock}
            trend={performanceScore.onTimePercentage >= 85 ? 'up' : 'down'}
            unit="%"
            severity="good"
          />
          <MetricCard
            label="Success Rate"
            value={performanceScore.successRate || 0}
            icon={CheckCircle}
            trend={performanceScore.successRate >= 95 ? 'up' : 'down'}
            unit="%"
            severity="good"
          />
          <MetricCard
            label="Avg Turnaround"
            value={performanceScore.avgTurnaroundDays || 0}
            icon={Clock}
            trend={performanceScore.avgTurnaroundDays <= 10 ? 'down' : 'up'}
            unit=" days"
            severity="good"
          />
          <MetricCard
            label="Cost Accuracy"
            value={performanceScore.costAccuracyPercent || 0}
            icon={DollarSign}
            trend={performanceScore.costAccuracyPercent >= 85 ? 'up' : 'down'}
            unit="%"
            severity="good"
          />
          <MetricCard
            label="Quality Rating"
            value={performanceScore.avgQualityScore || 0}
            icon={Star}
            unit=" / 5"
          />
          <MetricCard
            label="Total Repairs"
            value={performanceScore.totalRepairs || 0}
            icon={Award}
          />
        </div>
      )}

      {/* Recent Repair Details */}
      {recentMetrics && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            Latest Repair Metrics
          </h4>
          <div className="space-y-3">
            {recentMetrics.estimatedCost !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Estimated Cost:</span>
                <span className="font-medium">{formatINR(recentMetrics.estimatedCost)}</span>
              </div>
            )}
            {recentMetrics.actualCost !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Actual Cost:</span>
                <span className="font-medium">{formatINR(recentMetrics.actualCost)}</span>
              </div>
            )}
            {recentMetrics.costOverrunPercent !== undefined && recentMetrics.costOverrunPercent > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Cost Overrun:</span>
                <span className="font-medium text-red-600">{recentMetrics.costOverrunPercent.toFixed(1)}%</span>
              </div>
            )}
            {recentMetrics.daysInRepair !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Days in Repair:</span>
                <span className="font-medium">{recentMetrics.daysInRepair}</span>
              </div>
            )}
            {recentMetrics.customerSatisfaction && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Customer Satisfaction:</span>
                <span className="font-medium">
                  {'⭐'.repeat(recentMetrics.customerSatisfaction)} ({recentMetrics.customerSatisfaction}/5)
                </span>
              </div>
            )}
            {recentMetrics.reworkRequired && (
              <div className="flex items-center text-sm text-orange-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                Rework Required
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Indicators */}
      {performanceScore && (
        <div className="space-y-2">
          {performanceScore.trustScore < 60 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Low Trust Score</p>
                <p className="text-sm text-red-600">This vendor may need performance review</p>
              </div>
            </div>
          )}
          {performanceScore.onTimePercentage < 80 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-700">Delivery Delays</p>
                <p className="text-sm text-yellow-600">On-time rate below 80%</p>
              </div>
            </div>
          )}
          {performanceScore.successRate < 90 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-700">Quality Concerns</p>
                <p className="text-sm text-orange-600">Success rate below 90%</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
