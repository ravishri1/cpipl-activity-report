import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Calendar, CheckSquare, Loader2, Plus, ExternalLink, RefreshCw } from 'lucide-react';

export default function GoogleSuggestions({ onAddToReport }) {
  const [connected, setConnected] = useState(null); // null = loading, true/false
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await api.get('/google/status');
        setConnected(res.data.connected);
      } catch {
        setConnected(false);
      } finally {
        setLoadingStatus(false);
      }
    };
    checkStatus();
  }, []);

  const handleConnect = async () => {
    try {
      const res = await api.get('/google/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Google auth error:', err);
    }
  };

  const fetchCalendarAndTasks = async () => {
    setLoadingData(true);
    try {
      const [calRes, taskRes] = await Promise.all([
        api.get('/google/calendar-events'),
        api.get('/google/tasks'),
      ]);
      setEvents(calRes.data || []);
      setTasks(taskRes.data || []);
      setFetched(true);
    } catch (err) {
      console.error('Fetch calendar/tasks error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const toggleEvent = (id) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTask = (id) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    const lines = [];
    events.filter((e) => selectedEvents.has(e.id)).forEach((e) => {
      const time = e.startTime ? new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
      lines.push(`[Meeting] ${e.title}${time ? ` (${time})` : ''}`);
    });
    tasks.filter((t) => selectedTasks.has(t.id)).forEach((t) => {
      lines.push(`[Task] ${t.title}${t.completed ? ' (Done)' : ''}`);
    });

    if (lines.length > 0 && onAddToReport) {
      onAddToReport(lines.join('\n'));
    }
    setSelectedEvents(new Set());
    setSelectedTasks(new Set());
  };

  if (loadingStatus) return null;

  if (!connected) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            Connect Google to auto-fill from Calendar & Tasks
          </div>
          <button
            onClick={handleConnect}
            className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Connect Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Google Calendar & Tasks
        </p>
        <button
          onClick={fetchCalendarAndTasks}
          disabled={loadingData}
          className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 disabled:opacity-50"
        >
          {loadingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {fetched ? 'Refresh' : 'Load'}
        </button>
      </div>

      {fetched && (
        <>
          {events.length === 0 && tasks.length === 0 ? (
            <p className="text-xs text-slate-400">No events or tasks found for today.</p>
          ) : (
            <div className="space-y-2">
              {/* Calendar Events */}
              {events.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(e.id)}
                    onChange={() => toggleEvent(e.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                  />
                  <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-slate-700 truncate">{e.title}</span>
                  {e.startTime && (
                    <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                      {new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                </label>
              ))}

              {/* Tasks */}
              {tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selectedTasks.has(t.id)}
                    onChange={() => toggleTask(t.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-green-600"
                  />
                  <CheckSquare className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  <span className={`text-slate-700 truncate ${t.completed ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                </label>
              ))}

              {/* Add Selected Button */}
              {(selectedEvents.size > 0 || selectedTasks.size > 0) && (
                <button
                  onClick={addSelected}
                  className="w-full mt-2 text-xs bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add {selectedEvents.size + selectedTasks.size} item(s) to report
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
