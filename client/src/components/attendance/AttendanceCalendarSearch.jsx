import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import EmployeeCalendarView from './EmployeeCalendarView';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import { CheckSquare, Calendar, List, Search, X, User } from 'lucide-react';

export default function AttendanceCalendarSearch() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch all active employees
  const { data: employees, loading: empLoading, error: empErr } = useFetch('/users?active=true', []);

  // Filter employees by search
  const filtered = useMemo(() => {
    if (!employees?.length) return [];
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (emp) => {
    setSelectedUser(emp);
    setSearch('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSelectedUser(null);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-blue-600" />
          Team Attendance
        </h1>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => navigate('/admin/attendance')}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition text-gray-600 hover:text-gray-800"
          >
            <List size={14} className="inline mr-1.5 -mt-0.5" />
            List View
          </button>
          <button
            className="px-3 py-1.5 rounded-md text-sm font-medium transition bg-white text-blue-700 shadow-sm"
          >
            <Calendar size={14} className="inline mr-1.5 -mt-0.5" />
            Calendar View
          </button>
        </div>
      </div>

      {/* Employee search bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>

        {selectedUser ? (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{selectedUser.name}</p>
              <p className="text-xs text-gray-500">
                {selectedUser.employeeId ? `#${selectedUser.employeeId}` : ''}{selectedUser.department ? ` · ${selectedUser.department}` : ''}{selectedUser.designation ? ` · ${selectedUser.designation}` : ''}
              </p>
            </div>
            <button onClick={handleClear} className="p-1.5 hover:bg-blue-100 rounded-lg transition" title="Change employee">
              <X size={16} className="text-blue-500" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search employee by name, ID, or department..."
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Dropdown */}
            {showDropdown && (
              <div ref={dropdownRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-72 overflow-y-auto">
                {empLoading ? (
                  <div className="flex justify-center py-6"><LoadingSpinner /></div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No employees found</p>
                ) : (
                  filtered.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelect(emp)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {emp.name?.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {emp.employeeId || '-'}{emp.department ? ` · ${emp.department}` : ''}{emp.designation ? ` · ${emp.designation}` : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {empErr && <AlertMessage type="error" message={empErr} />}

      {/* Calendar View */}
      {selectedUser ? (
        <EmployeeCalendarView
          userId={selectedUser.id}
          employeeName={selectedUser.name}
          onBack={handleClear}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-lg font-medium text-gray-500">Select an Employee</p>
          <p className="text-sm text-gray-400 mt-1">Search and select an employee above to view their attendance calendar</p>
        </div>
      )}
    </div>
  );
}
