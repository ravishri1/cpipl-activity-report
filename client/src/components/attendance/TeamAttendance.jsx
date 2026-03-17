import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import EmployeeCalendarView from './EmployeeCalendarView';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarRange,
  List,
  X,
} from 'lucide-react';

// Period presets — "single" = one day view, "range" = aggregated view
const PERIODS = [
  { key: 'today', label: 'Today', type: 'single' },
  { key: 'yesterday', label: 'Yesterday', type: 'single' },
  { key: 'this_week', label: 'This Week', type: 'range' },
  { key: 'this_month', label: 'This Month', type: 'range' },
  { key: 'last_month', label: 'Last Month', type: 'range' },
  { key: 'last_30', label: 'Last 30 Days', type: 'range' },
  { key: 'last_90', label: 'Last 90 Days', type: 'range' },
  { key: 'this_quarter', label: 'This Quarter', type: 'range' },
  { key: 'this_year', label: 'This Year', type: 'range' },
  { key: 'custom', label: 'Custom Range', type: 'range' },
];

function getPeriodDates(key) {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const todayStr = fmt(today);

  switch (key) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      return { startDate: yStr, endDate: yStr };
    }
    case 'this_week': {
      const day = today.getDay();
      const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { startDate: fmt(mon), endDate: todayStr };
    }
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(s), endDate: todayStr };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: fmt(s), endDate: fmt(e) };
    }
    case 'last_30': {
      const s = new Date(today); s.setDate(today.getDate() - 29);
      return { startDate: fmt(s), endDate: todayStr };
    }
    case 'last_90': {
      const s = new Date(today); s.setDate(today.getDate() - 89);
      return { startDate: fmt(s), endDate: todayStr };
    }
    case 'this_quarter': {
      const qMonth = Math.floor(today.getMonth() / 3) * 3;
      const s = new Date(today.getFullYear(), qMonth, 1);
      return { startDate: fmt(s), endDate: todayStr };
    }
    case 'this_year': {
      const s = new Date(today.getFullYear(), 0, 1);
      return { startDate: fmt(s), endDate: todayStr };
    }
    default:
      return { startDate: todayStr, endDate: todayStr };
  }
}

