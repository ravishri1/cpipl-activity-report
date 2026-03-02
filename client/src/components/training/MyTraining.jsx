import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap, BookOpen, Clock, Award, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Loader2, Search, Filter, Play, Send,
  Star, Target, TrendingUp, XCircle, Timer, ArrowLeft, X,
  Shield, Cpu, Users, Lightbulb, Sparkles, BookMarked,
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All', color: 'bg-slate-100 text-slate-700', icon: BookOpen },
  { value: 'general', label: 'General', color: 'bg-blue-100 text-blue-700', icon: BookMarked },
  { value: 'compliance', label: 'Compliance', color: 'bg-red-100 text-red-700', icon: Shield },
  { value: 'technical', label: 'Technical', color: 'bg-purple-100 text-purple-700', icon: Cpu },
  { value: 'soft_skills', label: 'Soft Skills', color: 'bg-amber-100 text-amber-700', icon: Users },
  { value: 'ai', label: 'AI', color: 'bg-emerald-100 text-emerald-700', icon: Sparkles },
  { value: 'onboarding', label: 'Onboarding', color: 'bg-cyan-100 text-cyan-700', icon: Lightbulb },
];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'passed', label: 'Passed' },
];

function getCategoryBadge(category) {
  return CATEGORIES.find(c => c.value === category) || CATEGORIES[1];
}

