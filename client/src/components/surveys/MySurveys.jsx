import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  ClipboardList, CheckCircle, Clock, Star, ArrowLeft, Loader2,
  AlertCircle, Send, MessageSquare, ThumbsUp, ListChecks, Type,
  Calendar, Shield, X,
} from 'lucide-react';

const SURVEY_TYPES = [
  { value: 'pulse', label: 'Pulse', color: 'bg-blue-100 text-blue-700' },
  { value: 'engagement', label: 'Engagement', color: 'bg-purple-100 text-purple-700' },
  { value: 'exit', label: 'Exit', color: 'bg-red-100 text-red-700' },
  { value: 'custom', label: 'Custom', color: 'bg-slate-100 text-slate-700' },
];

function getTypeBadge(type) {
  return SURVEY_TYPES.find(t => t.value === type) || SURVEY_TYPES[3];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── Star Rating Input ────────────────────────────────────────

function StarRating({ value, onChange, readOnly }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => {
        const active = star <= (hover || value);
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(star)}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => !readOnly && setHover(0)}
            className={`p-0.5 transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                active
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200'
              }`}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm font-medium text-slate-500">{value}/5</span>
      )}
    </div>
  );
}

// ─── Yes/No Toggle Input ──────────────────────────────────────

function YesNoToggle({ value, onChange, readOnly }) {
  return (
    <div className="flex items-center gap-2">
      {['Yes', 'No'].map(option => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange(option)}
            className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selected
                ? option === 'Yes'
                  ? 'bg-green-100 border-green-300 text-green-700'
                  : 'bg-red-100 border-red-300 text-red-700'
                : readOnly
                  ? 'bg-slate-50 border-slate-200 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer'
            } ${readOnly ? 'cursor-default' : ''}`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function MySurveys() {
  const { user } = useAuth();

  // List state
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active survey state
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [surveyDetail, setSurveyDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Fetch survey list ──

  const fetchSurveys = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/surveys');
      setSurveys(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load surveys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  // ── Open a survey ──

  const openSurvey = async (survey) => {
    setActiveSurvey(survey);
    setDetailLoading(true);
    setSubmitted(false);
    setAnswers({});
    try {
      const res = await api.get(`/surveys/${survey.id}`);
      setSurveyDetail(res.data);

      // If already responded, pre-fill answers as read-only
      if (res.data.myResponse) {
        const prefilled = {};
        (res.data.myResponse.answers || []).forEach(a => {
          prefilled[a.questionId] = a.value;
        });
        setAnswers(prefilled);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load survey.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeSurvey = () => {
    setActiveSurvey(null);
    setSurveyDetail(null);
    setAnswers({});
    setSubmitted(false);
  };

  // ── Set an answer ──

  const setAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // ── Submit ──

  const handleSubmit = async () => {
    if (!surveyDetail) return;

    // Validate required questions
    const required = (surveyDetail.questions || []).filter(q => q.required !== false);
    const missing = required.find(q => !answers[q.id] && answers[q.id] !== 0);
    if (missing) {
      setError(`Please answer: "${missing.text}"`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId: parseInt(questionId, 10) || questionId,
          value: String(value),
        })),
      };
      await api.post(`/surveys/${surveyDetail.id}/respond`, payload);
      setSubmitted(true);
      fetchSurveys(); // refresh list badges
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit survey.');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyResponded = surveyDetail?.myResponse != null;
  const isReadOnly = alreadyResponded || submitted;

  // ─── Take Survey View ──────────────────────────────────────

  if (activeSurvey) {
    const typeBadge = getTypeBadge(activeSurvey.type);

    // Success state after submission
    if (submitted) {
      return (
        <div className="space-y-6">
          <button
            onClick={closeSurvey}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Surveys
          </button>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Response Submitted</h3>
            <p className="text-sm text-slate-500 text-center max-w-md">
              Thank you for completing the survey
              {activeSurvey.isAnonymous ? '. Your response is anonymous.' : '.'}
            </p>
            <button
              onClick={closeSurvey}
              className="mt-6 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Surveys
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={closeSurvey}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Surveys
        </button>

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

        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : surveyDetail ? (
          <>
            {/* Survey header card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{surveyDetail.title}</h2>
                  {surveyDetail.description && (
                    <p className="text-sm text-slate-500 mt-1">{surveyDetail.description}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                  {typeBadge.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                {surveyDetail.isAnonymous && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> Anonymous
                  </span>
                )}
                {surveyDetail.expiresAt && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" /> Due: {formatDate(surveyDetail.expiresAt)}
                  </span>
                )}
                {alreadyResponded && (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Already Submitted
                  </span>
                )}
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-4">
              {(surveyDetail.questions || []).map((q, idx) => (
                <div key={q.id || idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-xs font-bold text-blue-500 bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">
                        {q.text}
                        {q.required !== false && (
                          <span className="text-red-400 ml-0.5">*</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="pl-9">
                    {/* Text question */}
                    {q.type === 'text' && (
                      <textarea
                        value={answers[q.id] || ''}
                        onChange={e => setAnswer(q.id, e.target.value)}
                        disabled={isReadOnly}
                        placeholder="Type your answer..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    )}

                    {/* Rating question */}
                    {q.type === 'rating' && (
                      <StarRating
                        value={parseInt(answers[q.id], 10) || 0}
                        onChange={val => setAnswer(q.id, val)}
                        readOnly={isReadOnly}
                      />
                    )}

                    {/* Multiple choice question */}
                    {q.type === 'multiple_choice' && (
                      <div className="space-y-2">
                        {(q.options || []).map((opt, oIdx) => {
                          const selected = answers[q.id] === opt;
                          return (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-blue-50 border-blue-300'
                                  : isReadOnly
                                    ? 'bg-slate-50 border-slate-100'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                              } ${isReadOnly ? 'cursor-default' : ''}`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={selected}
                                onChange={() => !isReadOnly && setAnswer(q.id, opt)}
                                disabled={isReadOnly}
                                className="accent-blue-600"
                              />
                              <span className={`text-sm ${selected ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
                                {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Yes/No question */}
                    {q.type === 'yes_no' && (
                      <YesNoToggle
                        value={answers[q.id] || ''}
                        onChange={val => setAnswer(q.id, val)}
                        readOnly={isReadOnly}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Submit button */}
            {!isReadOnly && (
              <div className="flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Response
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-slate-400 text-sm">Survey not found.</div>
        )}
      </div>
    );
  }

  // ─── Survey List View ──────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-600" />
          My Surveys
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">View and respond to surveys</p>
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

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No surveys available right now.</p>
        </div>
      ) : (
        /* Survey cards */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surveys.map(survey => {
            const typeBadge = getTypeBadge(survey.type);
            const hasResponded = survey.hasResponded || survey.responded;
            const isExpired = survey.expiresAt && new Date(survey.expiresAt) < new Date();

            return (
              <div
                key={survey.id}
                onClick={() => openSurvey(survey)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
              >
                {/* Top row: title + type */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors line-clamp-2 flex-1 mr-2">
                    {survey.title}
                  </h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${typeBadge.color}`}>
                    {typeBadge.label}
                  </span>
                </div>

                {/* Description */}
                {survey.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                    {survey.description}
                  </p>
                )}

                {/* Bottom row: status badges + deadline */}
                <div className="flex items-center gap-2 flex-wrap">
                  {hasResponded ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Completed
                    </span>
                  ) : isExpired ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Expired
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}

                  {survey.isAnonymous && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Shield className="w-3 h-3" /> Anonymous
                    </span>
                  )}

                  {survey.expiresAt && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                      <Calendar className="w-3 h-3" /> {formatDate(survey.expiresAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
