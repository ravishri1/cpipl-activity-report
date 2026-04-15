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
  ChevronUp, CalendarDays, Download, Eye, PieChart, Building2, Lock,
} from 'lucide-react';
import { usePayrollLock } from '../../hooks/usePayrollLock';

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

function getFYMonths(fyYear) {
  const months = [];
  for (let m = 3; m < 12; m++) months.push({ year: fyYear, month: m });
  for (let m = 0; m < 3; m++) months.push({ year: fyYear + 1, month: m });
  return months;
}

// ── Date helpers for period filtering ────────────────────────
function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().split('T')[0], end: sunday.toISOString().split('T')[0] };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

function getQuarterRange() {
  const now = new Date();
  const m = now.getMonth();
  const qStart = m < 3 ? 0 : m < 6 ? 3 : m < 9 ? 6 : 9;
  const start = new Date(now.getFullYear(), qStart, 1);
  const end = new Date(now.getFullYear(), qStart + 3, 0);
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], label: `Q${Math.floor(qStart / 3) + 1} ${now.getFullYear()}` };
}

function getYearRange(fyYear) {
  return { start: `${fyYear}-04-01`, end: `${fyYear + 1}-03-31` };
}

function isDateInRange(dateStr, startDate, endDate) {
  return dateStr >= startDate && dateStr <= endDate;
}

function doesLeaveOverlapRange(startDate, endDate, rangeStart, rangeEnd) {
  return startDate <= rangeEnd && endDate >= rangeStart;
}

