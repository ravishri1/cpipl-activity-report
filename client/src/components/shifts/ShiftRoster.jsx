import { useState, useMemo, useCallback } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { ChevronLeft, ChevronRight, Search, X, Calendar, Filter, Users } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Generate a short code from shift name (e.g., "General Shift" -> "GS", "Night" -> "N")
function shiftCode(name) {
  if (!name) return '-';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().substring(0, 3);
}

// Shift color palette
const SHIFT_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
];

export default function ShiftRoster() {
  const today = new Date();
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [assignModal, setAssignModal] = useState(null); // { userId, userName, date }
  const [assignForm, setAssignForm] = useState({ shiftId: '', effectiveTo: '', reason: 'Roster Assignment' });

  const { data, loading, error, refetch } = useFetch(
    `/shifts/roster?month=${month}`, null
  );
  const { execute, loading: saving, error: saveErr, success } = useApi();

  // Parse month for navigation
  const [yearNum, monNum] = month.split('-').map(Number);

  const changeMonth = (delta) => {
    const d = new Date(yearNum, monNum - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Build shift color map
  const shiftColorMap = useMemo(() => {
    if (!data?.shifts) return {};
    const map = {};
    data.shifts.forEach((s, i) => {
      map[s.name] = SHIFT_COLORS[i % SHIFT_COLORS.length];
    });
    return map;
  }, [data?.shifts]);

  // Get unique departments and branches for filters
  const { departments, branches } = useMemo(() => {
    if (!data?.roster) return { departments: [], branches: [] };
    const depts = new Set();
    const brs = new Set();
    data.roster.forEach(emp => {
      if (emp.department) depts.add(emp.department);
      if (emp.branch) brs.add(emp.branch);
    });
    return {
      departments: [...depts].sort(),
      branches: [...brs].sort(),
    };
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

  // Build days array for the month header
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
        isToday: dateStr === today.toISOString().split('T')[0],
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }
    return arr;
  }, [data, month, yearNum, monNum]);

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

  if (loading) return <LoadingSpinner />;
  if (error) return <AlertMessage type="error" message={error} />;
  if (!data) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-7 h-7 text-blue-600" />
            Shift Roster
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Click on any cell to assign or change shifts
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded transition">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center">
            {MONTH_NAMES[monNum - 1]} {yearNum}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded transition">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {success && <AlertMessage type="success" message={success} />}
      {saveErr && <AlertMessage type="error" message={saveErr} />}

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {departments.length > 0 && (
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {branches.length > 0 && (
          <select
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Users size={16} />
          <span>{filteredRoster.length} employees</span>
        </div>
      </div>

      {/* Shift Legend */}
      <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-lg p-3">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
          <Filter size={14} /> Shifts:
        </span>
        {data.shifts.map(s => {
          const colors = shiftColorMap[s.name] || SHIFT_COLORS[0];
          return (
            <span key={s.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}>
              <span className="font-bold">{shiftCode(s.name)}</span>
              <span className="font-normal">{s.name} ({s.startTime}-{s.endTime})</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500">
          <span className="font-bold">-</span>
          <span className="font-normal">No assignment</span>
        </span>
      </div>

      {/* Roster Grid */}
      {filteredRoster.length === 0 ? (
        <EmptyState icon="📅" title="No employees found" subtitle="Try adjusting your filters" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-700 min-w-[200px] border-r border-gray-200">
                    Employee
                  </th>
                  {daysArray.map(d => (
                    <th
                      key={d.day}
                      className={`px-1 py-2.5 text-center font-medium min-w-[40px] ${
                        d.isToday ? 'bg-blue-50 text-blue-700' :
                        d.isWeekend ? 'bg-red-50 text-red-600' :
                        'text-gray-700'
                      }`}
                    >
                      <div className="text-[10px] leading-tight">{DAY_NAMES[d.dayOfWeek]}</div>
                      <div className="text-sm font-bold leading-tight">{d.day}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((emp, idx) => (
                  <tr
                    key={emp.userId}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}
                  >
                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-gray-200 bg-inherit">
                      <div className="font-semibold text-gray-900 text-sm truncate max-w-[180px]" title={emp.name}>
                        {emp.name}
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        {emp.employeeId || '-'} {emp.department ? `| ${emp.department}` : ''}
                      </div>
                    </td>
                    {daysArray.map(d => {
                      const dayData = emp.days[d.date];
                      const sName = dayData?.shiftName;
                      const code = shiftCode(sName);
                      const colors = sName ? (shiftColorMap[sName] || { bg: 'bg-gray-100', text: 'text-gray-600' }) : null;
                      const isAssigned = dayData?.assignmentId != null;

                      return (
                        <td
                          key={d.date}
                          onClick={() => handleCellClick(emp.userId, emp.name, d.date)}
                          className={`px-0.5 py-1.5 text-center cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 hover:ring-inset ${
                            d.isToday ? 'bg-blue-50/50' : d.isWeekend ? 'bg-red-50/30' : ''
                          }`}
                          title={`${emp.name} - ${d.date}\n${sName || 'No shift assigned'}${isAssigned ? ' (assigned)' : ' (default)'}`}
                        >
                          {sName ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight ${colors.bg} ${colors.text} ${
                              isAssigned ? 'ring-1 ring-inset ' + (colors.border || '') : 'opacity-60'
                            }`}>
                              {code}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-[10px]">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
