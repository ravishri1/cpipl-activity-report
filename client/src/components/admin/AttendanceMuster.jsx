import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  Calendar, Search, X, Download, ChevronLeft, ChevronRight, ChevronDown,
  Clock, Shield, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';

// ── Color map for cell backgrounds (greytHR-style) ──
const CELL_COLORS = {
  present:  'bg-sky-100 text-sky-800',
  absent:   'bg-red-100 text-red-700',
  halfday:  'bg-amber-100 text-amber-800',
  leave:    'bg-purple-100 text-purple-700',
  holiday:  'bg-orange-100 text-orange-700',
  off:      'bg-slate-100 text-slate-400',
  future:   'bg-white text-slate-300',
  lop:      'bg-rose-100 text-rose-700',
  onduty:   'bg-blue-100 text-blue-700',
  compoff:  'bg-teal-100 text-teal-700',
  other:    'bg-slate-100 text-slate-500',
};

// Day header colors (weekend in red)
const DAY_HEADER_COLORS = {
  0: 'text-red-400',   // Sun
  6: 'text-red-400',   // Sat
};

// Session status options for admin
const SESSION_OPTIONS = [
  { value: 'P', label: 'Present', color: 'bg-emerald-500' },
  { value: 'A', label: 'Absent', color: 'bg-red-500' },
  { value: 'L', label: 'Leave', color: 'bg-purple-500' },
  { value: 'LOP', label: 'Loss of Pay', color: 'bg-orange-500' },
  { value: 'OD', label: 'On Duty', color: 'bg-blue-500' },
  { value: 'COF', label: 'Comp Off', color: 'bg-teal-500' },
  { value: 'HD', label: 'Half Day', color: 'bg-amber-500' },
];

// Quick override presets
const QUICK_PRESETS = [
  { label: 'P (Full Present)', s1: 'P', s2: 'P', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'A (Full Absent)', s1: 'A', s2: 'A', color: 'bg-red-50 text-red-700 border-red-200' },
  { label: 'P:A (Half Day AM)', s1: 'P', s2: 'A', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'A:P (Half Day PM)', s1: 'A', s2: 'P', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'L (Leave)', s1: 'L', s2: 'L', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'LOP', s1: 'LOP', s2: 'LOP', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'OD (On Duty)', s1: 'OD', s2: 'OD', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'COF (Comp Off)', s1: 'COF', s2: 'COF', color: 'bg-teal-50 text-teal-700 border-teal-200' },
];

// ── Summary column config ──
const SUMMARY_COLS = [
  { key: 'P',   label: 'P',   bg: 'bg-emerald-50', text: 'text-emerald-700', title: 'Present' },
  { key: 'A',   label: 'A',   bg: 'bg-red-50',     text: 'text-red-700',     title: 'Absent' },
  { key: 'HD',  label: 'HD',  bg: 'bg-amber-50',   text: 'text-amber-700',   title: 'Half Day' },
  { key: 'L',   label: 'L',   bg: 'bg-purple-50',  text: 'text-purple-700',  title: 'Leave' },
  { key: 'LOP', label: 'LOP', bg: 'bg-rose-50',    text: 'text-rose-700',    title: 'Loss of Pay' },
  { key: 'OD',  label: 'OD',  bg: 'bg-blue-50',    text: 'text-blue-700',    title: 'On Duty' },
  { key: 'H',   label: 'H',   bg: 'bg-orange-50',  text: 'text-orange-700',  title: 'Holiday' },
  { key: 'OFF', label: 'OFF', bg: 'bg-slate-50',   text: 'text-slate-600',   title: 'Week Off' },
];

