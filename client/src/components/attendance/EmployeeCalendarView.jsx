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
  Shield,
  Activity,
  FileText,
  AlertCircle,
} from 'lucide-react';

const statusConfig = {
  present:  { bg: 'bg-emerald-500', text: 'text-white',       label: 'P',  full: 'Present',  dotColor: 'bg-emerald-500' },
  absent:   { bg: 'bg-red-500',     text: 'text-white',       label: 'A',  full: 'Absent',   dotColor: 'bg-red-500' },
  half_day: { bg: 'bg-amber-500',   text: 'text-white',       label: 'HD', full: 'Half Day', dotColor: 'bg-amber-500' },
  on_leave: { bg: 'bg-blue-500',    text: 'text-white',       label: 'L',  full: 'On Leave', dotColor: 'bg-blue-500' },
  holiday:  { bg: 'bg-purple-500',  text: 'text-white',       label: 'H',  full: 'Holiday',  dotColor: 'bg-purple-500' },
  weekend:  { bg: 'bg-slate-300',   text: 'text-white',       label: 'W',  full: 'Weekend',  dotColor: 'bg-slate-400' },
  future:   { bg: 'bg-slate-100',   text: 'text-slate-400',   label: '-',  full: '',          dotColor: 'bg-slate-200' },
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
    const firstDow = (firstDay.dayOfWeek + 6) % 7; // 0=Mon, 6=Sun
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (const day of data.days) cells.push(day);
    return cells;
  };

  const grid = buildGrid();

  const formatTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatPunchTime = (timeStr) => {
    if (!timeStr) return '—';
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
        <div className="flex-1">
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
          {/* Left: Calendar Grid — compact like greytHR */}
          <div className="lg:w-[420px] w-full flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* Month navigation */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <button onClick={() => changeMonth(-1)} className="p-1 rounded-lg hover:bg-slate-100">
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
                <h3 className="text-sm font-semibold text-slate-700">
                  {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeMonth(1)} className="p-1 rounded-lg hover:bg-slate-100">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 px-3 pt-2">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1 uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid — compact cells */}
              <div className="grid grid-cols-7 gap-[3px] px-3 pb-2">
                {grid.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} className="h-[42px]" />;
                  const cfg = statusConfig[cell.status] || statusConfig.future;
                  const isSelected = cell.date === selectedDate;
                  const isToday = cell.date === new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`
                        flex flex-col items-center justify-center h-[42px] rounded-md transition-all cursor-pointer
                        ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-slate-50'}
                        ${isToday && !isSelected ? 'ring-1 ring-blue-400' : ''}
                      `}
                    >
                      <span className={`text-[11px] leading-none ${isToday ? 'font-bold text-blue-600' : 'font-medium text-slate-600'}`}>
                        {cell.day}
                      </span>
                      <span className={`mt-0.5 w-5 h-[14px] rounded-sm flex items-center justify-center text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>
                        {cell.statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t border-slate-100 text-[10px]">
                {Object.entries(statusConfig).filter(([k]) => k !== 'future').map(([key, cfg]) => (
                  <span key={key} className="inline-flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-sm ${cfg.bg}`} />
                    <span className="text-slate-500">{cfg.full}</span>
                  </span>
                ))}
              </div>

              {/* Summary stats */}
              {data.summary && (
                <div className="grid grid-cols-3 gap-2 px-3 py-2.5 border-t border-slate-100">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">{data.summary.present}</p>
                    <p className="text-[10px] text-slate-500">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-600">{data.summary.absent}</p>
                    <p className="text-[10px] text-slate-500">Absent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{data.summary.onLeave}</p>
                    <p className="text-[10px] text-slate-500">Leave</p>
                  </div>
                  {data.summary.halfDay > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-600">{data.summary.halfDay}</p>
                      <p className="text-[10px] text-slate-500">Half Day</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">{data.summary.holiday}</p>
                    <p className="text-[10px] text-slate-500">Holidays</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-indigo-600">{data.summary.totalWorkHours?.toFixed(0) || 0}h</p>
                    <p className="text-[10px] text-slate-500">Total Hrs</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Day Detail Panel — wider, with 5 sections like greytHR */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
              {selectedDay ? (
                <div className="divide-y divide-slate-100">
                  {/* Day header */}
                  <div className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                    {(() => {
                      const cfg = statusConfig[selectedDay.status] || statusConfig.future;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label} — {cfg.full}
                        </span>
                      );
                    })()}
                  </div>

                  {/* 1. Shift Details */}
                  <DetailSection icon={Clock} title="Shift Details" color="text-indigo-600">
                    {data.shift ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Shift Name</span>
                          <span className="text-xs font-semibold text-slate-800">{data.shift.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Shift Timing</span>
                          <span className="text-xs font-semibold text-slate-800">{data.shift.startTime} — {data.shift.endTime}</span>
                        </div>
                        {data.shift.breakDuration > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Break Duration</span>
                            <span className="text-xs font-semibold text-slate-800">{data.shift.breakDuration} min</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No shift assigned</p>
                    )}
                  </DetailSection>

                  {/* 2. Processed / Status Details */}
                  <DetailSection icon={Activity} title="Processed Details" color="text-emerald-600">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Status</span>
                        {(() => {
                          const cfg = statusConfig[selectedDay.status] || statusConfig.future;
                          return <span className={`text-xs font-semibold ${cfg.bg === 'bg-slate-100' ? 'text-slate-500' : cfg.bg.replace('bg-', 'text-').replace('500', '700')}`}>{cfg.full || '—'}</span>;
                        })()}
                      </div>
                      {selectedDay.holidayName && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Holiday</span>
                          <span className="text-xs font-semibold text-purple-700">{selectedDay.holidayName}</span>
                        </div>
                      )}
                      {selectedDay.leaveName && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Leave Type</span>
                          <span className="text-xs font-semibold text-blue-700">{selectedDay.leaveName}</span>
                        </div>
                      )}
                      {selectedDay.notes && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Remarks</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedDay.notes}</span>
                        </div>
                      )}
                      {selectedDay.workHours != null && selectedDay.workHours > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Work Hours</span>
                          <span className="text-xs font-bold text-emerald-700">{selectedDay.workHours.toFixed(2)} hrs</span>
                        </div>
                      )}
                    </div>
                  </DetailSection>

                  {/* 3. Session Details */}
                  <DetailSection icon={LogIn} title="Session Details" color="text-blue-600">
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] font-medium text-emerald-600 uppercase mb-0.5">First In</p>
                          <p className="text-sm font-bold text-emerald-700">{formatTime(selectedDay.checkIn)}</p>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] font-medium text-rose-600 uppercase mb-0.5">Last Out</p>
                          <p className="text-sm font-bold text-rose-700">{formatTime(selectedDay.checkOut)}</p>
                        </div>
                      </div>
                      {(selectedDay.lateIn || selectedDay.earlyOut) && (
                        <div className="grid grid-cols-2 gap-3">
                          {selectedDay.lateIn && (
                            <div className="bg-amber-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-medium text-amber-600 uppercase mb-0.5">Late In</p>
                              <p className="text-xs font-bold text-amber-700">{selectedDay.lateIn}</p>
                            </div>
                          )}
                          {selectedDay.earlyOut && (
                            <div className="bg-orange-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] font-medium text-orange-600 uppercase mb-0.5">Early Out</p>
                              <p className="text-xs font-bold text-orange-700">{selectedDay.earlyOut}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {selectedDay.workHours != null && selectedDay.workHours > 0 && (
                        <div className="bg-indigo-50 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-indigo-600">Total Hours</span>
                          <span className="text-sm font-bold text-indigo-700">{selectedDay.workHours.toFixed(2)} hrs</span>
                        </div>
                      )}
                      {data.shift && (
                        <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">Expected Hours</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {(() => {
                              const [sh, sm] = (data.shift.startTime || '0:0').split(':').map(Number);
                              const [eh, em] = (data.shift.endTime || '0:0').split(':').map(Number);
                              const expected = ((eh * 60 + em) - (sh * 60 + sm) - (data.shift.breakDuration || 0)) / 60;
                              return expected > 0 ? `${expected.toFixed(1)} hrs` : '—';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </DetailSection>

                  {/* 4. Permission / Leave Details */}
                  <DetailSection icon={Shield} title="Permission Details" color="text-purple-600">
                    {selectedDay.leaveName ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Type</span>
                          <span className="text-xs font-semibold text-blue-700">{selectedDay.leaveName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Status</span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Approved
                          </span>
                        </div>
                      </div>
                    ) : selectedDay.holidayName ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Holiday</span>
                        <span className="text-xs font-semibold text-purple-700">{selectedDay.holidayName}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No permissions for this day</p>
                    )}
                  </DetailSection>

                  {/* 5. Swipe Details */}
                  <DetailSection icon={Fingerprint} title="Swipe Details" color="text-orange-600" noPaddingBottom>
                    {selectedDay.punches && selectedDay.punches.length > 0 ? (
                      <div className="space-y-0">
                        {/* Swipe table header */}
                        <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-400 uppercase pb-1 border-b border-slate-100 mb-1">
                          <span>Time</span>
                          <span>Direction</span>
                          <span>Device</span>
                          <span>Location</span>
                        </div>
                        {selectedDay.punches.map((punch, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-4 gap-2 py-1.5 text-xs border-b border-slate-50 last:border-0"
                          >
                            <span className="font-mono font-medium text-slate-700">
                              {formatPunchTime(punch.time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                punch.direction === 'in' ? 'bg-emerald-500' :
                                punch.direction === 'out' ? 'bg-rose-500' : 'bg-slate-400'
                              }`} />
                              <span className={`font-medium capitalize ${
                                punch.direction === 'in' ? 'text-emerald-600' :
                                punch.direction === 'out' ? 'text-rose-600' : 'text-slate-500'
                              }`}>
                                {punch.direction || '—'}
                              </span>
                            </span>
                            <span className="text-slate-600 truncate" title={punch.device}>
                              {punch.device || '—'}
                            </span>
                            <span className="text-slate-500 truncate flex items-center gap-0.5" title={punch.location}>
                              {punch.location ? (
                                <>
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {punch.location}
                                </>
                              ) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-2">No swipe records for this day</p>
                    )}
                  </DetailSection>
                </div>
              ) : (
                <div className="px-5 py-16 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Select a day to view details</p>
                  <p className="text-xs mt-1">Click on any date in the calendar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable section wrapper — greytHR-style collapsible card section
function DetailSection({ icon: Icon, title, color, children, noPaddingBottom }) {
  return (
    <div className={`px-5 py-3 ${noPaddingBottom ? 'pb-2' : ''}`}>
      <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
        {title}
      </h4>
      {children}
    </div>
  );
}
