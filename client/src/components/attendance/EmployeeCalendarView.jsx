import { useState, useEffect, useMemo } from 'react';
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
  RefreshCw,
  Info,
  Pencil,
} from 'lucide-react';

// Calendar cell colors — greytHR style
const statusConfig = {
  present:        { bg: 'bg-emerald-50',   text: 'text-emerald-600', label: 'P',  full: 'Present' },
  absent:         { bg: 'bg-red-50',      text: 'text-red-500',     label: 'A',  full: 'Absent' },
  half_day:       { bg: 'bg-amber-50',    text: 'text-amber-600',   label: 'HD', full: 'Half Day' },
  on_leave:       { bg: 'bg-blue-50',     text: 'text-blue-500',    label: 'L',  full: 'On Leave' },
  holiday:        { bg: 'bg-orange-50',   text: 'text-orange-500',  label: 'H',  full: 'Holiday' },
  weekend:        { bg: 'bg-slate-50',    text: 'text-slate-400',   label: 'O',  full: 'Off' },
  future:         { bg: 'bg-white',       text: 'text-slate-300',   label: '',   full: '' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EmployeeCalendarView({ userId, employeeName: employeeNameProp, onBack, selfView = false }) {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState(null);
  const [hideInsight, setHideInsight] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleRecalculate = async (date) => {
    if (!window.confirm(`Recalculate attendance for ${date}? This will rebuild First In, Last Out, and Work Hours from all biometric punches.`)) return;
    setRecalculating(true);
    setRecalcMsg(null);
    try {
      const res = await api.post('/biometric/recalculate', { userId, date });
      setRecalcMsg({ type: 'success', text: `Recalculated: ${res.data.punchCount} punches → ${res.data.workHours?.toFixed(2)}h work, ${res.data.breakHours?.toFixed(2)}h break` });
      const calRes = await api.get(selfView ? `/attendance/my-calendar?month=${month}` : `/attendance/employee-calendar?userId=${userId}&month=${month}`);
      setData(calRes.data);
    } catch (err) {
      setRecalcMsg({ type: 'error', text: err.response?.data?.error || 'Recalculation failed' });
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecalculateMonth = async () => {
    const [y, m] = month.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    if (!window.confirm(`Recalculate attendance for ALL days in ${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}? This may take a moment.`)) return;
    setRecalculating(true);
    setRecalcMsg(null);
    try {
      let recalculated = 0;
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        try {
          const res = await api.post('/biometric/recalculate', { userId, date: dateStr });
          if (res.data.punchCount > 0) recalculated++;
        } catch {} // Skip days with no punches
      }
      setRecalcMsg({ type: 'success', text: `Recalculated ${recalculated} days` });
      const calRes = await api.get(selfView ? `/attendance/my-calendar?month=${month}` : `/attendance/employee-calendar?userId=${userId}&month=${month}`);
      setData(calRes.data);
    } catch (err) {
      setRecalcMsg({ type: 'error', text: err.response?.data?.error || 'Recalculation failed' });
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(selfView ? `/attendance/my-calendar?month=${month}` : `/attendance/employee-calendar?userId=${userId}&month=${month}`);
        setData(res.data);
        const todayStr = new Date().toISOString().split('T')[0];
        if (todayStr.startsWith(month)) {
          setSelectedDate(todayStr);
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
    setHideInsight(false);
    fetchCalendar();
  }, [userId, month]);

  const changeMonth = (delta) => {
    const d = new Date(month + '-01');
    d.setMonth(d.getMonth() + delta);
    setMonth(d.toISOString().substring(0, 7));
  };

  const selectedDay = data?.days?.find(d => d.date === selectedDate);

  // Check if selected day is today (day not complete — skip regularization warnings)
  const isSelectedDayToday = selectedDay?.date === today;

  // Build penalty date set: only complete groups of 3 unregularized late marks get yellow
  // Incomplete remainder stays green (no penalty yet)
  const penaltyDates = useMemo(() => {
    if (!data?.days) return new Set();
    const unregLate = data.days.filter(d =>
      d.isLate && d.date !== today &&
      (!d.regularizationStatus || d.regularizationStatus !== 'approved')
    ).map(d => d.date);
    // Only complete groups of 3 become penalty dates
    const penaltyCount = Math.floor(unregLate.length / 3) * 3;
    return new Set(unregLate.slice(0, penaltyCount));
  }, [data?.days, today]);

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

  const shiftCode = data?.shift?.name ? getShiftCode(data.shift.name) : '';

  // Cell background — only penalty dates (complete groups of 3 late marks) get yellow
  const getCellBg = (cell) => {
    if (!cell) return '';
    // Regularization approved → blue
    if (cell.regularizationStatus === 'approved') return 'bg-blue-50';
    // Regularization pending → light amber
    if (cell.regularizationStatus === 'pending') return 'bg-amber-50/60';
    // Penalty date (part of a complete group of 3 unregularized late marks) → light yellow
    if (penaltyDates.has(cell.date)) return 'bg-amber-50';
    // Today = white background (day still in progress)
    if (cell.date === today) return 'bg-white';
    return (statusConfig[cell.status] || statusConfig.future).bg;
  };

  // Cell border indicator
  const getCellBorder = (cell) => {
    if (!cell) return '';
    if (cell.regularizationStatus === 'approved') return 'border-l-[3px] border-l-blue-400';
    if (cell.regularizationStatus === 'pending') return 'border-l-[3px] border-l-amber-400';
    // Only penalty dates (complete group of 3) get amber border
    if (penaltyDates.has(cell.date)) return 'border-l-[3px] border-l-amber-400';
    return '';
  };

  // Break hours = fixed 1 hour as per company policy
  const BREAK_HOURS = 1;

  // Convert DateTime to IST minutes since midnight (UTC+5:30)
  const toISTMin = (dt) => {
    const d = new Date(dt);
    return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  };

  // Calculate work hours within shift window
  const calcWorkInShift = (day, shift) => {
    if (!day?.checkIn || !shift) return 0;
    const coTime = day.checkOut ? new Date(day.checkOut) : null;
    if (!coTime) return 0;

    const [sh, sm] = (shift.startTime || '0:0').split(':').map(Number);
    const [eh, em] = (shift.endTime || '0:0').split(':').map(Number);
    const shiftStartMin = sh * 60 + (sm || 0);
    const shiftEndMin = eh * 60 + (em || 0);

    const ciMin = toISTMin(day.checkIn);
    const coMin = toISTMin(day.checkOut);

    const effectiveStart = Math.max(ciMin, shiftStartMin);
    const effectiveEnd = Math.min(coMin, shiftEndMin);

    if (effectiveEnd <= effectiveStart) return 0;
    return (effectiveEnd - effectiveStart) / 60;
  };

  // Shift duration in hours (for shortfall/excess calculation)
  const getShiftDurationHrs = (shift) => {
    if (!shift) return 0;
    const [sh, sm] = (shift.startTime || '0:0').split(':').map(Number);
    const [eh, em] = (shift.endTime || '0:0').split(':').map(Number);
    return ((eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))) / 60;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header — hide for self view (already inside My Attendance tabs) */}
      {!selfView && (
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white" title="Back to team view">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">Attendance Info</h2>
            <p className="text-sm text-slate-500">{employeeNameProp || data?.employeeName || 'Employee'}</p>
          </div>
        </div>
      )}

      {error && <AlertMessage type="error" message={error} />}
      {recalcMsg && <AlertMessage type={recalcMsg.type} message={recalcMsg.text} />}

      {data && (
        <>
          {/* Insight cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <InsightCard label="AVG. WORK HRS" value={data.summary.avgWorkHours > 0 ? formatHrsMin(data.summary.avgWorkHours) : '-'} />
            <InsightCard label="AVG. ACTUAL HRS" value={data.summary.avgActualWorkHours > 0 ? formatHrsMin(data.summary.avgActualWorkHours) : '-'} />
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
                  <div className="flex items-center gap-2">
                    {!selfView && (
                      <button
                        onClick={handleRecalculateMonth}
                        disabled={recalculating}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        title="Recalculate all days from biometric punches"
                      >
                        <RefreshCw className={`w-3 h-3 ${recalculating ? 'animate-spin' : ''}`} />
                        {recalculating ? 'Recalculating...' : 'Recalculate Month'}
                      </button>
                    )}
                    <button onClick={() => changeMonth(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
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
                    // Don't show regularization icons for today
                    const showRegIcons = !isToday;

                    return (
                      <button
                        key={cell.date}
                        onClick={() => { setSelectedDate(cell.date); setHideInsight(false); }}
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
                          {/* Policy indicator icons — skip for today */}
                          {showRegIcons && (
                            <div className="flex gap-0.5">
                              {cell.regularizationStatus === 'approved' && (
                                <CheckCircle2 className="w-3 h-3 text-blue-500" />
                              )}
                              {cell.regularizationStatus === 'pending' && (
                                <Clock className="w-3 h-3 text-amber-500" />
                              )}
                              {penaltyDates.has(cell.date) && !cell.regularizationStatus && (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {/* Status code */}
                        <div className="flex items-center justify-center mt-1">
                          <span className={`text-sm font-semibold ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
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
                    <span className="w-3 h-3 rounded border-l-[3px] border-l-amber-400 bg-amber-50 border border-slate-200" /> Needs Regularization
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Detail Panel */}
            <div className="lg:flex-[2] min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm sticky top-4">
                {selectedDay ? (
                  <div>
                    {/* Date header */}
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-800">
                        {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {DAY_NAMES[selectedDay.dayOfWeek]}
                      </p>
                    </div>

                    {/* Attendance Exempt badge */}
                    {data.isAttendanceExempt && (
                      <div className="mx-3 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-emerald-700">Attendance Exception — All rules bypassed</span>
                      </div>
                    )}

                    {/* Insight banner — greytHR style (skip for today — day not complete) */}
                    {!isSelectedDayToday && selectedDay.needsRegularization && !hideInsight && (
                      <div className="mx-3 mt-3 border border-amber-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between bg-amber-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-amber-800">Attendance Regularization Required</span>
                          </div>
                          <button onClick={() => setHideInsight(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                            Hide
                          </button>
                        </div>
                        <div className="px-3 py-2 bg-white border-t border-amber-100 space-y-1">
                          {selectedDay.isLate && (
                            <p className="text-xs text-slate-600">
                              Late by {selectedDay.lateMinutes >= 60 ? `${Math.floor(selectedDay.lateMinutes / 60)} hr ${selectedDay.lateMinutes % 60} min` : `${selectedDay.lateMinutes} min`} (after 15 min grace). Every 3 unregularized late marks = 0.5 day deduction.
                            </p>
                          )}
                          {selectedDay.shortHours && (
                            <p className="text-xs text-slate-600">
                              Full day minimum hours (9 hrs) is not fulfilled. 0.5 day(s) of LOP will be deducted.
                            </p>
                          )}
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

                    {/* Shift info + Processed time — greytHR style */}
                    {data.shift && (
                      <div className="mx-3 mt-3 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center border-r border-slate-200 pr-4">
                              <p className="text-lg font-bold text-slate-700">{selectedDay.day}</p>
                              <p className="text-[10px] text-slate-400">{DAY_NAMES[selectedDay.dayOfWeek]}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-700">{data.shift.name} ({shiftCode})</span>
                                <Pencil className="w-3 h-3 text-blue-400" />
                              </div>
                              <p className="text-[11px] text-slate-500">Shift : {data.shift.startTime} to {data.shift.endTime}</p>
                            </div>
                          </div>
                        </div>
                        {selectedDay.checkIn && (
                          <p className="text-[10px] text-slate-400 mt-2">
                            Processed on {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {formatTime(selectedDay.checkIn)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Attendance Details — greytHR style */}
                    {(() => {
                      // For today, skip all hour calculations — day not yet complete
                      const totalHrsRaw = isSelectedDayToday ? 0 : (selectedDay.totalWorkHrsRaw || 0);
                      const breakHrs = (totalHrsRaw > 0 && selectedDay.checkIn && selectedDay.checkOut) ? BREAK_HOURS : 0;
                      const actualWorkHrs = Math.max(0, totalHrsRaw - breakHrs);
                      const workInShift = isSelectedDayToday ? 0 : calcWorkInShift(selectedDay, data.shift);
                      const shiftDuration = getShiftDurationHrs(data.shift);
                      const shiftWorkExpected = shiftDuration > 0 ? shiftDuration - BREAK_HOURS : 0;
                      const shortfallHrs = isSelectedDayToday ? 0 : ((shiftWorkExpected > 0 && actualWorkHrs > 0 && actualWorkHrs < shiftWorkExpected) ? (shiftWorkExpected - actualWorkHrs) : 0);
                      const excessHrs = isSelectedDayToday ? 0 : ((shiftWorkExpected > 0 && actualWorkHrs > shiftWorkExpected) ? (actualWorkHrs - shiftWorkExpected) : 0);
                      // Late In display
                      const lateInDisplay = selectedDay.lateIn || '-';
                      // Early Out display
                      const earlyOutDisplay = selectedDay.earlyOut || '-';

                      return (
                        <>
                          <div className="px-3 mt-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-slate-400 font-medium border-b border-slate-100">
                                    <td className="py-2 pr-2 whitespace-nowrap">First In</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Last Out</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Late In</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Early Out</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Total Work Hrs</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Break Hrs</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Actual Work Hrs</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Work Hrs in Shift</td>
                                    <td className="py-2 pr-2 whitespace-nowrap">Shortfall Hrs</td>
                                    <td className="py-2 whitespace-nowrap">Excess Hrs</td>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="text-slate-700">
                                    <td className="py-2.5 pr-2 font-semibold">{formatTime(selectedDay.checkIn)}</td>
                                    <td className="py-2.5 pr-2 font-semibold">{isSelectedDayToday ? '-' : formatTime(selectedDay.checkOut)}</td>
                                    <td className="py-2.5 pr-2">
                                      {selectedDay.lateInMinutes > 0 ? (
                                        <span className={`font-medium ${selectedDay.isLate ? 'text-amber-600' : 'text-slate-600'}`}>{lateInDisplay}</span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2.5 pr-2">
                                      {!isSelectedDayToday && selectedDay.earlyOutMinutes > 0 ? (
                                        <span className="text-orange-600 font-medium">{earlyOutDisplay}</span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2.5 pr-2 font-semibold">
                                      {totalHrsRaw > 0 ? formatHrsMin(totalHrsRaw) : '-'}
                                    </td>
                                    <td className="py-2.5 pr-2">{breakHrs > 0 ? formatHrsMin(breakHrs) : '-'}</td>
                                    <td className="py-2.5 pr-2 font-semibold">
                                      {actualWorkHrs > 0 ? (
                                        <span className={!isSelectedDayToday && selectedDay.shortHours ? 'text-amber-600' : ''}>
                                          {formatHrsMin(actualWorkHrs)}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2.5 pr-2 font-semibold">{workInShift > 0 ? formatHrsMin(workInShift) : '-'}</td>
                                    <td className="py-2.5 pr-2">
                                      {shortfallHrs > 0 ? (
                                        <span className="text-red-500 font-medium">{formatHrsMin(shortfallHrs)}</span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2.5">
                                      {excessHrs > 0 ? (
                                        <span className="text-emerald-600 font-medium">{formatHrsMin(excessHrs)}</span>
                                      ) : '-'}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Status row */}
                          <SectionHeader title="Status Details" />
                          <div className="px-4 pb-3">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400 font-medium">
                                  <td className="py-1.5">Status</td>
                                  <td className="py-1.5">Remarks</td>
                                </tr>
                              </thead>
                              <tbody className="text-slate-700">
                                <tr className="border-t border-slate-50">
                                  <td className="py-2">
                                    <span className={`font-semibold ${(statusConfig[selectedDay.status] || statusConfig.future).text}`}>
                                      {(statusConfig[selectedDay.status] || statusConfig.future).full || '-'}
                                    </span>
                                  </td>
                                  <td className="py-2 text-slate-500">{selectedDay.notes || '-'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}

                    {/* Session Details — greytHR style */}
                    <SectionHeader title="Session Details" />
                    <div className="px-4 pb-3">
                      {data.shift ? (
                        (() => {
                          const [sh, sm] = (data.shift.startTime || '0:0').split(':').map(Number);
                          const [eh, em] = (data.shift.endTime || '0:0').split(':').map(Number);
                          const startMin = sh * 60 + (sm || 0);
                          const endMin = eh * 60 + (em || 0);
                          const midMin = Math.floor((startMin + endMin) / 2);
                          const lunchStart = midMin;
                          const lunchEnd = midMin + 60; // 1 hour break
                          const fmtMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                          const s1Start = data.shift.startTime;
                          const s1End = fmtMin(lunchStart);
                          const s2Start = fmtMin(lunchEnd);
                          const s2End = data.shift.endTime;

                          const firstIn = selectedDay.checkIn ? formatTime(selectedDay.checkIn) : '-';
                          const lastOut = isSelectedDayToday ? null : (selectedDay.checkOut ? formatTime(selectedDay.checkOut) : '-');

                          // Calculate session durations
                          const s1Dur = (lunchStart - startMin) / 60;
                          const s2Dur = (endMin - lunchEnd) / 60;

                          return (
                            <div className="space-y-2">
                              {/* Session 1 */}
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-700">Session 1</span>
                                  <span className="text-[10px] text-slate-400">{s1Start} – {s1End} ({s1Dur.toFixed(1)} hrs)</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-0.5">First In</div>
                                    <div className="text-xs font-semibold text-emerald-600">{firstIn}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-0.5">Last Out</div>
                                    <div className="text-xs font-semibold text-slate-600">{s1End}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Break */}
                              <div className="bg-amber-50 rounded-lg p-2 flex items-center justify-between">
                                <span className="text-[10px] font-medium text-amber-700">🍽️ Break</span>
                                <span className="text-[10px] text-amber-600">{s1End} – {s2Start} (1:00 hr)</span>
                              </div>

                              {/* Session 2 */}
                              <div className="bg-slate-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-700">Session 2</span>
                                  <span className="text-[10px] text-slate-400">{s2Start} – {s2End} ({s2Dur.toFixed(1)} hrs)</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-0.5">First In</div>
                                    <div className="text-xs font-semibold text-slate-600">{s2Start}</div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] text-slate-400 mb-0.5">Last Out</div>
                                    <div className="text-xs font-semibold text-blue-600">{lastOut || '-'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-slate-700">Full Day</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] text-slate-400 mb-0.5">First In</div>
                              <div className="text-xs font-semibold text-emerald-600">{selectedDay.checkIn ? formatTime(selectedDay.checkIn) : '-'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400 mb-0.5">Last Out</div>
                              <div className="text-xs font-semibold text-blue-600">{isSelectedDayToday ? '-' : (selectedDay.checkOut ? formatTime(selectedDay.checkOut) : '-')}</div>
                            </div>
                          </div>
                        </div>
                      )}
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
                              <td className="py-1.5">Applied</td>
                              <td className="py-1.5">Approved</td>
                              <td className="py-1.5">From Date</td>
                              <td className="py-1.5">To Date</td>
                              <td className="py-1.5">Reason</td>
                            </tr>
                          </thead>
                          <tbody className="text-slate-700">
                            <tr className="border-t border-slate-50">
                              <td className="py-2 font-medium">{selectedDay.leaveName}</td>
                              <td className="py-2">-</td>
                              <td className="py-2"><span className="text-emerald-600 font-medium">Yes</span></td>
                              <td className="py-2">{selectedDay.date}</td>
                              <td className="py-2">{selectedDay.date}</td>
                              <td className="py-2">-</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-400 py-2">-</p>
                      )}
                    </div>

                    {/* Recalculate button — admin only */}
                    {!selfView && selectedDay.punches && selectedDay.punches.length > 0 && (
                      <div className="px-4 py-2 border-t border-slate-100">
                        <button
                          onClick={() => handleRecalculate(selectedDay.date)}
                          disabled={recalculating}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 w-full justify-center"
                        >
                          <RefreshCw className={`w-3 h-3 ${recalculating ? 'animate-spin' : ''}`} />
                          {recalculating ? 'Recalculating...' : 'Recalculate from Punches'}
                        </button>
                      </div>
                    )}

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

