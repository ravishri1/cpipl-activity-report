import { useState, useMemo } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { formatDate } from '../../utils/formatters';
import {
  BarChart3, Users, ChevronLeft, ChevronRight, Search, User, Calendar,
  CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, ChevronDown,
  ChevronUp, CalendarDays,
} from 'lucide-react';

const statusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const compOffStatusStyles = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

// Calendar cell styles for leave
const leaveCalStyles = {
  approved:  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', label: 'Approved' },
  pending:   { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   label: 'Pending' },
  rejected:  { bg: 'bg-red-50',      text: 'text-red-400',     border: 'border-red-200',     label: 'Rejected' },
  cancelled: { bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-200',   label: 'Cancelled' },
  holiday:   { bg: 'bg-orange-50',   text: 'text-orange-500',  border: 'border-orange-200',  label: 'Holiday' },
  weekend:   { bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-100',   label: 'Weekend' },
  compoff:   { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300',  label: 'Comp-Off' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

// Get FY months (Apr-Mar) for the given FY year
function getFYMonths(fyYear) {
  const months = [];
  for (let m = 3; m < 12; m++) months.push({ year: fyYear, month: m }); // Apr-Dec
  for (let m = 0; m < 3; m++) months.push({ year: fyYear + 1, month: m }); // Jan-Mar
  return months;
}

// ── Leave Calendar Component (per employee) ──────────────────
function LeaveCalendar({ requests, compOffHistory, fyYear, holidays }) {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  // Find current FY month index for initial state
  const fyMonths = getFYMonths(fyYear);
  const initialIdx = fyMonths.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth());
  const [monthIdx, setMonthIdx] = useState(initialIdx >= 0 ? initialIdx : 0);

  const { year: calYear, month: calMonth } = fyMonths[monthIdx] || fyMonths[0];
  const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`;

  // Build date map for leave requests — expand each request to individual dates
  const dateMap = useMemo(() => {
    const map = {}; // dateStr => { status, leaveType, session, reason, days }

    // Map approved/pending leave requests
    for (const r of requests) {
      if (r.status === 'cancelled') continue; // skip cancelled in calendar
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const ds = cur.toISOString().split('T')[0];
        const dayOfWeek = cur.getDay();
        // Skip weekends
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Priority: approved > pending > rejected
          const existing = map[ds];
          const priority = { approved: 3, pending: 2, rejected: 1 };
          if (!existing || (priority[r.status] || 0) > (priority[existing.status] || 0)) {
            map[ds] = {
              status: r.status,
              leaveType: r.leaveType?.code || r.leaveType?.name || 'Leave',
              session: r.session,
              reason: r.reason,
              days: r.days,
            };
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Map comp-off (approved earn days)
    for (const c of (compOffHistory || [])) {
      if (c.status === 'approved' && c.type === 'redeem') {
        const ds = c.workDate;
        if (!map[ds]) {
          map[ds] = { status: 'compoff', leaveType: 'CO', session: 'full_day', reason: c.reason || 'Comp-Off Redeem' };
        }
      }
    }

    return map;
  }, [requests, compOffHistory]);

  // Holiday set
  const holidayMap = useMemo(() => {
    const m = {};
    for (const h of (holidays || [])) {
      m[h.date] = h.name;
    }
    return m;
  }, [holidays]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();
    const today = new Date().toISOString().split('T')[0];

    const cells = [];

    // Empty cells for padding
    for (let i = 0; i < startPad; i++) {
      cells.push({ empty: true });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(calYear, calMonth, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = !!holidayMap[dateStr];
      const leave = dateMap[dateStr];
      const isToday = dateStr === today;
      const isFuture = dateStr > today;

      let style = null;
      let tooltip = '';

      if (leave) {
        if (leave.status === 'compoff') {
          style = leaveCalStyles.compoff;
          tooltip = `Comp-Off: ${leave.reason}`;
        } else {
          style = leaveCalStyles[leave.status];
          const sess = leave.session === 'first_half' ? ' (1st Half)' : leave.session === 'second_half' ? ' (2nd Half)' : '';
          tooltip = `${leave.leaveType}${sess} — ${style?.label || leave.status}\n${leave.reason}`;
        }
      } else if (isHoliday) {
        style = leaveCalStyles.holiday;
        tooltip = `Holiday: ${holidayMap[dateStr]}`;
      } else if (isWeekend) {
        style = leaveCalStyles.weekend;
        tooltip = dayOfWeek === 0 ? 'Sunday' : 'Saturday';
      }

      cells.push({
        day: d,
        dateStr,
        isWeekend,
        isHoliday,
        isToday,
        isFuture,
        leave,
        style,
        tooltip,
        holidayName: holidayMap[dateStr] || null,
      });
    }

    return cells;
  }, [calYear, calMonth, dateMap, holidayMap]);

  // Count leaves in this month
  const monthStats = useMemo(() => {
    let approved = 0, pending = 0;
    calendarDays.forEach(c => {
      if (c.leave?.status === 'approved') approved++;
      if (c.leave?.status === 'pending') pending++;
    });
    return { approved, pending };
  }, [calendarDays]);

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
            disabled={monthIdx === 0}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-700 px-2 min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button
            onClick={() => setMonthIdx(i => Math.min(fyMonths.length - 1, i + 1))}
            disabled={monthIdx >= fyMonths.length - 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {monthStats.approved > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400"></span>
              {monthStats.approved} approved
            </span>
          )}
          {monthStats.pending > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400"></span>
              {monthStats.pending} pending
            </span>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
        {/* Day headers */}
        {DAY_NAMES.map(d => (
          <div key={d} className="bg-slate-100 text-center py-1.5 text-[10px] font-semibold text-slate-500 uppercase">
            {d}
          </div>
        ))}

        {/* Calendar cells */}
        {calendarDays.map((cell, idx) => {
          if (cell.empty) {
            return <div key={`e-${idx}`} className="bg-white min-h-[52px]" />;
          }

          const { day, style, tooltip, isToday, leave, isHoliday, holidayName } = cell;
          const bgClass = style ? `${style.bg} ${style.border}` : 'bg-white';
          const textClass = style ? style.text : 'text-slate-700';

          return (
            <div
              key={cell.dateStr}
              className={`relative min-h-[52px] p-1 ${bgClass} ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''} group cursor-default`}
              title={tooltip}
            >
              <span className={`text-xs font-medium ${textClass}`}>{day}</span>

              {/* Leave indicator */}
              {leave && leave.status !== 'compoff' && (
                <div className="mt-0.5">
                  <span className={`text-[9px] font-bold ${style?.text || ''} block leading-tight`}>
                    {leave.leaveType}
                  </span>
                  {leave.session !== 'full_day' && (
                    <span className="text-[8px] text-slate-500 block">
                      {leave.session === 'first_half' ? '½ AM' : '½ PM'}
                    </span>
                  )}
                </div>
              )}

              {/* Comp-Off indicator */}
              {leave && leave.status === 'compoff' && (
                <div className="mt-0.5">
                  <span className="text-[9px] font-bold text-purple-700 block">CO</span>
                </div>
              )}

              {/* Holiday name */}
              {isHoliday && !leave && (
                <div className="mt-0.5">
                  <span className="text-[8px] text-orange-500 block leading-tight truncate" title={holidayName}>
                    {holidayName}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px]">
        {[
          { style: leaveCalStyles.approved, label: 'Approved Leave' },
          { style: leaveCalStyles.pending, label: 'Pending Leave' },
          { style: leaveCalStyles.compoff, label: 'Comp-Off' },
          { style: leaveCalStyles.holiday, label: 'Holiday' },
          { style: leaveCalStyles.weekend, label: 'Weekend' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${l.style.bg} border ${l.style.border}`}></span>
            <span className="text-slate-500">{l.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-white ring-2 ring-blue-400"></span>
          <span className="text-slate-500">Today</span>
        </span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function AdminLeaveDashboard() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [activeTab, setActiveTab] = useState({}); // per employee: 'balance' | 'history' | 'calendar' | 'compoff'

  const { data, loading, error: fetchErr } = useFetch(
    `/leave/admin/dashboard?year=${fyYear}`, { employees: [] }, [fyYear]
  );

  // Fetch holidays for the FY range (Apr year to Mar year+1)
  const { data: holidays } = useFetch(`/holidays?year=${fyYear}`, []);
  const { data: holidays2 } = useFetch(`/holidays?year=${fyYear + 1}`, []);
  const allHolidays = useMemo(() => [...(holidays || []), ...(holidays2 || [])], [holidays, holidays2]);

  const employees = data?.employees || [];

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set();
    employees.forEach(e => {
      if (e.employee.department) depts.add(e.employee.department);
    });
    return ['all', ...Array.from(depts).sort()];
  }, [employees]);

  // Filter employees
  const filtered = useMemo(() => {
    return employees.filter(e => {
      const emp = e.employee;
      const matchSearch = !search ||
        emp.name.toLowerCase().includes(search.toLowerCase()) ||
        (emp.employeeId || '').toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'all' || emp.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, search, deptFilter]);

  // Overall stats
  const stats = useMemo(() => {
    let totalPending = 0, totalApproved = 0, totalRejected = 0, totalDaysUsed = 0;
    employees.forEach(e => {
      totalPending += e.summary.pendingCount;
      totalApproved += e.summary.approvedCount;
      totalRejected += e.summary.rejectedCount;
      totalDaysUsed += e.summary.totalApprovedDays;
    });
    return { totalPending, totalApproved, totalRejected, totalDaysUsed, totalEmployees: data?.totalEmployees || 0 };
  }, [employees, data]);

  const toggleExpand = (empId) => {
    setExpandedEmp(prev => prev === empId ? null : empId);
    if (!activeTab[empId]) setActiveTab(prev => ({ ...prev, [empId]: 'balance' }));
  };

  const setEmpTab = (empId, tab) => {
    setActiveTab(prev => ({ ...prev, [empId]: tab }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          Leave Dashboard
        </h1>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
          <button onClick={() => setFyYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-700 px-2 min-w-[90px] text-center">
            {getFYLabel(fyYear)}
          </span>
          <button
            onClick={() => setFyYear(y => y + 1)}
            disabled={fyYear >= getCurrentFY()}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">Employees</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.totalEmployees}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500">Pending</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.totalPending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Approved</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.totalApproved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.totalRejected}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span className="text-xs text-slate-500">Total Days Used</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">{stats.totalDaysUsed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          {departments.map(d => (
            <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} employees</span>
      </div>

      {/* Employee List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees" subtitle="No employees found matching your filters" />
      ) : (
        <div className="space-y-3">
          {filtered.map(({ employee: emp, balances, requests, compOff, summary }) => {
            const isExpanded = expandedEmp === emp.id;
            const empTab = activeTab[emp.id] || 'balance';

            return (
              <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Employee Row (clickable) */}
                <button
                  onClick={() => toggleExpand(emp.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  {emp.driveProfilePhotoUrl || emp.profilePhotoUrl ? (
                    <img
                      src={emp.driveProfilePhotoUrl || emp.profilePhotoUrl}
                      alt={emp.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                    <p className="text-xs text-slate-400">{emp.employeeId} · {emp.department} · {emp.designation || ''}</p>
                  </div>

                  {/* Quick Stats */}
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    {summary.pendingCount > 0 && (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                        <Clock className="w-3 h-3" /> {summary.pendingCount} pending
                      </span>
                    )}
                    <span className="text-slate-500">
                      <span className="font-semibold text-emerald-600">{summary.totalApprovedDays}</span> days used
                    </span>
                    {balances.length > 0 && (
                      <span className="text-slate-500">
                        <span className="font-semibold text-blue-600">
                          {balances.reduce((s, b) => s + b.available, 0).toFixed(1)}
                        </span> available
                      </span>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 pb-5">
                    {/* Tab bar */}
                    <div className="flex items-center gap-1 border-b border-slate-100 mt-2 mb-4 overflow-x-auto">
                      {[
                        { key: 'balance', label: 'Leave Balance', icon: BarChart3 },
                        { key: 'history', label: `Leave History (${requests.length})`, icon: Calendar },
                        { key: 'calendar', label: 'Calendar View', icon: CalendarDays },
                        { key: 'compoff', label: 'Comp-Off', icon: AlertTriangle },
                      ].map(t => (
                        <button
                          key={t.key}
                          onClick={() => setEmpTab(emp.id, t.key)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                            empTab === t.key
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <t.icon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Balance Tab */}
                    {empTab === 'balance' && (
                      <div>
                        {balances.length === 0 ? (
                          <p className="text-sm text-slate-400 py-4 text-center">No leave balances for this FY. Grant leaves first.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left">
                                  <th className="px-3 py-2 font-medium text-slate-600">Leave Type</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Opening</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Credited</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Total Pool</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Used</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Available</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {balances.map(b => (
                                  <tr key={b.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                      <span className="font-medium text-slate-700">{b.leaveType.name}</span>
                                      <span className="ml-1 text-xs text-slate-400">({b.leaveType.code})</span>
                                    </td>
                                    <td className="px-3 py-2 text-center text-slate-600">{b.opening}</td>
                                    <td className="px-3 py-2 text-center text-slate-600">{b.credited}</td>
                                    <td className="px-3 py-2 text-center font-medium text-slate-700">
                                      {(b.opening + b.credited).toFixed(1)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-semibold ${b.used > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                        {b.used}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-bold ${b.available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {b.available.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {b.onProbation ? (
                                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                          Probation ({b.probationAllowance} usable)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                                          Confirmed
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* History Tab */}
                    {empTab === 'history' && (
                      <div>
                        {requests.length === 0 ? (
                          <p className="text-sm text-slate-400 py-4 text-center">No leave requests this FY.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left">
                                  <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">From</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">To</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Days</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Session</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Reason</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Note</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {requests.map(r => (
                                  <tr key={r.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                      <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">
                                        {r.leaveType.code}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(r.startDate)}</td>
                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(r.endDate)}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{r.days}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                      {r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full'}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.reason}>
                                      {r.reason}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>
                                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[150px] truncate" title={r.reviewNote || ''}>
                                      {r.reviewNote || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Calendar Tab */}
                    {empTab === 'calendar' && (
                      <LeaveCalendar
                        requests={requests}
                        compOffHistory={compOff.history}
                        fyYear={fyYear}
                        holidays={allHolidays}
                      />
                    )}

                    {/* Comp-Off Tab */}
                    {empTab === 'compoff' && (
                      <div>
                        {/* Comp-Off Balance */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <p className="text-[10px] uppercase text-blue-500 font-medium">Earned</p>
                            <p className="text-lg font-bold text-blue-700">{compOff.earned}</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3 text-center">
                            <p className="text-[10px] uppercase text-red-500 font-medium">Used</p>
                            <p className="text-lg font-bold text-red-600">{compOff.used}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-3 text-center">
                            <p className="text-[10px] uppercase text-emerald-500 font-medium">Balance</p>
                            <p className="text-lg font-bold text-emerald-700">{compOff.balance}</p>
                          </div>
                        </div>

                        {/* Comp-Off History */}
                        {compOff.history.length === 0 ? (
                          <p className="text-sm text-slate-400 py-2 text-center">No comp-off requests.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-left">
                                  <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Work Date</th>
                                  <th className="px-3 py-2 font-medium text-slate-600 text-center">Days</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Reason</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                                  <th className="px-3 py-2 font-medium text-slate-600">Requested</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {compOff.history.map(c => (
                                  <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                        c.type === 'earn' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                      }`}>
                                        {c.type === 'earn' ? 'Earn' : 'Redeem'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(c.workDate)}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{c.days}</td>
                                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={c.reason || ''}>
                                      {c.reason || '-'}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${compOffStatusStyles[c.status]}`}>
                                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                                      {formatDate(c.createdAt)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
