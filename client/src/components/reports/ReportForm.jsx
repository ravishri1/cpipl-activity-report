import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Send, CheckCircle, Edit3, Zap, FileText, X, Clock, Plus, Trash2 } from 'lucide-react';
import GoogleSuggestions from '../google/GoogleSuggestions';

export default function ReportForm() {
  const [activities, setActivities] = useState('');
  const [challenges, setChallenges] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [existingReport, setExistingReport] = useState(null);

  // Task-based hours tracking
  const [tasks, setTasks] = useState([{ description: '', hours: '' }]);

  // Pre-fill & compact mode state
  const [mode, setMode] = useState('full'); // 'full' or 'quick'
  const [showPrefillBanner, setShowPrefillBanner] = useState(false);
  const [recentActivities, setRecentActivities] = useState([]);
  const [quickText, setQuickText] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const totalHours = tasks.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Check if report exists for today
        const res = await api.get(`/reports/my?date=${today}`);
        if (res.data) {
          setExistingReport(res.data);
          setActivities(res.data.activities);
          setChallenges(res.data.challenges);
          setPlanTomorrow(res.data.planTomorrow);
          // Load existing tasks
          if (res.data.tasks && res.data.tasks.length > 0) {
            setTasks(res.data.tasks.map(t => ({ description: t.description, hours: t.hours.toString() })));
          } else if (res.data.activities) {
            // Backward compat: convert activities text to a single task
            setTasks([{ description: res.data.activities, hours: '' }]);
          }
        } else {
          // 2. No report today -> try pre-fill from yesterday's plan
          try {
            const planRes = await api.get('/reports/yesterday-plan');
            if (planRes.data.planTomorrow) {
              setActivities(planRes.data.planTomorrow);
              // Split yesterday's plan into tasks by newline
              const lines = planRes.data.planTomorrow.split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                setTasks(lines.map(l => ({ description: l.trim(), hours: '' })));
              }
              setShowPrefillBanner(true);
            }
          } catch (e) {
            // Ignore - pre-fill is optional
          }
        }

        // 3. Fetch recent activities for suggestions
        try {
          const recentRes = await api.get('/reports/recent-activities');
          setRecentActivities(recentRes.data || []);
        } catch (e) {
          // Ignore
        }
      } catch (err) {
        console.error('Fetch report error:', err);
      }
    };
    fetchData();
  }, []);

  const dismissPrefill = () => {
    setActivities('');
    setTasks([{ description: '', hours: '' }]);
    setShowPrefillBanner(false);
  };

  // Build activities text from tasks
  const buildActivitiesFromTasks = () => {
    return tasks
      .filter(t => t.description.trim())
      .map(t => {
        const hrs = parseFloat(t.hours);
        return hrs ? `${t.description.trim()} (${hrs}h)` : t.description.trim();
      })
      .join('\n');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    let submitActivities;
    let submitTasks = [];

    if (mode === 'quick') {
      submitActivities = quickText;
    } else {
      // Build activities from tasks
      const validTasks = tasks.filter(t => t.description.trim());
      if (validTasks.length === 0) {
        setError('Please add at least one task.');
        setLoading(false);
        return;
      }
      submitActivities = buildActivitiesFromTasks();
      submitTasks = validTasks.map(t => ({
        description: t.description.trim(),
        hours: parseFloat(t.hours) || 0,
      }));
    }

    if (!submitActivities.trim()) {
      setError('Activities field is required.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/reports', {
        activities: submitActivities,
        challenges: mode === 'quick' ? '' : challenges,
        planTomorrow: mode === 'quick' ? '' : planTomorrow,
        reportDate: today,
        tasks: submitTasks,
      });
      setSuccess(res.data.message);
      setExistingReport(res.data.report);
      if (mode === 'quick') {
        setActivities(submitActivities);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  const useRecentActivity = (text) => {
    if (mode === 'quick') {
      setQuickText(text);
    } else {
      setActivities(text);
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        setTasks(lines.map(l => ({ description: l.trim(), hours: '' })));
      }
    }
  };

  // Task management
  const addTask = () => setTasks([...tasks, { description: '', hours: '' }]);

  const removeTask = (index) => {
    if (tasks.length === 1) return;
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const updateTask = (index, field, value) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const switchMode = (newMode) => {
    if (newMode === 'quick' && mode === 'full') {
      setQuickText(buildActivitiesFromTasks() || activities);
    } else if (newMode === 'full' && mode === 'quick') {
      if (quickText && tasks.every(t => !t.description.trim())) {
        const lines = quickText.split('\n').filter(l => l.trim());
        setTasks(lines.length > 0 ? lines.map(l => ({ description: l.trim(), hours: '' })) : [{ description: quickText, hours: '' }]);
      }
      setActivities(quickText || activities);
    }
    setMode(newMode);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">EOD Report</h1>
            <p className="text-slate-500 mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalHours > 0 && mode === 'full' && (
              <span className="flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                <Clock className="w-4 h-4" />
                {totalHours}h total
              </span>
            )}
            {existingReport && (
              <span className="flex items-center gap-1.5 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                <CheckCircle className="w-4 h-4" />
                Submitted
              </span>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
          <button
            type="button"
            onClick={() => switchMode('full')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'full'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Full Report
          </button>
          <button
            type="button"
            onClick={() => switchMode('quick')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'quick'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            Quick Report
          </button>
        </div>

        {/* Alerts */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Pre-fill Banner */}
        {showPrefillBanner && mode === 'full' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pre-filled from yesterday's plan. You can edit or clear it.
            </span>
            <button onClick={dismissPrefill} className="text-blue-500 hover:text-blue-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Google Workspace Suggestions (Calendar, Tasks, Email, Chat) */}
        {!existingReport && (
          <GoogleSuggestions
            onAddTasks={(items) => {
              if (mode === 'quick') {
                const text = items.map((i) => i.description).join('\n');
                setQuickText((prev) => (prev ? prev + '\n' + text : text));
              } else {
                // Add each item as a separate task row
                const newTasks = items.map((i) => ({ description: i.description, hours: '' }));
                // Fill empty task slots first, then append
                const updated = [...tasks];
                let remaining = [...newTasks];
                for (let i = 0; i < updated.length && remaining.length > 0; i++) {
                  if (!updated[i].description.trim()) {
                    updated[i] = remaining.shift();
                  }
                }
                setTasks([...updated, ...remaining]);
              }
            }}
          />
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'quick' ? (
            /* Quick Mode */
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Quick summary of today's work..."
                  required
                />
                <button
                  type="submit"
                  disabled={loading || !quickText.trim()}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-4 h-4" />
                  {loading ? '...' : 'Submit'}
                </button>
              </div>

              {/* Recent Activities Chips */}
              {recentActivities.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Recent activities (click to reuse):</p>
                  <div className="flex flex-wrap gap-2">
                    {recentActivities.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => useRecentActivity(r.activities)}
                        className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors max-w-[250px] truncate"
                        title={r.activities}
                      >
                        {r.reportDate}: {r.activities.substring(0, 60)}{r.activities.length > 60 ? '...' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Full Mode */
            <div className="space-y-5">
              {/* Task-based Activities with Hours */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Today's Tasks & Hours <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addTask}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Task
                  </button>
                </div>

                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={task.description}
                          onChange={(e) => { updateTask(index, 'description', e.target.value); setShowPrefillBanner(false); }}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                          placeholder={`Task ${index + 1} — e.g., Client meeting, Code review...`}
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          value={task.hours}
                          onChange={(e) => updateTask(index, 'hours', e.target.value)}
                          className="w-full px-2 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-center"
                          placeholder="Hrs"
                          min="0"
                          max="24"
                          step="0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTask(index)}
                        disabled={tasks.length === 1}
                        className="p-2.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:hover:text-slate-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total hours bar */}
                {totalHours > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      {tasks.filter(t => t.description.trim()).length} task(s) logged
                    </span>
                    <span className={`font-semibold ${totalHours > 10 ? 'text-amber-600' : 'text-blue-600'}`}>
                      Total: {totalHours}h
                    </span>
                  </div>
                )}
              </div>

              {/* Recent Activities Chips (Full Mode) */}
              {recentActivities.length > 0 && !existingReport && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Recent activities (click to reuse):</p>
                  <div className="flex flex-wrap gap-2">
                    {recentActivities.map((r, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => useRecentActivity(r.activities)}
                        className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors max-w-[250px] truncate"
                        title={r.activities}
                      >
                        {r.reportDate}: {r.activities.substring(0, 50)}...
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Challenges Faced <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={challenges}
                  onChange={(e) => setChallenges(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Any blockers or challenges..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Plan for Tomorrow <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={planTomorrow}
                  onChange={(e) => setPlanTomorrow(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="What do you plan to work on tomorrow..."
                />
              </div>

              <button
                type="submit"
                disabled={loading || tasks.every(t => !t.description.trim())}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {existingReport ? <Edit3 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {loading ? 'Submitting...' : existingReport ? 'Update Report' : 'Submit Report'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
