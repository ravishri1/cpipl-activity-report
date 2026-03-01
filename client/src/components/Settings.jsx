import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Save, CheckCircle, ExternalLink, Unlink, Loader2 } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    reminder_time: '21:00',
    escalation_time: '11:00',
    team_lead_email: '',
    company_name: 'CPIPL',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: null });
  const [googleLoading, setGoogleLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        setSettings((prev) => ({ ...prev, ...res.data }));
      } catch (err) {
        console.error('Fetch settings error:', err);
      }
    };
    const fetchGoogleStatus = async () => {
      try {
        const res = await api.get('/google/status');
        setGoogleStatus(res.data);
      } catch {
        // Google not configured
      } finally {
        setGoogleLoading(false);
      }
    };
    fetchSettings();
    fetchGoogleStatus();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    try {
      await api.put('/settings', settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Save settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team Lead / Report In-charge Email</label>
            <input
              type="email"
              value={settings.team_lead_email}
              onChange={(e) => setSettings({ ...settings, team_lead_email: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="teamlead@company.com"
            />
            <p className="text-xs text-slate-500 mt-1">This person receives daily summary and escalation emails.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Reminder Time</label>
              <input
                type="time"
                value={settings.reminder_time}
                onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">When to send first reminder (default: 9:00 PM)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Escalation Time</label>
              <input
                type="time"
                value={settings.escalation_time}
                onChange={(e) => setSettings({ ...settings, escalation_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">When to escalate next morning (default: 11:00 AM)</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Google Workspace Connection */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Google Workspace Connection</h3>
          {googleLoading ? (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking connection...
            </div>
          ) : googleStatus.connected ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Connected as <span className="font-medium">{googleStatus.email || 'Google Account'}</span>
                </p>
                <p className="text-xs text-blue-500 mt-1">Calendar events and tasks can be auto-loaded into your reports.</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.delete('/google/disconnect');
                    setGoogleStatus({ connected: false, email: null });
                  } catch (err) {
                    console.error('Disconnect error:', err);
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Unlink className="w-3 h-3" />
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">Connect your Google account to auto-fill reports from Calendar & Tasks.</p>
              <button
                onClick={async () => {
                  try {
                    const res = await api.get('/google/auth-url');
                    window.location.href = res.data.url;
                  } catch (err) {
                    console.error('Google auth error:', err);
                  }
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Connect Google
              </button>
            </div>
          )}
        </div>

        {/* Gmail Configuration Note */}
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-medium text-amber-800 mb-2">Gmail Configuration</h3>
          <p className="text-sm text-amber-700">
            To enable email reminders, configure these in the server <code className="bg-amber-100 px-1 rounded">.env</code> file:
          </p>
          <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
            <li><code className="bg-amber-100 px-1 rounded">GMAIL_USER</code> - Your Gmail address</li>
            <li><code className="bg-amber-100 px-1 rounded">GMAIL_APP_PASSWORD</code> - Gmail App Password (not your regular password)</li>
            <li><code className="bg-amber-100 px-1 rounded">TEAM_LEAD_EMAIL</code> - Email for summaries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
