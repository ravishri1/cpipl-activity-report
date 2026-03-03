import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  FileText,
  Building2,
  PartyPopper,
  ChevronRight,
  Loader2,
  MessageSquare,
  Calendar,
  Tag,
  Info,
} from 'lucide-react';

const CATEGORY_STYLES = {
  general:    { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-400' },
  attendance: { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
  leave:      { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-400' },
  conduct:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400' },
  benefits:   { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400' },
  safety:     { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
};

function getCategoryStyle(category) {
  return CATEGORY_STYLES[category?.toLowerCase()] || CATEGORY_STYLES.general;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function renderPolicyContent(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-3" />;
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={i} className="text-sm font-semibold text-slate-700 mt-4 mb-1">
          {trimmed.slice(4)}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={i} className="text-base font-semibold text-slate-800 mt-5 mb-2">
          {trimmed.slice(3)}
        </h3>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={i} className="text-lg font-bold text-slate-900 mt-6 mb-2">
          {trimmed.slice(2)}
        </h2>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <li key={i} className="text-sm text-slate-600 leading-relaxed ml-4 list-disc">
          {trimmed.slice(2)}
        </li>
      );
    }
    return (
      <p key={i} className="text-sm text-slate-600 leading-relaxed">
        {trimmed}
      </p>
    );
  });
}

// -- Loading Skeleton --
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-48 h-7 bg-slate-200 rounded" />
        <div className="w-24 h-5 bg-slate-100 rounded-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-32 h-5 bg-slate-200 rounded" />
              <div className="w-16 h-5 bg-slate-100 rounded-full" />
            </div>
            <div className="w-full h-4 bg-slate-100 rounded" />
            <div className="w-3/4 h-4 bg-slate-100 rounded" />
            <div className="flex items-center justify-between pt-2">
              <div className="w-20 h-4 bg-slate-100 rounded" />
              <div className="w-16 h-4 bg-slate-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -- Empty State --
function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-slate-700 mb-1">No Policies Available</h3>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
        There are no active policies to review at this time. Check back later.
      </p>
    </div>
  );
}

// -- All Accepted Celebration --
function AllAcceptedState({ total }) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200 p-10 text-center">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <PartyPopper className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-emerald-800 mb-1">All Policies Accepted</h3>
      <p className="text-sm text-emerald-600 max-w-md mx-auto">
        You have reviewed and accepted all {total} {total === 1 ? 'policy' : 'policies'}. You are all up to date.
      </p>
    </div>
  );
}

// -- Error State --
function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-slate-700 mb-1">Failed to Load Policies</h3>
      <p className="text-sm text-slate-400 mb-4">{message || 'An unexpected error occurred.'}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// -- Policy Card --
