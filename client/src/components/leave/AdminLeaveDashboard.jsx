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
  ChevronUp, Filter, Download,
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

function getCurrentFY() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function getFYLabel(year) {
  return `FY ${year}-${String(year + 1).slice(2)}`;
}

export default function AdminLeaveDashboard() {
  const [fyYear, setFyYear] = useState(getCurrentFY());
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [activeTab, setActiveTab] = useState({}); // per employee: 'balance' | 'history' | 'compoff'

  const { data, loading, error: fetchErr } = useFetch(
    `/leave/admin/dashboard?year=${fyYear}`, { employees: [] }, [fyYear]
  );

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
                    <div className="flex items-center gap-1 border-b border-slate-100 mt-2 mb-4">
                      {[
                        { key: 'balance', label: 'Leave Balance', icon: BarChart3 },
                        { key: 'history', label: `Leave History (${requests.length})`, icon: Calendar },
                        { key: 'compoff', label: 'Comp-Off', icon: AlertTriangle },
                      ].map(t => (
                        <button
                          key={t.key}
                          onClick={() => setEmpTab(emp.id, t.key)}
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
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
