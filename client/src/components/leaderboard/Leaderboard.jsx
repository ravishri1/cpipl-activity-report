import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { Trophy, Medal, Star, TrendingUp, Award, Mail, MessageSquare, Calendar, CheckSquare, FileText, ThumbsUp, RefreshCw, Heart } from 'lucide-react';
import AppreciationModal from './AppreciationModal';
import BudgetIndicator from './BudgetIndicator';
import AppreciationFeed from './AppreciationFeed';

const SOURCE_ICONS = {
  report: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Reports' },
  calendar: { icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Calendar' },
  task: { icon: CheckSquare, color: 'text-green-600', bg: 'bg-green-50', label: 'Tasks' },
  email: { icon: Mail, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Emails' },
  chat: { icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Chat' },
  thumbsup: { icon: ThumbsUp, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Thumbs Up' },
  appreciation: { icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Appreciation' },
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('weekly');
  const [leaderboard, setLeaderboard] = useState([]);
  const [myPoints, setMyPoints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appreciateUser, setAppreciateUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lbRes, myRes] = await Promise.all([
        api.get(`/points/leaderboard?period=${period}`),
        api.get(`/points/my?period=${period}`),
      ]);
      setLeaderboard(lbRes.data);
      setMyPoints(myRes.data);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  const myRank = leaderboard.findIndex((e) => e.user?.id === user?.id) + 1;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Leaderboard</h1>
            <p className="text-xs text-slate-400">Earn points by submitting reports, completing tasks & more</p>
          </div>
        </div>
        <button onClick={fetchData} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
          <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {['weekly', 'monthly', 'alltime'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p === 'alltime' ? 'All Time' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* My Points Summary */}
      {myPoints && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-5 mb-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-blue-200">Your Points ({period})</p>
              <p className="text-4xl font-bold">{myPoints.total}</p>
              {myRank > 0 && (
                <p className="text-sm text-blue-200 mt-1">
                  Rank #{myRank} of {leaderboard.length}
                </p>
              )}
            </div>
            <Star className="w-16 h-16 text-white/20" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(myPoints.breakdown || {}).map(([source, pts]) => {
              const info = SOURCE_ICONS[source];
              if (!info || !pts) return null;
              return (
                <span key={source} className="flex items-center gap-1 bg-white/15 text-white text-xs px-2.5 py-1 rounded-full">
                  <info.icon className="w-3 h-3" />
                  {info.label}: {pts}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No points earned yet for this period.</p>
          <p className="text-sm text-slate-400 mt-1">Submit reports to start earning!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Top 3 Podium */}
          {leaderboard.length >= 3 && (
            <div className="bg-gradient-to-b from-amber-50 to-white px-5 py-6 border-b border-slate-200">
              <div className="flex items-end justify-center gap-4">
                <PodiumCard entry={leaderboard[1]} position={2} />
                <PodiumCard entry={leaderboard[0]} position={1} />
                <PodiumCard entry={leaderboard[2]} position={3} />
              </div>
            </div>
          )}

          {/* Full List */}
          <div className="divide-y divide-slate-100">
            {leaderboard.map((entry) => (
              <div
                key={entry.user?.id}
                className={`px-5 py-3.5 flex items-center gap-4 ${
                  entry.user?.id === user?.id ? 'bg-blue-50/50' : ''
                }`}
              >
                <RankBadge rank={entry.rank} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">
                    {entry.user?.name}
                    {entry.user?.id === user?.id && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded ml-2">You</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{entry.user?.department}</p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.user?.id !== user?.id && (
                    <button
                      onClick={() => setAppreciateUser(entry.user)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                      title={`Appreciate ${entry.user?.name?.split(' ')[0]}`}
                    >
                      <Heart className="w-3 h-3" />
                    </button>
                  )}
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    <span className="text-lg font-bold text-slate-800">{entry.points}</span>
                    <span className="text-xs text-slate-400">pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Appreciation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            Recent Appreciations
          </h3>
          <AppreciationFeed refreshKey={refreshKey} />
        </div>
        <div>
          <BudgetIndicator refreshKey={refreshKey} />
        </div>
      </div>

      {/* Appreciation Modal */}
      {appreciateUser && (
        <AppreciationModal
          receiver={appreciateUser}
          onClose={() => setAppreciateUser(null)}
          onSuccess={() => {
            setAppreciateUser(null);
            setRefreshKey((k) => k + 1);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function PodiumCard({ entry, position }) {
  const heights = { 1: 'h-24', 2: 'h-20', 3: 'h-16' };
  const medals = {
    1: { color: 'from-amber-400 to-yellow-500', icon: '🥇', size: 'w-14 h-14 text-xl' },
    2: { color: 'from-slate-300 to-slate-400', icon: '🥈', size: 'w-12 h-12 text-lg' },
    3: { color: 'from-orange-300 to-orange-400', icon: '🥉', size: 'w-11 h-11 text-base' },
  };
  const m = medals[position];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${m.size} bg-gradient-to-br ${m.color} rounded-full flex items-center justify-center shadow-md`}>
        {m.icon}
      </div>
      <p className="font-semibold text-slate-800 text-sm text-center truncate max-w-[100px]">
        {entry.user?.name?.split(' ')[0]}
      </p>
      <p className="text-xs font-bold text-amber-600">{entry.points} pts</p>
      <div className={`w-20 ${heights[position]} bg-gradient-to-t from-amber-100 to-amber-50 rounded-t-lg border border-b-0 border-amber-200 flex items-center justify-center`}>
        <span className="text-2xl font-black text-amber-400">#{position}</span>
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank <= 3) {
    const colors = {
      1: 'bg-amber-100 text-amber-700 border-amber-300',
      2: 'bg-slate-100 text-slate-600 border-slate-300',
      3: 'bg-orange-100 text-orange-700 border-orange-300',
    };
    return (
      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${colors[rank]}`}>
        {rank}
      </span>
    );
  }
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-slate-400 bg-slate-50">
      {rank}
    </span>
  );
}
