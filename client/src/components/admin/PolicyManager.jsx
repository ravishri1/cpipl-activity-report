import { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Shield, FileText, Users, CheckCircle, XCircle, Plus, Edit,
  Eye, ChevronDown, Search, Filter, AlertTriangle,
  X, Loader2, ChevronUp, ToggleLeft, ToggleRight, Trash2,
  GripVertical, Save,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-slate-100 text-slate-700' },
  { value: 'attendance', label: 'Attendance', color: 'bg-blue-100 text-blue-700' },
  { value: 'leave', label: 'Leave', color: 'bg-green-100 text-green-700' },
  { value: 'conduct', label: 'Conduct', color: 'bg-purple-100 text-purple-700' },
  { value: 'benefits', label: 'Benefits', color: 'bg-amber-100 text-amber-700' },
  { value: 'safety', label: 'Safety', color: 'bg-red-100 text-red-700' },
];

function getCategoryBadge(category) {
  const cat = CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  return cat;
}

function getScoreColor(score) {
  if (score == null || score === 0) return 'bg-slate-100 text-slate-500';
  if (score < 50) return 'bg-red-100 text-red-700';
  if (score <= 75) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

export default function PolicyManager() {
  // ── List state ──
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Modal state ──
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  // ── Acceptance tracking state ──
  const [expandedAcceptance, setExpandedAcceptance] = useState(null);
  const [acceptanceData, setAcceptanceData] = useState(null);
  const [acceptanceLoading, setAcceptanceLoading] = useState(false);

  // ── Score editing state ──
  const [editingScore, setEditingScore] = useState(null);
  const [scoreValue, setScoreValue] = useState('');
  const [scoreSaving, setScoreSaving] = useState(false);

  // ── Companies for dropdown ──
  const [companies, setCompanies] = useState([]);

  // ── Fetch policies ──
  const fetchPolicies = async () => {
    try {
      setError('');
      const res = await api.get('/policies/admin/all');
      setPolicies(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch policies.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchCompanies();
  }, []);

  // ── Toggle active ──
  const toggleActive = async (policy) => {
    try {
      await api.put(`/policies/admin/${policy.id}`, { isActive: !policy.isActive });
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to toggle status.');
    }
  };

  // ── Acceptance tracking ──
  const loadAcceptances = async (policyId) => {
    if (expandedAcceptance === policyId) {
      setExpandedAcceptance(null);
      setAcceptanceData(null);
      return;
    }
    setExpandedAcceptance(policyId);
    setAcceptanceLoading(true);
    try {
      const res = await api.get(`/policies/admin/${policyId}/acceptances`);
      setAcceptanceData(res.data);
    } catch {
      setAcceptanceData(null);
    } finally {
      setAcceptanceLoading(false);
    }
  };

  // ── Score update ──
  const startEditScore = (policy) => {
    setEditingScore(policy.id);
    setScoreValue(policy.protectionScore || 0);
  };

  const saveScore = async (policyId) => {
    setScoreSaving(true);
    try {
      await api.put(`/policies/admin/${policyId}/score`, {
        protectionScore: parseFloat(scoreValue) || 0,
      });
      setEditingScore(null);
      fetchPolicies();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update score.');
    } finally {
      setScoreSaving(false);
    }
  };

  // ── Filtering ──
  const filtered = policies.filter(p => {
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.summary && p.summary.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // ── Open editor ──
  const openCreate = () => {
    setEditingPolicy(null);
    setShowForm(true);
  };

  const openEdit = (policy) => {
    setEditingPolicy(policy);
    setShowForm(true);
  };

  const handleFormClose = (didSave) => {
    setShowForm(false);
    setEditingPolicy(null);
    if (didSave) fetchPolicies();
  };

  // ── Stats ──
  const totalActive = policies.filter(p => p.isActive).length;
  const avgAcceptance = policies.length > 0
    ? Math.round(policies.reduce((s, p) => s + (p.acceptanceRate || 0), 0) / policies.length)
    : 0;
  const avgScore = policies.filter(p => p.protectionScore > 0).length > 0
    ? Math.round(
        policies.filter(p => p.protectionScore > 0)
          .reduce((s, p) => s + p.protectionScore, 0) /
        policies.filter(p => p.protectionScore > 0).length
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Policy Management
        </h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Policy
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Total Policies</p>
          <p className="text-2xl font-bold text-slate-800">{policies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-green-500 font-medium">Active</p>
          <p className="text-2xl font-bold text-green-700">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-blue-500 font-medium">Avg Acceptance</p>
          <p className="text-2xl font-bold text-blue-700">{avgAcceptance}%</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-purple-500 font-medium">Avg Protection</p>
          <p className="text-2xl font-bold text-purple-700">{avgScore}</p>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search policies by title..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
              filterCategory
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterCategory ? getCategoryBadge(filterCategory).label : 'Category'}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-20 py-1 w-44">
              <button
                onClick={() => { setFilterCategory(''); setShowFilters(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                  !filterCategory ? 'text-blue-600 font-medium' : 'text-slate-700'
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => { setFilterCategory(cat.value); setShowFilters(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                    filterCategory === cat.value ? 'text-blue-600 font-medium' : 'text-slate-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`} />
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Policy List ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mb-3 text-slate-200" />
            <p className="text-sm font-medium">
              {policies.length === 0 ? 'No policies created yet' : 'No policies match your search'}
            </p>
            {policies.length === 0 && (
              <button
                onClick={openCreate}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Create your first policy
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-medium text-slate-600">Policy</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Category</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Version</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Status</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Acceptance</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Protection</th>
                <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(policy => {
                const catBadge = getCategoryBadge(policy.category);
                const isExpanded = expandedAcceptance === policy.id;

                return (
                  <PolicyRow
                    key={policy.id}
                    policy={policy}
                    catBadge={catBadge}
                    isExpanded={isExpanded}
                    acceptanceData={isExpanded ? acceptanceData : null}
                    acceptanceLoading={isExpanded && acceptanceLoading}
                    editingScore={editingScore}
                    scoreValue={scoreValue}
                    scoreSaving={scoreSaving}
                    onToggleActive={() => toggleActive(policy)}
                    onEdit={() => openEdit(policy)}
                    onToggleAcceptance={() => loadAcceptances(policy.id)}
                    onStartEditScore={() => startEditScore(policy)}
                    onScoreChange={setScoreValue}
                    onSaveScore={() => saveScore(policy.id)}
                    onCancelScore={() => setEditingScore(null)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <PolicyFormModal
          policy={editingPolicy}
          companies={companies}
          onClose={handleFormClose}
        />
      )}

      {/* Close dropdown on outside click */}
      {showFilters && (
        <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Policy Table Row (with expandable acceptance)
// ═══════════════════════════════════════════════
function PolicyRow({
  policy, catBadge, isExpanded, acceptanceData, acceptanceLoading,
  editingScore, scoreValue, scoreSaving,
  onToggleActive, onEdit, onToggleAcceptance,
  onStartEditScore, onScoreChange, onSaveScore, onCancelScore,
}) {
  const isEditingThisScore = editingScore === policy.id;

  return (
    <>
      <tr className={`hover:bg-slate-50 transition-colors ${!policy.isActive ? 'opacity-60' : ''}`}>
        {/* Title */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-slate-800 leading-tight">{policy.title}</p>
              {policy.summary && (
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{policy.summary}</p>
              )}
              {policy.isMandatory && (
                <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                  Mandatory
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Category */}
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${catBadge.color}`}>
            {catBadge.label}
          </span>
        </td>

        {/* Version */}
        <td className="px-4 py-3 text-center">
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            v{policy.version}
          </span>
        </td>

        {/* Status Toggle */}
        <td className="px-4 py-3 text-center">
          <button
            onClick={onToggleActive}
            className="inline-flex items-center gap-1 text-xs font-medium"
            title={policy.isActive ? 'Click to deactivate' : 'Click to activate'}
          >
            {policy.isActive ? (
              <>
                <ToggleRight className="w-5 h-5 text-green-600" />
                <span className="text-green-700">Active</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-slate-400" />
                <span className="text-slate-500">Inactive</span>
              </>
            )}
          </button>
        </td>

        {/* Acceptance Rate */}
        <td className="px-4 py-3 text-center">
          <button
            onClick={onToggleAcceptance}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            title="View acceptance details"
          >
            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(policy.acceptanceRate || 0, 100)}%` }}
              />
            </div>
            <span>{policy.acceptanceRate || 0}%</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </td>

        {/* Protection Score */}
        <td className="px-4 py-3 text-center">
          {isEditingThisScore ? (
            <div className="flex items-center gap-1 justify-center">
              <input
                type="number"
                min="0"
                max="100"
                value={scoreValue}
                onChange={(e) => onScoreChange(e.target.value)}
                className="w-14 text-xs text-center border border-slate-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={onSaveScore}
                disabled={scoreSaving}
                className="p-0.5 text-green-600 hover:text-green-800"
                title="Save"
              >
                {scoreSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              </button>
              <button onClick={onCancelScore} className="p-0.5 text-slate-400 hover:text-slate-600" title="Cancel">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onStartEditScore}
              className={`text-xs font-semibold px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity ${getScoreColor(policy.protectionScore)}`}
              title="Click to edit protection score"
            >
              {policy.protectionScore || '—'}
            </button>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
              title="Edit policy"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleAcceptance}
              className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
              title="View acceptances"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* ── Expanded Acceptance Panel ── */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 py-0">
            <AcceptancePanel
              loading={acceptanceLoading}
              data={acceptanceData}
              policyTitle={policy.title}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// Acceptance Tracking Panel
// ═══════════════════════════════════════════════
function AcceptancePanel({ loading, data, policyTitle }) {
  const [tab, setTab] = useState('accepted');

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-4 text-center text-sm text-slate-400">
        Failed to load acceptance data.
      </div>
    );
  }

  const acceptedCount = data.accepted?.length || 0;
  const notAcceptedCount = data.notAccepted?.length || 0;
  const totalCount = data.total || (acceptedCount + notAcceptedCount);
  const rate = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 my-3 overflow-hidden">
      {/* Acceptance summary bar */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-700">
            Acceptance Rate for "{policyTitle}"
          </p>
          <span className="text-xs font-bold text-slate-600">
            {acceptedCount}/{totalCount} ({rate}%)
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab('accepted')}
          className={`flex-1 text-xs font-medium py-2 px-3 flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'accepted'
              ? 'text-green-700 bg-green-50 border-b-2 border-green-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Accepted ({acceptedCount})
        </button>
        <button
          onClick={() => setTab('notAccepted')}
          className={`flex-1 text-xs font-medium py-2 px-3 flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'notAccepted'
              ? 'text-red-700 bg-red-50 border-b-2 border-red-500'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Not Accepted ({notAcceptedCount})
        </button>
      </div>

      {/* Content */}
      <div className="max-h-56 overflow-y-auto">
        {tab === 'accepted' ? (
          acceptedCount === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No employees have accepted this policy yet.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Name</th>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Email</th>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Department</th>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Accepted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.accepted.map((a, i) => (
                  <tr key={i} className="hover:bg-white">
                    <td className="px-3 py-1.5 font-medium text-slate-700">{a.user?.name || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{a.user?.email || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{a.user?.department || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {a.acceptedAt ? new Date(a.acceptedAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          notAcceptedCount === 0 ? (
            <div className="py-6 text-center text-xs text-green-600 flex flex-col items-center gap-1">
              <CheckCircle className="w-5 h-5" />
              All employees have accepted this policy!
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Name</th>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Email</th>
                  <th className="text-left px-3 py-1.5 font-medium text-slate-500">Department</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.notAccepted.map((u, i) => (
                  <tr key={i} className="hover:bg-white">
                    <td className="px-3 py-1.5 font-medium text-slate-700">{u.name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{u.email}</td>
                    <td className="px-3 py-1.5 text-slate-500">{u.department || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Policy Create/Edit Modal
// ═══════════════════════════════════════════════
function PolicyFormModal({ policy, companies, onClose }) {
  const isEdit = !!policy;

  const [form, setForm] = useState({
    title: policy?.title || '',
    category: policy?.category || 'general',
    summary: policy?.summary || '',
    content: policy?.content || '',
    effectiveDate: policy?.effectiveDate?.split('T')[0] || '',
    isMandatory: policy?.isMandatory ?? true,
    isActive: policy?.isActive ?? true,
    companyId: policy?.companyId ? String(policy.companyId) : '',
  });

  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingSections, setLoadingSections] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  // Load sections for existing policy
  useEffect(() => {
    if (isEdit && policy?.id) {
      loadPolicySections();
    }
  }, []);

  const loadPolicySections = async () => {
    setLoadingSections(true);
    try {
      const res = await api.get(`/policies/${policy.slug}`);
      if (res.data.sections) {
        setSections(res.data.sections.map(s => ({
          id: s.id,
          title: s.title,
          content: s.content,
          isEditable: s.isEditable,
        })));
      }
    } catch {
      // Non-critical, sections may not exist
    } finally {
      setLoadingSections(false);
    }
  };

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ── Section management ──
  const addSection = () => {
    setSections(prev => [...prev, { title: '', content: '', isEditable: false }]);
  };

  const updateSection = (index, field, value) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const removeSection = (index) => {
    setSections(prev => prev.filter((_, i) => i !== index));
  };

  const moveSection = (index, direction) => {
    const newSections = [...sections];
    const target = index + direction;
    if (target < 0 || target >= newSections.length) return;
    [newSections[index], newSections[target]] = [newSections[target], newSections[index]];
    setSections(newSections);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        summary: form.summary.trim() || null,
        content: form.content,
        effectiveDate: form.effectiveDate || null,
        isMandatory: form.isMandatory,
        isActive: form.isActive,
        companyId: form.companyId || null,
      };

      if (isEdit) {
        await api.put(`/policies/admin/${policy.id}`, payload);
        // Update sections
        if (sections.length > 0) {
          await api.put(`/policies/admin/${policy.id}/sections`, {
            sections: sections.map(s => ({
              title: s.title,
              content: s.content,
              isEditable: s.isEditable,
            })),
          });
        }
      } else {
        // Create with sections
        await api.post('/policies/admin/create', {
          ...payload,
          sections: sections.length > 0
            ? sections.map(s => ({
                title: s.title,
                content: s.content,
                isEditable: s.isEditable,
              }))
            : undefined,
        });
      }

      onClose(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl mx-4">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {isEdit ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
            {isEdit ? 'Edit Policy' : 'Create Policy'}
          </h2>
          <button onClick={() => onClose(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sections'
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sections
            {sections.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {sections.length}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Details Tab ── */}
          {activeTab === 'details' && (
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  placeholder="e.g. Employee Leave Policy"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Category + Company row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company (optional)</label>
                  <select
                    value={form.companyId}
                    onChange={(e) => updateForm('companyId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">All Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.shortName ? ` (${c.shortName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => updateForm('summary', e.target.value)}
                  rows={2}
                  placeholder="Brief summary of the policy..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content <span className="text-red-400">*</span>
                  <span className="text-xs text-slate-400 font-normal ml-1">(Markdown supported)</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => updateForm('content', e.target.value)}
                  rows={10}
                  placeholder="Full policy content. Use markdown for formatting..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                  required
                />
              </div>

              {/* Effective Date + Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => updateForm('effectiveDate', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => updateForm('isMandatory', !form.isMandatory)}
                      className="text-slate-500"
                    >
                      {form.isMandatory ? (
                        <ToggleRight className="w-6 h-6 text-red-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                      )}
                    </button>
                    Mandatory
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => updateForm('isActive', !form.isActive)}
                      className="text-slate-500"
                    >
                      {form.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-400" />
                      )}
                    </button>
                    Active
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Sections Tab ── */}
          {activeTab === 'sections' && (
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              {loadingSections ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  {sections.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                      <p className="text-sm">No sections added yet.</p>
                      <p className="text-xs mt-1">Sections help organize policy content into manageable parts.</p>
                    </div>
                  )}

                  {sections.map((section, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                        <span className="text-xs font-semibold text-slate-400 w-6">{index + 1}.</span>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(index, 'title', e.target.value)}
                          placeholder="Section title"
                          className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                        />
                        <label className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={section.isEditable}
                            onChange={(e) => updateSection(index, 'isEditable', e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Editable
                        </label>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSection(index, -1)}
                            disabled={index === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(index, 1)}
                            disabled={index === sections.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSection(index)}
                            className="p-0.5 text-slate-400 hover:text-red-600 ml-1"
                            title="Remove section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(index, 'content', e.target.value)}
                        rows={3}
                        placeholder="Section content..."
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-400 outline-none resize-y font-mono"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addSection}
                    className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Section
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update Policy' : 'Create Policy'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
