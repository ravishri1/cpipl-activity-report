import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import EmployeeShiftInfo from '../shifts/EmployeeShiftInfo';
import EmployeeCalendarView from './EmployeeCalendarView';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Timer,
  CheckCircle2,
  XCircle,
  Coffee,
  Palmtree,
  Sun,
  ChevronLeft,
  ChevronRight,
  List,
  Building2,
  Home,
  MapPin,
  Briefcase,
  ClipboardList,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

const WORK_TYPES = [
  { value: 'office',       label: 'In Office',      icon: Building2,    desc: 'Working from the office' },
  { value: 'wfh',          label: 'Work from Home', icon: Home,         desc: 'Requires approved WFH request' },
  { value: 'field_work',   label: 'Field Work',     icon: MapPin,       desc: 'Working outside office — location required' },
  { value: 'client_visit', label: 'Client Visit',   icon: Briefcase,    desc: 'At a client location — location required' },
  { value: 'on_duty',      label: 'On Duty',        icon: ClipboardList, desc: 'Official duty travel or assignment' },
];

const WORK_TYPE_BADGES = {
  office:       { bg: 'bg-slate-100',  text: 'text-slate-700',  label: 'In Office' },
  wfh:          { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'WFH' },
  field_work:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Field Work' },
  client_visit: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Client Visit' },
  on_duty:      { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'On Duty' },
};

