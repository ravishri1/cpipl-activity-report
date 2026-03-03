import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDate } from '../../utils/formatters';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarOff,
  Receipt,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  UserX,
} from 'lucide-react';

export default function TeamOverview() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  // Fetch dashboard data (reports status) — already dept-filtered for team_lead
  const { data: dashboard, loading: dashLoading, error: dashError } = useFetch(`/dashboard?date=${today}`, null);

  // Fetch pending leave requests — already dept-filtered for team_lead
  const { data: pendingLeaves, loading: leaveLoading } = useFetch('/leave/pending', []);

  // Fetch team attendance — already dept-filtered for team_lead
  const { data: attendance, loading: attLoading } = useFetch(`/attendance/team?date=${today}`, null);

  // Fetch pending expense claims
  const { data: pendingExpenses, loading: expLoading } = useFetch('/expenses/pending', []);

  const loading = dashLoading || leaveLoading || attLoading || expLoading;

  if (loading) return <LoadingSpinner />;
  if (dashError) return <AlertMessage type="error" message={dashError} />;

  const summary = dashboard?.summary || { total: 0, reported: 0, notReported: 0, ignoredReminder: 0 };
  const reportRate = summary.total > 0 ? Math.round((summary.reported / summary.total) * 100) : 0;

  const checkedInCount = attendance?.records?.filter(r => r.checkInTime)?.length || 0;
  const totalTeam = attendance?.records?.length || summary.total || 0;
  const attendanceRate = totalTeam > 0 ? Math.round((checkedInCount / totalTeam) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Team</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.department ? `${user.department} Department` : 'Team'} — {formatDate(today)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Users}
          label="Team Size"
          value={summary.total}
          color="blue"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Reports Submitted"
          value={`${summary.reported}/${summary.total}`}
          sub={`${reportRate}%`}
          color="green"
        />
        <SummaryCard
          icon={Clock}
          label="Checked In Today"
          value={`${checkedInCount}/${totalTeam}`}
          sub={`${attendanceRate}%`}
          color="indigo"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Pending Actions"
          value={(pendingLeaves?.length || 0) + (pendingExpenses?.length || 0)}
          sub={`${pendingLeaves?.length || 0} leaves, ${pendingExpenses?.length || 0} expenses`}
          color="amber"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Report Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-500" />
              Today's Reports
            </h2>
            <Link to="/dashboard" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {summary.total === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No team members found</p>
          ) : (
            <div className="space-y-2">
              {/* Submitted */}
              {(dashboard?.reported || []).slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <UserCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-slate-400">{m.submittedAt ? new Date(m.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              ))}
              {(dashboard?.reported?.length || 0) > 5 && (
                <p className="text-xs text-slate-400 pl-7">+{dashboard.reported.length - 5} more submitted</p>
              )}

              {/* Not Submitted */}
              {(dashboard?.notReported || []).slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <UserX className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-red-400">Pending</span>
                </div>
              ))}
              {(dashboard?.notReported?.length || 0) > 5 && (
                <p className="text-xs text-slate-400 pl-7">+{dashboard.notReported.length - 5} more pending</p>
              )}

              {/* Ignored */}
              {(dashboard?.ignoredReminder || []).slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center gap-3 py-1.5">
                  <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm text-slate-600 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-amber-500">Ignored Reminder</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Pending Approvals
          </h2>

          {/* Leave Requests */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Leave Requests</h3>
              <Link to="/admin/leave-requests" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Review <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {(!pendingLeaves || pendingLeaves.length === 0) ? (
              <p className="text-sm text-slate-400 py-2">No pending leave requests</p>
            ) : (
              <div className="space-y-1.5">
                {pendingLeaves.slice(0, 4).map(leave => (
                  <div key={leave.id} className="flex items-center gap-3 py-1.5 px-2 bg-amber-50 rounded-lg">
                    <CalendarOff className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{leave.user?.name || 'Employee'}</span>
                    <span className="text-xs text-amber-600 font-medium">{leave.leaveType?.name || leave.leaveTypeName || 'Leave'}</span>
                  </div>
                ))}
                {pendingLeaves.length > 4 && (
                  <p className="text-xs text-slate-400 pl-2">+{pendingLeaves.length - 4} more requests</p>
                )}
              </div>
            )}
          </div>

          {/* Expense Claims */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expense Claims</h3>
              <Link to="/admin/expense-claims" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Review <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {(!pendingExpenses || pendingExpenses.length === 0) ? (
              <p className="text-sm text-slate-400 py-2">No pending expense claims</p>
            ) : (
              <div className="space-y-1.5">
                {pendingExpenses.slice(0, 4).map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 py-1.5 px-2 bg-orange-50 rounded-lg">
                    <Receipt className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{exp.user?.name || 'Employee'}</span>
                    <span className="text-xs text-orange-600 font-medium">₹{exp.totalAmount?.toLocaleString('en-IN') || '0'}</span>
                  </div>
                ))}
                {pendingExpenses.length > 4 && (
                  <p className="text-xs text-slate-400 pl-2">+{pendingExpenses.length - 4} more claims</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/attendance" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors">
            <Clock className="w-4 h-4" /> View Attendance
          </Link>
          <Link to="/admin/leave-requests" className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors">
            <CalendarOff className="w-4 h-4" /> Approve Leaves
          </Link>
          <Link to="/admin/expense-claims" className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 text-sm font-medium rounded-lg hover:bg-orange-100 transition-colors">
            <Receipt className="w-4 h-4" /> Review Expenses
          </Link>
          <Link to="/directory" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
            <Users className="w-4 h-4" /> Team Directory
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    indigo: 'from-indigo-500 to-indigo-600',
    amber: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-4.5 h-4.5 text-white" />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="pl-12">
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
