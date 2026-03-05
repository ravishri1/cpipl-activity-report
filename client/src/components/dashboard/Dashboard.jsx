import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import {
  Users, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Mail,
  ClipboardEdit, ThumbsUp, Heart, LogIn, LogOut, CalendarOff,
  ClipboardCheck, CalendarDays, Briefcase, Wrench, TrendingUp,
} from 'lucide-react';
import AppreciationModal from '../leaderboard/AppreciationModal';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [myReport, setMyReport] = useState(null);
  const [myReportLoading, setMyReportLoading] = useState(true);
  const [appreciateUser, setAppreciateUser] = useState(null);

  // HR widget states
  const [attendance, setAttendance] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [assetHealth, setAssetHealth] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard?date=${date}`);
      setData(res.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReport = async () => {
    setMyReportLoading(true);
    try {
      const res = await api.get(`/reports/my?date=${today}`);
      setMyReport(res.data);
    } catch (err) {
      console.error('My report fetch error:', err);
    } finally {
      setMyReportLoading(false);
    }
  };

  const fetchHRData = async () => {
    try {
      const [attRes, balRes] = await Promise.all([
        api.get('/attendance/today').catch(() => ({ data: null })),
        api.get(`/leave/balance?year=${new Date().getFullYear()}`).catch(() => ({ data: [] })),
      ]);
      setAttendance(attRes.data);
      setLeaveBalances(balRes.data);
    } catch (err) {
      console.error('HR data error:', err);
    }
  };

  const fetchPendingLeaves = async () => {
    try {
      const res = await api.get('/leave/pending');
      setPendingLeaves(res.data);
    } catch (err) {
      console.error('Pending leaves error:', err);
    }
  };

  const fetchAssetHealth = async () => {
    try {
      const res = await api.get('/predictions/dashboard/summary');
      setAssetHealth(res.data);
    } catch (err) {
      // Non-critical — silently ignore if no assets or endpoint unavailable
      console.error('Asset health fetch error:', err);
    }
  };

  useEffect(() => {
    fetchHRData();
    if (isAdmin) {
      fetchDashboard();
      fetchPendingLeaves();
      fetchAssetHealth();
    } else {
      fetchMyReport();
    }
  }, [date, isAdmin]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await api.post('/attendance/check-in');
      setAttendance(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      const res = await api.post('/attendance/check-out');
      setAttendance(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Check-out failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  if (isAdmin && loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // ─── Member View ──────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">My Dashboard</h1>

        {/* Quick Actions + Attendance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Attendance card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700">Attendance</h3>
            </div>
            {!attendance || !attendance.checkIn ? (
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {checkingIn ? 'Checking in...' : 'Check In'}
              </button>
            ) : !attendance.checkOut ? (
              <div>
                <p className="text-xs text-emerald-600 font-medium mb-2">
                  ✓ Checked in at {new Date(attendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
                <button
                  onClick={handleCheckOut}
                  disabled={checkingIn}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  {checkingIn ? 'Checking out...' : 'Check Out'}
                </button>
              </div>
            ) : (
              <div className="text-sm space-y-1">
                <p className="text-emerald-600 font-medium">✓ Day complete</p>
                <p className="text-xs text-slate-500">
                  {new Date(attendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  {' → '}
                  {new Date(attendance.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
                {attendance.workHours && (
                  <p className="text-xs text-blue-600 font-medium">{attendance.workHours.toFixed(1)}h worked</p>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/submit-report')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <ClipboardEdit className="w-4 h-4" />
                Submit Report
              </button>
              <button
                onClick={() => navigate('/leave')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <CalendarOff className="w-4 h-4" />
                Apply Leave
              </button>
              <button
                onClick={() => navigate('/attendance')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <CalendarDays className="w-4 h-4" />
                View Attendance
              </button>
            </div>
          </div>

          {/* Leave balance mini */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Leave Balance</h3>
              <Link to="/leave" className="text-xs text-blue-600 hover:underline">View all</Link>
            </div>
            {leaveBalances.length > 0 ? (
              <div className="space-y-2">
                {leaveBalances.map((lb) => (
                  <div key={lb.id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{lb.leaveType?.code || lb.leaveType?.name}</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {lb.balance} <span className="text-slate-400 font-normal">/ {lb.total}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No leave data</p>
            )}
          </div>
        </div>

        {/* Today's report status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-500" />
            Today's Report
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {myReportLoading ? (
            <p className="text-slate-400">Checking...</p>
          ) : myReport ? (
            <div>
              <p className="text-green-700 font-medium text-sm mb-3">
                ✓ Submitted at {new Date(myReport.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
              <div className="text-sm text-slate-700 space-y-2 mb-3">
                {myReport.tasks && myReport.tasks.length > 0 ? (
                  <div>
                    <p className="font-medium mb-1.5 text-xs text-slate-500">Tasks:</p>
                    <div className="space-y-1">
                      {myReport.tasks.map((task, idx) => (
                        <div key={task.id || idx} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5">
                          <span className="text-sm">{task.description}</span>
                          {task.hours > 0 && (
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2">
                              {task.hours}h
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {myReport.totalHours > 0 && (
                      <p className="text-xs text-right text-slate-500 mt-1">Total: {myReport.totalHours}h</p>
                    )}
                  </div>
                ) : (
                  <p><strong>Activities:</strong> {myReport.activities}</p>
                )}
                {myReport.challenges && <p className="text-sm"><strong>Challenges:</strong> {myReport.challenges}</p>}
                {myReport.planTomorrow && <p className="text-sm"><strong>Plan for Tomorrow:</strong> {myReport.planTomorrow}</p>}
              </div>
              <button onClick={() => navigate('/submit-report')} className="text-sm text-blue-600 hover:underline">
                Edit Report
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 mb-3 text-sm">✗ Not yet submitted</p>
              <button
                onClick={() => navigate('/submit-report')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Submit Report
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Admin/Team Lead View ─────────────────────────────────
  if (!data) return <div className="text-center text-red-500 mt-8">Failed to load dashboard.</div>;

  const { summary, reported, notReported, ignoredReminder, emailDataDate } = data;

  const handleThumbsUp = async (reportId) => {
    const member = reported.find((m) => m.reportId === reportId);
    if (!member) return;
    const alreadyGiven = member.thumbsUps.some((t) => t.givenBy.id === user.id);
    try {
      if (alreadyGiven) {
        await api.delete('/points/thumbsup', { data: { reportId } });
      } else {
        await api.post('/points/thumbsup', { reportId });
      }
      fetchDashboard();
    } catch (err) {
      console.error('Thumbs up error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={fetchDashboard}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* HR Quick Widgets — admin row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase">My Attendance</h3>
          </div>
          {!attendance || !attendance.checkIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {checkingIn ? 'Checking in...' : 'Check In'}
            </button>
          ) : !attendance.checkOut ? (
            <div>
              <p className="text-xs text-emerald-600 font-medium mb-1.5">
                ✓ In at {new Date(attendance.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
              <button
                onClick={handleCheckOut}
                disabled={checkingIn}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Check Out
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-emerald-700">✓ Complete</p>
              <p className="text-xs text-slate-500">
                {attendance.workHours ? `${attendance.workHours.toFixed(1)}h worked` : 'Done for today'}
              </p>
            </div>
          )}
        </div>

        {/* Pending leave requests widget */}
        <Link to="/admin/leave-requests" className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-blue-200 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase">Pending Leaves</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800">{pendingLeaves.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {pendingLeaves.length > 0 ? 'Awaiting review' : 'All clear'}
          </p>
        </Link>

        {/* Leave balance widget */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CalendarOff className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-semibold text-slate-500 uppercase">My Leave</h3>
          </div>
          {leaveBalances.length > 0 ? (
            <div className="space-y-1">
              {leaveBalances.slice(0, 3).map((lb) => (
                <div key={lb.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{lb.leaveType?.code}</span>
                  <span className="text-xs font-semibold text-slate-700">{lb.balance}/{lb.total}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No data</p>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Quick Links</h3>
          <div className="space-y-1.5">
            <Link to="/admin/attendance" className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-700">
              <CalendarDays className="w-3.5 h-3.5" /> Team Attendance
            </Link>
            <Link to="/admin/holidays" className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-700">
              <CalendarDays className="w-3.5 h-3.5" /> Holidays
            </Link>
            <Link to="/directory" className="flex items-center gap-2 text-xs text-slate-600 hover:text-blue-700">
              <Users className="w-3.5 h-3.5" /> Directory
            </Link>
          </div>
        </div>
      </div>

      {/* Asset Health Banner (admin only) */}
      {assetHealth && (
        <Link
          to="/admin/predictive-maintenance"
          className="block bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left: icon + label */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${assetHealth.riskDistribution?.critical > 0 ? 'bg-red-50' : assetHealth.riskDistribution?.high > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                <Wrench className={`w-5 h-5 ${assetHealth.riskDistribution?.critical > 0 ? 'text-red-600' : assetHealth.riskDistribution?.high > 0 ? 'text-orange-500' : 'text-green-600'}`} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Asset Health</h3>
                <p className="text-xs text-slate-500">ML predictive maintenance</p>
              </div>
            </div>

            {/* Right: stats row */}
            <div className="flex items-center gap-5 flex-wrap">
              {assetHealth.riskDistribution?.critical > 0 && (
                <div className="text-center">
                  <p className="text-xl font-bold text-red-600">{assetHealth.riskDistribution.critical}</p>
                  <p className="text-[11px] text-slate-500">Critical</p>
                </div>
              )}
              {assetHealth.riskDistribution?.high > 0 && (
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-500">{assetHealth.riskDistribution.high}</p>
                  <p className="text-[11px] text-slate-500">High Risk</p>
                </div>
              )}
              {assetHealth.riskDistribution?.medium > 0 && (
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-600">{assetHealth.riskDistribution.medium}</p>
                  <p className="text-[11px] text-slate-500">Medium</p>
                </div>
              )}
              <div className="text-center border-l border-slate-200 pl-5">
                <p className="text-xl font-bold text-indigo-600">{assetHealth.avgHealthScore}</p>
                <p className="text-[11px] text-slate-500">Avg Score</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-700">{assetHealth.totalAssets}</p>
                <p className="text-[11px] text-slate-500">Assets</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium group-hover:underline ml-2">
                <TrendingUp className="w-3.5 h-3.5" />
                View All
              </div>
            </div>
          </div>

          {/* Critical asset chips */}
          {assetHealth.criticalAssets?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2 flex-wrap items-center">
              <span className="text-[11px] text-slate-500 font-medium">Urgent:</span>
              {assetHealth.criticalAssets.slice(0, 4).map(a => (
                <span
                  key={a.id}
                  className={`px-2 py-0.5 text-[11px] rounded-full border font-medium ${a.riskLevel === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}
                >
                  {a.name}
                </span>
              ))}
              {assetHealth.criticalAssets.length > 4 && (
                <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[11px] rounded-full border border-slate-200">
                  +{assetHealth.criticalAssets.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* All-healthy state */}
          {assetHealth.atRiskCount === 0 && (
            <div className="mt-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 font-medium">All {assetHealth.totalAssets} assets operating within healthy parameters</span>
            </div>
          )}
        </Link>
      )}

      {/* Report Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard icon={Users} label="Total Members" value={summary.total} color="blue" />
        <SummaryCard icon={CheckCircle} label="Reported" value={summary.reported} color="green" />
        <SummaryCard icon={XCircle} label="Not Reported" value={summary.notReported} color="red" />
        <SummaryCard icon={AlertTriangle} label="Ignored Reminder" value={summary.ignoredReminder} color="orange" />
      </div>

      {/* Email data note */}
      {emailDataDate && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <Mail className="w-3 h-3" />
          Email data from {emailDataDate} (2-day delay from Google Reports API)
        </div>
      )}

      {/* Three Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reported */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 bg-green-50 rounded-t-xl">
            <h2 className="font-semibold text-green-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Reported ({reported.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {reported.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400">No reports yet</div>
            ) : (
              reported.map((m) => {
                const myThumbsUp = m.thumbsUps?.some((t) => t.givenBy.id === user.id);
                return (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.department}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <EmailBadge sent={m.emailsSent} received={m.emailsReceived} />
                      {m.id !== user.id && (
                        <button
                          onClick={() => setAppreciateUser({ id: m.id, name: m.name })}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
                          title={`Appreciate ${m.name}`}
                        >
                          <Heart className="w-3 h-3" />
                        </button>
                      )}
                      {isAdmin && m.id !== user.id && (
                        <button
                          onClick={() => handleThumbsUp(m.reportId)}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                            myThumbsUp
                              ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-pink-50 hover:text-pink-600'
                          }`}
                          title={myThumbsUp ? 'Remove thumbs up (-10 pts)' : 'Give thumbs up (+10 pts)'}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${myThumbsUp ? 'fill-current' : ''}`} />
                          {m.thumbsUpCount > 0 && <span>{m.thumbsUpCount}</span>}
                        </button>
                      )}
                      {(!isAdmin || m.id === user.id) && m.thumbsUpCount > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
                          <ThumbsUp className="w-3 h-3 fill-current" />
                          {m.thumbsUpCount}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Clock className="w-3 h-3" />
                        {new Date(m.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Not Reported */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 bg-red-50 rounded-t-xl">
            <h2 className="font-semibold text-red-800 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Not Reported ({notReported.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {notReported.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400">Everyone reported!</div>
            ) : (
              notReported.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.department}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <EmailBadge sent={m.emailsSent} received={m.emailsReceived} />
                    {m.reminded && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        Reminded
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ignored Reminder */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-200 bg-orange-50 rounded-t-xl">
            <h2 className="font-semibold text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Ignored Reminder ({ignoredReminder.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {ignoredReminder.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400">None</div>
            ) : (
              ignoredReminder.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.department}</p>
                  </div>
                  <EmailBadge sent={m.emailsSent} received={m.emailsReceived} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Appreciation Modal */}
      {appreciateUser && (
        <AppreciationModal
          receiver={appreciateUser}
          onClose={() => setAppreciateUser(null)}
          onSuccess={() => {
            setAppreciateUser(null);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}

function EmailBadge({ sent, received }) {
  if (!sent && !received) return null;
  return (
    <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full" title={`Sent: ${sent}, Received: ${received}`}>
      <Mail className="w-3 h-3" />
      {sent}/{received}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-10 h-10 opacity-40" />
      </div>
    </div>
  );
}
