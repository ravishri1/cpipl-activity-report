import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  PieChart,
  BarChart3,
  Cake,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
  UserMinus,
  Building2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const formatNumber = (n) => {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const formatShortMonth = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const DEPT_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-pink-500', 'bg-lime-500', 'bg-sky-500',
];

const LEAVE_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700' },
];

// --- Sub-components ---

function CardShell({ title, icon: Icon, children, action, loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-b-xl">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}>
      {label}: <span className="font-bold">{formatNumber(value)}</span>
    </span>
  );
}

function HorizontalBar({ label, value, maxValue, color, showPercent }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-28 truncate text-right flex-shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
        <div
          className={`${color} h-full rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-semibold text-slate-500">
          {formatNumber(value)}{showPercent ? ` (${pct.toFixed(1)}%)` : ''}
        </span>
      </div>
    </div>
  );
}

function MonthPicker({ value, onChange }) {
  return (
    <div className="relative">
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
      />
    </div>
  );
}

// --- Card Components ---

function HeadcountCard({ data, loading }) {
  if (!data) return <CardShell title="Headcount Overview" icon={Users} loading={loading}><EmptyState /></CardShell>;

  const { total, byDepartment, byType, byCompany } = data;
  const deptEntries = byDepartment ? Object.entries(byDepartment).sort((a, b) => b[1] - a[1]) : [];
  const typeEntries = byType ? Object.entries(byType) : [];
  const companyEntries = byCompany ? Object.entries(byCompany).sort((a, b) => b[1] - a[1]) : [];
  const maxDept = deptEntries.length > 0 ? deptEntries[0][1] : 1;

  return (
    <CardShell title="Headcount Overview" icon={Users} loading={loading}>
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-3xl font-bold text-slate-800">{formatNumber(total || 0)}</span>
        <span className="text-sm text-slate-500">active employees</span>
      </div>

      {typeEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {typeEntries.map(([type, count]) => (
            <StatPill
              key={type}
              label={type}
              value={count}
              color="bg-blue-50 text-blue-700 border border-blue-200"
            />
          ))}
        </div>
      )}

      {companyEntries.length > 1 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">By Company</p>
          <div className="flex flex-wrap gap-2">
            {companyEntries.map(([company, count]) => (
              <StatPill
                key={company}
                label={company}
                value={count}
                color="bg-purple-50 text-purple-700 border border-purple-200"
              />
            ))}
          </div>
        </div>
      )}

      {deptEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">By Department</p>
          <div className="space-y-2">
            {deptEntries.map(([dept, count], i) => (
              <HorizontalBar
                key={dept}
                label={dept}
                value={count}
                maxValue={maxDept}
                color={DEPT_COLORS[i % DEPT_COLORS.length]}
                showPercent={total > 0}
              />
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function AttritionCard({ data, loading }) {
  if (!data) return <CardShell title="Attrition & Hiring" icon={TrendingUp} loading={loading}><EmptyState /></CardShell>;

  const months = data.months || data || [];
  const totalJoiners = months.reduce((s, m) => s + (m.joiners || 0), 0);
  const totalLeavers = months.reduce((s, m) => s + (m.leavers || 0), 0);
  const netChange = totalJoiners - totalLeavers;

  return (
    <CardShell title="Attrition & Hiring (6 Months)" icon={TrendingUp} loading={loading}>
      <div className="flex gap-4 mb-5">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          <UserPlus className="w-4 h-4 text-green-600" />
          <div>
            <p className="text-xs text-green-600 font-medium">Joined</p>
            <p className="text-lg font-bold text-green-700">{formatNumber(totalJoiners)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
          <UserMinus className="w-4 h-4 text-red-600" />
          <div>
            <p className="text-xs text-red-600 font-medium">Left</p>
            <p className="text-lg font-bold text-red-700">{formatNumber(totalLeavers)}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
          netChange >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'
        }`}>
          {netChange >= 0 ? (
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-orange-600" />
          )}
          <div>
            <p className={`text-xs font-medium ${netChange >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>Net</p>
            <p className={`text-lg font-bold ${netChange >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>
              {netChange >= 0 ? '+' : ''}{formatNumber(netChange)}
            </p>
          </div>
        </div>
      </div>

      {months.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-medium text-slate-500">Month</th>
                <th className="text-right py-2 px-2 font-medium text-green-600">Joiners</th>
                <th className="text-right py-2 px-2 font-medium text-red-600">Leavers</th>
                <th className="text-right py-2 px-2 font-medium text-slate-600">Net Change</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const net = (m.joiners || 0) - (m.leavers || 0);
                return (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2 text-slate-700 font-medium">
                      {formatShortMonth(m.month)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <UserPlus className="w-3 h-3" />
                        {formatNumber(m.joiners || 0)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <UserMinus className="w-3 h-3" />
                        {formatNumber(m.leavers || 0)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        net > 0 ? 'text-green-600' : net < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {net > 0 ? <ArrowUpRight className="w-3 h-3" /> : net < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                        {net > 0 ? '+' : ''}{formatNumber(net)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}

function AttendanceCard({ data, loading, month, onMonthChange }) {
  if (!data) {
    return (
      <CardShell
        title="Attendance Summary"
        icon={Clock}
        loading={loading}
        action={<MonthPicker value={month} onChange={onMonthChange} />}
      >
        <EmptyState />
      </CardShell>
    );
  }

  const { summary, byDepartment } = data;
  const total = summary
    ? (summary.present || 0) + (summary.absent || 0) + (summary.late || 0) +
      (summary.half_day || 0) + (summary.on_leave || 0)
    : 0;

  const attendanceTypes = summary ? [
    { key: 'present', label: 'Present', value: summary.present || 0, color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-700' },
    { key: 'absent', label: 'Absent', value: summary.absent || 0, color: 'bg-red-500', lightColor: 'bg-red-100', textColor: 'text-red-700' },
    { key: 'late', label: 'Late', value: summary.late || 0, color: 'bg-amber-500', lightColor: 'bg-amber-100', textColor: 'text-amber-700' },
    { key: 'half_day', label: 'Half Day', value: summary.half_day || 0, color: 'bg-blue-500', lightColor: 'bg-blue-100', textColor: 'text-blue-700' },
    { key: 'on_leave', label: 'On Leave', value: summary.on_leave || 0, color: 'bg-purple-500', lightColor: 'bg-purple-100', textColor: 'text-purple-700' },
  ] : [];

  const deptEntries = byDepartment ? Object.entries(byDepartment) : [];

  return (
    <CardShell
      title="Attendance Summary"
      icon={Clock}
      loading={loading}
      action={<MonthPicker value={month} onChange={onMonthChange} />}
    >
      <p className="text-xs text-slate-500 mb-4">{formatMonthDisplay(month)}</p>

      {/* Summary stats row */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {attendanceTypes.map((type) => (
          <div key={type.key} className={`${type.lightColor} rounded-lg p-2 text-center`}>
            <p className={`text-lg font-bold ${type.textColor}`}>{formatNumber(type.value)}</p>
            <p className="text-[10px] text-slate-500 font-medium">{type.label}</p>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      {total > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-slate-500 mb-2">Distribution</p>
          <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
            {attendanceTypes.map((type) => {
              const pct = (type.value / total) * 100;
              return pct > 0 ? (
                <div
                  key={type.key}
                  className={`${type.color} relative group transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${type.label}: ${formatNumber(type.value)} (${pct.toFixed(1)}%)`}
                >
                  {pct > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {attendanceTypes.map((type) => (
              <div key={type.key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${type.color}`} />
                <span className="text-[10px] text-slate-500">{type.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department breakdown */}
      {deptEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">By Department</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-1 font-medium text-slate-500">Department</th>
                  <th className="text-right py-2 px-1 font-medium text-green-600">Present</th>
                  <th className="text-right py-2 px-1 font-medium text-red-600">Absent</th>
                  <th className="text-right py-2 px-1 font-medium text-amber-600">Late</th>
                  <th className="text-right py-2 px-1 font-medium text-purple-600">Leave</th>
                </tr>
              </thead>
              <tbody>
                {deptEntries.map(([dept, stats]) => (
                  <tr key={dept} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-1.5 px-1 text-slate-700 font-medium truncate max-w-[120px]" title={dept}>{dept}</td>
                    <td className="py-1.5 px-1 text-right text-green-700">{formatNumber(stats.present || 0)}</td>
                    <td className="py-1.5 px-1 text-right text-red-700">{formatNumber(stats.absent || 0)}</td>
                    <td className="py-1.5 px-1 text-right text-amber-700">{formatNumber(stats.late || 0)}</td>
                    <td className="py-1.5 px-1 text-right text-purple-700">{formatNumber(stats.on_leave || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CardShell>
  );
}

function LeaveSummaryCard({ data, loading, month, onMonthChange }) {
  if (!data) {
    return (
      <CardShell
        title="Leave Utilization"
        icon={PieChart}
        loading={loading}
        action={<MonthPicker value={month} onChange={onMonthChange} />}
      >
        <EmptyState />
      </CardShell>
    );
  }

  const { byType, byDepartment } = data;
  const typeEntries = byType ? Object.entries(byType).sort((a, b) => b[1] - a[1]) : [];
  const totalLeaves = typeEntries.reduce((s, [, v]) => s + v, 0);
  const deptEntries = byDepartment
    ? Object.entries(byDepartment).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : [];
  const maxDeptLeave = deptEntries.length > 0 ? deptEntries[0][1] : 1;

  // Build donut segments using conic-gradient
  let accumulated = 0;
  const segments = typeEntries.map(([type, count], i) => {
    const pct = totalLeaves > 0 ? (count / totalLeaves) * 100 : 0;
    const start = accumulated;
    accumulated += pct;
    const colorMap = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#6366f1'];
    return { type, count, pct, start, end: accumulated, color: colorMap[i % colorMap.length] };
  });

  const conicStops = segments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(', ');
  const donutStyle = totalLeaves > 0
    ? { background: `conic-gradient(${conicStops})` }
    : { background: '#e2e8f0' };

  return (
    <CardShell
      title="Leave Utilization"
      icon={PieChart}
      loading={loading}
      action={<MonthPicker value={month} onChange={onMonthChange} />}
    >
      <p className="text-xs text-slate-500 mb-4">{formatMonthDisplay(month)}</p>

      <div className="flex items-start gap-6 mb-5">
        {/* Donut chart via CSS */}
        <div className="relative flex-shrink-0">
          <div
            className="w-28 h-28 rounded-full"
            style={donutStyle}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
              <span className="text-lg font-bold text-slate-800">{formatNumber(totalLeaves)}</span>
              <span className="text-[9px] text-slate-400">total</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 min-w-0">
          {segments.map((s, i) => (
            <div key={s.type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-slate-600 truncate flex-1" title={s.type}>{s.type}</span>
              <span className="text-xs font-semibold text-slate-700">{formatNumber(s.count)}</span>
              <span className="text-[10px] text-slate-400">({s.pct.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top departments by leave */}
      {deptEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Top Departments by Leave</p>
          <div className="space-y-2">
            {deptEntries.map(([dept, count], i) => (
              <HorizontalBar
                key={dept}
                label={dept}
                value={count}
                maxValue={maxDeptLeave}
                color={DEPT_COLORS[i % DEPT_COLORS.length]}
              />
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function DiversityCard({ genderData, ageData, tenureData, loading }) {
  const hasAny = genderData || ageData || tenureData;
  if (!hasAny) return <CardShell title="Workforce Diversity" icon={BarChart3} loading={loading}><EmptyState /></CardShell>;

  // Gender
  const genderEntries = genderData ? Object.entries(genderData).filter(([k]) => k !== 'total') : [];
  const genderTotal = genderEntries.reduce((s, [, v]) => s + v, 0);

  const genderColorMap = {
    male: { bar: 'bg-blue-500', ring: '#3b82f6' },
    female: { bar: 'bg-pink-500', ring: '#ec4899' },
    other: { bar: 'bg-purple-500', ring: '#8b5cf6' },
    undisclosed: { bar: 'bg-slate-400', ring: '#94a3b8' },
  };

  // Gender donut
  let gAccum = 0;
  const genderSegments = genderEntries.map(([g, count]) => {
    const pct = genderTotal > 0 ? (count / genderTotal) * 100 : 0;
    const start = gAccum;
    gAccum += pct;
    const col = genderColorMap[g.toLowerCase()] || genderColorMap.undisclosed;
    return { gender: g, count, pct, start, end: gAccum, color: col.ring };
  });
  const gConicStops = genderSegments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(', ');
  const gDonutStyle = genderTotal > 0 ? { background: `conic-gradient(${gConicStops})` } : { background: '#e2e8f0' };

  // Age buckets
  const ageBuckets = ageData ? Object.entries(ageData).sort((a, b) => {
    const orderKey = (k) => {
      const match = k.match(/\d+/);
      return match ? parseInt(match[0]) : 999;
    };
    return orderKey(a[0]) - orderKey(b[0]);
  }) : [];
  const maxAge = ageBuckets.length > 0 ? Math.max(...ageBuckets.map(([, v]) => v)) : 1;

  // Tenure buckets
  const tenureBuckets = tenureData ? Object.entries(tenureData).sort((a, b) => {
    const orderKey = (k) => {
      const match = k.match(/\d+/);
      return match ? parseInt(match[0]) : 999;
    };
    return orderKey(a[0]) - orderKey(b[0]);
  }) : [];
  const maxTenure = tenureBuckets.length > 0 ? Math.max(...tenureBuckets.map(([, v]) => v)) : 1;

  return (
    <CardShell title="Workforce Diversity" icon={BarChart3} loading={loading}>
      {/* Gender section */}
      {genderEntries.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Gender Distribution</p>
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-full" style={gDonutStyle} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-sm font-bold text-slate-800">{formatNumber(genderTotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {genderSegments.map((s) => (
                <div key={s.gender} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-600 capitalize flex-1">{s.gender}</span>
                  <span className="text-xs font-bold text-slate-700">{formatNumber(s.count)}</span>
                  <span className="text-[10px] text-slate-400 w-10 text-right">({s.pct.toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Age distribution */}
      {ageBuckets.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Age Distribution</p>
          <div className="space-y-2">
            {ageBuckets.map(([bucket, count], i) => (
              <HorizontalBar
                key={bucket}
                label={bucket}
                value={count}
                maxValue={maxAge}
                color={DEPT_COLORS[i % DEPT_COLORS.length]}
                showPercent
              />
            ))}
          </div>
        </div>
      )}

      {/* Tenure distribution */}
      {tenureBuckets.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Tenure Distribution</p>
          <div className="space-y-2">
            {tenureBuckets.map(([bucket, count], i) => (
              <HorizontalBar
                key={bucket}
                label={bucket}
                value={count}
                maxValue={maxTenure}
                color={DEPT_COLORS[(i + 4) % DEPT_COLORS.length]}
                showPercent
              />
            ))}
          </div>
        </div>
      )}
    </CardShell>
  );
}

function BirthdayCard({ data, loading }) {
  if (!data) return <CardShell title="Birthday Calendar" icon={Cake} loading={loading}><EmptyState /></CardShell>;

  const { birthdays, anniversaries } = data;
  const birthdayList = birthdays || [];
  const anniversaryList = anniversaries || [];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setFullYear(today.getFullYear());
    target.setHours(0, 0, 0, 0);
    if (target < today) target.setFullYear(today.getFullYear() + 1);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  return (
    <CardShell title="Birthday Calendar" icon={Cake} loading={loading}>
      {/* Birthdays */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Cake className="w-4 h-4 text-pink-500" />
          <p className="text-xs font-medium text-slate-600">Upcoming Birthdays</p>
          {birthdayList.length > 0 && (
            <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full font-medium">
              {birthdayList.length}
            </span>
          )}
        </div>
        {birthdayList.length === 0 ? (
          <p className="text-xs text-slate-400 italic pl-6">No upcoming birthdays this month</p>
        ) : (
          <div className="space-y-1.5">
            {birthdayList.slice(0, 10).map((person, i) => {
              const days = getDaysUntil(person.date || person.dateOfBirth);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-pink-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                    <Cake className="w-4 h-4 text-pink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{person.name}</p>
                    <p className="text-[10px] text-slate-400">{person.department || ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-pink-600">
                      {formatDate(person.date || person.dateOfBirth)}
                    </p>
                    {days === 0 ? (
                      <p className="text-[10px] text-pink-500 font-bold">Today!</p>
                    ) : days <= 7 ? (
                      <p className="text-[10px] text-amber-500">in {days}d</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Anniversaries */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-medium text-slate-600">Work Anniversaries</p>
          {anniversaryList.length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              {anniversaryList.length}
            </span>
          )}
        </div>
        {anniversaryList.length === 0 ? (
          <p className="text-xs text-slate-400 italic pl-6">No work anniversaries this month</p>
        ) : (
          <div className="space-y-1.5">
            {anniversaryList.slice(0, 10).map((person, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Award className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{person.name}</p>
                  <p className="text-[10px] text-slate-400">{person.department || ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-amber-600">
                    {formatDate(person.date || person.dateOfJoining)}
                  </p>
                  {person.years && (
                    <p className="text-[10px] text-amber-500 font-bold">{person.years} yr{person.years > 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      <AlertTriangle className="w-8 h-8 mb-2 text-slate-300" />
      <p className="text-xs">No data available</p>
    </div>
  );
}

// --- Main Component ---

export default function HRReports() {
  const { user } = useAuth();
  const [headcount, setHeadcount] = useState(null);
  const [attrition, setAttrition] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [genderData, setGenderData] = useState(null);
  const [ageData, setAgeData] = useState(null);
  const [tenureData, setTenureData] = useState(null);
  const [birthdayData, setBirthdayData] = useState(null);

  const [attendanceMonth, setAttendanceMonth] = useState(getCurrentMonth());
  const [leaveMonth, setLeaveMonth] = useState(getCurrentMonth());

  const [loadingStates, setLoadingStates] = useState({
    headcount: false,
    attrition: false,
    attendance: false,
    leave: false,
    diversity: false,
    birthday: false,
  });
  const [errors, setErrors] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);

  const setLoading = useCallback((key, val) => {
    setLoadingStates((prev) => ({ ...prev, [key]: val }));
  }, []);

  const setError = useCallback((key, err) => {
    setErrors((prev) => ({ ...prev, [key]: err }));
  }, []);

  const fetchHeadcount = useCallback(async () => {
    setLoading('headcount', true);
    setError('headcount', null);
    try {
      const res = await api.get('/analytics/headcount');
      setHeadcount(res.data);
    } catch (err) {
      console.error('Headcount fetch error:', err);
      setError('headcount', err.response?.data?.error || 'Failed to load headcount');
    } finally {
      setLoading('headcount', false);
    }
  }, [setLoading, setError]);

  const fetchAttrition = useCallback(async () => {
    setLoading('attrition', true);
    setError('attrition', null);
    try {
      const res = await api.get('/analytics/attrition', { params: { months: 6 } });
      setAttrition(res.data);
    } catch (err) {
      console.error('Attrition fetch error:', err);
      setError('attrition', err.response?.data?.error || 'Failed to load attrition');
    } finally {
      setLoading('attrition', false);
    }
  }, [setLoading, setError]);

  const fetchAttendance = useCallback(async (month) => {
    setLoading('attendance', true);
    setError('attendance', null);
    try {
      const res = await api.get('/analytics/attendance-summary', { params: { month } });
      setAttendance(res.data);
    } catch (err) {
      console.error('Attendance fetch error:', err);
      setError('attendance', err.response?.data?.error || 'Failed to load attendance');
    } finally {
      setLoading('attendance', false);
    }
  }, [setLoading, setError]);

  const fetchLeaveSummary = useCallback(async (month) => {
    setLoading('leave', true);
    setError('leave', null);
    try {
      const res = await api.get('/analytics/leave-summary', { params: { month } });
      setLeaveSummary(res.data);
    } catch (err) {
      console.error('Leave summary fetch error:', err);
      setError('leave', err.response?.data?.error || 'Failed to load leave summary');
    } finally {
      setLoading('leave', false);
    }
  }, [setLoading, setError]);

  const fetchDiversity = useCallback(async () => {
    setLoading('diversity', true);
    setError('diversity', null);
    try {
      const [genderRes, ageRes, tenureRes] = await Promise.allSettled([
        api.get('/analytics/gender-diversity'),
        api.get('/analytics/age-distribution'),
        api.get('/analytics/tenure-distribution'),
      ]);
      if (genderRes.status === 'fulfilled') setGenderData(genderRes.value.data);
      if (ageRes.status === 'fulfilled') setAgeData(ageRes.value.data);
      if (tenureRes.status === 'fulfilled') setTenureData(tenureRes.value.data);
    } catch (err) {
      console.error('Diversity fetch error:', err);
      setError('diversity', err.response?.data?.error || 'Failed to load diversity');
    } finally {
      setLoading('diversity', false);
    }
  }, [setLoading, setError]);

  const fetchBirthdays = useCallback(async () => {
    setLoading('birthday', true);
    setError('birthday', null);
    try {
      const res = await api.get('/analytics/birthday-calendar');
      setBirthdayData(res.data);
    } catch (err) {
      console.error('Birthday fetch error:', err);
      setError('birthday', err.response?.data?.error || 'Failed to load birthdays');
    } finally {
      setLoading('birthday', false);
    }
  }, [setLoading, setError]);

  const fetchAll = useCallback(() => {
    fetchHeadcount();
    fetchAttrition();
    fetchAttendance(attendanceMonth);
    fetchLeaveSummary(leaveMonth);
    fetchDiversity();
    fetchBirthdays();
    setLastRefresh(new Date());
  }, [fetchHeadcount, fetchAttrition, fetchAttendance, fetchLeaveSummary, fetchDiversity, fetchBirthdays, attendanceMonth, leaveMonth]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAttendance(attendanceMonth);
  }, [attendanceMonth, fetchAttendance]);

  useEffect(() => {
    fetchLeaveSummary(leaveMonth);
  }, [leaveMonth, fetchLeaveSummary]);

  const handleAttendanceMonthChange = (month) => {
    setAttendanceMonth(month);
  };

  const handleLeaveMonthChange = (month) => {
    setLeaveMonth(month);
  };

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            HR Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Workforce insights and organizational metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-slate-400">
              Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchAll}
            disabled={isAnyLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stat pills row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Total Employees</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatNumber(headcount?.total || 0)}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Departments</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatNumber(headcount?.byDepartment ? Object.keys(headcount.byDepartment).length : 0)}
              </p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Birthdays This Month</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatNumber(birthdayData?.birthdays?.length || 0)}
              </p>
            </div>
            <div className="p-2 bg-pink-50 rounded-lg">
              <Cake className="w-5 h-5 text-pink-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Anniversaries</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {formatNumber(birthdayData?.anniversaries?.length || 0)}
              </p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Award className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {Object.entries(errors).filter(([, v]) => v).length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-700 space-y-0.5">
              {Object.entries(errors)
                .filter(([, v]) => v)
                .map(([key, msg]) => (
                  <p key={key}><span className="font-medium capitalize">{key}:</span> {msg}</p>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <HeadcountCard data={headcount} loading={loadingStates.headcount} />

        <AttritionCard data={attrition} loading={loadingStates.attrition} />

        <AttendanceCard
          data={attendance}
          loading={loadingStates.attendance}
          month={attendanceMonth}
          onMonthChange={handleAttendanceMonthChange}
        />

        <LeaveSummaryCard
          data={leaveSummary}
          loading={loadingStates.leave}
          month={leaveMonth}
          onMonthChange={handleLeaveMonthChange}
        />

        <DiversityCard
          genderData={genderData}
          ageData={ageData}
          tenureData={tenureData}
          loading={loadingStates.diversity}
        />

        <BirthdayCard data={birthdayData} loading={loadingStates.birthday} />
      </div>
    </div>
  );
}
