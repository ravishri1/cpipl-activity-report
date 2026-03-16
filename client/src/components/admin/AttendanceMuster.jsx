import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import {
  Calendar, Search, X, ChevronDown, Download,
  CheckCircle, XCircle, Clock, Shield,
} from 'lucide-react';

// Color map for cell backgrounds (matching greytHR)
const CELL_COLORS = {
  present:  'bg-sky-100 text-sky-800',
  absent:   'bg-red-50 text-red-600',
  halfday:  'bg-amber-100 text-amber-800',
  leave:    'bg-purple-100 text-purple-700',
  holiday:  'bg-orange-100 text-orange-700',
  off:      'bg-slate-100 text-slate-400',
  future:   'bg-white text-slate-300',
  other:    'bg-slate-100 text-slate-500',
};

// Day header colors
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
  { label: 'LOP (Loss of Pay)', s1: 'LOP', s2: 'LOP', color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

export default function AttendanceMuster() {
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [department, setDepartment] = useState('');
  const [searchName, setSearchName] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editCell, setEditCell] = useState(null); // { userId, date, name, current }
  const [editForm, setEditForm] = useState({ session1: 'P', session2: 'P', remark: '' });
  const { execute: execUpdate, loading: updating, error: updateErr, success: updateSuccess, clearMessages } = useApi();
  const tableRef = useRef(null);

  // Fetch muster data
  useEffect(() => {
    const fetchMuster = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ month });
        if (department) params.set('department', department);
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
  }, [month, department]);

  // Open edit popup
  const openEdit = (emp, dateStr) => {
    const dayData = emp.days[dateStr];
    if (!dayData) return;
    // Don't allow editing weekends/holidays/future
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
    if (!editForm.remark.trim()) {
      return; // Remark is optional but encouraged
    }
    try {
      await execUpdate(
        () => api.put(`/muster/${editCell.userId}/${editCell.date}`, {
          session1: editForm.session1,
          session2: editForm.session2,
          remark: editForm.remark,
        }),
        'Attendance updated!'
      );
      // Refresh data
      const params = new URLSearchParams({ month });
      if (department) params.set('department', department);
      const res = await api.get(`/muster?${params}`);
      setData(res.data);
      setEditCell(null);
    } catch {
      // Error displayed by useApi
    }
  };

  // Quick preset apply
  const applyPreset = (preset) => {
    setEditForm(f => ({ ...f, session1: preset.s1, session2: preset.s2 }));
  };

  // Get unique departments
  const departments = data ? [...new Set(data.employees.map(e => e.department).filter(Boolean))].sort() : [];

  // Filter employees
  const filtered = data?.employees?.filter(emp => {
    if (searchName && !emp.name.toLowerCase().includes(searchName.toLowerCase()) && !emp.employeeId?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  }) || [];

  // Display text for session combo in the edit popup
  const getSessionDisplay = (s1, s2) => {
    if (s1 === 'P' && s2 === 'P') return 'P (Full Present)';
    if (s1 === 'A' && s2 === 'A') return 'A (Full Absent)';
    if (s1 === 'P' && s2 === 'A') return 'P:A (Half Day AM)';
    if (s1 === 'A' && s2 === 'P') return 'A:P (Half Day PM)';
    return `${s1}:${s2}`;
  };

  // Export to CSV
  const exportCSV = () => {
    if (!data) return;
    const headers = ['Employee', 'ID', 'Department'];
    for (const di of data.dayInfo) headers.push(`${di.day} ${di.dayName}`);
    headers.push('P', 'L', 'H', 'A', 'OFF', 'HD');

    const rows = filtered.map(emp => {
      const row = [emp.name, emp.employeeId, emp.department || ''];
      for (const di of data.dayInfo) {
        row.push(emp.days[di.date]?.display || '-');
      }
      row.push(emp.summary.P, emp.summary.L, emp.summary.H, emp.summary.A, emp.summary.OFF, emp.summary.HD);
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

  const monthLabel = month ? new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Attendance Muster
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Monthly attendance grid — click any cell to edit</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!data}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Select Month</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Department</label>
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Employee name or ID..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-56 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
        <div className="ml-auto text-sm text-slate-500 self-end pb-2">
          {filtered.length} employees · {monthLabel}
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
                  {/* Date number row */}
                  <tr className="bg-slate-100">
                    <th className="sticky left-0 z-20 bg-slate-100 border-r border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 min-w-[200px]">
                      Employee
                    </th>
                    {data.dayInfo.map(di => (
                      <th
                        key={di.date}
                        className={`border-r border-b border-slate-200 px-1 py-1 text-center font-bold min-w-[36px] ${
                          di.dow === 0 || di.dow === 6 ? 'bg-slate-200 text-red-500' : data.holidays[di.date] ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-700'
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
                    ))}
                    {/* Summary columns */}
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-emerald-50 text-emerald-700 min-w-[32px]">P</th>
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-purple-50 text-purple-700 min-w-[32px]">L</th>
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-orange-50 text-orange-700 min-w-[32px]">H</th>
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-red-50 text-red-700 min-w-[32px]">A</th>
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-slate-100 text-slate-600 min-w-[36px]">OFF</th>
                    <th className="border-r border-b border-slate-200 px-2 py-1 text-center font-bold bg-amber-50 text-amber-700 min-w-[32px]">HD</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-blue-50/30 border-b border-slate-100">
                      {/* Employee name — sticky */}
                      <td className="sticky left-0 z-10 bg-white border-r border-slate-200 px-3 py-1.5 group-hover:bg-blue-50">
                        <div className="max-w-[200px]">
                          <p className="font-semibold text-slate-800 truncate leading-tight">{emp.name} [{emp.employeeId}]</p>
                          <p className="text-[10px] text-slate-400 truncate">{emp.department}{emp.location ? `, ${emp.location}` : ''}</p>
                        </div>
                      </td>
                      {/* Day cells */}
                      {data.dayInfo.map(di => {
                        const dayData = emp.days[di.date];
                        if (!dayData) return <td key={di.date} className="border-r border-slate-100 px-1 py-1 text-center">-</td>;

                        const cellColor = CELL_COLORS[dayData.color] || CELL_COLORS.other;
                        const isEditable = dayData.color !== 'off' && dayData.color !== 'holiday' && dayData.color !== 'future';
                        const isOverride = dayData.adminOverride;

                        return (
                          <td
                            key={di.date}
                            onClick={() => isEditable && openEdit(emp, di.date)}
                            className={`border-r border-slate-100 px-0.5 py-1 text-center font-bold select-none transition-colors ${cellColor} ${
                              isEditable ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-blue-400' : ''
                            } ${isOverride ? 'ring-1 ring-inset ring-blue-300' : ''}`}
                            title={`${emp.name} · ${di.date}${dayData.adminRemark ? `\nRemark: ${dayData.adminRemark}` : ''}${dayData.checkIn ? `\nIn: ${new Date(dayData.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}${dayData.checkOut ? `\nOut: ${new Date(dayData.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                          >
                            <span className="text-[11px]">{dayData.display}</span>
                          </td>
                        );
                      })}
                      {/* Summary cells */}
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-emerald-700 bg-emerald-50/50">{emp.summary.P}</td>
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-purple-700 bg-purple-50/50">{emp.summary.L}</td>
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-orange-700 bg-orange-50/50">{emp.summary.H}</td>
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-red-700 bg-red-50/50">{emp.summary.A}</td>
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-slate-600 bg-slate-50">{emp.summary.OFF}</td>
                      <td className="border-r border-slate-100 px-1 py-1 text-center font-bold text-amber-700 bg-amber-50/50">{emp.summary.HD}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Legend</p>
            <div className="flex flex-wrap gap-3 text-[11px]">
              <LegendChip color="bg-sky-100 text-sky-800" label="Present : P" />
              <LegendChip color="bg-red-50 text-red-600" label="Absent : A" />
              <LegendChip color="bg-slate-100 text-slate-400" label="Off Day : OFF" />
              <LegendChip color="bg-orange-100 text-orange-700" label="Holiday : H" />
              <LegendChip color="bg-purple-100 text-purple-700" label="Leave : L" />
              <LegendChip color="bg-amber-100 text-amber-800" label="Half Day : HD / P:A / A:P" />
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="w-4 h-4 rounded ring-1 ring-inset ring-blue-300 bg-white" /> Admin Override
              </span>
            </div>
          </div>
        </>
      )}

      {/* Edit Cell Modal */}
      {editCell && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Edit Attendance</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editCell.name} ({editCell.employeeId})</p>
              </div>
              <button onClick={() => setEditCell(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Date & current info */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold">{new Date(editCell.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                {editCell.shift && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shift:</span>
                    <span className="font-medium">{editCell.shift.name} ({editCell.shift.startTime} - {editCell.shift.endTime})</span>
                  </div>
                )}
                {editCell.current?.checkIn && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual In:</span>
                    <span className="font-mono font-medium">{new Date(editCell.current.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {editCell.current?.checkOut && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual Out:</span>
                    <span className="font-mono font-medium">{new Date(editCell.current.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {editCell.current?.workHours != null && editCell.current.workHours > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Work Hours:</span>
                    <span className={`font-semibold ${editCell.current.workHours < 9 ? 'text-rose-600' : 'text-emerald-600'}`}>{editCell.current.workHours.toFixed(1)}h</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold">{editCell.current?.display || '-'}</span>
                </div>
              </div>

              {/* Quick presets */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Quick Set</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyPreset(preset)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-colors ${preset.color} ${
                        editForm.session1 === preset.s1 && editForm.session2 === preset.s2
                          ? 'ring-2 ring-blue-400'
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Session 1 (AM)</label>
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Session 2 (PM)</label>
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
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Will display as:</span>
                <span className="font-bold text-slate-800 px-2 py-1 bg-slate-100 rounded">
                  {getSessionDisplay(editForm.session1, editForm.session2)}
                </span>
              </div>

              {/* Remark */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Admin Remark <span className="text-slate-400 font-normal">(required for override)</span>
                </label>
                <textarea
                  value={editForm.remark}
                  onChange={e => setEditForm(f => ({ ...f, remark: e.target.value }))}
                  rows={2}
                  placeholder="Reason for this override..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Override'}
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
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-medium ${color}`}>
      {label}
    </span>
  );
}
