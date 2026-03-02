import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  ClipboardList, Plus, Edit, Eye, Search, Filter, X, Loader2,
  ToggleLeft, ToggleRight, ChevronUp, ChevronDown, Trash2,
  BarChart3, Star, CheckCircle, AlertCircle, Calendar, Building2,
  MessageSquare, Hash, Type, ListChecks, ThumbsUp, Save, Users,
} from 'lucide-react';

const SURVEY_TYPES = [
  { value: 'pulse', label: 'Pulse', color: 'bg-blue-100 text-blue-700' },
  { value: 'engagement', label: 'Engagement', color: 'bg-purple-100 text-purple-700' },
  { value: 'exit', label: 'Exit', color: 'bg-red-100 text-red-700' },
  { value: 'custom', label: 'Custom', color: 'bg-slate-100 text-slate-700' },
];

const QUESTION_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'rating', label: 'Rating (1-5)', icon: Star },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks },
  { value: 'yes_no', label: 'Yes / No', icon: ThumbsUp },
];

function getTypeBadge(type) {
  return SURVEY_TYPES.find(t => t.value === type) || SURVEY_TYPES[3];
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function getSurveyStatus(survey) {
  if (!survey.isActive) return { label: 'Inactive', color: 'bg-slate-100 text-slate-600' };
  if (survey.expiresAt && new Date(survey.expiresAt) < new Date()) {
    return { label: 'Expired', color: 'bg-red-100 text-red-600' };
  }
  return { label: 'Active', color: 'bg-green-100 text-green-700' };
}

// ─── Results Components ───────────────────────────────────────

function RatingResult({ question, responses }) {
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  let sum = 0;
  responses.forEach(r => {
    const v = parseInt(r, 10);
    if (v >= 1 && v <= 5) {
      counts[v - 1]++;
      total++;
      sum += v;
    }
  });
  const avg = total > 0 ? (sum / total).toFixed(1) : '0.0';
  const max = Math.max(...counts, 1);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Star className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-slate-700">Average: {avg} / 5</span>
        <span className="text-xs text-slate-400">({total} responses)</span>
      </div>
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map(star => (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-right text-slate-500">{star}</span>
            <Star className="w-3 h-3 text-amber-400" />
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${(counts[star - 1] / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-slate-500">{counts[star - 1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultipleChoiceResult({ question, responses }) {
  const optionCounts = {};
  (question.options || []).forEach(o => { optionCounts[o] = 0; });
  responses.forEach(r => { if (optionCounts[r] !== undefined) optionCounts[r]++; });
  const total = responses.length || 1;
  const max = Math.max(...Object.values(optionCounts), 1);

  return (
    <div className="space-y-2">
      {Object.entries(optionCounts).map(([option, count]) => (
        <div key={option} className="flex items-center gap-2 text-sm">
          <span className="w-32 truncate text-slate-600">{option}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 text-right text-xs text-slate-500">
            {count} ({Math.round((count / total) * 100)}%)
          </span>
        </div>
      ))}
    </div>
  );
}

function YesNoResult({ responses }) {
  let yes = 0;
  let no = 0;
  responses.forEach(r => {
    const v = r?.toLowerCase();
    if (v === 'yes') yes++;
    else if (v === 'no') no++;
  });
  const total = yes + no || 1;
  const yesPct = Math.round((yes / total) * 100);

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Yes: {yesPct}%</span>
          <span>No: {100 - yesPct}%</span>
        </div>
        <div className="w-full bg-red-200 rounded-full h-5 overflow-hidden">
          <div
            className="h-full bg-green-400 rounded-full transition-all duration-300"
            style={{ width: `${yesPct}%` }}
          />
        </div>
      </div>
      <div className="text-xs text-slate-400">{yes + no} responses</div>
    </div>
  );
}

function TextResult({ responses, isAnonymous }) {
  if (!responses.length) {
    return <p className="text-sm text-slate-400 italic">No text responses yet.</p>;
  }
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {responses.map((r, i) => (
        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700 border border-slate-100">
          {isAnonymous ? (
            <span className="text-xs text-slate-400 mr-2">Anonymous #{i + 1}:</span>
          ) : null}
          {r}
        </div>
      ))}
    </div>
  );
}

// ─── Question Builder Sub-Component ────────────────────────────

function QuestionBuilder({ questions, setQuestions }) {
  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: Date.now(),
      text: '',
      type: 'text',
      options: [],
      required: true,
    }]);
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
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

  const addOption = (qIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...(q.options || []), ''] };
    }));
  };

  const updateOption = (qIdx, oIdx, value) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const removeOption = (qIdx, oIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.filter((_, j) => j !== oIdx) };
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Questions</h4>
        <button
          type="button"
          onClick={addQuestion}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      {questions.length === 0 && (
        <p className="text-xs text-slate-400 italic py-4 text-center">
          No questions yet. Click &quot;Add Question&quot; to start building.
        </p>
      )}

      {questions.map((q, idx) => {
        const typeInfo = QUESTION_TYPES.find(t => t.value === q.type) || QUESTION_TYPES[0];
        const TypeIcon = typeInfo.icon;

        return (
          <div
            key={q.id || idx}
            className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2"
          >
            {/* Header with ordering and delete */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 w-6">#{idx + 1}</span>
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
              value={q.text}
              onChange={e => updateQuestion(idx, 'text', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />

            {/* Type selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {QUESTION_TYPES.map(t => {
                const Icon = t.icon;
                const selected = q.type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => updateQuestion(idx, 'type', t.value)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Options for multiple choice */}
            {q.type === 'multiple_choice' && (
              <div className="pl-6 space-y-1.5">
                <label className="text-xs text-slate-500 font-medium">Options:</label>
                {(q.options || []).map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 w-4">{oIdx + 1}.</span>
                    <input
                      type="text"
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt}
                      onChange={e => updateOption(idx, oIdx, e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx, oIdx)}
                      className="text-red-400 hover:text-red-600 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(idx)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Option
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main SurveyManager Component ──────────────────────────────

export default function SurveyManager() {
  // List state
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('pulse');
  const [formAnonymous, setFormAnonymous] = useState(false);
  const [formExpiry, setFormExpiry] = useState('');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formQuestions, setFormQuestions] = useState([]);

  // Companies
  const [companies, setCompanies] = useState([]);

  // Results view state
  const [viewingResults, setViewingResults] = useState(null);
  const [results, setResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  // ── Fetchers ──

  const fetchSurveys = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/surveys/admin/all');
      setSurveys(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch surveys.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchSurveys();
    fetchCompanies();
  }, [fetchSurveys, fetchCompanies]);

  // ── Form helpers ──

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormType('pulse');
    setFormAnonymous(false);
    setFormExpiry('');
    setFormCompanyId('');
    setFormQuestions([]);
    setEditingSurvey(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (survey) => {
    setEditingSurvey(survey);
    setFormTitle(survey.title || '');
    setFormDescription(survey.description || '');
    setFormType(survey.type || 'custom');
    setFormAnonymous(survey.isAnonymous || false);
    setFormExpiry(survey.expiresAt ? survey.expiresAt.slice(0, 10) : '');
    setFormCompanyId(survey.companyId ? String(survey.companyId) : '');
    setFormQuestions(
      (survey.questions || []).map((q, i) => ({
        id: q.id || Date.now() + i,
        text: q.text || '',
        type: q.type || 'text',
        options: q.options || [],
        required: q.required !== false,
      }))
    );
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setError('Survey title is required.');
      return;
    }
    if (formQuestions.length === 0) {
      setError('Add at least one question.');
      return;
    }
    const emptyQ = formQuestions.find(q => !q.text.trim());
    if (emptyQ) {
      setError('All questions must have text.');
      return;
    }
    const badMC = formQuestions.find(
      q => q.type === 'multiple_choice' && (!q.options || q.options.filter(o => o.trim()).length < 2)
    );
    if (badMC) {
      setError('Multiple choice questions need at least 2 options.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        type: formType,
        isAnonymous: formAnonymous,
        expiresAt: formExpiry || null,
        companyId: formCompanyId ? parseInt(formCompanyId, 10) : null,
        questions: formQuestions.map((q, i) => ({
          text: q.text.trim(),
          type: q.type,
          options: q.type === 'multiple_choice' ? q.options.filter(o => o.trim()) : [],
          required: q.required,
          order: i,
        })),
      };

      if (editingSurvey) {
        await api.put(`/surveys/${editingSurvey.id}`, payload);
      } else {
        await api.post('/surveys', payload);
      }

      setShowForm(false);
      resetForm();
      fetchSurveys();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save survey.');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──

  const toggleActive = async (survey) => {
    try {
      await api.put(`/surveys/${survey.id}`, { isActive: !survey.isActive });
      fetchSurveys();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update survey.');
    }
  };

  // ── Results ──

  const openResults = async (survey) => {
    setViewingResults(survey);
    setResultsLoading(true);
    try {
      const res = await api.get(`/surveys/${survey.id}/results`);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load results.');
    } finally {
      setResultsLoading(false);
    }
  };

  const closeResults = () => {
    setViewingResults(null);
    setResults(null);
  };

  // ── Filtering ──

  const filtered = surveys.filter(s => {
    const matchesSearch =
      !searchQuery ||
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || s.type === filterType;
    return matchesSearch && matchesType;
  });

  // ── Results View ──

  if (viewingResults) {
    const survey = viewingResults;
    const status = getSurveyStatus(survey);
    const typeBadge = getTypeBadge(survey.type);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={closeResults}
              className="text-sm text-blue-600 hover:text-blue-700 mb-1 flex items-center gap-1"
            >
              <ChevronUp className="w-3.5 h-3.5 rotate-[-90deg]" /> Back to Surveys
            </button>
            <h2 className="text-xl font-bold text-slate-800">{survey.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                {typeBadge.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                {status.label}
              </span>
              {survey.isAnonymous && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Anonymous
                </span>
              )}
            </div>
          </div>
        </div>

        {resultsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : results ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="text-xs text-slate-500 mb-1">Total Responses</div>
                <div className="text-2xl font-bold text-slate-800">
                  {results.totalResponses ?? 0}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="text-xs text-slate-500 mb-1">Response Rate</div>
                <div className="text-2xl font-bold text-slate-800">
                  {results.responseRate != null ? `${results.responseRate}%` : '--'}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="text-xs text-slate-500 mb-1">Questions</div>
                <div className="text-2xl font-bold text-slate-800">
                  {results.questions?.length ?? 0}
                </div>
              </div>
            </div>

            {/* Per-question results */}
            <div className="space-y-4">
              {(results.questions || []).map((q, idx) => (
                <div key={q.id || idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-xs font-bold text-slate-400 mt-0.5">Q{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{q.text}</p>
                      <span className="text-xs text-slate-400">{q.type}</span>
                    </div>
                  </div>
                  <div className="pl-7">
                    {q.type === 'rating' && (
                      <RatingResult question={q} responses={q.responses || []} />
                    )}
                    {q.type === 'multiple_choice' && (
                      <MultipleChoiceResult question={q} responses={q.responses || []} />
                    )}
                    {q.type === 'yes_no' && (
                      <YesNoResult responses={q.responses || []} />
                    )}
                    {q.type === 'text' && (
                      <TextResult responses={q.responses || []} isAnonymous={survey.isAnonymous} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">No results data available.</div>
        )}
      </div>
    );
  }

  // ── Main List View ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" />
            Survey Manager
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage employee surveys</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Survey
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search surveys..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
            showFilters || filterType
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Type:</span>
          <button
            onClick={() => setFilterType('')}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              !filterType ? 'bg-blue-100 text-blue-700' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            All
          </button>
          {SURVEY_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`px-2 py-1 rounded-md text-xs font-medium ${
                filterType === t.value ? t.color : 'bg-white text-slate-500 border border-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {searchQuery || filterType ? 'No surveys match your filters.' : 'No surveys created yet.'}
          </p>
        </div>
      ) : (
        /* Survey Table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Survey
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(survey => {
                  const typeBadge = getTypeBadge(survey.type);
                  const status = getSurveyStatus(survey);
                  return (
                    <tr key={survey.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{survey.title}</div>
                        {survey.description && (
                          <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                            {survey.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="flex items-center justify-center gap-1 text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {survey._count?.responses ?? survey.responseCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(survey.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openResults(survey)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Results"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(survey)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(survey)}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={survey.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {survey.isActive ? (
                              <ToggleRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="w-4 h-4" />
                            )}
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

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingSurvey ? 'Edit Survey' : 'Create Survey'}
              </h3>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Q1 Employee Engagement Survey"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description of the survey purpose..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Type & Anonymous row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Survey Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {SURVEY_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => setFormAnonymous(!formAnonymous)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors w-full justify-center ${
                      formAnonymous
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {formAnonymous ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                    Anonymous
                  </button>
                </div>
              </div>

              {/* Expiry & Company row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Expiry Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={e => setFormExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    <Building2 className="w-3 h-3 inline mr-1" />
                    Company (optional)
                  </label>
                  <select
                    value={formCompanyId}
                    onChange={e => setFormCompanyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 pt-4">
                <QuestionBuilder questions={formQuestions} setQuestions={setFormQuestions} />
              </div>
            </div>

            {/* Modal footer */}
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
                {editingSurvey ? 'Update Survey' : 'Create Survey'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
