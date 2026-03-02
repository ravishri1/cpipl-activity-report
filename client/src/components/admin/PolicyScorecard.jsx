import { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, BarChart3, Users, CheckCircle,
  AlertTriangle, TrendingUp, Eye, ChevronDown,
} from 'lucide-react';

const CATEGORY_COLORS = {
  general: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  attendance: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  leave: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  conduct: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  benefits: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  safety: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
};

function getScoreColor(score) {
  if (score < 50) return { bar: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' };
  if (score < 75) return { bar: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' };
  return { bar: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' };
}

function getCategoryStyle(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
}

function ScoreBar({ score, label, height = 'h-3' }) {
  const color = getScoreColor(score);
  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 capitalize">{label}</span>
          <span className={`text-xs font-semibold ${color.text}`}>{score}%</span>
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${color.bar} ${height} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, subtitle, colorClass }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colorClass || 'text-slate-800'}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ policy, isExpanded, onToggle }) {
  const scoreColor = getScoreColor(policy.protectionScore);
  const acceptanceRate = policy.acceptanceRate || 0;
  const acceptanceColor = getScoreColor(acceptanceRate);
  const categoryStyle = getCategoryStyle(policy.category);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-shrink-0">
          {policy.protectionScore >= 75 ? (
            <ShieldCheck className="w-5 h-5 text-green-500" />
          ) : policy.protectionScore >= 50 ? (
            <Shield className="w-5 h-5 text-yellow-500" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-800 truncate">{policy.title}</span>
            {policy.isMandatory && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded uppercase tracking-wide">
                Mandatory
              </span>
            )}
            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${categoryStyle.bg} ${categoryStyle.text}`}>
              {policy.category}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>v{policy.version}</span>
            <span>{policy.totalAcceptances} of {policy.totalEmployees} accepted</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="w-32 hidden sm:block">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`${scoreColor.bar} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${policy.protectionScore}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${scoreColor.text} w-8 text-right`}>{policy.protectionScore}</span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Score Breakdown */}
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Score Breakdown
              </h4>
              <div className="space-y-2.5">
                {policy.scoreBreakdown && Object.entries(policy.scoreBreakdown).map(([dim, score]) => (
                  <ScoreBar key={dim} score={score} label={dim} height="h-2" />
                ))}
              </div>
            </div>

            {/* Acceptance Rate */}
            <div>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Acceptance Rate
              </h4>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-2xl font-bold ${acceptanceColor.text}`}>{acceptanceRate}%</span>
                  <span className="text-xs text-slate-400">
                    {policy.totalAcceptances} / {policy.totalEmployees} employees
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${acceptanceColor.bar} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${acceptanceRate}%` }}
                  />
                </div>
                {policy.isMandatory && acceptanceRate < 100 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Mandatory policy - not yet fully accepted
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateRecommendations(policies, summary) {
  const recommendations = [];

  policies.forEach((p) => {
    if (p.protectionScore < 60) {
      recommendations.push({
        type: 'warning',
        icon: ShieldAlert,
        message: `Consider strengthening "${p.title}" - protection score is only ${p.protectionScore}%`,
      });
    }
    if (p.acceptanceRate < 50) {
      recommendations.push({
        type: 'info',
        icon: Users,
        message: `Low acceptance for "${p.title}" (${p.acceptanceRate}%) - send reminders`,
      });
    }
  });

  if (summary?.categoryGroups) {
    Object.entries(summary.categoryGroups).forEach(([category, policyNames]) => {
      if (policyNames.length >= 3) {
        recommendations.push({
          type: 'review',
          icon: Eye,
          message: `Review "${category}" policies for redundancy - ${policyNames.length} policies in this category`,
        });
      }
    });
  }

  return recommendations;
}

export default function PolicyScorecard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPolicy, setExpandedPolicy] = useState(null);

  useEffect(() => {
    const fetchScorecard = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/policies/admin/scorecard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to load scorecard (${res.status})`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message || 'Failed to load policy scorecard.');
      } finally {
        setLoading(false);
      }
    };
    fetchScorecard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">Loading policy scorecard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-xs text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.policies) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Shield className="w-10 h-10 mx-auto mb-2" />
        <p className="text-sm">No policy data available.</p>
      </div>
    );
  }

  const { policies, summary } = data;

  const avgAcceptance = policies.length > 0
    ? Math.round(policies.reduce((sum, p) => sum + (p.acceptanceRate || 0), 0) / policies.length)
    : 0;

  const sortedPolicies = [...policies].sort((a, b) => b.protectionScore - a.protectionScore);
  const recommendations = generateRecommendations(policies, summary);
  const avgScoreColor = getScoreColor(summary.avgProtectionScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-slate-600" />
            Policy Scorecard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Comprehensive overview of policy protection and acceptance across the organization
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Shield}
          title="Total Policies"
          value={summary.totalPolicies}
          subtitle="Active policies"
        />
        <SummaryCard
          icon={ShieldCheck}
          title="Avg Protection Score"
          value={`${summary.avgProtectionScore}%`}
          subtitle="Across all policies"
          colorClass={avgScoreColor.text}
        />
        <SummaryCard
          icon={CheckCircle}
          title="Avg Acceptance Rate"
          value={`${avgAcceptance}%`}
          subtitle="Employee acceptance"
          colorClass={getScoreColor(avgAcceptance).text}
        />
        <SummaryCard
          icon={Users}
          title="Total Employees"
          value={summary.totalEmployees}
          subtitle="In the organization"
        />
      </div>

      {/* Protection Score Overview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            Protection Score Overview
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Sorted by score, highest first</p>
        </div>
        <div className="p-5 space-y-3">
          {sortedPolicies.map((policy) => {
            const color = getScoreColor(policy.protectionScore);
            return (
              <div key={policy.id} className="flex items-center gap-3">
                <div className="w-40 sm:w-52 flex-shrink-0 truncate">
                  <span className="text-sm text-slate-700">{policy.title}</span>
                </div>
                <div className="flex-1">
                  <div className="relative w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`${color.bar} h-6 rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max(policy.protectionScore, 8)}%` }}
                    >
                      <span className="text-[11px] font-bold text-white drop-shadow-sm">
                        {policy.protectionScore}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Policy List (expandable) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-slate-500" />
          Policy Details
        </h2>
        <div className="space-y-2">
          {sortedPolicies.map((policy) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              isExpanded={expandedPolicy === policy.id}
              onToggle={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}
            />
          ))}
        </div>
      </div>

      {/* Acceptance Rate Tracking */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            Acceptance Rate Tracking
          </h2>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            {policies.map((policy) => {
              const rate = policy.acceptanceRate || 0;
              const color = getScoreColor(rate);
              return (
                <div key={policy.id} className="flex items-center gap-4">
                  <div className="w-40 sm:w-52 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-700 truncate">{policy.title}</span>
                      {policy.isMandatory && (
                        <span className="px-1 py-0.5 text-[9px] font-bold bg-red-50 text-red-500 rounded uppercase flex-shrink-0">
                          req
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {policy.totalAcceptances} of {policy.totalEmployees} employees
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="relative w-full bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`${color.bar} h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max(rate, 6)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white drop-shadow-sm">{rate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Analysis */}
      {summary.categoryGroups && Object.keys(summary.categoryGroups).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              Category Analysis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Review policy distribution across categories</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary.categoryGroups).map(([category, policyNames]) => {
                const style = getCategoryStyle(category);
                const hasOverlap = policyNames.length >= 2;
                return (
                  <div
                    key={category}
                    className={`rounded-lg border p-4 ${style.border} ${hasOverlap ? 'ring-1 ring-amber-200' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize ${style.bg} ${style.text}`}>
                        {category}
                      </span>
                      {hasOverlap && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Overlap
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1 mt-2">
                      {policyNames.map((name, idx) => (
                        <li key={idx} className="text-sm text-slate-600 flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${style.bg.replace('100', '400')}`} />
                          {name}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {policyNames.length} {policyNames.length === 1 ? 'policy' : 'policies'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              Recommendations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Auto-generated suggestions based on current data</p>
          </div>
          <div className="p-5 space-y-3">
            {recommendations.map((rec, idx) => {
              const RecIcon = rec.icon;
              const colorMap = {
                warning: 'bg-red-50 border-red-200 text-red-700',
                info: 'bg-blue-50 border-blue-200 text-blue-700',
                review: 'bg-amber-50 border-amber-200 text-amber-700',
              };
              const iconColorMap = {
                warning: 'text-red-500',
                info: 'text-blue-500',
                review: 'text-amber-500',
              };
              return (
                <div key={idx} className={`flex items-start gap-3 rounded-lg border p-3 ${colorMap[rec.type]}`}>
                  <RecIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColorMap[rec.type]}`} />
                  <p className="text-sm">{rec.message}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recommendations.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-green-700 font-medium">All policies are in good standing</p>
          <p className="text-xs text-green-500 mt-1">No recommendations at this time</p>
        </div>
      )}
    </div>
  );
}