export default function TeamAttendance() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [singleDate, setSingleDate] = useState(new Date().toISOString().split('T')[0]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  // Determine if current view is a range or single-day
  const periodConfig = PERIODS.find(p => p.key === period);
  const isRange = periodConfig?.type === 'range';

  // Compute actual dates for current period
  const getActiveDates = useCallback(() => {
    if (period === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    if (!isRange) {
      // For today/yesterday, use the singleDate state (allows arrow navigation)
      return { startDate: singleDate, endDate: singleDate };
    }
    return getPeriodDates(period);
  }, [period, customStart, customEnd, singleDate, isRange]);

  // Single unified data fetch
  useEffect(() => {
    const { startDate, endDate } = getActiveDates();

    // For custom range, wait until both dates are selected
    if (period === 'custom' && (!startDate || !endDate)) {
      setEmployees([]);
      setSummary({});
      setLoading(false);
      return;
    }

    // For single-day periods
    if (!isRange) {
      const fetchSingle = async () => {
        setLoading(true);
        try {
          const res = await api.get(`/attendance/team?date=${startDate}`);
          const result = res.data;
          setEmployees(Array.isArray(result) ? result : (result.employees || []));
          setSummary(result.summary || {});
        } catch (err) {
          console.error('Team attendance error:', err);
          setEmployees([]);
        } finally {
          setLoading(false);
        }
      };
      fetchSingle();
      return;
    }

    // For range periods
    if (!startDate || !endDate) {
      setLoading(false);
      return;
    }
    const fetchRange = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/team-range?startDate=${startDate}&endDate=${endDate}`);
        setEmployees(res.data.employees || []);
        setSummary(res.data.summary || {});
      } catch (err) {
        console.error('Team attendance range error:', err);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRange();
  }, [period, singleDate, customStart, customEnd, isRange, getActiveDates]);

  // Handle period selection
  const handlePeriodSelect = (key) => {
    setPeriod(key);
    setShowPeriodMenu(false);
    // For single-day presets, sync the singleDate
    if (key === 'today') {
      setSingleDate(new Date().toISOString().split('T')[0]);
    } else if (key === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      setSingleDate(y.toISOString().split('T')[0]);
    }
    // For custom, initialize with this week's dates if empty
    if (key === 'custom' && !customStart && !customEnd) {
      const today = new Date();
      const mon = new Date(today);
      const day = today.getDay();
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      setCustomStart(mon.toISOString().split('T')[0]);
      setCustomEnd(today.toISOString().split('T')[0]);
    }
  };

  // Navigate single-day with arrows
  const navigateDay = (delta) => {
    const d = new Date(singleDate);
    d.setDate(d.getDate() + delta);
    setSingleDate(d.toISOString().split('T')[0]);
    // Keep the period as today/yesterday if it matches, else switch
    const todayStr = new Date().toISOString().split('T')[0];
    const newDate = d.toISOString().split('T')[0];
    if (newDate === todayStr) setPeriod('today');
    else {
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (newDate === y.toISOString().split('T')[0]) setPeriod('yesterday');
      else setPeriod('today'); // keep it single-day mode
    }
  };

  const currentPeriodLabel = PERIODS.find(p => p.key === period)?.label || 'Today';

  // Filter employees
  const filtered = filterName
    ? employees.filter(d =>
        d.name?.toLowerCase().includes(filterName.toLowerCase()) ||
        d.employeeId?.toLowerCase().includes(filterName.toLowerCase())
      )
    : employees;

  // Summary counts
  const presentCount = isRange
    ? filtered.reduce((s, d) => s + (d.presentDays || 0), 0)
    : filtered.filter(d => d.status === 'present' || d.status === 'half_day').length;
  const absentCount = isRange
    ? filtered.reduce((s, d) => s + (d.absentDays || 0), 0)
    : filtered.filter(d => d.status === 'absent').length;
  const leaveCount = isRange
    ? filtered.reduce((s, d) => s + (d.leaveDays || 0), 0)
    : filtered.filter(d => d.status === 'on_leave').length;

  // Date display text
  const getDateDisplayText = () => {
    const { startDate, endDate } = getActiveDates();
    if (!isRange) return startDate;
    if (!startDate || !endDate) return '—';
    if (startDate === endDate) return startDate;
    return `${startDate} to ${endDate}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-blue-600" />
          Team Attendance
        </h1>

        {/* View toggle tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => navigate('/admin/attendance')}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition bg-white text-blue-700 shadow-sm"
          >
            <List size={14} className="inline mr-1.5 -mt-0.5" />
            List View
          </button>
          <button
            onClick={() => navigate('/admin/attendance/calendar')}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition text-gray-600 hover:text-gray-800"
          >
            <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
            Calendar View
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu(!showPeriodMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <CalendarRange className="w-4 h-4 text-blue-500" />
              {currentPeriodLabel}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {showPeriodMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPeriodMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 w-48">
                  {PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => handlePeriodSelect(p.key)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between ${period === p.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                    >
                      {p.label}
                      {p.type === 'range' && <span className="text-[10px] text-slate-400 uppercase">Range</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Single-day date navigation (Today / Yesterday) */}
          {!isRange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDay(-1)}
                className="p-2 rounded-lg hover:bg-slate-100 bg-white border border-slate-200"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => { setSingleDate(e.target.value); setPeriod('today'); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
              <button
                onClick={() => navigateDay(1)}
                className="p-2 rounded-lg hover:bg-slate-100 bg-white border border-slate-200"
              >
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          )}

          {/* Custom Range — ALWAYS show both date pickers */}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
              <span className="text-sm text-slate-400 font-medium">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </div>
          )}

          {/* Employee search */}
          <div className="relative ml-auto">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-56 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
        </div>

        {/* Date range indicator */}
        {isRange && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Showing: <span className="font-medium text-slate-700">{getDateDisplayText()}</span>
            {summary.workingDays != null && (
              <span> · <span className="font-medium text-slate-700">{summary.workingDays}</span> working days</span>
            )}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">{isRange ? 'Employees' : 'Total'}</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{filtered.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">{isRange ? 'Present Days' : 'Present'}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{presentCount}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600">{isRange ? 'Absent Days' : 'Absent'}</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{absentCount}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-blue-600">{isRange ? 'Leave Days' : 'On Leave'}</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{leaveCount}</p>
        </div>
      </div>

      {/* Team table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {isRange ? (
              /* ═══ Range view — aggregated columns ═══ */
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Department</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Present</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Half Day</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Absent</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Leave</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Total Hrs</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Avg Hrs</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? filtered.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-slate-800">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{emp.department}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">
                          {emp.presentDays}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-amber-100 text-amber-700 text-xs font-bold">
                          {emp.halfDays || 0}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-red-100 text-red-700 text-xs font-bold">
                          {emp.absentDays}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-blue-100 text-blue-700 text-xs font-bold">
                          {emp.leaveDays}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        {emp.totalHours > 0 ? `${emp.totalHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        {emp.avgHours > 0 ? `${emp.avgHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => navigate(`/admin/attendance/${emp.userId}`)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View monthly calendar"
                        >
                          <Calendar className="w-4 h-4 text-blue-500" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No attendance data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              /* ═══ Single-day view ═══ */
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Department</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Shift</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Check In</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Check Out</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Hours</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length > 0 ? filtered.map((emp) => (
                    <tr key={emp.userId || emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="font-medium text-slate-800">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.employeeId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{emp.department}</td>
                      <td className="px-4 py-2.5">
                        {emp.shift ? (
                          <div className="flex flex-col gap-0.5">
                            <p className="font-medium text-slate-700 text-xs">{emp.shift.name}</p>
                            <p className="text-xs text-slate-500">{emp.shift.startTime} - {emp.shift.endTime}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {emp.status === 'present' || emp.status === 'half_day' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            {emp.status === 'half_day' ? 'Half Day' : 'Present'}
                          </span>
                        ) : emp.status === 'on_leave' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            On Leave
                          </span>
                        ) : emp.status === 'holiday' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            Holiday
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                            <XCircle className="w-3 h-3" /> Absent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {emp.checkIn ? new Date(emp.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {emp.checkOut ? new Date(emp.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {emp.workHours ? `${emp.workHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => navigate(`/admin/attendance/${emp.userId}`)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View monthly calendar"
                        >
                          <Calendar className="w-4 h-4 text-blue-500" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No attendance data for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
