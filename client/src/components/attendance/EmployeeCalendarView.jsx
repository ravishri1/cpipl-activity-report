import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Fingerprint,
  MapPin,
} from 'lucide-react';

const statusConfig = {
  present:  { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', label: 'P',  full: 'Present' },
  absent:   { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-600',     label: 'A',  full: 'Absent' },
  half_day: { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-700',   label: 'HD', full: 'Half Day' },
  on_leave: { bg: 'bg-blue-100',    border: 'border-blue-300',    text: 'text-blue-700',    label: 'L',  full: 'On Leave' },
  holiday:  { bg: 'bg-purple-100',  border: 'border-purple-300',  text: 'text-purple-700',  label: 'H',  full: 'Holiday' },
  weekend:  { bg: 'bg-slate-50',    border: 'border-slate-200',   text: 'text-slate-400',   label: 'W',  full: 'Weekend' },
  future:   { bg: 'bg-white',       border: 'border-slate-100',   text: 'text-slate-300',   label: '-',  full: '' },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function EmployeeCalendarView({ userId, employeeName, onBack }) {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/attendance/employee-calendar?userId=${userId}&month=${month}`);
        setData(res.data);
        // Auto-select today if in current month, else first day with data
        const today = new Date().toISOString().split('T')[0];
        if (today.startsWith(month)) {
          setSelectedDate(today);
        } else {
          const firstWithData = res.data.days?.find(d => d.status === 'present' || d.status === 'half_day');
          setSelectedDate(firstWithData?.date || res.data.days?.[0]?.date || null);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, [userId, month]);

  const changeMonth = (delta) => {
    const d = new Date(month + '-01');
    d.setMonth(d.getMonth() + delta);
    setMonth(d.toISOString().substring(0, 7));
  };

  const selectedDay = data?.days?.find(d => d.date === selectedDate);

  // Build calendar grid with Monday start
  const buildGrid = () => {
    if (!data?.days) return [];
    const firstDay = data.days[0];
    if (!firstDay) return [];
    // dayOfWeek: 0=Sun, 1=Mon ... 6=Sat  →  Mon-start offset: (dow + 6) % 7
    const firstDow = (firstDay.dayOfWeek + 6) % 7; // 0=Mon, 6=Sun
    const cells = [];
    // Padding cells before day 1
    for (let i = 0; i < firstDow; i++) cells.push(null);
    // Day cells
    for (const day of data.days) cells.push(day);
    return cells;
  };

  const grid = buildGrid();

  const formatTime = (dt) => {
    if (!dt) return null;
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatPunchTime = (timeStr) => {
    if (!timeStr) return '—';
    // timeStr is "YYYY-MM-DD HH:MM:SS"
    const parts = timeStr.split(' ');
    if (parts.length < 2) return timeStr;
    const [h, m] = parts[1].split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white"
          title="Back to team view"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {employeeName}
          </h2>
          <p className="text-xs text-slate-500">Attendance Calendar</p>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {data && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Calendar Grid */}
          <div className="flex-1 min-w-0">
            {/* Month navigation */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <h3 className="text-sm font-semibold text-slate-700">
                  {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 px-2 pt-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1 p-2">
                {grid.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} />;
                  const cfg = statusConfig[cell.status] || statusConfig.future;
                  const isSelected = cell.date === selectedDate;
                  const isToday = cell.date === new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`
                        relative flex flex-col items-center justify-center rounded-lg p-1.5 min-h-[52px] transition-all text-xs
                        ${cfg.bg} border ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : cfg.border}
                        ${isToday && !isSelected ? 'ring-1 ring-blue-300' : ''}
                        hover:ring-2 hover:ring-blue-200 cursor-pointer
                      `}
                    >
                      <span className={`text-[11px] font-medium ${isToday ? 'text-blue-600' : 'text-slate-600'}`}>
                        {cell.day}
                      </span>
                      <span className={`text-[10px] font-bold ${cfg.text} mt-0.5`}>
                        {cell.statusLabel}
                      </span>
                      {cell.holidayName && (
                        <span className="text-[8px] text-purple-500 truncate max-w-full" title={cell.holidayName}>
                          {cell.holidayName.length > 6 ? cell.holidayName.substring(0, 6) + '..' : cell.holidayName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Summary row */}
              {data.summary && (
                <div className="flex flex-wrap gap-2 px-3 py-2.5 border-t border-slate-100 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    P: {data.summary.present}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                    A: {data.summary.absent}
                  </span>
                  {data.summary.halfDay > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      HD: {data.summary.halfDay}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    L: {data.summary.onLeave}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                    H: {data.summary.holiday}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                    W: {data.summary.weekend}
                  </span>
                  {data.summary.totalWorkHours > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium ml-auto">
                      <Clock className="w-3 h-3" /> {data.summary.totalWorkHours.toFixed(1)}h total
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Shift info */}
            {data.shift && (
              <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{data.shift.name}</p>
                  <p className="text-xs text-slate-500">{data.shift.startTime} - {data.shift.endTime}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Day Detail Panel */}
          <div className="lg:w-80 w-full">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
              {selectedDay ? (
                <>
                  {/* Day header */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    {(() => {
                      const cfg = statusConfig[selectedDay.status] || statusConfig.future;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${cfg.bg} ${cfg.text}`}>
                          {cfg.full || selectedDay.statusLabel}
                        </span>
                      );
                    })()}
                    {selectedDay.holidayName && (
                      <p className="text-xs text-purple-600 mt-1">{selectedDay.holidayName}</p>
                    )}
                    {selectedDay.leaveName && (
                      <p className="text-xs text-blue-600 mt-1">{selectedDay.leaveName}</p>
                    )}
                  </div>

                  {/* Session info */}
                  <div className="px-4 py-3 border-b border-slate-100 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session Info</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] font-medium text-emerald-600 uppercase">First In</span>
                        </div>
                        <p className="text-sm font-bold text-emerald-700">
                          {formatTime(selectedDay.checkIn) || '—'}
                        </p>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <LogOut className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[10px] font-medium text-rose-600 uppercase">Last Out</span>
                        </div>
                        <p className="text-sm font-bold text-rose-700">
                          {formatTime(selectedDay.checkOut) || '—'}
                        </p>
                      </div>
                    </div>
                    {selectedDay.workHours != null && selectedDay.workHours > 0 && (
                      <div className="bg-indigo-50 rounded-lg p-2.5 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-medium text-indigo-600">Total Hours:</span>
                        <span className="text-sm font-bold text-indigo-700">{selectedDay.workHours.toFixed(1)}h</span>
                      </div>
                    )}
                  </div>

                  {/* Swipe details */}
                  <div className="px-4 py-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5" />
                      Swipe Details
                    </h4>
                    {selectedDay.punches && selectedDay.punches.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedDay.punches.map((punch, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                punch.direction === 'in' ? 'bg-emerald-500' :
                                punch.direction === 'out' ? 'bg-rose-500' : 'bg-slate-400'
                              }`} />
                              <span className="font-mono font-medium text-slate-700">
                                {formatPunchTime(punch.time)}
                              </span>
                              <span className={`text-[10px] font-medium uppercase ${
                                punch.direction === 'in' ? 'text-emerald-600' :
                                punch.direction === 'out' ? 'text-rose-600' : 'text-slate-500'
                              }`}>
                                {punch.direction || '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              {punch.location && (
                                <span className="flex items-center gap-0.5" title={punch.location}>
                                  <MapPin className="w-3 h-3" />
                                  <span className="text-[10px] max-w-[60px] truncate">{punch.location}</span>
                                </span>
                              )}
                              {punch.device && !punch.location && (
                                <span className="text-[10px] max-w-[80px] truncate" title={punch.device}>
                                  {punch.device}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-3">No swipe records</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="px-4 py-12 text-center text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Select a day to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