// ── CSV Export Helper ────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Leave Calendar Component ─────────────────────────────────
function LeaveCalendar({ requests, compOffHistory, fyYear, holidays }) {
  const now = new Date();
  const fyMonths = getFYMonths(fyYear);
  const initialIdx = fyMonths.findIndex(m => m.year === now.getFullYear() && m.month === now.getMonth());
  const [monthIdx, setMonthIdx] = useState(initialIdx >= 0 ? initialIdx : 0);

  const { year: calYear, month: calMonth } = fyMonths[monthIdx] || fyMonths[0];
  const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const dateMap = useMemo(() => {
    const map = {};
    for (const r of requests) {
      if (r.status === 'cancelled') continue;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const cur = new Date(start);
      while (cur <= end) {
        const ds = cur.toISOString().split('T')[0];
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const existing = map[ds];
          const priority = { approved: 3, pending: 2, rejected: 1 };
          if (!existing || (priority[r.status] || 0) > (priority[existing.status] || 0)) {
            map[ds] = { status: r.status, leaveType: r.leaveType?.code || 'Leave', session: r.session, reason: r.reason };
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    for (const c of (compOffHistory || [])) {
      if (c.status === 'approved' && c.type === 'redeem' && !map[c.workDate]) {
        map[c.workDate] = { status: 'compoff', leaveType: 'CO', session: 'full_day', reason: c.reason || 'Comp-Off' };
      }
    }
    return map;
  }, [requests, compOffHistory]);

  const holidayMap = useMemo(() => {
    const m = {};
    for (const h of (holidays || [])) m[h.date] = h.name;
    return m;
  }, [holidays]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const today = new Date().toISOString().split('T')[0];
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push({ empty: true });
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(calYear, calMonth, d);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = !!holidayMap[dateStr];
      const leave = dateMap[dateStr];
      const isToday = dateStr === today;
      let style = null, tooltip = '';
      if (leave) {
        style = leave.status === 'compoff' ? leaveCalStyles.compoff : leaveCalStyles[leave.status];
        const sess = leave.session === 'first_half' ? ' (1st Half)' : leave.session === 'second_half' ? ' (2nd Half)' : '';
        tooltip = `${leave.leaveType}${sess} — ${style?.label || leave.status}\n${leave.reason}`;
      } else if (isHoliday) {
        style = leaveCalStyles.holiday;
        tooltip = `Holiday: ${holidayMap[dateStr]}`;
      } else if (isWeekend) {
        style = leaveCalStyles.weekend;
      }
      cells.push({ day: d, dateStr, isWeekend, isHoliday, isToday, leave, style, tooltip, holidayName: holidayMap[dateStr] });
    }
    return cells;
  }, [calYear, calMonth, dateMap, holidayMap]);

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthIdx(i => Math.max(0, i - 1))} disabled={monthIdx === 0}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-700 px-2 min-w-[140px] text-center">{monthLabel}</span>
          <button onClick={() => setMonthIdx(i => Math.min(fyMonths.length - 1, i + 1))} disabled={monthIdx >= fyMonths.length - 1}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {monthStats.approved > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-400"></span>{monthStats.approved} approved</span>}
          {monthStats.pending > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400"></span>{monthStats.pending} pending</span>}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
        {DAY_NAMES.map(d => (
          <div key={d} className="bg-slate-100 text-center py-1.5 text-[10px] font-semibold text-slate-500 uppercase">{d}</div>
        ))}
        {calendarDays.map((cell, idx) => {
          if (cell.empty) return <div key={`e-${idx}`} className="bg-white min-h-[52px]" />;
          const { day, style, tooltip, isToday, leave, isHoliday, holidayName } = cell;
          const bgClass = style ? `${style.bg} ${style.border}` : 'bg-white';
          const textClass = style ? style.text : 'text-slate-700';
          return (
            <div key={cell.dateStr} className={`relative min-h-[52px] p-1 ${bgClass} ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}`} title={tooltip}>
              <span className={`text-xs font-medium ${textClass}`}>{day}</span>
              {leave && leave.status !== 'compoff' && (
                <div className="mt-0.5">
                  <span className={`text-[9px] font-bold ${style?.text || ''} block leading-tight`}>{leave.leaveType}</span>
                  {leave.session !== 'full_day' && <span className="text-[8px] text-slate-500 block">{leave.session === 'first_half' ? '½ AM' : '½ PM'}</span>}
                </div>
              )}
              {leave && leave.status === 'compoff' && <div className="mt-0.5"><span className="text-[9px] font-bold text-purple-700 block">CO</span></div>}
              {isHoliday && !leave && <div className="mt-0.5"><span className="text-[8px] text-orange-500 block leading-tight truncate">{holidayName}</span></div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px]">
        {[
          { style: leaveCalStyles.approved, label: 'Approved' },
          { style: leaveCalStyles.pending, label: 'Pending' },
          { style: leaveCalStyles.compoff, label: 'Comp-Off' },
          { style: leaveCalStyles.holiday, label: 'Holiday' },
          { style: leaveCalStyles.weekend, label: 'Weekend' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-sm ${l.style.bg} border ${l.style.border}`}></span>
            <span className="text-slate-500">{l.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-white ring-2 ring-blue-400"></span><span className="text-slate-500">Today</span></span>
      </div>
    </div>
  );
}

// ── Leave Overview Component (greytHR-style) ─────────────────
function LeaveOverview({ employees, fyYear }) {
  const [period, setPeriod] = useState('month');
  const [overviewDept, setOverviewDept] = useState('all');

  // Compute date range for selected period
  const dateRange = useMemo(() => {
    switch (period) {
      case 'today': { const t = getToday(); return { start: t, end: t, label: `Today (${formatDate(t)})` }; }
      case 'week': { const w = getWeekRange(); return { ...w, label: `This Week (${formatDate(w.start)} – ${formatDate(w.end)})` }; }
      case 'month': { const m = getMonthRange(); return { ...m, label: `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}` }; }
      case 'quarter': { const q = getQuarterRange(); return { ...q, label: q.label }; }
      case 'year': { const y = getYearRange(fyYear); return { ...y, label: getFYLabel(fyYear) }; }
      default: { const m = getMonthRange(); return { ...m, label: 'This Month' }; }
    }
  }, [period, fyYear]);

  // Filter leaves in this period
  const periodData = useMemo(() => {
    const result = [];
    for (const emp of employees) {
      if (overviewDept !== 'all' && emp.employee.department !== overviewDept) continue;
      const periodRequests = emp.requests.filter(r =>
        (r.status === 'approved' || r.status === 'pending') &&
        doesLeaveOverlapRange(r.startDate, r.endDate, dateRange.start, dateRange.end)
      );
      if (periodRequests.length > 0) {
        const approvedDays = periodRequests.filter(r => r.status === 'approved').reduce((s, r) => s + r.days, 0);
        const pendingDays = periodRequests.filter(r => r.status === 'pending').reduce((s, r) => s + r.days, 0);
        result.push({ employee: emp.employee, requests: periodRequests, approvedDays, pendingDays, totalDays: approvedDays + pendingDays });
      }
    }
    result.sort((a, b) => b.totalDays - a.totalDays);
    return result;
  }, [employees, dateRange, overviewDept]);

  // Department summary
  const deptSummary = useMemo(() => {
    const depts = {};
    for (const d of periodData) {
      const dept = d.employee.department || 'Unknown';
      if (!depts[dept]) depts[dept] = { dept, employees: 0, approvedDays: 0, pendingDays: 0 };
      depts[dept].employees++;
      depts[dept].approvedDays += d.approvedDays;
      depts[dept].pendingDays += d.pendingDays;
    }
    return Object.values(depts).sort((a, b) => (b.approvedDays + b.pendingDays) - (a.approvedDays + a.pendingDays));
  }, [periodData]);

  // Leave type breakdown
  const leaveTypeBreakdown = useMemo(() => {
    const types = {};
    for (const d of periodData) {
      for (const r of d.requests) {
        const code = r.leaveType?.code || 'Other';
        const name = r.leaveType?.name || code;
        if (!types[code]) types[code] = { code, name, count: 0, days: 0 };
        types[code].count++;
        types[code].days += r.days;
      }
    }
    return Object.values(types).sort((a, b) => b.days - a.days);
  }, [periodData]);

  // All departments for filter
  const allDepts = useMemo(() => {
    const depts = new Set();
    employees.forEach(e => { if (e.employee.department) depts.add(e.employee.department); });
    return ['all', ...Array.from(depts).sort()];
  }, [employees]);

  const totalApproved = periodData.reduce((s, d) => s + d.approvedDays, 0);
  const totalPending = periodData.reduce((s, d) => s + d.pendingDays, 0);

  // Export overview CSV
  const handleExportOverview = () => {
    const headers = ['Employee', 'Employee ID', 'Department', 'Designation', 'Leave Type', 'From', 'To', 'Days', 'Session', 'Status', 'Reason'];
    const rows = [];
    for (const d of periodData) {
      for (const r of d.requests) {
        rows.push([
          d.employee.name, d.employee.employeeId || '', d.employee.department || '', d.employee.designation || '',
          r.leaveType?.name || '', r.startDate, r.endDate, r.days,
          r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full Day',
          r.status, r.reason || '',
        ]);
      }
    }
    downloadCSV(`leave-overview-${period}-${dateRange.start}.csv`, headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* Period selector + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'quarter', label: 'Quarter' },
            { key: 'year', label: 'Year' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select value={overviewDept} onChange={e => setOverviewDept(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
          {allDepts.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
        </select>
        <span className="text-xs text-slate-500 font-medium">{dateRange.label}</span>
        <div className="ml-auto">
          <button onClick={handleExportOverview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] uppercase text-slate-400 font-medium">Employees on Leave</p>
          <p className="text-2xl font-bold text-slate-800">{periodData.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] uppercase text-slate-400 font-medium">Approved Days</p>
          <p className="text-2xl font-bold text-emerald-600">{totalApproved}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] uppercase text-slate-400 font-medium">Pending Days</p>
          <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-[10px] uppercase text-slate-400 font-medium">Total Days</p>
          <p className="text-2xl font-bold text-blue-600">{totalApproved + totalPending}</p>
        </div>
      </div>

      {/* Two-column: Leave Type + Department breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leave Type Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-500" /> By Leave Type
          </h3>
          {leaveTypeBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No leaves in this period</p>
          ) : (
            <div className="space-y-2">
              {leaveTypeBreakdown.map(lt => {
                const maxDays = leaveTypeBreakdown[0]?.days || 1;
                const pct = Math.round((lt.days / maxDays) * 100);
                return (
                  <div key={lt.code}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{lt.name} <span className="text-slate-400">({lt.code})</span></span>
                      <span className="text-slate-600 font-semibold">{lt.days} days <span className="text-slate-400 font-normal">({lt.count} requests)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Department Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> By Department
          </h3>
          {deptSummary.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No leaves in this period</p>
          ) : (
            <div className="space-y-2">
              {deptSummary.map(d => {
                const total = d.approvedDays + d.pendingDays;
                const maxTotal = (deptSummary[0]?.approvedDays + deptSummary[0]?.pendingDays) || 1;
                const pct = Math.round((total / maxTotal) * 100);
                return (
                  <div key={d.dept}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{d.dept}</span>
                      <span className="text-slate-600">
                        <span className="font-semibold">{d.employees}</span> employees · <span className="font-semibold">{total}</span> days
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Who's on leave — detailed table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Who's on Leave ({periodData.length} employees)
          </h3>
        </div>
        {periodData.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No one is on leave in this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-medium text-slate-600">Employee</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Department</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Leave Type</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">From</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">To</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Days</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Session</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodData.flatMap(d =>
                  d.requests.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-slate-700">{d.employee.name}</p>
                        <p className="text-[10px] text-slate-400">{d.employee.employeeId}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{d.employee.department || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">{r.leaveType?.code || '-'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(r.startDate)}</td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(r.endDate)}</td>
                      <td className="px-4 py-2.5 text-center font-semibold">{r.days}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[180px] truncate" title={r.reason}>{r.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function AdminLeaveDashboard() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [mainTab, setMainTab] = useState('overview'); // 'overview' | 'employees'
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { isLocked: monthLocked, lockInfo } = usePayrollLock(currentMonth);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [activeTab, setActiveTab] = useState({});

  const { data, loading, error: fetchErr } = useFetch(
    `/leave/admin/dashboard?year=${fyYear}`, { employees: [] }, [fyYear]
  );

  const { data: holidays } = useFetch(`/holidays?year=${fyYear}`, []);
  const { data: holidays2 } = useFetch(`/holidays?year=${fyYear + 1}`, []);
  const allHolidays = useMemo(() => [...(holidays || []), ...(holidays2 || [])], [holidays, holidays2]);

  const employees = data?.employees || [];

  const departments = useMemo(() => {
    const depts = new Set();
    employees.forEach(e => { if (e.employee.department) depts.add(e.employee.department); });
    return ['all', ...Array.from(depts).sort()];
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter(e => {
      const emp = e.employee;
      const matchSearch = !search || emp.name.toLowerCase().includes(search.toLowerCase()) || (emp.employeeId || '').toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === 'all' || emp.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, search, deptFilter]);

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

  // ── Export functions ──────────────────────────────────────
  const handleExportBalances = () => {
    const headers = ['Employee', 'Employee ID', 'Department', 'Designation', 'Leave Type', 'Code', 'Opening', 'Credited', 'Total Pool', 'Used', 'Available', 'Probation', 'Probation Allowance'];
    const rows = [];
    for (const emp of filtered) {
      for (const b of emp.balances) {
        rows.push([
          emp.employee.name, emp.employee.employeeId || '', emp.employee.department || '', emp.employee.designation || '',
          b.leaveType.name, b.leaveType.code, b.opening, b.credited, (b.opening + b.credited).toFixed(1), b.used, b.available.toFixed(1),
          b.onProbation ? 'Yes' : 'No', b.probationAllowance ?? '',
        ]);
      }
    }
    downloadCSV(`leave-balances-${getFYLabel(fyYear)}.csv`, headers, rows);
  };

  const handleExportHistory = () => {
    const headers = ['Employee', 'Employee ID', 'Department', 'Leave Type', 'Code', 'From', 'To', 'Days', 'Session', 'Status', 'Reason', 'Review Note', 'Applied On'];
    const rows = [];
    for (const emp of filtered) {
      for (const r of emp.requests) {
        rows.push([
          emp.employee.name, emp.employee.employeeId || '', emp.employee.department || '',
          r.leaveType?.name || '', r.leaveType?.code || '', r.startDate, r.endDate, r.days,
          r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full Day',
          r.status, r.reason || '', r.reviewNote || '', r.createdAt ? formatDate(r.createdAt) : '',
        ]);
      }
    }
    downloadCSV(`leave-history-${getFYLabel(fyYear)}.csv`, headers, rows);
  };

  const handleExportCompOff = () => {
    const headers = ['Employee', 'Employee ID', 'Department', 'Comp-Off Earned', 'Comp-Off Used', 'Comp-Off Balance', 'Request Type', 'Work Date', 'Days', 'Status', 'Reason', 'Requested On'];
    const rows = [];
    for (const emp of filtered) {
      if (emp.compOff.history.length > 0) {
        for (const c of emp.compOff.history) {
          rows.push([
            emp.employee.name, emp.employee.employeeId || '', emp.employee.department || '',
            emp.compOff.earned, emp.compOff.used, emp.compOff.balance,
            c.type === 'earn' ? 'Earn' : 'Redeem', c.workDate, c.days, c.status, c.reason || '', formatDate(c.createdAt),
          ]);
        }
      } else {
        rows.push([
          emp.employee.name, emp.employee.employeeId || '', emp.employee.department || '',
          emp.compOff.earned, emp.compOff.used, emp.compOff.balance,
          '', '', '', '', '', '',
        ]);
      }
    }
    downloadCSV(`comp-off-report-${getFYLabel(fyYear)}.csv`, headers, rows);
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
        <div className="flex items-center gap-3">
          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button onClick={handleExportBalances} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> Leave Balances
              </button>
              <button onClick={handleExportHistory} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Leave History
              </button>
              <button onClick={handleExportCompOff} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-500" /> Comp-Off Report
              </button>
            </div>
          </div>
          {/* FY selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1 py-1">
            <button onClick={() => setFyYear(y => y - 1)} className="p-1.5 rounded hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2 min-w-[90px] text-center">{getFYLabel(fyYear)}</span>
            <button onClick={() => setFyYear(y => y + 1)} disabled={fyYear >= getCurrentFY()}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {fetchErr && <AlertMessage type="error" message={fetchErr} />}

      {/* Payroll Lock Notice */}
      {monthLocked && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              Payroll Locked — {currentMonth}
              {lockInfo?.lockedAt && (
                <span className="text-xs font-normal text-red-400 ml-2">
                  (since {new Date(lockInfo.lockedAt).toLocaleDateString('en-IN')})
                </span>
              )}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              New leave applications for this month are blocked. You can still view and export leave data. Unlock payroll from Payroll Dashboard to allow modifications.
            </p>
          </div>
        </div>
      )}

      {/* Main Tabs: Overview | Employees */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { key: 'overview', label: 'Leave Overview', icon: Eye },
          { key: 'employees', label: 'Employee Details', icon: Users },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mainTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Overview Tab ═══ */}
      {mainTab === 'overview' && (
        <LeaveOverview employees={employees} fyYear={fyYear} />
      )}

      {/* ═══ Employee Details Tab ═══ */}
      {mainTab === 'employees' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-500" /><span className="text-xs text-slate-500">Employees</span></div>
              <p className="text-2xl font-bold text-slate-800">{stats.totalEmployees}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-slate-500">Pending</span></div>
              <p className="text-2xl font-bold text-amber-600">{stats.totalPending}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-slate-500">Approved</span></div>
              <p className="text-2xl font-bold text-emerald-600">{stats.totalApproved}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500">Rejected</span></div>
              <p className="text-2xl font-bold text-red-600">{stats.totalRejected}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-indigo-500" /><span className="text-xs text-slate-500">Total Days Used</span></div>
              <p className="text-2xl font-bold text-indigo-600">{stats.totalDaysUsed}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
              {departments.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
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
                    <button onClick={() => toggleExpand(emp.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left">
                      {emp.driveProfilePhotoUrl || emp.profilePhotoUrl ? (
                        <img src={emp.driveProfilePhotoUrl || emp.profilePhotoUrl} alt={emp.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.employeeId} · {emp.department} · {emp.designation || ''}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 text-xs">
                        {summary.pendingCount > 0 && (
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                            <Clock className="w-3 h-3" /> {summary.pendingCount} pending
                          </span>
                        )}
                        <span className="text-slate-500"><span className="font-semibold text-emerald-600">{summary.totalApprovedDays}</span> days used</span>
                        {balances.length > 0 && (
                          <span className="text-slate-500"><span className="font-semibold text-blue-600">{balances.reduce((s, b) => s + b.available, 0).toFixed(1)}</span> available</span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 px-5 pb-5">
                        <div className="flex items-center gap-1 border-b border-slate-100 mt-2 mb-4 overflow-x-auto">
                          {[
                            { key: 'balance', label: 'Leave Balance', icon: BarChart3 },
                            { key: 'history', label: `Leave History (${requests.length})`, icon: Calendar },
                            { key: 'calendar', label: 'Calendar View', icon: CalendarDays },
                            { key: 'compoff', label: 'Comp-Off', icon: AlertTriangle },
                          ].map(t => (
                            <button key={t.key} onClick={() => setEmpTab(emp.id, t.key)}
                              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                                empTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                              }`}>
                              <t.icon className="w-3.5 h-3.5" />{t.label}
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
                                  <thead><tr className="bg-slate-50 text-left">
                                    <th className="px-3 py-2 font-medium text-slate-600">Leave Type</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Opening</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Credited</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Total Pool</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Used</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Available</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Status</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {balances.map(b => (
                                      <tr key={b.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2"><span className="font-medium text-slate-700">{b.leaveType.name}</span> <span className="text-xs text-slate-400">({b.leaveType.code})</span></td>
                                        <td className="px-3 py-2 text-center text-slate-600">{b.opening}</td>
                                        <td className="px-3 py-2 text-center text-slate-600">{b.credited}</td>
                                        <td className="px-3 py-2 text-center font-medium text-slate-700">{(b.opening + b.credited).toFixed(1)}</td>
                                        <td className="px-3 py-2 text-center"><span className={`font-semibold ${b.used > 0 ? 'text-red-600' : 'text-slate-400'}`}>{b.used}</span></td>
                                        <td className="px-3 py-2 text-center"><span className={`font-bold ${b.available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{b.available.toFixed(1)}</span></td>
                                        <td className="px-3 py-2 text-center">
                                          {b.onProbation ? (
                                            <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Probation ({b.probationAllowance} usable)</span>
                                          ) : (
                                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Confirmed</span>
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
                                  <thead><tr className="bg-slate-50 text-left">
                                    <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">From</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">To</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Days</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Session</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Reason</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Note</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {requests.map(r => (
                                      <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2"><span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">{r.leaveType.code}</span></td>
                                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(r.startDate)}</td>
                                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(r.endDate)}</td>
                                        <td className="px-3 py-2 text-center font-semibold">{r.days}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{r.session === 'first_half' ? '1st Half' : r.session === 'second_half' ? '2nd Half' : 'Full'}</td>
                                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                                        <td className="px-3 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[r.status]}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
                                        <td className="px-3 py-2 text-xs text-slate-400 max-w-[150px] truncate" title={r.reviewNote || ''}>{r.reviewNote || '-'}</td>
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
                          <LeaveCalendar requests={requests} compOffHistory={compOff.history} fyYear={fyYear} holidays={allHolidays} />
                        )}

                        {/* Comp-Off Tab */}
                        {empTab === 'compoff' && (
                          <div>
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
                            {compOff.history.length === 0 ? (
                              <p className="text-sm text-slate-400 py-2 text-center">No comp-off requests.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead><tr className="bg-slate-50 text-left">
                                    <th className="px-3 py-2 font-medium text-slate-600">Type</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Work Date</th>
                                    <th className="px-3 py-2 font-medium text-slate-600 text-center">Days</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Reason</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                                    <th className="px-3 py-2 font-medium text-slate-600">Requested</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {compOff.history.map(c => (
                                      <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="px-3 py-2"><span className={`text-xs font-medium px-2 py-0.5 rounded ${c.type === 'earn' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{c.type === 'earn' ? 'Earn' : 'Redeem'}</span></td>
                                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(c.workDate)}</td>
                                        <td className="px-3 py-2 text-center font-semibold">{c.days}</td>
                                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={c.reason || ''}>{c.reason || '-'}</td>
                                        <td className="px-3 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${compOffStatusStyles[c.status]}`}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span></td>
                                        <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
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
        </>
      )}
    </div>
  );
}
