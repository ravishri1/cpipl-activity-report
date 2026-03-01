import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Search, Download, FileText, Clock } from 'lucide-react';

export default function ReportHistory() {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    // Set default date range to last 7 days
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    setTo(today.toISOString().split('T')[0]);
    setFrom(weekAgo.toISOString().split('T')[0]);

    if (isAdmin) {
      api.get('/users').then((res) => setUsers(res.data)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (from && to) fetchReports();
  }, [from, to, selectedUser]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (selectedUser) params.append('userId', selectedUser);
      const res = await api.get(`/reports/history?${params}`);
      setReports(res.data);
    } catch (err) {
      console.error('Fetch history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Name', 'Department', 'Activities', 'Challenges', 'Plan Tomorrow', 'Submitted At'];
    const rows = reports.map((r) => [
      r.reportDate,
      r.user.name,
      r.user.department,
      `"${r.activities.replace(/"/g, '""')}"`,
      `"${r.challenges.replace(/"/g, '""')}"`,
      `"${r.planTomorrow.replace(/"/g, '""')}"`,
      new Date(r.submittedAt).toLocaleString('en-IN'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Report History</h1>
        {reports.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Member</label>
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={fetchReports}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No reports found for the selected period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{r.reportDate}</span>
                  <span className="font-medium text-slate-800">{r.user.name}</span>
                  <span className="text-xs text-slate-500">{r.user.department}</span>
                  {r.totalHours > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {r.totalHours}h
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(r.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </button>
              {expanded === r.id && (
                <div className="px-5 pb-4 border-t border-slate-100 pt-4 space-y-3">
                  {/* Task breakdown with hours */}
                  {r.tasks && r.tasks.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-2">Tasks & Hours</p>
                      <div className="space-y-1.5">
                        {r.tasks.map((task, idx) => (
                          <div key={task.id || idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                            <span className="text-sm text-slate-800">{task.description}</span>
                            {task.hours > 0 && (
                              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2 shrink-0">
                                {task.hours}h
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {r.totalHours > 0 && (
                        <p className="text-xs text-right text-slate-500 mt-1.5">Total: {r.totalHours}h</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">Activities</p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.activities}</p>
                    </div>
                  )}
                  {r.challenges && (
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">Challenges</p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.challenges}</p>
                    </div>
                  )}
                  {r.planTomorrow && (
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-1">Plan for Tomorrow</p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{r.planTomorrow}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