function CheckInModal({ onClose, onSuccess }) {
  const [workType, setWorkType] = useState('office');
  const [workLocation, setWorkLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wfhStatus, setWfhStatus] = useState(null); // null | {approved, request}
  const [wfhChecking, setWfhChecking] = useState(false);

  const needsLocation = workType === 'field_work' || workType === 'client_visit';
  const needsNotes = workType === 'on_duty';

  // Check WFH approval when user selects WFH
  useEffect(() => {
    if (workType !== 'wfh') { setWfhStatus(null); return; }
    setWfhChecking(true);
    api.get('/wfh/check-today')
      .then(r => setWfhStatus(r.data))
      .catch(() => setWfhStatus({ approved: false, request: null }))
      .finally(() => setWfhChecking(false));
  }, [workType]);

  const handleSubmit = async () => {
    if (workType === 'wfh' && !wfhStatus?.approved) return;
    if (needsLocation && !workLocation.trim()) { setError('Location is required.'); return; }
    if (needsNotes && !notes.trim()) { setError('Please describe your on-duty work.'); return; }
    setLoading(true);
    setError(null);
    try {
      await api.post('/attendance/check-in', { workType, workLocation: workLocation.trim() || undefined, notes: notes.trim() || undefined });
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error || 'Check-in failed.';
      if (msg === 'NO_WFH_APPROVAL') {
        setError('You do not have an approved WFH request for today. Please apply through the WFH Requests section.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">How are you working today?</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
        </div>

        {/* Work Type Options */}
        <div className="px-5 py-4 space-y-2">
          {WORK_TYPES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => { setWorkType(value); setError(null); setWorkLocation(''); setNotes(''); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                workType === value ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${workType === value ? 'text-blue-600' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${workType === value ? 'text-blue-800' : 'text-slate-700'}`}>{label}</p>
                <p className="text-xs text-slate-400 truncate">{desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${workType === value ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                {workType === value && <div className="w-full h-full rounded-full bg-white scale-50" />}
              </div>
            </button>
          ))}

          {/* WFH Approval Status */}
          {workType === 'wfh' && (
            <div className={`mt-2 px-4 py-3 rounded-xl text-sm ${wfhChecking ? 'bg-slate-50' : wfhStatus?.approved ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              {wfhChecking && <span className="text-slate-500">Checking approval...</span>}
              {!wfhChecking && wfhStatus?.approved && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>WFH approved{wfhStatus.request?.reviewer?.name ? ` by ${wfhStatus.request.reviewer.name}` : ''}. You can check in.</span>
                </div>
              )}
              {!wfhChecking && !wfhStatus?.approved && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {wfhStatus?.request ? 'Your WFH request is pending approval.' : 'No WFH request found for today.'}
                      {' '}You cannot check in as WFH without approval.
                    </span>
                  </div>
                  <a href="/attendance-regularization" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                    <ExternalLink className="w-3 h-3" /> Apply for WFH Request
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Location input for Field Work / Client Visit */}
          {needsLocation && (
            <div className="mt-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                {workType === 'client_visit' ? 'Client Name & Location *' : 'Work Location *'}
              </label>
              <input
                type="text"
                value={workLocation}
                onChange={e => { setWorkLocation(e.target.value); setError(null); }}
                placeholder={workType === 'client_visit' ? 'e.g. ABC Corp, MG Road, Lucknow' : 'e.g. Warehouse, Gomti Nagar'}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}

          {/* Reason for On Duty */}
          {needsNotes && (
            <div className="mt-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Duty Description *</label>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setError(null); }}
                placeholder="e.g. Visit to Delhi branch for stock audit"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || (workType === 'wfh' && (!wfhStatus?.approved || wfhChecking))}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Checking in...' : 'Check In'}
          </button>
        </div>
      </div>
    </div>
  );
}

const statusConfig = {
  present: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Present' },
  absent: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Absent' },
  half_day: { color: 'bg-amber-100 text-amber-700', icon: Coffee, label: 'Half Day' },
  on_leave: { color: 'bg-blue-100 text-blue-700', icon: Palmtree, label: 'On Leave' },
  holiday: { color: 'bg-purple-100 text-purple-700', icon: Sun, label: 'Holiday' },
  weekend: { color: 'bg-slate-100 text-slate-500', icon: Coffee, label: 'Weekend' },
};

export default function MyAttendance() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [view, setView] = useState('calendar'); // 'list' or 'calendar'
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const timerRef = useRef(null);

  const fetchData = async () => {
    try {
      const [todayRes, monthlyRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get(`/attendance/my?month=${month}`),
      ]);
      setToday(todayRes.data);
      setMonthly(monthlyRes.data);
    } catch (err) {
      console.error('Fetch attendance error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month]);

  // Live elapsed timer
  useEffect(() => {
    if (today?.checkIn && !today?.checkOut) {
      const startTimer = () => {
        const checkInTime = new Date(today.checkIn).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - checkInTime) / 1000));
      };
      startTimer();
      timerRef.current = setInterval(startTimer, 1000);
      return () => clearInterval(timerRef.current);
    } else {
      setElapsed(null);
      clearInterval(timerRef.current);
    }
  }, [today?.checkIn, today?.checkOut]);

  const formatElapsed = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCheckInSuccess = async () => {
    setShowCheckInModal(false);
    await fetchData();
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-out');
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Check-out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const changeMonth = (delta) => {
    const d = new Date(month + '-01');
    d.setMonth(d.getMonth() + delta);
    setMonth(d.toISOString().substring(0, 7));
  };

  const isCheckedIn = today?.checkIn && !today?.checkOut;
  const isCheckedOut = today?.checkIn && today?.checkOut;
  const notCheckedIn = !today?.checkIn || today?.status === 'not_checked_in';

  // Format decimal hours as HH:MM
  const formatHrsMin = (hrs) => {
    if (!hrs || hrs <= 0) return '-';
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showCheckInModal && (
        <CheckInModal onClose={() => setShowCheckInModal(false)} onSuccess={handleCheckInSuccess} />
      )}

      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Clock className="w-6 h-6 text-blue-600" />
        My Attendance
      </h1>

      {/* Current Shift Information */}
      {user && <EmployeeShiftInfo userId={user.id} />}

      {/* Check-in / Check-out Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status display */}
          <div className="text-center sm:text-left">
            <p className="text-sm text-slate-500 mb-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            {isCheckedIn && (
              <>
                <p className="text-sm text-emerald-600 font-medium">
                  Checked in at {new Date(today.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Timer className="w-5 h-5 text-blue-500" />
                  <span className="text-2xl font-mono font-bold text-slate-800">{formatElapsed(elapsed)}</span>
                </div>
              </>
            )}
            {isCheckedOut && (
              <>
                <p className="text-sm text-slate-600">
                  {new Date(today.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — {new Date(today.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-lg font-semibold text-emerald-600 mt-1">
                  {today.workHours?.toFixed(1)} hours worked
                </p>
              </>
            )}
            {notCheckedIn && (
              <p className="text-slate-500">You haven't checked in today.</p>
            )}
          </div>

          {/* Action button */}
          <div className="flex flex-col items-end gap-2">
            {/* Work type badge (shown after check-in) */}
            {today?.workType && WORK_TYPE_BADGES[today.workType] && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${WORK_TYPE_BADGES[today.workType].bg} ${WORK_TYPE_BADGES[today.workType].text}`}>
                {WORK_TYPE_BADGES[today.workType].label}
                {today.workLocation && ` · ${today.workLocation}`}
              </span>
            )}
            {notCheckedIn && (
              <button
                onClick={() => setShowCheckInModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <LogIn className="w-5 h-5" />
                Check In
              </button>
            )}
            {isCheckedIn && (
              <button
                onClick={handleCheckOut}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <LogOut className="w-5 h-5" />
                {actionLoading ? 'Checking out...' : 'Check Out'}
              </button>
            )}
            {isCheckedOut && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Completed for today
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      {monthly?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Present" value={monthly.summary.present} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Absent" value={monthly.summary.absent} color="text-red-600" bg="bg-red-50" />
          <StatCard label="On Leave" value={monthly.summary.onLeave} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Avg Work Hrs" value={formatHrsMin(monthly.summary.avgWorkHours)} color="text-purple-600" bg="bg-purple-50" />
          <StatCard label="Avg Actual Hrs" value={formatHrsMin(monthly.summary.avgActualWorkHours)} color="text-indigo-600" bg="bg-indigo-50" />
        </div>
      )}

      {/* View Toggle Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            view === 'list'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <List className="w-4 h-4" />
          List View
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            view === 'calendar'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Calendar View
        </button>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <h3 className="text-sm font-semibold text-slate-700">
              {new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-100">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Records table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2.5 font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Day</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Check In</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Check Out</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthly?.records?.length > 0 ? (
                  monthly.records.map((r) => {
                    const cfg = statusConfig[r.status] || statusConfig.present;
                    const StatusIcon = cfg.icon;
                    const dateObj = new Date(r.date + 'T00:00:00');
                    return (
                      <tr key={r.date} className="hover:bg-slate-50">
                        <td className="px-4 py-2">{r.date}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-700">
                          {r.workHours ? `${r.workHours.toFixed(1)}h` : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No attendance records for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View — reuse EmployeeCalendarView in self mode */}
      {view === 'calendar' && user && (
        <EmployeeCalendarView userId={user.id} selfView />
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`rounded-xl ${bg} px-4 py-3`}>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