function PolicyCard({ policy, onClick }) {
  const catStyle = getCategoryStyle(policy.category);
  const isAccepted = !!policy.acceptedAt;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left w-full group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className={`w-5 h-5 flex-shrink-0 ${isAccepted ? 'text-emerald-500' : 'text-slate-400'}`} />
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors truncate">
            {policy.title}
          </h3>
        </div>
        {isAccepted ? (
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        ) : policy.isMandatory ? (
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-slate-300 flex-shrink-0" />
        )}
      </div>

      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
        {policy.summary || 'No summary available.'}
      </p>

      <div className="flex items-center flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
          {policy.category || 'General'}
        </span>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
          v{policy.version || '1.0'}
        </span>
        {policy.isMandatory && (
          <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            Mandatory
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        {isAccepted ? (
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Accepted {formatDate(policy.acceptedAt)}
          </span>
        ) : (
          <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Pending review
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
      </div>
    </button>
  );
}

// -- Policy Detail View --
function PolicyDetail({ slug, onBack, onAccepted }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remarks, setRemarks] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    const fetchPolicy = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/policies/${slug}`);
        setPolicy(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, [slug]);

  const handleAccept = async () => {
    if (!policy) return;
    setAccepting(true);
    setAcceptError('');
    try {
      await api.post(`/policies/${policy.id}/accept`, { remarks: remarks.trim() || undefined });
      setPolicy((prev) => ({
        ...prev,
        acceptedAt: new Date().toISOString(),
        acceptanceRemarks: remarks.trim(),
      }));
      onAccepted();
    } catch (err) {
      setAcceptError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-lg" />
          <div className="w-48 h-6 bg-slate-200 rounded" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="w-2/3 h-6 bg-slate-200 rounded" />
          <div className="w-full h-4 bg-slate-100 rounded" />
          <div className="w-full h-4 bg-slate-100 rounded" />
          <div className="w-5/6 h-4 bg-slate-100 rounded" />
          <div className="w-full h-4 bg-slate-100 rounded" />
          <div className="w-2/3 h-4 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to policies
        </button>
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (!policy) return null;

  const isAccepted = !!policy.acceptedAt;
  const catStyle = getCategoryStyle(policy.category);

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to policies
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{policy.title}</h2>
              {policy.summary && (
                <p className="text-sm text-slate-500 mt-0.5">{policy.summary}</p>
              )}
            </div>
          </div>
          {isAccepted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium flex-shrink-0">
              <CheckCircle className="w-3.5 h-3.5" />
              Accepted {formatDate(policy.acceptedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${catStyle.bg} ${catStyle.text}`}>
            <Tag className="w-3 h-3" />
            {policy.category || 'General'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
            <Info className="w-3 h-3" />
            Version {policy.version || '1.0'}
          </span>
          {policy.effectiveDate && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full">
              <Calendar className="w-3 h-3" />
              Effective {formatDate(policy.effectiveDate)}
            </span>
          )}
          {policy.company && (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              <Building2 className="w-3 h-3" />
              {policy.company.shortName || policy.company.name}
            </span>
          )}
          {policy.isMandatory && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Mandatory
            </span>
          )}
        </div>
      </div>

      {/* Policy content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        {policy.content && (
          <div className="prose prose-sm max-w-none mb-6">
            {renderPolicyContent(policy.content)}
          </div>
        )}

        {policy.sections && policy.sections.length > 0 && (
          <div className="space-y-6">
            {policy.sections
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((section, idx) => (
                <div key={section.id || idx} className="border-l-2 border-blue-200 pl-4">
                  <h3 className="text-base font-semibold text-slate-800 mb-2">
                    {section.title}
                  </h3>
                  <div className="prose prose-sm max-w-none">
                    {renderPolicyContent(section.content)}
                  </div>
                </div>
              ))}
          </div>
        )}

        {!policy.content && (!policy.sections || policy.sections.length === 0) && (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No content available for this policy.</p>
          </div>
        )}
      </div>

      {/* Accept section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        {isAccepted ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                You accepted this policy on {formatDate(policy.acceptedAt)}
              </p>
              {policy.acceptanceRemarks && (
                <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {policy.acceptanceRemarks}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {policy.isMandatory
                    ? 'This is a mandatory policy. Please review and accept it.'
                    : 'Please review the policy above and accept when ready.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Remarks (optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Any comments or acknowledgements..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {acceptError && (
              <div className="text-xs bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                {acceptError}
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  I have read and accept this policy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// -- Main Component --
export default function PolicyAcceptance() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/policies');
      const data = response.data;
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
        // Mandatory first
        if (a.isMandatory && !b.isMandatory) return -1;
        if (!a.isMandatory && b.isMandatory) return 1;
        // Pending before accepted
        const aAccepted = !!a.acceptedAt;
        const bAccepted = !!b.acceptedAt;
        if (!aAccepted && bAccepted) return -1;
        if (aAccepted && !bAccepted) return 1;
        // Then by date descending
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      setPolicies(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const acceptedCount = policies.filter((p) => !!p.acceptedAt).length;
  const totalCount = policies.length;
  const allAccepted = totalCount > 0 && acceptedCount === totalCount;

  const handleAccepted = () => {
    // Refresh the list so the accepted status updates
    fetchPolicies();
  };

  // Detail view
  if (selectedSlug) {
    return (
      <div className="space-y-6">
        <PolicyDetail
          slug={selectedSlug}
          onBack={() => setSelectedSlug(null)}
          onAccepted={handleAccepted}
        />
      </div>
    );
  }

  // Loading
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Company Policies
        </h1>
        <ErrorState message={error} onRetry={fetchPolicies} />
      </div>
    );
  }

  // Empty
  if (totalCount === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Company Policies
        </h1>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Company Policies
        </h1>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${
            allAccepted
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {allAccepted ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
            {acceptedCount} / {totalCount} accepted
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-600">Acceptance Progress</p>
          <p className="text-xs text-slate-400">
            {totalCount - acceptedCount > 0
              ? `${totalCount - acceptedCount} ${totalCount - acceptedCount === 1 ? 'policy' : 'policies'} remaining`
              : 'All done'}
          </p>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allAccepted ? 'bg-emerald-500' : 'bg-blue-500'
            }`}
            style={{ width: `${totalCount > 0 ? (acceptedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* All accepted celebration */}
      {allAccepted && <AllAcceptedState total={totalCount} />}

      {/* Policy cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies.map((policy) => (
          <PolicyCard
            key={policy.id}
            policy={policy}
            onClick={() => setSelectedSlug(policy.slug || policy.id)}
          />
        ))}
      </div>
    </div>
  );
}