function formatDuration(minutes) {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ---- Exam Timer Component ----

function ExamTimer({ timeLimit, onTimeUp }) {
  const [secondsLeft, setSecondsLeft] = useState(timeLimit * 60);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [timeLimit, onTimeUp]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isLow = secondsLeft < 60;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium ${
      isLow ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-700'
    }`}>
      <Timer className="w-4 h-4" />
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ---- Exam UI Component ----

function ExamView({ module, onClose, onCompleted }) {
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const startTimeRef = useRef(Date.now());

  const fetchExam = useCallback(async () => {
    try {
      setError('');
      const res = await api.get(`/training/exams/${module.id}`);
      setExam(res.data);
      setAnswers({});
      startTimeRef.current = Date.now();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load exam.');
    } finally {
      setLoading(false);
    }
  }, [module.id]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const handleAnswer = (questionIndex, optionIndex) => {
    if (result) return;
    setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = useCallback(async () => {
    if (submitting || result) return;

    const unanswered = (exam?.questions || []).filter((_, i) => answers[i] === undefined);
    if (unanswered.length > 0) {
      setError(`Please answer all questions. ${unanswered.length} remaining.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      const res = await api.post('/training/attempts', {
        examId: exam.id,
        answers: JSON.stringify(answers),
        timeSpent,
      });
      setResult(res.data);
      if (onCompleted) onCompleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit exam.');
    } finally {
      setSubmitting(false);
    }
  }, [exam, answers, submitting, result, onCompleted]);

  const handleTimeUp = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200">
            Close
          </button>
        </div>
      </div>
    );
  }

  const totalQuestions = exam?.questions?.length || 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-4 bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl border border-slate-200">
        {/* Exam Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{exam?.title || module.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalQuestions} questions {exam?.passingScore ? ` | Passing: ${exam.passingScore}%` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {exam?.timeLimit && !result && (
              <ExamTimer timeLimit={exam.timeLimit} onTimeUp={handleTimeUp} />
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Result Banner */}
        {result && (
          <div className={`px-6 py-4 border-b ${
            result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {result.passed ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
              <div>
                <p className={`text-sm font-semibold ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                  {result.passed ? 'Congratulations! You Passed!' : 'Not Passed - Try Again'}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Score: <span className="font-bold">{result.score}%</span>
                  {result.passingScore ? ` (Required: ${result.passingScore}%)` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Questions */}
        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {(exam?.questions || []).map((q, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
              <div className="flex items-start gap-3 mb-3">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  answers[idx] !== undefined
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">{q.question}</p>
                  {q.points && <span className="text-xs text-slate-400">{q.points} pts</span>}
                </div>
              </div>
              <div className="pl-10 space-y-2">
                {(q.options || []).map((option, oIdx) => {
                  const isSelected = answers[idx] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswer(idx, oIdx)}
                      disabled={!!result}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all border ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      } ${result ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full mr-2.5 text-xs font-medium ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <div className="text-xs text-slate-500">
            {answeredCount}/{totalQuestions} answered
          </div>
          <div className="flex items-center gap-3">
            {result ? (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || answeredCount < totalQuestions}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Exam
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main MyTraining Component ----

export default function MyTraining() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedModuleId, setExpandedModuleId] = useState(null);
  const [examModule, setExamModule] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [modulesRes, progressRes] = await Promise.all([
        api.get('/training/modules'),
        api.get('/training/my-progress'),
      ]);
      setModules(modulesRes.data);
      setProgress(progressRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load training data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (moduleId) => {
    setExpandedModuleId(prev => prev === moduleId ? null : moduleId);
  };

  const getModuleStatus = (mod) => {
    if (!mod.myAttempts || mod.myAttempts.length === 0) {
      return { label: 'Not Started', color: 'text-slate-400', bg: 'bg-slate-100 text-slate-600' };
    }
    const passed = mod.myAttempts.some(a => a.passed);
    if (passed) {
      return { label: 'Passed', color: 'text-green-600', bg: 'bg-green-100 text-green-700' };
    }
    return { label: 'Attempted', color: 'text-amber-600', bg: 'bg-amber-100 text-amber-700' };
  };

  const getBestScore = (mod) => {
    if (!mod.myAttempts || mod.myAttempts.length === 0) return null;
    return Math.max(...mod.myAttempts.map(a => a.score || 0));
  };

  // Filter modules
  const filtered = modules.filter(mod => {
    const matchesSearch = !searchQuery ||
      mod.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mod.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !categoryFilter || mod.category === categoryFilter;

    let matchesStatus = true;
    if (statusFilter) {
      const status = getModuleStatus(mod);
      if (statusFilter === 'not_started') matchesStatus = status.label === 'Not Started';
      else if (statusFilter === 'attempted') matchesStatus = status.label === 'Attempted';
      else if (statusFilter === 'passed') matchesStatus = status.label === 'Passed';
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-blue-600" />
          My Training
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Learn, practice, and earn certifications</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Progress Overview */}
      {progress && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-slate-500 font-medium">Total Modules</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{progress.totalModules ?? 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs text-slate-500 font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold text-green-600">{progress.completed ?? 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-slate-500 font-medium">Mandatory Pending</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{progress.mandatoryPending ?? 0}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-slate-500 font-medium">Overall Score</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {progress.overallScore != null ? `${progress.overallScore}%` : '--'}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search training modules..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const isActive = categoryFilter === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? cat.color + ' ring-1 ring-current/20'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500">Status:</span>
        {STATUS_FILTERS.map(sf => (
          <button
            key={sf.value}
            onClick={() => setStatusFilter(sf.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              statusFilter === sf.value
                ? 'bg-blue-100 text-blue-700'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Module Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {searchQuery || categoryFilter || statusFilter
              ? 'No training modules match your filters.'
              : 'No training modules available yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(mod => {
            const cat = getCategoryBadge(mod.category);
            const CatIcon = cat.icon;
            const status = getModuleStatus(mod);
            const bestScore = getBestScore(mod);
            const isExpanded = expandedModuleId === mod.id;

            return (
              <div
                key={mod.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Card Header */}
                <button
                  onClick={() => toggleExpand(mod.id)}
                  className="w-full px-5 py-4 flex items-start gap-4 text-left"
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cat.color}`}>
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-800">{mod.title}</h3>
                      {mod.isMandatory && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-wider">
                          Mandatory
                        </span>
                      )}
                    </div>
                    {mod.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{mod.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                        {cat.label}
                      </span>
                      {mod.duration && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" /> {formatDuration(mod.duration)}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg}`}>
                        {status.label}
                      </span>
                      {bestScore !== null && (
                        <span className="flex items-center gap-1 text-xs text-slate-600">
                          <Star className="w-3 h-3 text-amber-500" /> Best: {bestScore}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-slate-100">
                    {/* Module Content */}
                    {mod.content && (
                      <div className="mt-4 mb-4">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          Training Material
                        </h4>
                        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto border border-slate-100">
                          {mod.content}
                        </div>
                      </div>
                    )}

                    {/* Attempt History */}
                    {mod.myAttempts && mod.myAttempts.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          My Attempts
                        </h4>
                        <div className="space-y-1.5">
                          {mod.myAttempts.map((attempt, idx) => (
                            <div
                              key={attempt.id || idx}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                attempt.passed
                                  ? 'bg-green-50 border border-green-100'
                                  : 'bg-slate-50 border border-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {attempt.passed ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                )}
                                <span className="text-slate-600">
                                  Score: <span className="font-semibold">{attempt.score}%</span>
                                </span>
                              </div>
                              <span className="text-slate-400">{formatDate(attempt.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Take Exam Button */}
                    {mod.hasExam !== false && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExamModule(mod);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        {mod.myAttempts && mod.myAttempts.length > 0 ? 'Retake Exam' : 'Take Exam'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Exam Modal */}
      {examModule && (
        <ExamView
          module={examModule}
          onClose={() => setExamModule(null)}
          onCompleted={fetchData}
        />
      )}
    </div>
  );
}
