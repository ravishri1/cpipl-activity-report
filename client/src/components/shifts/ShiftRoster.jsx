import { useState, useMemo, useCallback } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { ChevronLeft, ChevronRight, Search, X, Calendar, Download, Users } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Generate a short code from shift name (e.g., "General Shift" -> "GS", "Night" -> "N")
function shiftCode(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
}

// Shift color palette (index-based)
const SHIFT_COLORS = [
  { bg: '#dbeafe', text: '#1d4ed8' },   // blue
  { bg: '#d1fae5', text: '#047857' },   // emerald
  { bg: '#ede9fe', text: '#6d28d9' },   // purple
  { bg: '#fef3c7', text: '#b45309' },   // amber
  { bg: '#fce7f3', text: '#be185d' },   // pink
  { bg: '#cffafe', text: '#0e7490' },   // cyan
  { bg: '#ffedd5', text: '#c2410c' },   // orange
  { bg: '#e0e7ff', text: '#4338ca' },   // indigo
];

export default function ShiftRoster() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [assignModal, setAssignModal] = useState(null);
  const [assignForm, setAssignForm] = useState({ shiftId: '', effectiveTo: '', reason: 'Roster Assignment' });

  const { data, loading, error, refetch } = useFetch(
    `/shifts/roster?month=${month}`, null
  );
  const { execute, loading: saving, error: saveErr, success } = useApi();

  const [yearNum, monNum] = month.split('-').map(Number);

  const changeMonth = (delta) => {
    const d = new Date(yearNum, monNum - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Build shift color map by name
  const shiftColorMap = useMemo(() => {
    if (!data?.shifts) return {};
    const map = {};
    data.shifts.forEach((s, i) => {
      map[s.name] = SHIFT_COLORS[i % SHIFT_COLORS.length];
    });
    return map;
  }, [data?.shifts]);

  // Build shift code map
  const shiftCodeMap = useMemo(() => {
    if (!data?.shifts) return {};
    const map = {};
    data.shifts.forEach((s, i) => {
      map[s.name] = { code: shiftCode(s.name), index: i };
    });
    return map;
  }, [data?.shifts]);

  // Unique departments and branches
  const { departments, branches } = useMemo(() => {
    if (!data?.roster) return { departments: [], branches: [] };
    const depts = new Set();
    const brs = new Set();
    data.roster.forEach(emp => {
      if (emp.department) depts.add(emp.department);
      if (emp.branch) brs.add(emp.branch);
    });
    return { departments: [...depts].sort(), branches: [...brs].sort() };
  }, [data?.roster]);

  // Filter employees
  const filteredRoster = useMemo(() => {
    if (!data?.roster) return [];
    return data.roster.filter(emp => {
      if (search && !emp.name.toLowerCase().includes(search.toLowerCase()) &&
          !emp.employeeId?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDept && emp.department !== filterDept) return false;
      if (filterBranch && emp.branch !== filterBranch) return false;
      return true;
    });
  }, [data?.roster, search, filterDept, filterBranch]);

  // Days array for header
  const daysArray = useMemo(() => {
    if (!data) return [];
    const arr = [];
    for (let d = 1; d <= data.lastDay; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(yearNum, monNum - 1, d);
      arr.push({
        day: d,
        date: dateStr,
        dayOfWeek: dateObj.getDay(),
        isToday: dateStr === todayStr,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }
    return arr;
  }, [data, month, yearNum, monNum, todayStr]);

  const handleCellClick = useCallback((userId, userName, date) => {
    setAssignModal({ userId, userName, date });
    setAssignForm({ shiftId: '', effectiveTo: '', reason: 'Roster Assignment' });
  }, []);

  const handleAssign = async () => {
    if (!assignForm.shiftId) {
      alert('Please select a shift');
      return;
    }
    try {
      await execute(
        () => api.post('/shifts/roster/assign', {
          userId: assignModal.userId,
          shiftId: parseInt(assignForm.shiftId),
          effectiveFrom: assignModal.date,
          effectiveTo: assignForm.effectiveTo || undefined,
          reason: assignForm.reason,
        }),
        'Shift assigned successfully'
      );
      setAssignModal(null);
      refetch();
    } catch {
      // Error displayed by useApi
    }
  };

  // Render cell content based on day data
  const renderCell = (dayData) => {
    if (!dayData) return <span className="text-gray-300">-</span>;

    const { status, shiftName, leaveCode } = dayData;

    // Weekend or Holiday → show "OFF" in red
    if (status === 'OFF') {
      return (
        <span className="text-red-500 font-bold text-[10px]">OFF</span>
      );
    }

    // Leave day → show "GS:LOP", "GS:PL", "COF" etc.
    if (leaveCode) {
      const sc = shiftName ? shiftCodeMap[shiftName]?.code : null;
      const label = sc ? `${sc}:${leaveCode}` : leaveCode;
      return (
        <span className="text-orange-600 font-bold text-[10px]">{label}</span>
      );
    }

    // Normal working day → show shift code with color
    if (shiftName) {
      const colors = shiftColorMap[shiftName];
      const code = shiftCodeMap[shiftName]?.code || shiftCode(shiftName);
      if (colors) {
        return (
          <span
            className="font-bold text-[10px] inline-block px-1 py-0.5 rounded"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {code}
          </span>
        );
      }
      return <span className="text-gray-600 font-bold text-[10px]">{code}</span>;
    }

    return <span className="text-gray-300 text-[10px]">-</span>;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (!data) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Shift Roster
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Click on any cell to assign or change shift. OFF = Weekend/Holiday.
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded border border-gray-200 transition">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-semibold text-gray-900 min-w-[160px] text-center bg-white border border-gray-200 rounded px-3 py-1.5">
            {MONTH_NAMES[monNum - 1]} {yearNum}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-100 rounded border border-gray-200 transition">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Type employee name or number"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {departments.length > 0 && (
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {branches.length > 0 && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Locations</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
          <Users size={14} />
          <span>Total: {filteredRoster.length}</span>
        </div>
      </div>

      {/* Roster Grid */}
      {filteredRoster.length === 0 ? (
        <EmptyState icon="📅" title="No employees found" subtitle="Try adjusting your filters" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  {/* Employee No */}
                  <th className="sticky left-0 z-20 bg-gray-100 px-2 py-2 text-left font-semibold text-gray-700 min-w-[90px] border-r border-gray-300 text-[11px]">
                    Employee No
                  </th>
                  {/* Employee Name */}
                  <th className="sticky left-[90px] z-20 bg-gray-100 px-2 py-2 text-left font-semibold text-gray-700 min-w-[180px] border-r border-gray-300 text-[11px]">
                    Employee Name
                  </th>
                  {/* OFF Count */}
                  <th className="px-1 py-2 text-center font-semibold text-gray-700 min-w-[36px] border-r border-gray-200 text-[11px] bg-gray-100">
                    OFF
                  </th>
                  {/* Day columns */}
                  {daysArray.map(d => (
                    <th
                      key={d.day}
                      className={`px-0 py-1.5 text-center font-medium min-w-[36px] border-r border-gray-200 ${
                        d.isToday ? 'bg-blue-100 text-blue-800' :
                        d.isWeekend ? 'bg-red-50 text-red-600' :
                        'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="text-[9px] leading-tight font-normal">{DAY_NAMES[d.dayOfWeek]}</div>
                      <div className="text-[11px] font-bold leading-tight">{d.day}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((emp, idx) => (
                  <tr
                    key={emp.userId}
                    className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-blue-50/40`}
                  >
                    {/* Employee No */}
                    <td className="sticky left-0 z-10 px-2 py-1.5 border-r border-gray-200 bg-inherit text-[11px] font-medium text-gray-700">
                      {emp.employeeId || '-'}
                    </td>
                    {/* Employee Name + designation + location */}
                    <td className="sticky left-[90px] z-10 px-2 py-1.5 border-r border-gray-200 bg-inherit">
                      <div className="font-semibold text-gray-900 text-[11px] truncate max-w-[170px]" title={emp.name}>
                        {emp.name}
                      </div>
                      <div className="text-gray-500 text-[9px] truncate max-w-[170px]">
                        {emp.designation || ''}{emp.branch ? `, ${emp.branch}` : ''}
                      </div>
                    </td>
                    {/* OFF count */}
                    <td className="px-1 py-1.5 text-center border-r border-gray-200 text-[11px] font-bold text-gray-700">
                      {emp.offCount || 0}
                    </td>
                    {/* Day cells */}
                    {daysArray.map(d => {
                      const dayData = emp.days[d.date];

                      return (
                        <td
                          key={d.date}
                          onClick={() => handleCellClick(emp.userId, emp.name, d.date)}
                          className={`px-0 py-1 text-center cursor-pointer transition-colors border-r border-gray-100 hover:bg-blue-100 ${
                            d.isToday ? 'bg-blue-50/60' :
                            d.isWeekend ? 'bg-red-50/40' : ''
                          }`}
                          title={`${emp.name} — ${d.date}${dayData?.holidayName ? `\nHoliday: ${dayData.holidayName}` : ''}${dayData?.leaveCode ? `\nLeave: ${dayData.leaveCode}` : ''}${dayData?.shiftName ? `\nShift: ${dayData.shiftName}` : ''}`}
                        >
                          {renderCell(dayData, d)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: item count + shift legend (like greytHR) */}
          <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs text-gray-600">
              Total Items: {filteredRoster.length}
            </span>
            <span className="text-xs text-gray-400">|</span>
            {/* Shift legend: OFF : 0, GS : 1, etc. */}
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
              OFF : 0
            </span>
            {data.shifts.map((s, i) => {
              const colors = SHIFT_COLORS[i % SHIFT_COLORS.length];
              return (
                <span
                  key={s.id}
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                  {shiftCode(s.name)} : {i + 1}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Assign Shift</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {assignModal.userName} — {new Date(assignModal.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {saveErr && <AlertMessage type="error" message={saveErr} />}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Shift *</label>
              <select
                value={assignForm.shiftId}
                onChange={e => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a shift...</option>
                {data.shifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Until (optional)</label>
              <input
                type="date"
                value={assignForm.effectiveTo}
                onChange={e => setAssignForm({ ...assignForm, effectiveTo: e.target.value })}
                min={assignModal.date}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite assignment</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                value={assignForm.reason}
                onChange={e => setAssignForm({ ...assignForm, reason: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option>Roster Assignment</option>
                <option>Manager Decision</option>
                <option>Employee Request</option>
                <option>Rotation</option>
                <option>Promotion</option>
                <option>Other</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setAssignModal(null)}
                className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={saving || !assignForm.shiftId}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition"
              >
                {saving ? 'Assigning...' : 'Assign Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
