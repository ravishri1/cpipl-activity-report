import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import { formatDate, capitalize } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import AlertMessage from '../shared/AlertMessage';
import { BarChart3, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import VendorPerformanceCard from './vendor/VendorPerformanceCard';
import VendorRankingsList from './vendor/VendorRankingsList';
import VendorTrendChart from './vendor/VendorTrendChart';

export default function VendorAnalyticsDashboard() {
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Fetch all vendor performance scores
  const { 
    data: vendorData, 
    loading: loadingVendors, 
    error: vendorError, 
    refetch: refetchVendors 
  } = useFetch('/vendor-metrics/summary', { totalVendors: 0, scores: [] });

  // Fetch rankings with category filter
  const rankingsUrl = selectedCategory
    ? `/vendor-metrics/rankings?category=${selectedCategory}`
    : '/vendor-metrics/rankings';
  const { 
    data: rankingsData, 
    loading: loadingRankings, 
    error: rankingsError 
  } = useFetch(rankingsUrl, { total: 0, rankings: [] });

  // Fetch selected vendor metrics
  const selectedVendorUrl = selectedVendorId 
    ? `/vendor-metrics/vendor/${selectedVendorId}/metrics`
    : null;
  const { 
    data: vendorMetrics, 
    loading: loadingMetrics, 
    error: metricsError 
  } = useFetch(selectedVendorUrl, null);

  // Fetch selected vendor trends
  const selectedVendorTrendsUrl = selectedVendorId
    ? `/vendor-metrics/vendor/${selectedVendorId}/trends?timeWindowDays=90`
    : null;
  const { 
    data: vendorTrends, 
    loading: loadingTrends, 
    error: trendsError 
  } = useFetch(selectedVendorTrendsUrl, null);

  if (loadingVendors) return <LoadingSpinner />;
  if (vendorError) return <AlertMessage type="error" message={vendorError} />;

  // Get categories from vendors
  const categories = [...new Set(vendorData.scores?.map(v => v.vendor?.category))].filter(Boolean);
  
  // Filter vendors by category if selected
  const filteredVendors = selectedCategory
    ? vendorData.scores.filter(v => v.vendor?.category === selectedCategory)
    : vendorData.scores;

  // Get statistics
  const stats = {
    total: vendorData.totalVendors || 0,
    platinum: vendorData.scores?.filter(v => v.vendorTier === 'platinum').length || 0,
    gold: vendorData.scores?.filter(v => v.vendorTier === 'gold').length || 0,
    silver: vendorData.scores?.filter(v => v.vendorTier === 'silver').length || 0,
    bronze: vendorData.scores?.filter(v => v.vendorTier === 'bronze').length || 0,
    avgTrustScore: vendorData.scores?.length > 0
      ? (vendorData.scores.reduce((sum, v) => sum + v.trustScore, 0) / vendorData.scores.length).toFixed(1)
      : 0
  };

  // Get overdue/at-risk vendors
  const atRiskVendors = vendorData.scores?.filter(v => v.trustScore < 60) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Vendor Analytics</h1>
        <p className="mt-2 text-gray-600">
          Monitor vendor performance, trust scores, and repair quality metrics
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Trust Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgTrustScore}</p>
            </div>
            <Award className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platinum</p>
              <p className="text-2xl font-bold text-purple-600">{stats.platinum}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gold</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.gold}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">At Risk</p>
              <p className="text-2xl font-bold text-red-600">{atRiskVendors.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* At-Risk Alert */}
      {atRiskVendors.length > 0 && (
        <AlertMessage 
          type="warning" 
          message={`${atRiskVendors.length} vendor(s) with trust score below 60 - Review performance and address issues`}
        />
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Rankings & Categories */}
        <div className="lg:col-span-1 space-y-4">
          {/* Category Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Filter by Category</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === null
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'hover:bg-gray-50'
                }`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {capitalize(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Vendors List */}
          {loadingRankings ? (
            <LoadingSpinner />
          ) : rankingsError ? (
            <AlertMessage type="error" message={rankingsError} />
          ) : (
            <VendorRankingsList 
              rankings={rankingsData.rankings || []} 
              selectedVendorId={selectedVendorId}
              onSelectVendor={(vendor) => setSelectedVendorId(vendor.id)}
              loading={loadingRankings}
            />
          )}
        </div>

        {/* Right: Vendor Details */}
        <div className="lg:col-span-2 space-y-4">
          {selectedVendorId ? (
            <>
              {/* Performance Card */}
              {loadingMetrics ? (
                <LoadingSpinner />
              ) : metricsError ? (
                <AlertMessage type="error" message={metricsError} />
              ) : vendorMetrics ? (
                <VendorPerformanceCard 
                  vendor={vendorMetrics.vendor}
                  metrics={vendorMetrics.metrics}
                  performanceScore={vendorMetrics.performanceScore}
                />
              ) : null}

              {/* Trends Chart */}
              {loadingTrends ? (
                <LoadingSpinner />
              ) : trendsError ? (
                <AlertMessage type="error" message={trendsError} />
              ) : vendorTrends ? (
                <VendorTrendChart trends={vendorTrends} />
              ) : null}
            </>
          ) : (
            <EmptyState 
              icon="📊" 
              title="Select a Vendor" 
              subtitle="Choose a vendor from the list to view detailed analytics and performance metrics"
            />
          )}
        </div>
      </div>
    </div>
  );
}
