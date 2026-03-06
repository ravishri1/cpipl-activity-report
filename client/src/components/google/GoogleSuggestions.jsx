import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Calendar, CheckSquare, Loader2, Plus, ExternalLink, RefreshCw, Mail, MessageSquare } from 'lucide-react';

export default function GoogleSuggestions({ onAddTasks }) {
  const [connected, setConnected] = useState(null);
  const [data, setData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [fetched, setFetched] = useState(false);
  const [connectError, setConnectError] = useState('');

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
      setConnectError('');
      const res = await api.get('/google/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      console.error('Google auth error:', err);
      setConnectError(err.response?.data?.error || 'Failed to connect Google. Please try again.');
    }
  };

  const fetchAutoTasks = async () => {
    setLoadingData(true);
    try {
      const res = await api.get('/google/auto-tasks');
      setData(res.data);
      setFetched(true);
    } catch (err) {
      console.error('Fetch auto-tasks error:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const toggleItem = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build selectable items from all sources
  const getItems = () => {
    if (!data) return [];
    const items = [];

    // Calendar events
    (data.calendar || []).forEach((e) => {
      const time = e.startTime
        ? new Date(e.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '';
      items.push({
        key: `cal-${e.id}`,
        source: 'calendar',
        icon: Calendar,
        iconColor: 'text-blue-400',
        label: e.title + (time ? ` (${time})` : ''),
        description: `[Meeting] ${e.title}`,
      });
    });

    // Google Tasks
    (data.tasks || []).forEach((t) => {
      items.push({
        key: `task-${t.id}`,
        source: 'tasks',
        icon: CheckSquare,
        iconColor: 'text-green-400',
        label: t.title + (t.completed ? ' (Done)' : ''),
        description: `[Task] ${t.title}`,
        strikethrough: t.completed,
      });
    });

    // Email activity (single summary item)
    if (data.email) {
      items.push({
        key: 'email-summary',
        source: 'email',
        icon: Mail,
        iconColor: 'text-indigo-400',
        label: `Emails: ${data.email.sent} sent, ${data.email.received} received (${data.email.date})`,
        description: `[Email] Handled ${data.email.sent + data.email.received} emails (${data.email.sent} sent, ${data.email.received} received)`,
      });
    }

    // Chat activity (single summary item)
    if (data.chat) {
      items.push({
        key: 'chat-summary',
        source: 'chat',
        icon: MessageSquare,
        iconColor: 'text-purple-400',
        label: `Chat: ${data.chat.messagesSent} messages sent (${data.chat.date})`,
        description: `[Chat] Sent ${data.chat.messagesSent} chat messages`,
      });
    }

    return items;
  };

  const addSelected = () => {
    const items = getItems();
    const selectedItems = items
      .filter((item) => selected.has(item.key))
      .map((item) => ({ description: item.description, source: item.source }));

    if (selectedItems.length > 0 && onAddTasks) {
      onAddTasks(selectedItems);
    }
    setSelected(new Set());
  };

  if (loadingStatus) return null;

  if (!connected) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            Connect Google to auto-fill from Calendar, Tasks, Email & Chat
          </div>
          <button
            onClick={handleConnect}
            className="text-xs bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Connect Google
          </button>
        </div>
        {connectError && (
          <p className="mt-2 text-xs text-red-600">{connectError}</p>
        )}
      </div>
    );
  }

  const items = getItems();
  const hasCalendarError = data?.calendarError;
  const hasTasksError = data?.tasksError;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Google Workspace
        </p>
        <button
          onClick={fetchAutoTasks}
          disabled={loadingData}
          className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 disabled:opacity-50"
        >
          {loadingData ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {fetched ? 'Refresh' : 'Load Activities'}
        </button>
      </div>

      {fetched && (
        <>
          {/* Errors */}
          {hasCalendarError && (
            <p className="text-xs text-amber-600 mb-2">Calendar: {data.calendarError}</p>
          )}
          {hasTasksError && (
            <p className="text-xs text-amber-600 mb-2">Tasks: {data.tasksError}</p>
          )}

          {items.length === 0 ? (
            <p className="text-xs text-slate-400">No activities found from Google Workspace today.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white rounded px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.key)}
                      onChange={() => toggleItem(item.key)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor} flex-shrink-0`} />
                    <span className={`text-slate-700 truncate ${item.strikethrough ? 'line-through opacity-60' : ''}`}>
                      {item.label}
                    </span>
                  </label>
                );
              })}

              {selected.size > 0 && (
                <button
                  onClick={addSelected}
                  className="w-full mt-2 text-xs bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add {selected.size} item(s) as tasks
                </button>
              )}
            </div>
          )}

          {/* Data freshness note for email/chat */}
          {(data?.email || data?.chat) && (
            <p className="text-xs text-slate-400 mt-2">
              Email & Chat data from {data.email?.date || data.chat?.date} (2-day delay from Google Reports API)
            </p>
          )}
        </>
      )}
    </div>
  );
}
