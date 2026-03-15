import { useState, useEffect } from 'react';
import api from '../../utils/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Fingerprint,
  MapPin,
} from 'lucide-react';

// Light pastel backgrounds like greytHR — subtle, not bold
const statusConfig = {
  present:  { bg: 'bg-white',       text: 'text-emerald-600', label: 'P',  full: 'Present' },
  absent:   { bg: 'bg-red-50',      text: 'text-red-500',     label: 'A',  full: 'Absent' },
  half_day: { bg: 'bg-amber-50',    text: 'text-amber-600',   label: 'HD', full: 'Half Day' },
  on_leave: { bg: 'bg-blue-50',     text: 'text-blue-500',    label: 'L',  full: 'On Leave' },
  holiday:  { bg: 'bg-orange-50',   text: 'text-orange-500',  label: 'H',  full: 'Holiday' },
  weekend:  { bg: 'bg-slate-50',    text: 'text-slate-400',   label: 'O',  full: 'Off' },
  future:   { bg: 'bg-white',       text: 'text-slate-300',   label: '',   full: '' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  // Build calendar grid with Sunday start (like greytHR)
  const buildGrid = () => {
    if (!data?.days) return [];
    const firstDay = data.days[0];
    if (!firstDay) return [];
    const firstDow = firstDay.dayOfWeek; // 0=Sun already
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (const day of data.days) cells.push(day);
    // Pad end to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const grid = buildGrid();

  const formatTime = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatPunchTime = (timeStr) => {
    if (!timeStr) return '-';
    const parts = timeStr.split(' ');
    if (parts.length < 2) return timeStr;
    const [h, m] = parts[1].split(':');
    return `${h}:${m}`;
  };

  const today = new Date().toISOString().split('T')[0];
  const shiftCode = data?.shift?.name ? getShiftCode(data.shift.name) : '';

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white" title="Back to team view">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-800">Attendance Info</h2>
          <p className="text-sm text-slate-500">{employeeName}</p>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}

      {data && (
        <>
          {/* Insight cards — like greytHR top row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InsightCard label="AVG. WORK HRS" value={data.summary.totalWorkHours > 0 && data.summary.present > 0 ? formatHrsMin(data.summary.totalWorkHours / data.summary.present) : '-'} />
            <InsightCard label="PRESENT DAYS" value={data.summary.present} />
            <InsightCard label="ABSENT DAYS" value={data.summary.absent} />
            <InsightCard label="LEAVES" value={data.summary.onLeave} />
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Calendar Grid */}
            <div className="lg:flex-[3] min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {/* Month navigation — Prev / Month Year / Next */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <button onClick={() => changeMonth(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <h3 className="text-base font-semibold text-slate-800">
                    {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button onClick={() => changeMonth(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-200">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2 border-r border-slate-100 last:border-r-0">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid — proper bordered boxes like greytHR */}
                <div className="grid grid-cols-7">
                  {grid.map((cell, idx) => {
                    if (!cell) {
                      return (
                        <div key={`empty-${idx}`} className="border-r border-b border-slate-100 last:border-r-0 h-[80px] bg-slate-50/50" />
                      );
                    }
                    const cfg = statusConfig[cell.status] || statusConfig.future;
                    const isSelected = cell.date === selectedDate;
                    const isToday = cell.date === today;
                    const isWeekend = cell.dayOfWeek === 0 || cell.dayOfWeek === 6;
                    const showShift = !isWeekend && cell.status !== 'holiday' && cell.status !== 'future';

                    return (
                      <button
                        key={cell.date}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`
                          relative h-[80px] border-r border-b border-slate-100 last:border-r-0 text-left p-1.5 transition-all cursor-pointer
                          ${cfg.bg}
                          ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/40' : 'hover:bg-blue-50/30'}
                        `}
                      >
                        {/* Date number */}
                        <div className="flex items-start justify-between">
                          <span className={`text-xs font-medium leading-none ${isToday ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-600'}`}>
                            {String(cell.day).padStart(2, '0')}
                          </span>
                        </div>
                        {/* Status code — center */}
                        <div className="flex items-center justify-center mt-1">
                          <span className={`text-sm font-semibold ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {/* Shift code — bottom right like greytHR */}
                        {showShift && shiftCode && (
                          <div className="absolute bottom-1 right-1.5">
                            <span className="text-[10px] text-slate-300 font-medium">{shiftCode}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Detail Panel — wider, with table sections like greytHR */}
            <div className="lg:flex-[2] min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
                {selectedDay ? (
                  <div>
                    {/* Swipe timeline bar */}
                    {selectedDay.punches && selectedDay.punches.length > 0 && (
                      <SwipeTimeline punches={selectedDay.punches} shift={data.shift} />
                    )}

                    {/* Status Details */}
                    <SectionHeader title="Status Details" />
                    <div className="px-4 pb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 font-medium">
                            <td className="py-1.5 pr-4">Status</td>
                            <td className="py-1.5">Remarks</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-slate-700 border-t border-slate-50">
                            <td className="py-2 pr-4">
                              <span className={`font-semibold ${(statusConfig[selectedDay.status] || statusConfig.future).text}`}>
                                {(statusConfig[selectedDay.status] || statusConfig.future).full || '-'}
                              </span>
                            </td>
                            <td className="py-2">
                              {selectedDay.holidayName || selectedDay.leaveName || selectedDay.notes || '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Session Details */}
                    <SectionHeader title="Session Details" />
                    <div className="px-4 pb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 font-medium">
                            <td className="py-1.5">Session</td>
                            <td className="py-1.5">Session Timing</td>
                            <td className="py-1.5">First In</td>
                            <td className="py-1.5">Last Out</td>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700">
                          {data.shift ? (
                            <>
                              {/* Session 1: Shift start to midpoint */}
                              {(() => {
                                const [sh] = (data.shift.startTime || '0').split(':').map(Number);
                                const [eh] = (data.shift.endTime || '0').split(':').map(Number);
                                const midH = Math.floor((sh + eh) / 2);
                                const midTime = `${String(midH).padStart(2, '0')}:30`;
                                const s1Start = data.shift.startTime;
                                const s1End = midTime;
                                const s2Start = `${String(midH).padStart(2, '0')}:31`;
                                const s2End = data.shift.endTime;

                                // Find first in and last out from punches
                                const firstIn = selectedDay.checkIn ? formatTime(selectedDay.checkIn) : '-';
                                const lastOut = selectedDay.checkOut ? formatTime(selectedDay.checkOut) : '-';

                                return (
                                  <>
                                    <tr className="border-t border-slate-50">
                                      <td className="py-2 font-medium">Session 1</td>
                                      <td className="py-2">{s1Start} - {s1End}</td>
                                      <td className="py-2 font-semibold">{firstIn}</td>
                                      <td className="py-2">-</td>
                                    </tr>
                                    <tr className="border-t border-slate-50">
                                      <td className="py-2 font-medium">Session 2</td>
                                      <td className="py-2">{s2Start} - {s2End}</td>
                                      <td className="py-2">-</td>
                                      <td className="py-2 font-semibold">{lastOut}</td>
                                    </tr>
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <tr className="border-t border-slate-50">
                              <td className="py-2 font-medium">Full Day</td>
                              <td className="py-2">-</td>
                              <td className="py-2 font-semibold">{selectedDay.checkIn ? formatTime(selectedDay.checkIn) : '-'}</td>
                              <td className="py-2 font-semibold">{selectedDay.checkOut ? formatTime(selectedDay.checkOut) : '-'}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {/* Late In / Early Out row */}
                      {(selectedDay.lateIn || selectedDay.earlyOut) && (
                        <div className="flex gap-4 mt-2 text-xs">
                          {selectedDay.lateIn && (
                            <span className="text-amber-600 font-medium">Late In: {selectedDay.lateIn}</span>
                          )}
                          {selectedDay.earlyOut && (
                            <span className="text-orange-600 font-medium">Early Out: {selectedDay.earlyOut}</span>
                          )}
                        </div>
                      )}
                      {selectedDay.workHours > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          Total: <span className="font-semibold text-slate-700">{formatHrsMin(selectedDay.workHours)}</span>
                        </div>
                      )}
                    </div>

                    {/* Permission Details */}
                    <SectionHeader title="Permission Details" />
                    <div className="px-4 pb-3">
                      {selectedDay.leaveName ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 font-medium">
                              <td className="py-1.5">Type</td>
                              <td className="py-1.5">Status</td>
                              <td className="py-1.5">From Date</td>
                              <td className="py-1.5">To Date</td>
                            </tr>
                          </thead>
                          <tbody className="text-slate-700">
                            <tr className="border-t border-slate-50">
                              <td className="py-2 font-medium">{selectedDay.leaveName}</td>
                              <td className="py-2">
                                <span className="text-emerald-600 font-medium">Approved</span>
                              </td>
                              <td className="py-2">{selectedDay.date}</td>
                              <td className="py-2">{selectedDay.date}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-400 py-2">-</p>
                      )}
                    </div>

                    {/* Swipe Details */}
                    <SectionHeader title={`Swipes${selectedDay.workHours > 0 ? ` (Total: ${formatHrsMin(selectedDay.workHours)})` : ''}`} />
                    <div className="px-4 pb-3">
                      {selectedDay.punches && selectedDay.punches.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 font-medium">
                              <td className="py-1.5">Time</td>
                              <td className="py-1.5">In/Out</td>
                              <td className="py-1.5">Device</td>
                              <td className="py-1.5">Location</td>
                            </tr>
                          </thead>
                          <tbody className="text-slate-700">
                            {selectedDay.punches.map((punch, idx) => (
                              <tr key={idx} className="border-t border-slate-50">
                                <td className="py-2 font-mono font-medium">{formatPunchTime(punch.time)}</td>
                                <td className="py-2">
                                  <span className={`font-medium capitalize ${
                                    punch.direction === 'in' ? 'text-emerald-600' :
                                    punch.direction === 'out' ? 'text-rose-600' : 'text-slate-500'
                                  }`}>
                                    {punch.direction || '-'}
                                  </span>
                                </td>
                                <td className="py-2 max-w-[100px] truncate" title={punch.device}>{punch.device || '-'}</td>
                                <td className="py-2 max-w-[80px] truncate" title={punch.location}>
                                  {punch.location ? (
                                    <span className="flex items-center gap-0.5">
                                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                      {punch.location}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-400 py-2">No swipe records</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-16 text-center text-slate-400">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Select a day to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Section header — light grey bar like greytHR
function SectionHeader({ title }) {
  return (
    <div className="bg-slate-50 px-4 py-2 border-t border-b border-slate-100">
      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

// Insight card — top row stats
function InsightCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  );
}

// Swipe timeline bar — visual representation of swipe times across the day
function SwipeTimeline({ punches, shift }) {
  if (!punches || punches.length === 0) return null;

  // Parse punch times to display as timeline markers
  const times = punches.map(p => {
    const parts = p.time?.split(' ');
    if (!parts || parts.length < 2) return null;
    return parts[1]?.substring(0, 5); // HH:MM
  }).filter(Boolean);

  if (times.length === 0) return null;

  return (
    <div className="px-4 py-2.5 border-b border-slate-100 overflow-x-auto">
      <div className="flex items-center gap-4 min-w-max">
        {times.map((time, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${idx % 2 === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-xs font-mono font-medium text-slate-600">{time}</span>
          </div>
        ))}
      </div>
      {/* Green progress bar */}
      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  );
}

// Helper: get shift short code (e.g., "General Shift" → "GS")
function getShiftCode(name) {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

// Helper: format decimal hours to HH:MM (e.g., 9.5 → "09:30")
function formatHrsMin(hours) {
  if (!hours || hours <= 0) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
