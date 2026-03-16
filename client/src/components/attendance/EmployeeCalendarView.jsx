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
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  ShieldAlert,
  ClipboardEdit,
} from 'lucide-react';

// Calendar cell colors — policy-aware
const statusConfig = {
  present:        { bg: 'bg-white',       text: 'text-emerald-600', label: 'P',  full: 'Present' },
  absent:         { bg: 'bg-red-50',      text: 'text-red-500',     label: 'A',  full: 'Absent' },
  half_day:       { bg: 'bg-amber-50',    text: 'text-amber-600',   label: 'HD', full: 'Half Day' },
  on_leave:       { bg: 'bg-blue-50',     text: 'text-blue-500',    label: 'L',  full: 'On Leave' },
  holiday:        { bg: 'bg-orange-50',   text: 'text-orange-500',  label: 'H',  full: 'Holiday' },
  weekend:        { bg: 'bg-slate-50',    text: 'text-slate-400',   label: 'O',  full: 'Off' },
  future:         { bg: 'bg-white',       text: 'text-slate-300',   label: '',   full: '' },
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

  // Build calendar grid with Sunday start
  const buildGrid = () => {
    if (!data?.days) return [];
    const firstDay = data.days[0];
    if (!firstDay) return [];
    const firstDow = firstDay.dayOfWeek;
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (const day of data.days) cells.push(day);
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

  // Get cell background based on policy status
  const getCellBg = (cell) => {
    if (!cell) return '';
    // Regularization approved → blue background
    if (cell.regularizationStatus === 'approved') return 'bg-blue-50';
    // Needs regularization (late/short hours, no approved reg) → light red
    if (cell.needsRegularization) return 'bg-rose-50';
    // Regularization pending → light amber
    if (cell.regularizationStatus === 'pending') return 'bg-amber-50/60';
    // Default status color
    return (statusConfig[cell.status] || statusConfig.future).bg;
  };

  // Get cell border indicator
  const getCellBorder = (cell) => {
    if (!cell) return '';
    if (cell.regularizationStatus === 'approved') return 'border-l-[3px] border-l-blue-400';
    if (cell.needsRegularization) return 'border-l-[3px] border-l-rose-400';
    if (cell.regularizationStatus === 'pending') return 'border-l-[3px] border-l-amber-400';
    return '';
  };

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
          {/* Insight cards — top row with policy data */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <InsightCard label="AVG. WORK HRS" value={data.summary.totalWorkHours > 0 && data.summary.present > 0 ? formatHrsMin(data.summary.totalWorkHours / data.summary.present) : '-'} />
            <InsightCard label="PRESENT DAYS" value={data.summary.present} />
            <InsightCard label="LATE MARKS" value={data.summary.lateMarks || 0} highlight={data.summary.lateMarks > 0 ? 'amber' : null} />
            <InsightCard label="REGULARIZED" value={data.summary.regularizedDays || 0} highlight={data.summary.regularizedDays > 0 ? 'blue' : null} />
            <InsightCard
              label="PENALTY DAYS"
              value={data.summary.halfDayDeductions || 0}
              highlight={data.summary.halfDayDeductions > 0 ? 'red' : null}
              subtitle={data.summary.halfDayDeductions > 0 ? `${data.summary.halfDayDeductions * 0.5} day deduction` : null}
            />
          </div>

          {/* Late mark policy warning */}
          {data.summary.lateMarks > 0 && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${
              data.summary.halfDayDeductions > 0
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">
                  {data.summary.lateMarks} late mark{data.summary.lateMarks !== 1 ? 's' : ''} this month
                  {data.summary.regularizedDays > 0 && ` (${data.summary.regularizedDays} regularized)`}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  Policy: Every 3 unregularized late marks = 0.5 day deduction.
                  {data.summary.halfDayDeductions > 0 && ` Current penalty: ${data.summary.halfDayDeductions * 0.5} day(s) deducted from leave/LOP.`}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Calendar Grid */}
            <div className="lg:flex-[3] min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {/* Month navigation */}
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

                {/* Calendar grid */}
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
                    const cellBg = getCellBg(cell);
                    const cellBorder = getCellBorder(cell);

                    return (
                      <button
                        key={cell.date}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`
                          relative h-[80px] border-r border-b border-slate-100 last:border-r-0 text-left p-1.5 transition-all cursor-pointer
                          ${cellBg} ${cellBorder}
                          ${isSelected ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-blue-50/30'}
                        `}
                      >
                        {/* Date number */}
                        <div className="flex items-start justify-between">
                          <span className={`text-xs font-medium leading-none ${isToday ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-slate-600'}`}>
                            {String(cell.day).padStart(2, '0')}
                          </span>
                          {/* Policy indicator icons */}
                          <div className="flex gap-0.5">
                            {cell.regularizationStatus === 'approved' && (
                              <CheckCircle2 className="w-3 h-3 text-blue-500" />
                            )}
                            {cell.regularizationStatus === 'pending' && (
                              <Clock className="w-3 h-3 text-amber-500" />
                            )}
                            {cell.needsRegularization && !cell.regularizationStatus && (
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                            )}
                          </div>
                        </div>
                        {/* Status code */}
                        <div className="flex items-center justify-center mt-1">
                          <span className={`text-sm font-semibold ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {/* Late indicator */}
                        {cell.isLate && (
                          <div className="absolute bottom-1 left-1.5">
                            <span className="text-[9px] text-rose-400 font-bold">LATE</span>
                          </div>
                        )}
                        {/* Shift code — bottom right */}
                        {showShift && shiftCode && (
                          <div className="absolute bottom-1 right-1.5">
                            <span className="text-[10px] text-slate-300 font-medium">{shiftCode}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
                  <LegendItem color="bg-emerald-500" label="P — Present" />
                  <LegendItem color="bg-red-400" label="A — Absent" />
                  <LegendItem color="bg-orange-400" label="H — Holiday" />
                  <LegendItem color="bg-slate-300" label="O — Off Day" />
                  <LegendItem color="bg-blue-400" label="L — Leave" />
                  <LegendItem color="bg-amber-400" label="HD — Half Day" />
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <span className="w-3 h-3 rounded border-l-[3px] border-l-blue-400 bg-blue-50 border border-slate-200" /> Regularized
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <span className="w-3 h-3 rounded border-l-[3px] border-l-rose-400 bg-rose-50 border border-slate-200" /> Needs Regularization
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Detail Panel */}
            <div className="lg:flex-[2] min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
                {selectedDay ? (
                  <div>
                    {/* Date header with shift info */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-xs text-slate-400">
                          {DAY_NAMES[selectedDay.dayOfWeek]}
                        </p>
                      </div>
                      {data.shift && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-slate-700">{data.shift.name}</p>
                          <p className="text-[10px] text-slate-400">Shift: {data.shift.startTime} to {data.shift.endTime}</p>
                        </div>
                      )}
                    </div>

                    {/* Policy alert — if this day needs regularization */}
                    {selectedDay.needsRegularization && (
                      <div className="mx-3 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-rose-700">Regularization Required</p>
                            <p className="text-[11px] text-rose-600 mt-0.5">
                              {selectedDay.isLate && `Late by ${selectedDay.lateMinutes} min (grace: 15 min). `}
                              {selectedDay.shortHours && `Work hours (${selectedDay.workHours?.toFixed(1)}h) below minimum 9h. `}
                              {selectedDay.regularizationStatus === 'rejected'
                                ? 'Previous request was rejected. 0.5 day LOP may apply.'
                                : 'Employee should apply for regularization to avoid penalty.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Regularization approved badge */}
                    {selectedDay.regularizationStatus === 'approved' && (
                      <div className="mx-3 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-blue-700">Regularized</p>
                            <p className="text-[11px] text-blue-600 mt-0.5">
                              Approved{selectedDay.regularization?.reviewerName ? ` by ${selectedDay.regularization.reviewerName}` : ''}.
                              {selectedDay.regularization?.reviewNote && ` Note: ${selectedDay.regularization.reviewNote}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Regularization pending badge */}
                    {selectedDay.regularizationStatus === 'pending' && (
                      <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-amber-700">Regularization Pending</p>
                            <p className="text-[11px] text-amber-600 mt-0.5">
                              Request submitted{selectedDay.regularization?.reason ? `: "${selectedDay.regularization.reason}"` : ''}. Awaiting manager review.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Swipe timeline */}
                    {selectedDay.punches && selectedDay.punches.length > 0 && (
                      <SwipeTimeline punches={selectedDay.punches} shift={data.shift} />
                    )}

                    {/* Attendance Details */}
                    <SectionHeader title="Attendance Details" />
                    <div className="px-4 pb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 font-medium">
                            <td className="py-1.5">First In</td>
                            <td className="py-1.5">Last Out</td>
                            <td className="py-1.5">Total Work Hrs</td>
                            <td className="py-1.5">Status</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-slate-700 border-t border-slate-50">
                            <td className="py-2 font-semibold">{formatTime(selectedDay.checkIn)}</td>
                            <td className="py-2 font-semibold">{formatTime(selectedDay.checkOut)}</td>
                            <td className="py-2 font-semibold">
                              {selectedDay.workHours > 0 ? (
                                <span className={selectedDay.shortHours ? 'text-rose-600' : 'text-emerald-600'}>
                                  {formatHrsMin(selectedDay.workHours)}
                                  {selectedDay.shortHours && <span className="text-[10px] ml-1">(min: 9h)</span>}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2">
                              <span className={`font-semibold ${(statusConfig[selectedDay.status] || statusConfig.future).text}`}>
                                {(statusConfig[selectedDay.status] || statusConfig.future).full || '-'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {/* Late / Early indicators */}
                      {(selectedDay.lateIn || selectedDay.earlyOut || selectedDay.isLate) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                          {selectedDay.isLate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                              <Timer className="w-3 h-3" /> Late: {selectedDay.lateMinutes} min
                            </span>
                          )}
                          {selectedDay.lateIn && !selectedDay.isLate && (
                            <span className="text-amber-600 font-medium">Late In: {selectedDay.lateIn}</span>
                          )}
                          {selectedDay.earlyOut && (
                            <span className="text-orange-600 font-medium">Early Out: {selectedDay.earlyOut}</span>
                          )}
                        </div>
                      )}
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
                            (() => {
                              const [sh] = (data.shift.startTime || '0').split(':').map(Number);
                              const [eh] = (data.shift.endTime || '0').split(':').map(Number);
                              const midH = Math.floor((sh + eh) / 2);
                              const midTime = `${String(midH).padStart(2, '0')}:30`;
                              const s1Start = data.shift.startTime;
                              const s1End = midTime;
                              const s2Start = `${String(midH).padStart(2, '0')}:31`;
                              const s2End = data.shift.endTime;
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
                            })()
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
                    </div>

                    {/* Regularization Details */}
                    {selectedDay.regularization && (
                      <>
                        <SectionHeader title="Regularization Details" />
                        <div className="px-4 pb-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-400 font-medium">
                                <td className="py-1.5">Type</td>
                                <td className="py-1.5">Requested</td>
                                <td className="py-1.5">Status</td>
                                <td className="py-1.5">Reviewer</td>
                              </tr>
                            </thead>
                            <tbody className="text-slate-700">
                              <tr className="border-t border-slate-50">
                                <td className="py-2 font-medium">
                                  <ClipboardEdit className="w-3 h-3 inline mr-1 text-slate-400" />
                                  Regularization
                                </td>
                                <td className="py-2">
                                  {selectedDay.regularization.requestedIn && <span className="text-emerald-600">In: {selectedDay.regularization.requestedIn}</span>}
                                  {selectedDay.regularization.requestedIn && selectedDay.regularization.requestedOut && ' / '}
                                  {selectedDay.regularization.requestedOut && <span className="text-blue-600">Out: {selectedDay.regularization.requestedOut}</span>}
                                </td>
                                <td className="py-2">
                                  <RegStatusBadge status={selectedDay.regularization.status} />
                                </td>
                                <td className="py-2 text-slate-500">
                                  {selectedDay.regularization.reviewerName || '-'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          {selectedDay.regularization.reason && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              <span className="font-medium">Reason:</span> {selectedDay.regularization.reason}
                            </p>
                          )}
                          {selectedDay.regularization.reviewNote && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              <span className="font-medium">Review Note:</span> {selectedDay.regularization.reviewNote}
                            </p>
                          )}
                        </div>
                      </>
                    )}

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
                              <td className="py-2"><span className="text-emerald-600 font-medium">Approved</span></td>
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

// ── Sub-components ──

function RegStatusBadge({ status }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700"><CheckCircle2 className="w-2.5 h-2.5" /> Approved</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700"><XCircle className="w-2.5 h-2.5" /> Rejected</span>;
  return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700"><Clock className="w-2.5 h-2.5" /> Pending</span>;
}

function LegendItem({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} /> {label}
    </span>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="bg-slate-50 px-4 py-2 border-t border-b border-slate-100">
      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

function InsightCard({ label, value, highlight, subtitle }) {
  const highlightStyles = {
    amber: 'border-amber-200 bg-amber-50',
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
  };
  const valueStyles = {
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <div className={`rounded-xl border p-3 text-center shadow-sm ${highlight ? highlightStyles[highlight] : 'bg-white border-slate-200'}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${highlight ? valueStyles[highlight] : 'text-slate-800'}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SwipeTimeline({ punches, shift }) {
  if (!punches || punches.length === 0) return null;
  const times = punches.map(p => {
    const parts = p.time?.split(' ');
    if (!parts || parts.length < 2) return null;
    return parts[1]?.substring(0, 5);
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
      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  );
}

function getShiftCode(name) {
  if (!name) return '';
  return name.split(' ').map(w => w[0]).join('').toUpperCase();
}

function formatHrsMin(hours) {
  if (!hours || hours <= 0) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
