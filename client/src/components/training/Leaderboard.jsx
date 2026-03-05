import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { Medal, Crown, Star } from 'lucide-react';

export default function Leaderboard() {
  const { data: leaderboard, loading, error } = useFetch('/api/training/leaderboard', {
    leaders: [],
    yourRank: null,
    yourTotalPoints: 0,
  });

  const getMedalColor = (rank) => {
    if (rank === 1) return 'text-yellow-500'; // Gold
    if (rank === 2) return 'text-gray-400'; // Silver
    if (rank === 3) return 'text-orange-600'; // Bronze
    return 'text-blue-500';
  };

  const getMedalIcon = (rank) => {
    if (rank <= 3) return <Medal className={`w-6 h-6 ${getMedalColor(rank)}`} />;
    return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
  };

  const getBackgroundColor = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500';
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-400';
    if (rank === 3) return 'bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-600';
    return 'bg-white border-l-4 border-gray-300 hover:bg-gray-50';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-8 h-8 text-yellow-500" />
          Learning Points Leaderboard
        </h1>
        <p className="text-gray-600 mt-2">Top performers in training completion and contributions</p>
      </div>

      {/* Your Rank Card (if not in top 50) */}
      {leaderboard.yourRank && leaderboard.yourRank > 50 && (
        <div className="mb-8 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-blue-600">#{leaderboard.yourRank}</span>
              <div>
                <p className="text-sm text-gray-600">Your Rank</p>
                <p className="text-lg font-semibold text-gray-900">You</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Points</p>
              <p className="text-3xl font-bold text-blue-600">{leaderboard.yourTotalPoints}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="space-y-2 mb-8">
        {leaderboard.leaders.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="Leaderboard coming soon"
            subtitle="No learning points have been awarded yet"
          />
        ) : (
          leaderboard.leaders.map((leader, idx) => {
            const rank = idx + 1;
            const isYou = leader.userId === leaderboard.currentUserId;

            return (
              <div
                key={leader.userId}
                className={`rounded-lg p-4 transition-all ${getBackgroundColor(rank)} ${isYou ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  {/* Rank + Name */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-8 flex justify-center">
                      {getMedalIcon(rank)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{leader.name}</p>
                        {isYou && (
                          <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs font-semibold rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{leader.department}</p>
                    </div>
                  </div>

                  {/* Point Breakdown */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Completion</p>
                      <p className="text-sm font-semibold text-green-600">{leader.completionPoints}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Contribution</p>
                      <p className="text-sm font-semibold text-purple-600">{leader.contributionPoints}</p>
                    </div>
                    <div className="text-right min-w-20">
                      <p className="text-xs text-gray-600 mb-1">Total</p>
                      <p className={`text-2xl font-bold ${
                        rank === 1 ? 'text-yellow-600' :
                        rank === 2 ? 'text-gray-600' :
                        rank === 3 ? 'text-orange-600' :
                        'text-blue-600'
                      }`}>
                        {leader.totalPoints}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats Row (for top 10) */}
                {rank <= 10 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 flex gap-4 text-xs text-gray-600">
                    <span>✓ {leader.trainingsCompleted} trainings completed</span>
                    <span>💡 {leader.contributionsApproved} contributions approved</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">Points Breakdown</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            <span className="text-gray-700">Training Completion</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
            <span className="text-gray-700">Contributions Approved</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏅</span>
            <span className="text-gray-700">Top 3 Performers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <span className="text-gray-700">High Achiever</span>
          </div>
        </div>
      </div>
    </div>
  );
}
