import { useState } from 'react';
import api from '../../utils/api';
import { useFetch } from '../../hooks/useFetch';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, TrendingDown, Filter, ChevronDown } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_STYLES = {
  critical: { badge: 'bg-red-100 text-red-800 border-red-200',    dot: 'bg-red-500',    label: 'Critical' },
  high:     { badge: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500', label: 'High'     },
  medium:   { badge: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-500',  label: 'Medium'   },
  low:      { badge: 'bg-green-100 text-green-800 border-green-200',   dot: 'bg-green-500',  label: 'Low'      },
};

const REC_STATUS_STYLES = {
  pending:     'bg-amber-100 text-amber-800 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed:   'bg-green-100 text-green-800 border-green-200',
  dismissed:   'bg-slate-100 text-slate-600 border-slate-200',
};

const RISK_FACTOR_LABELS = {
  asset_age:       'Old Asset',
  poor_condition:  'Poor Condition',
  repair_history:  'Frequent Repairs',
  warranty_status: 'Warranty Expired',
};

function healthColor(score) {
  if (score <= 40) return 'text-red-700';
  if (score <= 60) return 'text-orange-600';
  if (score <= 75) return 'text-amber-600';
  return 'text-green-700';
}

function healthBarColor(score) {
  if (score <= 40) return 'bg-red-500';
  if (score <= 60) return 'bg-orange-500';
  if (score <= 75) return 'bg-amber-400';
  return 'bg-green-500';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const s = RISK_STYLES[level] || RISK_STYLES.low;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function HealthBar({ score }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${healthBarColor(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-semibold w-8 text-right ${healthColor(score)}`}>{score}</span>
    </div>
  );
}

function StatCard({ label, value, sub, colorClass = 'text-slate-800' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-sm text-slate-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tab 1: Dashboard ─────────────────────────────────────────────────────────

function DashboardTab() {
  const { data: summary, loading, error, refetch } = useFetch('/predictions/dashboard/summary', null);
  const { execute, loading: recalculating, error: recalcErr, success: recalcOk, clearMessages } = useApi();

  async function handleRecalculate() {
    clearMessages();
    try {
      await execute(
        () => api.post('/predictions/recalculate-all'),
        'Health scores recalculated for all assets'
      );
      refetch();
    } catch {
      // Error displayed by useApi
    }
  }

  if (loading) return <LoadingSpinner />;
  if (error)   return <AlertMessage type="error" message={error} />;
  if (!summary) return null;

  const { totalAssets, atRiskCount, avgHealthScore, riskDistribution, criticalAssets } = summary;
  const dist = riskDistribution || {};

  return (
    <div className="space-y-6">
      {recalcErr && <AlertMessage type="error" message={recalcErr} />}
      {recalcOk  && <AlertMessage type="success" message={recalcOk} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value={totalAssets} />
        <StatCard
          label="At-Risk Assets"
          value={atRiskCount}
          sub="Critical + High + Medium"
          colorClass={atRiskCount > 0 ? 'text-orange-600' : 'text-green-700'}
        />
        <StatCard
          label="Avg Health Score"
          value={avgHealthScore}
          sub="Out of 100"
          colorClass={healthColor(avgHealthScore)}
        />
        <StatCard
          label="Critical Assets"
          value={dist.critical || 0}
          sub="Immediate attention needed"
          colorClass={(dist.critical || 0) > 0 ? 'text-red-600' : 'text-green-700'}
        />
      </div>

      {/* Risk distribution */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Risk Distribution</h3>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating…' : 'Recalculate All'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['critical', 'high', 'medium', 'low']).map(level => {
            const s = RISK_STYLES[level];
            const count = dist[level] || 0;
            const pct = totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
            return (
              <div key={level} className={`rounded-lg border p-4 ${s.badge}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  <span className="text-sm font-medium">{s.label}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs opacity-70">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical assets table */}
      {criticalAssets && criticalAssets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Top Critical Assets
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Asset</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Health Score</th>
                <th className="px-4 py-3 text-left font-medium">Risk Level</th>
                <th className="px-4 py-3 text-left font-medium">Top Risk Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criticalAssets.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{a.type}</td>
                  <td className="px-4 py-3"><HealthBar score={a.healthScore} /></td>
                  <td className="px-4 py-3"><RiskBadge level={a.riskLevel} /></td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.topRisk ? (RISK_FACTOR_LABELS[a.topRisk] || a.topRisk) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: At-Risk Assets ────────────────────────────────────────────────────

function AtRiskTab() {
  const [riskLevel, setRiskLevel] = useState('');
  const [sort, setSort]           = useState('risk_desc');

  const params = new URLSearchParams({ sort, limit: '100' });
  if (riskLevel) params.set('riskLevel', riskLevel);

  const { data: assets, loading, error } = useFetch(`/predictions/at-risk?${params}`, []);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={riskLevel}
            onChange={e => setRiskLevel(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="risk_desc">Sort: Highest Risk First</option>
          <option value="risk_asc">Sort: Lowest Risk First</option>
          <option value="failure_prob">Sort: Failure Probability</option>
          <option value="repair_count">Sort: Repair Count</option>
          <option value="age_desc">Sort: Oldest First</option>
        </select>
        {assets && (
          <span className="text-sm text-slate-500 ml-auto">{assets.length} asset{assets.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && assets.length === 0 && (
        <EmptyState icon="✅" title="No at-risk assets" subtitle="All assets are in good health" />
      )}

      {!loading && assets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Asset</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Health Score</th>
                  <th className="px-4 py-3 text-left font-medium">Risk Level</th>
                  <th className="px-4 py-3 text-left font-medium">Fail 30d</th>
                  <th className="px-4 py-3 text-left font-medium">Fail 60d</th>
                  <th className="px-4 py-3 text-left font-medium">Fail 90d</th>
                  <th className="px-4 py-3 text-left font-medium">Repairs</th>
                  <th className="px-4 py-3 text-left font-medium">Top Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{a.name}</p>
                      {a.assetTag && <p className="text-xs text-slate-400">{a.assetTag}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{a.type}</td>
                    <td className="px-4 py-3"><HealthBar score={a.healthScore} /></td>
                    <td className="px-4 py-3"><RiskBadge level={a.riskLevel} /></td>
                    <td className={`px-4 py-3 font-medium ${a.prob30 >= 50 ? 'text-red-600' : a.prob30 >= 25 ? 'text-orange-500' : 'text-slate-600'}`}>
                      {a.prob30}%
                    </td>
                    <td className={`px-4 py-3 font-medium ${a.prob60 >= 50 ? 'text-red-600' : a.prob60 >= 25 ? 'text-orange-500' : 'text-slate-600'}`}>
                      {a.prob60}%
                    </td>
                    <td className={`px-4 py-3 font-medium ${a.prob90 >= 50 ? 'text-red-600' : a.prob90 >= 25 ? 'text-orange-500' : 'text-slate-600'}`}>
                      {a.prob90}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.repairCount >= 5 ? 'bg-red-100 text-red-700' : a.repairCount >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.repairCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {a.topRiskFactor ? (RISK_FACTOR_LABELS[a.topRiskFactor] || a.topRiskFactor) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Recommendations ───────────────────────────────────────────────────

function RecommendationsTab() {
  const [status, setStatus]   = useState('pending');
  const [urgency, setUrgency] = useState('');

  const params = new URLSearchParams({ status, limit: '100' });
  if (urgency) params.set('urgency', urgency);

  const { data: recs, loading, error, refetch } = useFetch(`/predictions/recommendations?${params}`, []);
  const { execute, loading: updating } = useApi();

  async function updateStatus(recId, newStatus) {
    try {
      await execute(() => api.put(`/predictions/recommendations/${recId}/status`, { status: newStatus }), '');
      refetch();
    } catch {
      // Error displayed by useApi
    }
  }

  const NEXT_STATUS = {
    pending:     ['in_progress', 'dismissed'],
    in_progress: ['completed', 'dismissed'],
    completed:   [],
    dismissed:   ['pending'],
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={urgency}
          onChange={e => setUrgency(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Urgency</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {recs && (
          <span className="text-sm text-slate-500 ml-auto">{recs.length} recommendation{recs.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {error   && <AlertMessage type="error" message={error} />}

      {!loading && !error && recs.length === 0 && (
        <EmptyState
          icon="✅"
          title="No recommendations"
          subtitle={`No ${status} recommendations found`}
        />
      )}

      {!loading && recs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Asset</th>
                <th className="px-4 py-3 text-left font-medium">Recommendation</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Urgency</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recs.map(rec => {
                const nextOptions = NEXT_STATUS[rec.status] || [];
                return (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{rec.asset?.name || `Asset #${rec.assetId}`}</p>
                      <p className="text-xs text-slate-400 capitalize">{rec.asset?.type}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs">
                      <p className="font-medium">{rec.title || rec.recommendationType || '—'}</p>
                      {rec.reasoning && <p className="text-xs text-slate-400 truncate">{rec.reasoning}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${rec.priority >= 8 ? 'bg-red-100 text-red-700' : rec.priority >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        P{rec.priority || '?'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {rec.urgency ? <RiskBadge level={rec.urgency} /> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${REC_STATUS_STYLES[rec.status] || ''}`}>
                        {rec.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {nextOptions.length > 0 ? (
                        <div className="flex gap-1">
                          {nextOptions.map(ns => (
                            <button
                              key={ns}
                              onClick={() => updateStatus(rec.id, ns)}
                              disabled={updating}
                              className={`px-2 py-1 text-xs rounded font-medium transition ${
                                ns === 'completed'   ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                ns === 'in_progress' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                ns === 'dismissed'   ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' :
                                'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              } disabled:opacity-60`}
                            >
                              {ns === 'in_progress' ? 'Start' : ns === 'completed' ? 'Complete' : ns === 'dismissed' ? 'Dismiss' : ns}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Done
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'dashboard',       label: 'Dashboard',       icon: Activity      },
  { key: 'at_risk',         label: 'At-Risk Assets',  icon: AlertTriangle },
  { key: 'recommendations', label: 'Recommendations', icon: TrendingDown  },
];

export default function PredictiveMaintenanceDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="p-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Predictive Maintenance</h1>
            <p className="text-sm text-slate-500">Asset health scores, risk analysis, and maintenance recommendations</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard'       && <DashboardTab />}
      {activeTab === 'at_risk'         && <AtRiskTab />}
      {activeTab === 'recommendations' && <RecommendationsTab />}
    </div>
  );
}
