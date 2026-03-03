import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, BookOpen, Megaphone, Shield, LifeBuoy, Info, CalendarDays, Receipt, Clock, ClipboardList, GraduationCap } from 'lucide-react';
import api from '../../utils/api';

const ICON_MAP = {
  wiki_update: BookOpen,
  announcement: Megaphone,
  policy: Shield,
  ticket: LifeBuoy,
  leave: CalendarDays,
  expense: Receipt,
  overtime: Clock,
  survey: ClipboardList,
  training: GraduationCap,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch unread count every 30s
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await api.get('/notifications/unread-count');
        setUnread(data.count);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifications(data);
      } catch {}
    })();
  }, [open]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {}
  };

  const handleClick = (n) => {
    if (!n.isRead) markRead(n.id);
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">No notifications yet</div>
            ) : (
              notifications.map(n => {
                const Icon = ICON_MAP[n.type] || Info;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!n.isRead ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{n.title}</p>
                      {n.message && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.message}</p>}
                      <p className="text-[10px] text-slate-300 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="mt-2 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
