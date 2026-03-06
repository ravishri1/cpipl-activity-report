import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { Trophy, Award, BookOpen, Star } from 'lucide-react';

export default function MyPointsDashboard() {
  const { data: pointData, loading, error } = useFetch('/training/my-points', {
    totalPoints: 0,
    completionPoints: 0,
    contributionPoints: 0,
    pointHistory: [],
    stats: {
      trainingsCompleted: 0,
      trainingsWithinDeadline: 0,
      contributionsApproved: 0,
      contributionsPending: 0,
      rank: null,
      totalPlayers: 0,
    },
  });

  const [filter, setFilter] = useState('all'); // all, completion, contribution

  const filteredHistory = useMemo(() => {
    if (!pointData.pointHistory) return [];
    
    if (filter === 'completion') {
      return pointData.pointHistory.filter(p => (p.description || '').includes('Training Completion'));
    }
    if (filter === 'contribution') {
      return pointData.pointHistory.filter(p => (p.description || '').includes('Training Value Added') || (p.description || '').includes('Contribution'));
    }
    return pointData.pointHistory;
  }, [pointData.pointHistory, filter]);

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-8 h-8 text-yellow-500" />
          Your Learning Points
        </h1>
        <p className="text-gray-600 mt-2">Earn points by completing trainings and contributing to learning modules</p>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Points Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-600 text-sm font-semibold mb-1">Total Points</p>
              <p className="text-4xl font-bold text-blue-900">{pointData.totalPoints}</p>
              {pointData.stats.rank && (
                <p className="text-blue-700 text-sm mt-2">
                  Rank: <strong>#{pointData.stats.rank}</strong> of {pointData.stats.totalPlayers}
                </p>
              )}
            </div>
            <Trophy className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        {/* Completion Points Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-600 text-sm font-semibold mb-1">Completion Points</p>
              <p className="text-4xl font-bold text-green-900">{pointData.completionPoints}</p>
              <p className="text-green-700 text-xs mt-2">
                {pointData.stats.trainingsWithinDeadline}/{pointData.stats.trainingsCompleted} on-time
              </p>
            </div>
            <BookOpen className="w-10 h-10 text-green-500" />
          </div>
        </div>

        {/* Contribution Points Card */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-600 text-sm font-semibold mb-1">Contribution Points</p>
              <p className="text-4xl font-bold text-purple-900">{pointData.contributionPoints}</p>
              <p className="text-purple-700 text-xs mt-2">
                {pointData.stats.contributionsApproved} approved
              </p>
            </div>
            <Award className="w-10 h-10 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Trainings Completed</p>
          <p className="text-2xl font-bold text-gray-900">{pointData.stats.trainingsCompleted}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Within Deadline</p>
          <p className="text-2xl font-bold text-green-600">{pointData.stats.trainingsWithinDeadline}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Approved Contributions</p>
          <p className="text-2xl font-bold text-purple-600">{pointData.stats.contributionsApproved}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-sm mb-1">Pending Contributions</p>
          <p className="text-2xl font-bold text-amber-600">{pointData.stats.contributionsPending}</p>
        </div>
      </div>

      {/* Point History */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { value: 'all', label: 'All Points', count: pointData.pointHistory?.length || 0 },
            { value: 'completion', label: 'Completions', count: pointData.pointHistory?.filter(p => (p.description || '').includes('Training Completion')).length || 0 },
            { value: 'contribution', label: 'Contributions', count: pointData.pointHistory?.filter(p => (p.description || '').includes('Training Value Added') || (p.description || '').includes('Contribution')).length || 0 },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.value
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-gray-600 border-transparent hover:text-gray-900'
              }`}
            >
              {tab.label} <span className="ml-1 text-gray-500">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Point History List */}
        <div className="divide-y divide-gray-200">
          {filteredHistory.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No points yet"
              subtitle={
                filter === 'all'
                  ? 'Complete trainings and contribute to earn points'
                  : `No ${filter} points yet`
              }
            />
          ) : (
            filteredHistory.slice(0, 50).map(point => (
              <div key={point.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{point.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(point.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${point.points > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {point.points > 0 ? '+' : ''}{point.points}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredHistory.length > 50 && (
          <div className="px-6 py-4 bg-gray-50 text-center">
            <p className="text-sm text-gray-600">Showing 50 most recent • {filteredHistory.length} total</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>How to earn points:</strong>
          <br />
          💎 <strong>Completion Points</strong>: Earn points by completing assigned trainings within 90 days of publication.
          <br />
          ✨ <strong>Contribution Points</strong>: Earn points when your training contributions are approved by your manager. (Addition: 50pts, Improvement: 40pts, Resource: 35pts, Correction: 25pts)
        </p>
      </div>
    </div>
  );
}