export default function AttendanceMuster() {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [searchName, setSearchName] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editCell, setEditCell] = useState(null);
  const [editForm, setEditForm] = useState({ session1: 'P', session2: 'P', remark: '' });
  const [exportingYear, setExportingYear] = useState(false);
  const { execute: execUpdate, loading: updating, error: updateErr, success: updateSuccess, clearMessages } = useApi();
  const tableRef = useRef(null);

  // Month navigation
  const changeMonth = (delta) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Fetch muster data
  useEffect(() => {
    const fetchMuster = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ month });
        if (department) params.set('department', department);
        if (location) params.set('location', location);
        const res = await api.get(`/muster?${params}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load attendance muster');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMuster();
  }, [month, department, location]);

  // Open edit popup
  const openEdit = (emp, dateStr) => {
    const dayData = emp.days[dateStr];
    if (!dayData) return;
    if (dayData.color === 'off' || dayData.color === 'holiday' || dayData.color === 'future') return;

    clearMessages();
    setEditCell({
      userId: emp.userId,
      date: dateStr,
      name: emp.name,
      employeeId: emp.employeeId,
      current: dayData,
      shift: emp.shift,
    });
    setEditForm({
      session1: dayData.session1 || (dayData.color === 'present' ? 'P' : dayData.color === 'absent' ? 'A' : dayData.color === 'leave' ? 'L' : 'A'),
      session2: dayData.session2 || (dayData.color === 'present' ? 'P' : dayData.color === 'absent' ? 'A' : dayData.color === 'leave' ? 'L' : 'A'),
      remark: dayData.adminRemark || '',
    });
  };

  // Save edit
  const handleSave = async () => {
    if (!editForm.remark.trim()) return;
    try {
      await execUpdate(
        () => api.put(`/muster/${editCell.userId}/${editCell.date}`, {
          session1: editForm.session1,
          session2: editForm.session2,
          remark: editForm.remark,
        }),
        'Attendance updated!'
      );
      const params = new URLSearchParams({ month });
      if (department) params.set('department', department);
      if (location) params.set('location', location);
      const res = await api.get(`/muster?${params}`);
      setData(res.data);
      setEditCell(null);
    } catch {
      // Error displayed by useApi
    }
  };

  const applyPreset = (preset) => {
    setEditForm(f => ({ ...f, session1: preset.s1, session2: preset.s2 }));
  };

  // Filter employees (search is client-side)
  const filtered = data?.employees?.filter(emp => {
    if (searchName && !emp.name.toLowerCase().includes(searchName.toLowerCase()) && !emp.employeeId?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  }) || [];

  // Display text for session combo
  const getSessionDisplay = (s1, s2) => {
    if (s1 === s2) {
      const opt = SESSION_OPTIONS.find(o => o.value === s1);
      return opt ? `${s1} (${opt.label})` : s1;
    }
    return `${s1}:${s2}`;
  };

  // Export to CSV
  const exportCSV = () => {
    if (!data) return;
    const headers = ['Employee', 'ID', 'Department', 'Location'];
    for (const di of data.dayInfo) headers.push(`${di.day} ${di.dayName}`);
    SUMMARY_COLS.forEach(c => headers.push(c.key));

    const rows = filtered.map(emp => {
      const row = [emp.name, emp.employeeId, emp.department || '', emp.location || ''];
      for (const di of data.dayInfo) {
        row.push(emp.days[di.date]?.display || '-');
      }
      SUMMARY_COLS.forEach(c => row.push(emp.summary[c.key] || 0));
      return row;
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-muster-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export full financial year CSV (Apr-Mar)
  const exportYearlyCSV = async (fyStart) => {
    setExportingYear(true);
    try {
      const params = new URLSearchParams({ year: fyStart });
      if (department) params.set('department', department);
      if (location) params.set('location', location);
      const res = await api.get(`/muster/yearly?${params}`);
      const { months: allMonths, financialYear } = res.data;

      // Build one row per employee with all 12 months' daily statuses + per-month summary
      // First collect all employee IDs across all months
      const empMap = {};
      for (const mData of allMonths) {
        for (const emp of mData.employees) {
          if (!empMap[emp.userId]) {
            empMap[emp.userId] = { name: emp.name, employeeId: emp.employeeId, department: emp.department || '', location: emp.location || '', months: {} };
          }
          empMap[emp.userId].months[mData.month] = emp;
        }
      }

      const monthNames = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

      // Headers: Employee, ID, Dept, Location, then for each month: P, A, HD, L, LOP, OD, H, OFF
      const headers = ['Employee', 'ID', 'Department', 'Location'];
      monthNames.forEach(mn => {
        SUMMARY_COLS.forEach(c => headers.push(`${mn}-${c.key}`));
      });
      // Yearly totals
      SUMMARY_COLS.forEach(c => headers.push(`Total ${c.key}`));

      const rows = Object.values(empMap).map(emp => {
        const row = [emp.name, emp.employeeId, emp.department, emp.location];
        const yearTotals = {};
        SUMMARY_COLS.forEach(c => { yearTotals[c.key] = 0; });

        allMonths.forEach(mData => {
          const mEmp = emp.months[mData.month];
          SUMMARY_COLS.forEach(c => {
            const val = mEmp?.summary?.[c.key] || 0;
            row.push(val);
            yearTotals[c.key] += val;
          });
        });

        SUMMARY_COLS.forEach(c => row.push(yearTotals[c.key]));
        return row;
      });

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-muster-FY-${financialYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to export yearly data');
    } finally {
      setExportingYear(false);
    }
  };

  // Financial year options (last 5 years)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const currentFY = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyOptions = [];
  for (let y = currentFY; y >= currentFY - 4; y--) {
    fyOptions.push({ value: y, label: `FY ${y}-${String(y + 1).slice(2)} (Apr ${y} - Mar ${y + 1})` });
  }

  const monthLabel = month ? new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';

  // Build cell tooltip
  const cellTooltip = (emp, dayData, dateStr) => {
    const parts = [`${emp.name} · ${dateStr}`];
    if (dayData.isLate) parts.push(`Late: ${dayData.lateMinutes} min`);
    if (dayData.isRegularized) parts.push('Regularized');
    if (dayData.regPending) parts.push('Regularization Pending');
    if (dayData.adminRemark) parts.push(`Remark: ${dayData.adminRemark}`);
    if (dayData.checkIn) parts.push(`In: ${new Date(dayData.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    if (dayData.checkOut) parts.push(`Out: ${new Date(dayData.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    if (dayData.workHours) parts.push(`Hours: ${dayData.workHours.toFixed(1)}h`);
    return parts.join('\n');
  };

  // Cell border/indicator classes for special states
  const getCellIndicators = (dayData) => {
    const classes = [];
    if (dayData.adminOverride) classes.push('ring-1 ring-inset ring-blue-400');
    if (dayData.isRegularized) classes.push('border-l-[3px] border-l-green-500');
    if (dayData.regPending) classes.push('border-l-[3px] border-l-amber-400');
    if (dayData.isLate && !dayData.isRegularized) classes.push('border-b-2 border-b-red-400');
    return classes.join(' ');
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Attendance Muster
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Monthly attendance grid — click any cell to override status</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Monthly export */}
          <button
            onClick={exportCSV}
            disabled={!data}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Month CSV
          </button>
          {/* Yearly export dropdown */}
          <div className="relative group">
            <button
              disabled={exportingYear}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exportingYear ? 'Exporting...' : 'Year Export'}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-64 hidden group-hover:block z-30">
              {fyOptions.map(fy => (
                <button
                  key={fy.value}
                  onClick={() => exportYearlyCSV(fy.value)}
                  disabled={exportingYear}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  {fy.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 mb-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Month nav */}
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Month</label>
            <div className="flex items-center gap-1">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Previous month">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="Next month">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Financial Year filter */}
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Financial Year</label>
            <select
              value={(() => {
                const [y, m] = month.split('-').map(Number);
                return m >= 4 ? y : y - 1;
              })()}
              onChange={e => {
                const fy = parseInt(e.target.value);
                // Jump to April of selected FY
                setMonth(`${fy}-04`);
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[160px]"
            >
              {fyOptions.map(fy => (
                <option key={fy.value} value={fy.value}>FY {fy.value}-{String(fy.value + 1).slice(2)}</option>
              ))}
            </select>
          </div>

          {/* Department filter */}
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Department</label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[130px]"
            >
              <option value="">All Departments</option>
              {(data?.allDepartments || []).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Location filter */}
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Location</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[130px]"
            >
              <option value="">All Locations</option>
              {(data?.allLocations || []).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide block mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Name or ID..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="pl-9 pr-8 py-1.5 border border-slate-200 rounded-lg text-sm bg-white w-52 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {searchName && (
                <button onClick={() => setSearchName('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="ml-auto text-sm text-slate-500 pb-0.5 flex items-center gap-2">
            <span className="font-semibold text-slate-700">{filtered.length}</span> employees · {monthLabel}
          </div>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}
      {updateSuccess && <AlertMessage type="success" message={updateSuccess} />}

      {loading ? (
        <LoadingSpinner />
      ) : data && (
        <>
          {/* Muster Grid */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto" ref={tableRef}>
              <table className="text-xs border-collapse w-max min-w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 min-w-[200px]">
                      Employee
                    </th>
                    {data.dayInfo.map(di => {
                      const isWeekend = di.dow === 0 || di.dow === 6;
                      const isHoliday = !!data.holidays[di.date];
                      return (
                        <th
                          key={di.date}
                          className={`border-r border-b border-slate-200 px-0.5 py-1 text-center font-bold min-w-[38px] ${
                            isWeekend ? 'bg-slate-200/70 text-red-500' : isHoliday ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-700'
                          }`}
                          title={data.holidays[di.date] || di.dayName}
                        >
                          <div className="leading-tight">
                            <span className="block text-[10px]">{di.day}</span>
                            <span className={`block text-[9px] font-medium ${DAY_HEADER_COLORS[di.dow] || 'text-slate-400'}`}>
                              {di.dayName}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                    {/* Summary columns */}
                    {SUMMARY_COLS.map(col => (
                      <th key={col.key} className={`border-r border-b border-slate-200 px-1.5 py-1 text-center font-bold ${col.bg} ${col.text} min-w-[34px]`} title={col.title}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={data.dayInfo.length + SUMMARY_COLS.length + 1} className="text-center py-12 text-slate-400">
                        No employees found
                      </td>
                    </tr>
                  ) : filtered.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-blue-50/20 border-b border-slate-100">
                      {/* Employee name — sticky */}
                      <td className="sticky left-0 z-10 bg-white border-r border-slate-200 px-3 py-1.5">
                        <div className="max-w-[200px]">
                          <p className="font-semibold text-slate-800 truncate leading-tight text-[11px]">{emp.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">
                            {emp.employeeId}{emp.department ? ` · ${emp.department}` : ''}{emp.location ? ` · ${emp.location}` : ''}
                          </p>
                        </div>
                      </td>
                      {/* Day cells */}
                      {data.dayInfo.map(di => {
                        const dayData = emp.days[di.date];
                        if (!dayData) return <td key={di.date} className="border-r border-slate-100 px-0.5 py-1 text-center">-</td>;

                        // Admin override → pink background to clearly distinguish forced entries
                        const cellColor = dayData.adminOverride
                          ? 'bg-pink-100 text-pink-800'
                          : (CELL_COLORS[dayData.color] || CELL_COLORS.other);
                        const isEditable = dayData.color !== 'off' && dayData.color !== 'holiday' && dayData.color !== 'future';
                        const indicators = getCellIndicators(dayData);

                        return (
                          <td
                            key={di.date}
                            onClick={() => isEditable && openEdit(emp, di.date)}
                            className={`border-r border-slate-100 px-0 py-0.5 text-center font-bold select-none transition-all ${cellColor} ${
                              isEditable ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-blue-400' : ''
                            } ${indicators}`}
                            title={cellTooltip(emp, dayData, di.date)}
                          >
                            <div className="relative">
                              <span className="text-[10px] leading-tight block">{dayData.display}</span>
                              {/* Late dot indicator */}
                              {dayData.isLate && !dayData.isRegularized && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                              )}
                              {/* Regularized check */}
                              {dayData.isRegularized && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                      {/* Summary cells */}
                      {SUMMARY_COLS.map(col => (
                        <td key={col.key} className={`border-r border-slate-100 px-1 py-1 text-center font-bold ${col.text} ${col.bg}/50 text-[10px]`}>
                          {emp.summary[col.key] || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Status Legend</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <LegendChip color="bg-sky-100 text-sky-800" label="P — Present" />
              <LegendChip color="bg-red-100 text-red-700" label="A — Absent" />
              <LegendChip color="bg-amber-100 text-amber-800" label="HD — Half Day" />
              <LegendChip color="bg-purple-100 text-purple-700" label="L — Leave" />
              <LegendChip color="bg-rose-100 text-rose-700" label="LOP — Loss of Pay" />
              <LegendChip color="bg-blue-100 text-blue-700" label="OD — On Duty" />
              <LegendChip color="bg-teal-100 text-teal-700" label="COF — Comp Off" />
              <LegendChip color="bg-orange-100 text-orange-700" label="H — Holiday" />
              <LegendChip color="bg-slate-100 text-slate-400" label="OFF — Week Off" />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-slate-100 text-[10px]">
              <LegendChip color="bg-pink-100 text-pink-800" label="Admin Override (forced)" />
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-4 h-1 bg-green-500 rounded-sm" />
                Regularized
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-4 h-1 bg-amber-400 rounded-sm" />
                Regularization Pending
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Late (beyond 15 min grace)
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-4 h-1 bg-red-400 rounded-sm" />
                Deduction Alert (3 late = 0.5 day)
              </span>
            </div>
          </div>

          {/* Policy Note */}
          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-700">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Attendance Policy:</strong> 9-hour working day with 15-min grace period per shift.
              3 late marks in a month = 0.5 day (half day) salary deduction.
              Admin can override any cell — remark is required for all overrides.
            </div>
          </div>
        </>
      )}

      {/* ── Edit Cell Modal ── */}
      {editCell && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
              <div>
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Override Attendance
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{editCell.name} ({editCell.employeeId})</p>
              </div>
              <button onClick={() => setEditCell(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Date & current info */}
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(editCell.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {editCell.shift && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shift:</span>
                    <span className="font-medium text-slate-700">{editCell.shift.name} ({editCell.shift.startTime} - {editCell.shift.endTime})</span>
                  </div>
                )}
                {editCell.current?.checkIn && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual In:</span>
                    <span className="font-mono font-medium text-slate-700">{new Date(editCell.current.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {editCell.current?.checkOut && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual Out:</span>
                    <span className="font-mono font-medium text-slate-700">{new Date(editCell.current.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {editCell.current?.workHours != null && editCell.current.workHours > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Work Hours:</span>
                    <span className={`font-semibold ${editCell.current.workHours < 9 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {editCell.current.workHours.toFixed(1)}h
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-slate-800">{editCell.current?.display || '-'}</span>
                </div>
                {editCell.current?.isLate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Late By:</span>
                    <span className="font-semibold text-red-600">{editCell.current.lateMinutes} minutes</span>
                  </div>
                )}
                {editCell.current?.isRegularized && (
                  <div className="flex items-center gap-1.5 mt-1 text-green-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-medium">Regularized</span>
                  </div>
                )}
                {editCell.current?.regPending && (
                  <div className="flex items-center gap-1.5 mt-1 text-amber-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">Regularization Pending</span>
                  </div>
                )}
              </div>

              {/* Quick presets */}
              <div>
                <p className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Quick Set</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyPreset(preset)}
                      className={`px-1.5 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${preset.color} ${
                        editForm.session1 === preset.s1 && editForm.session2 === preset.s2
                          ? 'ring-2 ring-blue-400 shadow-sm'
                          : 'hover:opacity-80'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Session 1 (AM)</label>
                  <select
                    value={editForm.session1}
                    onChange={e => setEditForm(f => ({ ...f, session1: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SESSION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.value} — {o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Session 2 (PM)</label>
                  <select
                    value={editForm.session2}
                    onChange={e => setEditForm(f => ({ ...f, session2: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SESSION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.value} — {o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Will display as:</span>
                <span className="font-bold text-slate-800 px-2 py-0.5 bg-white rounded border border-slate-200">
                  {getSessionDisplay(editForm.session1, editForm.session2)}
                </span>
              </div>

              {/* Remark */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Admin Remark <span className="text-red-400 normal-case">*required</span>
                </label>
                <textarea
                  value={editForm.remark}
                  onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  rows={2}
                  placeholder="Reason for this override..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {!editForm.remark.trim() && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Remark is required for all overrides
                  </p>
                )}
              </div>

              {updateErr && <AlertMessage type="error" message={updateErr} />}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditCell(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updating || !editForm.remark.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Save Override
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendChip({ color, label }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${color}`}>
      {label}
    </span>
  );
}
