import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Heart, RefreshCw } from 'lucide-react';

export default function AppreciationFeed({ refreshKey = 0 }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/points/appreciation-feed?limit=10')
      .then((res) => setFeed(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-6">
        <Heart className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No appreciations yet. Be the first!</p>
      </div>
    );
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  return (
    <div className="space-y-2">
      {feed.map((item) => (
        <div key={item.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50">
          <Heart className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{item.giver?.name?.split(' ')[0]}</span>
              <span className="text-slate-400"> appreciated </span>
              <span className="font-medium">{item.receiver?.name?.split(' ')[0]}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">"{item.reason}"</p>
            <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
          </div>
          <span className="text-xs font-medium text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">
            +{item.points}
          </span>
        </div>
      ))}
    </div>
  );
}
