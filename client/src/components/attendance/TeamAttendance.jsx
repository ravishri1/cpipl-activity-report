import { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function TeamAttendance() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, onLeave: 0 });
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/team?date=${date}`);
        // Backend returns { employees: [...], summary: {...} }
        const result = res.data;
        setData(Array.isArray(result) ? result : (result.employees || []));
        if (result.summary) setSummary(result.summary);
      } catch (err) {
        console.error('Team attendance error:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, [date]);

  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const present = data.filter((d) => d.status === 'present' || d.status === 'half_day');
  const absent = data.filter((d) => d.status === 'absent');
  const onLeave = data.filter((d) => d.status === 'on_leave');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <CheckSquare className="w-6 h-6 text-blue-600" />
        Team Attendance
      </h1>

      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        />
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-slate-200 bg-white border border-slate-200">
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{data.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600">Present</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{present.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-600">Absent</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{absent.length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-blue-600">On Leave</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{onLeave.length}</p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length > 0 ? data.map((emp) => (
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
                      {emp.checkIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <XCircle className="w-3 h-3" /> Not Checked In
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
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No attendance data for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
