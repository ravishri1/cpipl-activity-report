import React, { useState, useMemo } from 'react';
import { Search, TrendingUp, Award, AlertCircle, Check } from 'lucide-react';
import { capitalize } from '../../../utils/formatters';

const TIER_ICONS = {
  platinum: '👑',
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉'
};

const TIER_COLORS = {
  platinum: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700'
  },
  gold: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700'
  },
  silver: {
    bg: 'bg-gray-100 hover:bg-gray-200',
    border: 'border-gray-300',
    badge: 'bg-gray-200 text-gray-700'
  },
  bronze: {
    bg: 'bg-orange-50 hover:bg-orange-100',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700'
  }
};

const getTrustScoreColor = (score) => {
  if (score >= 85) return 'text-green-600 bg-green-50';
  if (score >= 75) return 'text-blue-600 bg-blue-50';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

export default function VendorRankingsList({ rankings = [], selectedVendorId, onSelectVendor, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('trust_score');

  const filteredAndSorted = useMemo(() => {
    let filtered = rankings.filter(v =>
      (v.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       v.category?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      v.performanceScore
    );

    filtered.sort((a, b) => {
      const scoreA = a.performanceScore;
      const scoreB = b.performanceScore;

      switch (sortBy) {
        case 'trust_score':
          return (scoreB.trustScore || 0) - (scoreA.trustScore || 0);
        case 'on_time':
          return (scoreB.onTimePercentage || 0) - (scoreA.onTimePercentage || 0);
        case 'success_rate':
          return (scoreB.successRate || 0) - (scoreA.successRate || 0);
        case 'cost_accuracy':
          return (scoreB.costAccuracyPercent || 0) - (scoreA.costAccuracyPercent || 0);
        case 'name':
          return (a.vendorName || '').localeCompare(b.vendorName || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [rankings, searchTerm, sortBy]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Vendor Rankings</h3>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort Options */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'trust_score', label: 'Trust Score' },
            { value: 'on_time', label: 'On-Time' },
            { value: 'success_rate', label: 'Success Rate' },
            { value: 'cost_accuracy', label: 'Cost Accuracy' }
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                sortBy === option.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor List */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSorted.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {searchTerm ? 'No vendors match your search' : 'No vendors found'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {filteredAndSorted.map((vendor, index) => {
              const score = vendor.performanceScore;
              const tier = vendor.tier?.toLowerCase() || 'bronze';
              const tierColor = TIER_COLORS[tier];
              const isSelected = selectedVendorId === vendor.id;

              return (
                <button
                  key={vendor.id}
                  onClick={() => onSelectVendor(vendor)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    isSelected
                      ? `${tierColor.bg} ${tierColor.border} border-2`
                      : `${tierColor.bg} border-transparent hover:border-gray-300`
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="text-2xl">{TIER_ICONS[tier]}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {index + 1}. {vendor.vendorName}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {vendor.category || 'Uncategorized'} {vendor.location && `• ${vendor.location}`}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Score Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {/* Trust Score */}
                    <div className={`p-2 rounded text-xs ${getTrustScoreColor(score.trustScore || 0)}`}>
                      <p className="text-gray-600 text-xs">Trust Score</p>
                      <p className="font-bold text-sm">{(score.trustScore || 0).toFixed(0)}/100</p>
                    </div>

                    {/* On-Time */}
                    <div className={`p-2 rounded text-xs ${
                      score.onTimePercentage >= 85 ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'
                    }`}>
                      <p className="text-gray-600 text-xs">On-Time</p>
                      <p className="font-bold text-sm">{(score.onTimePercentage || 0).toFixed(0)}%</p>
                    </div>

                    {/* Success Rate */}
                    <div className={`p-2 rounded text-xs ${
                      score.successRate >= 95 ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'
                    }`}>
                      <p className="text-gray-600 text-xs">Success</p>
                      <p className="font-bold text-sm">{(score.successRate || 0).toFixed(0)}%</p>
                    </div>

                    {/* Cost Accuracy */}
                    <div className={`p-2 rounded text-xs ${
                      score.costAccuracyPercent >= 85 ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50'
                    }`}>
                      <p className="text-gray-600 text-xs">Cost Acuracy</p>
                      <p className="font-bold text-sm">{(score.costAccuracyPercent || 0).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Risk Badges */}
                  {(score.trustScore < 60 || score.onTimePercentage < 80) && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {score.trustScore < 60 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">⚠️ Low Trust</span>
                      )}
                      {score.onTimePercentage < 80 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">⏱️ Delays</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {filteredAndSorted.length > 0 && (
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
          Showing {filteredAndSorted.length} of {rankings.length} vendors
        </div>
      )}
    </div>
  );
}
