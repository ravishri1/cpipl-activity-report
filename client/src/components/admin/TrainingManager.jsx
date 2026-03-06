import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap, Plus, Edit, Eye, Search, Filter, X, Loader2,
  ToggleLeft, ToggleRight, ChevronUp, ChevronDown, Trash2,
  BarChart3, CheckCircle, AlertCircle, Save, Users, BookOpen,
  Clock, Award, Target, TrendingUp, FileText, Star, Shield,
  Cpu, Lightbulb, Sparkles, BookMarked, Hash, ArrowLeft,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-blue-100 text-blue-700', icon: BookMarked },
  { value: 'compliance', label: 'Compliance', color: 'bg-red-100 text-red-700', icon: Shield },
  { value: 'technical', label: 'Technical', color: 'bg-purple-100 text-purple-700', icon: Cpu },
  { value: 'soft_skills', label: 'Soft Skills', color: 'bg-amber-100 text-amber-700', icon: Users },
  { value: 'ai', label: 'AI', color: 'bg-emerald-100 text-emerald-700', icon: Sparkles },
  { value: 'onboarding', label: 'Onboarding', color: 'bg-cyan-100 text-cyan-700', icon: Lightbulb },
];

function getCategoryBadge(category) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatDuration(minutes) {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---- Exam Question Builder ----

function ExamQuestionBuilder({ questions, setQuestions }) {
  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: Date.now(),
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      points: 1,
    }]);
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const addOption = (qIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...q.options, ''] };
    }));
  };

  const removeOption = (qIdx, oIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = q.options.filter((_, j) => j !== oIdx);
      const correct = q.correctAnswer >= oIdx && q.correctAnswer > 0
        ? q.correctAnswer - 1
        : q.correctAnswer;
      return { ...q, options: opts, correctAnswer: Math.min(correct, opts.length - 1) };
    }));
  };

  const removeQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const moveQuestion = (idx, direction) => {
    setQuestions(prev => {
      const arr = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-500" />
          Exam Questions
        </h4>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-lg">
          No exam questions yet. Click "Add Question" to start building the exam.
        </p>
      )}

      {questions.map((q, idx) => (
        <div
          key={q.id || idx}
          className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 w-6">Q{idx + 1}</span>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => moveQuestion(idx, -1)}
                disabled={idx === 0}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveQuestion(idx, 1)}
                disabled={idx === questions.length - 1}
                className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1" />
            {/* Points */}
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500" />
              <input
                type="number"
                min={1}
                max={100}
                value={q.points}
                onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value) || 1)}
                className="w-14 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-center"
              />
              <span className="text-xs text-slate-400">pts</span>
            </div>
            <button
              type="button"
              onClick={() => removeQuestion(idx)}
              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Question text */}
          <input
            type="text"
            placeholder="Enter question text..."
            value={q.question}
            onChange={e => updateQuestion(idx, 'question', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />

          {/* Options */}
          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-medium">
              Options (click radio to set correct answer):
            </label>
            {(q.options || []).map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQuestion(idx, 'correctAnswer', oIdx)}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    q.correctAnswer === oIdx
                      ? 'border-green-500 bg-green-500'
                      : 'border-slate-300 hover:border-green-400'
                  }`}
                  title={q.correctAnswer === oIdx ? 'Correct answer' : 'Set as correct answer'}
                >
                  {q.correctAnswer === oIdx && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </button>
                <span className="text-xs text-slate-400 w-4 font-medium">
                  {String.fromCharCode(65 + oIdx)}
                </span>
                <input
                  type="text"
                  placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                  value={opt}
                  onChange={e => updateOption(idx, oIdx, e.target.value)}
                  className={`flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${
                    q.correctAnswer === oIdx
                      ? 'border-green-300 bg-green-50'
                      : 'border-slate-200'
                  }`}
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx, oIdx)}
                    className="text-red-400 hover:text-red-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {q.options.length < 6 && (
              <button
                type="button"
                onClick={() => addOption(idx)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 ml-11"
              >
                <Plus className="w-3 h-3" /> Add Option
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Attempts Viewer ----

function AttemptsViewer({ module, onClose }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await api.get(`/training/attempts/module/${module.id}`);
        setAttempts(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load attempts.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, [module.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Exam Attempts</h3>
            <p className="text-xs text-slate-500 mt-0.5">{module.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No attempts recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts.map((a, idx) => (
                    <tr key={a.id || idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-700">
                        {a.user?.name || a.userName || 'Unknown'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`font-semibold ${
                          a.score >= 80 ? 'text-green-600' : a.score >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {a.score}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {a.passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" /> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            <X className="w-3 h-3" /> Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {formatDate(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Main TrainingManager Component ----

export default function TrainingManager() {
  const { user } = useAuth();

  // List state
  const [modules, setModules] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formContent, setFormContent] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formPassingScore, setFormPassingScore] = useState(70);
  const [formIsMandatory, setFormIsMandatory] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formExamQuestions, setFormExamQuestions] = useState([]);
  const [formTimeLimit, setFormTimeLimit] = useState('');

  // Attempts viewer
  const [viewingAttempts, setViewingAttempts] = useState(null);

  // ---- Fetchers ----

  const fetchModules = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/training/modules/admin');
      setModules(res.data);
    } catch (err) {
      // Fallback to regular endpoint if admin endpoint not available
      try {
        const res = await api.get('/training/modules');
        setModules(res.data);
      } catch (err2) {
        setError(err2.response?.data?.error || 'Failed to fetch training modules.');
      }
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/training/dashboard');
      setDashboard(res.data);
    } catch {
      // Non-critical, dashboard stats may not be available
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchModules(), fetchDashboard()]).finally(() => setLoading(false));
  }, [fetchModules, fetchDashboard]);

  // ---- Form Helpers ----

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('general');
    setFormContent('');
    setFormDuration('');
    setFormPassingScore(70);
    setFormIsMandatory(false);
    setFormIsActive(true);
    setFormExamQuestions([]);
    setFormTimeLimit('');
    setEditingModule(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (mod) => {
    setEditingModule(mod);
    setFormTitle(mod.title || '');
    setFormDescription(mod.description || '');
    setFormCategory(mod.category || 'general');
    setFormContent(mod.content || '');
    setFormDuration(mod.duration ? String(mod.duration) : '');
    setFormPassingScore(mod.passingScore ?? 70);
    setFormIsMandatory(mod.isMandatory || false);
    setFormIsActive(mod.isActive !== false);
    setFormTimeLimit(mod.exam?.timeLimit ? String(mod.exam.timeLimit) : '');

    // Load exam questions
    if (mod.exam?.questions) {
      setFormExamQuestions(
        mod.exam.questions.map((q, i) => ({
          id: q.id || Date.now() + i,
          question: q.question || '',
          options: q.options || ['', '', '', ''],
          correctAnswer: q.correctAnswer ?? 0,
          points: q.points ?? 1,
        }))
      );
    } else {
      setFormExamQuestions([]);
    }

    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setError('Module title is required.');
      return;
    }

    // Validate exam questions if any
    if (formExamQuestions.length > 0) {
      const emptyQ = formExamQuestions.find(q => !q.question.trim());
      if (emptyQ) {
        setError('All exam questions must have question text.');
        return;
      }
      const badOpts = formExamQuestions.find(
        q => q.options.filter(o => o.trim()).length < 2
      );
      if (badOpts) {
        setError('Each question needs at least 2 non-empty options.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        content: formContent.trim(),
        duration: formDuration ? parseInt(formDuration, 10) : null,
        passingScore: parseInt(formPassingScore, 10) || 70,
        isMandatory: formIsMandatory,
        isActive: formIsActive,
        timeLimit: formTimeLimit ? parseInt(formTimeLimit, 10) : null,
        examQuestions: formExamQuestions.map((q, i) => ({
          question: q.question.trim(),
          options: q.options.filter(o => o.trim()),
          correctAnswer: q.correctAnswer,
          points: q.points || 1,
          order: i,
        })),
      };

      if (editingModule) {
        await api.put(`/training/modules/${editingModule.id}`, payload);
      } else {
        await api.post('/training/modules', payload);
      }

      setShowForm(false);
      resetForm();
      fetchModules();
      fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save module.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle Active ----

  const toggleActive = async (mod) => {
    try {
      await api.put(`/training/modules/${mod.id}`, { isActive: !mod.isActive });
      fetchModules();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update module.');
    }
  };

  // ---- Delete Module ----

  const deleteModule = async (mod) => {
    if (!window.confirm(`Delete "${mod.title}"? This will also remove all associated exams and attempts.`)) return;
    try {
      await api.delete(`/training/modules/${mod.id}`);
      fetchModules();
      fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete module.');
    }
  };

  // ---- Filtering ----

  const filtered = modules.filter(m => {
    const matchesSearch = !searchQuery ||
      m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = !filterCategory || m.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  // ---- Render ----

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            Training Manager
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage training modules & exams</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Module
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500 font-medium">Total Modules</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{dashboard.totalModules ?? 0}</div>
            <div className="text-xs text-slate-400 mt-1">
              {dashboard.activeModules ?? 0} active
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-red-500" />
              <span className="text-xs text-slate-500 font-medium">Mandatory</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{dashboard.mandatoryModules ?? 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-green-500" />
              <span className="text-xs text-slate-500 font-medium">Total Attempts</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{dashboard.totalAttempts ?? 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500 font-medium">Avg Pass Rate</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {dashboard.avgPassRate != null ? `${dashboard.avgPassRate}%` : '--'}
            </div>
          </div>
        </div>
      )}

      {/* Completion Rates */}
      {dashboard?.completionRates && dashboard.completionRates.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Module Completion Rates
          </h3>
          <div className="space-y-3">
            {dashboard.completionRates.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600 truncate max-w-[60%]">
                    {item.title}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {item.completionRate ?? 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (item.completionRate ?? 0) >= 80
                        ? 'bg-green-500'
                        : (item.completionRate ?? 0) >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(item.completionRate ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
            showFilters || filterCategory
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Category:</span>
          <button
            onClick={() => setFilterCategory('')}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              !filterCategory ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`px-2 py-1 rounded-md text-xs font-medium ${
                filterCategory === c.value ? c.color : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Module Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {searchQuery || filterCategory ? 'No modules match your filters.' : 'No training modules yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-16 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(mod => {
                  const cat = getCategoryBadge(mod.category);
                  return (
                    <tr key={mod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-800">{mod.title}</div>
                          {mod.isMandatory && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase">
                              Mandatory
                            </span>
                          )}
                        </div>
                        {mod.description && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                            {mod.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">
                        {mod.duration ? (
                          <span className="flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDuration(mod.duration)}
                          </span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-slate-600 font-medium">
                          {mod.exam?.questionCount ?? mod._count?.examQuestions ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          mod.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {mod.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingAttempts(mod)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Attempts"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(mod)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(mod)}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={mod.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {mod.isActive ? (
                              <ToggleRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteModule(mod)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attempts Viewer Modal */}
      {viewingAttempts && (
        <AttemptsViewer
          module={viewingAttempts}
          onClose={() => setViewingAttempts(null)}
        />
      )}

      {/* Create/Edit Module Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingModule ? 'Edit Training Module' : 'Create Training Module'}
              </h3>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Introduction to Company Policies"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description of the training module..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Category & Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    placeholder="e.g. 30"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <FileText className="w-3 h-3 inline mr-1" />
                  Training Content
                </label>
                <textarea
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="Write the training material content here. This will be shown to employees before they take the exam..."
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
                />
              </div>

              {/* Passing Score & Time Limit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    <Target className="w-3 h-3 inline mr-1" />
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formPassingScore}
                    onChange={e => setFormPassingScore(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Exam Time Limit (minutes, optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formTimeLimit}
                    onChange={e => setFormTimeLimit(e.target.value)}
                    placeholder="No limit"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFormIsMandatory(!formIsMandatory)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formIsMandatory
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {formIsMandatory ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  Mandatory
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formIsActive
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {formIsActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  Active
                </button>
              </div>

              {/* Exam Questions */}
              <div className="border-t border-slate-200 pt-5">
                <ExamQuestionBuilder
                  questions={formExamQuestions}
                  setQuestions={setFormExamQuestions}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingModule ? 'Update Module' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
