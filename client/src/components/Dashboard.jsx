import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Users, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Mail, ClipboardEdit, FileText } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  // Member-specific state
  const [myReport, setMyReport] = useState(null);
  const [myReportLoading, setMyReportLoading] = useState(true);

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

  useEffect(() => {
    if (isAdmin) {
      fetchDashboard();
    } else {
      fetchMyReport();
    }
  }, [date, isAdmin]);

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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">My Dashboard</h1>

        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <p className="text-sm text-slate-500 mb-3">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {myReportLoading ? (
            <p className="text-slate-400">Checking...</p>
          ) : myReport ? (
            <div>
              <p className="text-green-700 font-medium mb-3">
                ✓ Report submitted at {new Date(myReport.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
              <div className="text-sm text-slate-700 space-y-2 mb-3">
                <p><strong>Activities:</strong> {myReport.activities}</p>
                {myReport.challenges && <p><strong>Challenges:</strong> {myReport.challenges}</p>}
                {myReport.planTomorrow && <p><strong>Plan for Tomorrow:</strong> {myReport.planTomorrow}</p>}
              </div>
              <button onClick={() => navigate('/submit-report')} className="text-sm text-blue-600 hover:underline">
                Edit Report
              </button>
            </div>
          ) : (
            <div>
              <p className="text-red-600 mb-3">✗ Not yet submitted</p>
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={fetchDashboard}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={Users} label="Total Members" value={summary.total} color="blue" />
        <SummaryCard icon={CheckCircle} label="Reported" value={summary.reported} color="green" />
        <SummaryCard icon={XCircle} label="Not Reported" value={summary.notReported} color="red" />
        <SummaryCard icon={AlertTriangle} label="Ignored Reminder" value={summary.ignoredReminder} color="orange" />
      </div>

      {/* Email data note */}
      {emailDataDate && (
        <div className="mb-4 text-xs text-slate-400 flex items-center gap-1">
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
              reported.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.department}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <EmailBadge sent={m.emailsSent} received={m.emailsReceived} />
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Clock className="w-3 h-3" />
                      {new Date(m.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                  </div>
                </div>
              ))
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
