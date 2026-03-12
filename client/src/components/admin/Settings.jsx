import { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Save, CheckCircle, ExternalLink, Unlink, Loader2,
  Building2, Plus, Pencil, Brain, Eye, EyeOff, Camera, RotateCcw,
} from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    reminder_time: '21:00',
    escalation_time: '11:00',
    team_lead_email: '',
    gemini_api_key: '',
    requesty_api_key: '',
    photo_ai_model: '',
    photo_ai_prompt: '',
    photo_ai_prompt_male_extra: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: null });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showRequestyKey, setShowRequestyKey] = useState(false);

  // Company management
  const [companies, setCompanies] = useState([]);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: '', shortName: '', gst: '', state: '', city: '', address: '' });
  const [addingCompany, setAddingCompany] = useState(false);

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
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies');
        setCompanies(res.data);
      } catch (err) {
        console.error('Fetch companies error:', err);
      } finally {
        setCompanyLoading(false);
      }
    };
    fetchSettings();
    fetchGoogleStatus();
    fetchCompanies();
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

  // Company handlers
  const resetCompanyForm = () => {
    setCompanyForm({ name: '', shortName: '', gst: '', state: '', city: '', address: '' });
    setEditingCompany(null);
    setAddingCompany(false);
  };

  const handleSaveCompany = async () => {
    try {
      if (editingCompany) {
        const res = await api.put(`/companies/${editingCompany}`, companyForm);
        setCompanies((prev) => prev.map((c) => (c.id === editingCompany ? res.data : c)));
      } else {
        const res = await api.post('/companies', companyForm);
        setCompanies((prev) => [...prev, res.data]);
      }
      resetCompanyForm();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save company.');
    }
  };

  const startEditCompany = (company) => {
    setEditingCompany(company.id);
    setCompanyForm({
      name: company.name || '',
      shortName: company.shortName || '',
      gst: company.gst || '',
      state: company.state || '',
      city: company.city || '',
      address: company.address || '',
    });
    setAddingCompany(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* ═══ General Settings ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">General Settings</h2>
        <form onSubmit={handleSave} className="space-y-5">
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
              <p className="text-xs text-slate-500 mt-1">Default: 9:00 PM</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Escalation Time</label>
              <input
                type="time"
                value={settings.escalation_time}
                onChange={(e) => setSettings({ ...settings, escalation_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Default: 11:00 AM</p>
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
      </div>

      {/* ═══ AI Configuration ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          AI Configuration
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Requesty AI is the primary gateway (cost-ordered model routing). Gemini is the direct fallback.
        </p>

        {/* Requesty API Key (primary) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Requesty AI API Key
            <span className="ml-1.5 text-xs font-normal text-purple-500">(primary gateway)</span>
          </label>
          <div className="relative">
            <input
              type={showRequestyKey ? 'text' : 'password'}
              value={settings.requesty_api_key}
              onChange={(e) => setSettings({ ...settings, requesty_api_key: e.target.value })}
              className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
              placeholder="sk-..."
            />
            <button
              type="button"
              onClick={() => setShowRequestyKey(!showRequestyKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {showRequestyKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Get your key from{' '}
            <a href="https://app.requesty.ai" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
              Requesty.ai
            </a>
            {' '}— routes to 433+ models with automatic cost optimization.
          </p>
        </div>

        {/* Gemini API Key (fallback) */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Gemini API Key
            <span className="ml-1.5 text-xs font-normal text-slate-400">(direct fallback)</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.gemini_api_key}
              onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
              className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
              placeholder="AIzaSy..."
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Get your key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
              Google AI Studio
            </a>
            {' '}— used when Requesty is unavailable.
          </p>
        </div>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              await api.put('/settings', {
                requesty_api_key: settings.requesty_api_key,
                gemini_api_key: settings.gemini_api_key,
              });
              setSuccess('AI keys saved!');
              setTimeout(() => setSuccess(''), 3000);
            } catch (err) {
              console.error(err);
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="mt-3 bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save AI Keys
        </button>
      </div>

      {/* ═══ Profile Photo AI Settings ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Camera className="w-5 h-5 text-teal-600" />
          Profile Photo AI
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Configure the AI model and prompt used to process employee profile photos (background removal, headshot framing, cleanup). Leave blank to use defaults.
        </p>

        {/* AI Model for Image Editing */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            AI Model (via Requesty)
            <span className="ml-1.5 text-xs font-normal text-slate-400">(blank = default chain)</span>
          </label>
          <input
            type="text"
            value={settings.photo_ai_model}
            onChange={(e) => setSettings({ ...settings, photo_ai_model: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm"
            placeholder="google/gemini-2.0-flash-exp"
          />
          <p className="text-xs text-slate-500 mt-1">
            Requesty model ID for image editing. Default chain: <code className="bg-slate-100 px-1 rounded">google/gemini-2.0-flash-exp</code> → <code className="bg-slate-100 px-1 rounded">google/gemini-2.0-flash-001</code>.
            {' '}Browse models at{' '}
            <a href="https://app.requesty.ai/models" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Requesty.ai</a>.
          </p>
        </div>

        {/* Base Prompt */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Base Prompt
            <span className="ml-1.5 text-xs font-normal text-slate-400">(applies to all photos)</span>
          </label>
          <textarea
            value={settings.photo_ai_prompt}
            onChange={(e) => setSettings({ ...settings, photo_ai_prompt: e.target.value })}
            rows={6}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm leading-relaxed"
            placeholder="You are a professional headshot photo editor. Edit this photo to:&#10;1. Remove the background and replace it with a solid plain white background.&#10;2. Frame the subject as a professional portrait headshot...&#10;..."
          />
          <p className="text-xs text-slate-500 mt-1">
            Main instructions sent to the AI for every profile photo. Leave blank to use the built-in default prompt.
          </p>
        </div>

        {/* Male-Specific Extra Instructions */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Male-Specific Extra Instructions
            <span className="ml-1.5 text-xs font-normal text-slate-400">(appended only for male employees)</span>
          </label>
          <textarea
            value={settings.photo_ai_prompt_male_extra}
            onChange={(e) => setSettings({ ...settings, photo_ai_prompt_male_extra: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm leading-relaxed"
            placeholder="5. Remove any glasses or sunglasses from the person's face — inpaint the eyes naturally.&#10;6. Remove any cap, hat, or headwear — reveal the natural hair/head beneath."
          />
          <p className="text-xs text-slate-500 mt-1">
            Extra instructions appended after the base prompt for male employees (e.g., glasses/cap removal). Leave blank to use the built-in default.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await api.put('/settings', {
                  photo_ai_model: settings.photo_ai_model,
                  photo_ai_prompt: settings.photo_ai_prompt,
                  photo_ai_prompt_male_extra: settings.photo_ai_prompt_male_extra,
                });
                setSuccess('Photo AI settings saved!');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err) {
                console.error(err);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Photo AI Settings
          </button>
          <button
            onClick={() => {
              setSettings((prev) => ({
                ...prev,
                photo_ai_model: '',
                photo_ai_prompt: '',
                photo_ai_prompt_male_extra: '',
              }));
            }}
            className="text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 border border-slate-200 hover:border-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          💡 Reset clears the fields — the system will use built-in defaults. Click "Save" after resetting.
        </p>
      </div>

      {/* ═══ Company Management ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            Companies
          </h2>
          {!addingCompany && !editingCompany && (
            <button
              onClick={() => { setAddingCompany(true); setEditingCompany(null); setCompanyForm({ name: '', shortName: '', gst: '', state: '', city: '', address: '' }); }}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Company
            </button>
          )}
        </div>

        {/* Company list */}
        {companyLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => (
              <div key={c.id} className={`border rounded-lg p-3 ${editingCompany === c.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                {editingCompany === c.id ? (
                  <CompanyFormFields form={companyForm} setForm={setCompanyForm} onSave={handleSaveCompany} onCancel={resetCompanyForm} />
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.shortName && <span className="font-mono bg-slate-200 px-1 rounded mr-2">{c.shortName}</span>}
                        {c.gst && <span>GST: {c.gst}</span>}
                        {c.state && <span className="ml-2">• {c.city ? `${c.city}, ` : ''}{c.state}</span>}
                      </p>
                    </div>
                    <button onClick={() => startEditCompany(c)} className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {addingCompany && (
          <div className="mt-3 border border-blue-300 bg-blue-50 rounded-lg p-3">
            <CompanyFormFields form={companyForm} setForm={setCompanyForm} onSave={handleSaveCompany} onCancel={resetCompanyForm} isNew />
          </div>
        )}
      </div>

      {/* ═══ Google Workspace Connection ═══ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Google Workspace Connection</h2>
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
              <p className="text-xs text-slate-500 mt-1">Calendar events and tasks can be auto-loaded into your reports.</p>
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
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Connect your Google account to auto-fill reports from Calendar &amp; Tasks.</p>
              <button
                onClick={async () => {
                  setGoogleError('');
                  try {
                    const res = await api.get('/google/auth-url');
                    window.location.href = res.data.url;
                  } catch (err) {
                    const msg =
                      err?.response?.data?.error ||
                      err?.response?.data?.message ||
                      err?.message ||
                      'Failed to start Google authorization. Please try again.';
                    setGoogleError(msg);
                    console.error('Google auth error:', err);
                  }
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 shrink-0 ml-4"
              >
                <ExternalLink className="w-3 h-3" />
                Connect Google
              </button>
            </div>
            {googleError && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>{googleError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gmail config note */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="font-medium text-amber-800 mb-2">Gmail Configuration</h3>
        <p className="text-sm text-amber-700">
          To enable email reminders, configure these in the server <code className="bg-amber-100 px-1 rounded">.env</code> file:
        </p>
        <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
          <li><code className="bg-amber-100 px-1 rounded">GMAIL_USER</code> - Your Gmail address</li>
          <li><code className="bg-amber-100 px-1 rounded">GMAIL_APP_PASSWORD</code> - Gmail App Password</li>
          <li><code className="bg-amber-100 px-1 rounded">TEAM_LEAD_EMAIL</code> - Email for summaries</li>
        </ul>
      </div>
    </div>
  );
}

/* Reusable company form fields */
function CompanyFormFields({ form, setForm, onSave, onCancel, isNew }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Company Name *"
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        />
        <input
          value={form.shortName}
          onChange={(e) => setForm({ ...form, shortName: e.target.value })}
          placeholder="Short Name (e.g. CPIPL)"
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        />
      </div>
      <input
        value={form.gst}
        onChange={(e) => setForm({ ...form, gst: e.target.value })}
        placeholder="GST Number"
        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State"
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        />
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        />
      </div>
      <input
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        placeholder="Full Address"
        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
      />
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!form.name.trim()}
          className={`text-xs text-white px-3 py-1.5 rounded font-medium disabled:opacity-40 ${isNew ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
        >
          {isNew ? 'Add Company' : 'Save Changes'}
        </button>
        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}
