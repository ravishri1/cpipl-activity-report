import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import {
  Shield, Search, X, ChevronDown, ChevronRight, Save, Loader2, Users,
  CheckCircle, AlertTriangle, Info, Zap, Eye, EyeOff, ShieldCheck, ShieldAlert,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';
import AlertMessage from '../shared/AlertMessage';
import EmptyState from '../shared/EmptyState';

// ═══════════════════════════════════════════════════════════
// MODULE DEFINITIONS — with importance classification & guidance
// ═══════════════════════════════════════════════════════════

const PERMISSION_SECTIONS = [
  {
    label: 'Overview',
    icon: '📋',
    items: [
      { to: '/dashboard', label: 'Dashboard', importance: 'required', hint: 'Landing page — employee home screen' },
      { to: '/announcements', label: 'Announcements', importance: 'required', hint: 'Company communications — employee must read' },
    ],
  },
  {
    label: 'My Work',
    icon: '💼',
    items: [
      { to: '/submit-report', label: 'Submit Report', importance: 'optional', hint: 'Legacy report form — most use Activity Reports instead' },
      { to: '/reports', label: 'My Reports', importance: 'optional', hint: 'Legacy report history view' },
      { to: '/activity-reports', label: 'Activity Reports', importance: 'required', hint: 'Core feature — daily report submission & history' },
      { to: '/attendance', label: 'Attendance', importance: 'required', hint: 'View & mark daily attendance' },
      { to: '/leave', label: 'Leave', importance: 'required', hint: 'Apply for leave, check leave balance' },
      { to: '/expenses', label: 'Expenses', importance: 'recommended', hint: 'Submit expense claims (if employee has business expenses)' },
      { to: '/payslips', label: 'My Payslips', importance: 'required', hint: 'View salary slips — legal requirement for all employees' },
      { to: '/my-assets', label: 'My Assets', importance: 'optional', hint: 'View company assets assigned to them' },
      { to: '/my-repairs', label: 'My Repairs', importance: 'optional', hint: 'Track asset repair requests' },
      { to: '/policies', label: 'Policies', importance: 'required', hint: 'Read & accept company policies — compliance requirement' },
      { to: '/surveys', label: 'Surveys', importance: 'recommended', hint: 'Participate in company surveys & feedback' },
      { to: '/my-tickets', label: 'Support Tickets', importance: 'required', hint: 'Raise IT/HR support requests — essential for issue resolution' },
      { to: '/my-support', label: 'My Support', importance: 'required', hint: 'Helpdesk portal — employee support access' },
      { to: '/suggestions', label: 'Suggestions', importance: 'recommended', hint: 'Submit improvement ideas to management' },
      { to: '/wiki', label: 'Knowledge Base', importance: 'recommended', hint: 'Access company knowledge articles & SOPs' },
      { to: '/my-files', label: 'My Files', importance: 'recommended', hint: 'Access personal documents (letters, offer, etc.)' },
      { to: '/my-insurance', label: 'My Insurance', importance: 'recommended', hint: 'View insurance policy details & coverage' },
      { to: '/my-comp-off', label: 'Comp-Off', importance: 'optional', hint: 'Request compensatory off for extra work days' },
      { to: '/attendance-regularization', label: 'Regularization', importance: 'optional', hint: 'Request attendance corrections' },
      { to: '/my-compliance', label: 'My Compliance', importance: 'optional', hint: 'View personal compliance status' },
    ],
  },
  {
    label: 'Team',
    icon: '👥',
    items: [
      { to: '/directory', label: 'Employee Directory', importance: 'recommended', hint: 'Find colleague contact details' },
      { to: '/leaderboard', label: 'Leaderboard', importance: 'optional', hint: 'Points & recognition leaderboard' },
    ],
  },
  {
    label: 'My Team (Team Leads)',
    icon: '👔',
    items: [
      { to: '/my-team', label: 'Team Overview', importance: 'optional', hint: 'Only for team leads — manage direct reports' },
    ],
  },
  {
    label: 'People (Admin)',
    icon: '🏢',
    adminOnly: true,
    items: [
      { to: '/admin/team', label: 'Team Management', importance: 'optional', hint: 'Add/edit employees, manage team structure' },
      { to: '/admin/confirmations', label: 'Confirmations', importance: 'optional', hint: 'Manage probation confirmations' },
      { to: '/admin/onboarding', label: 'Onboarding', importance: 'optional', hint: 'New employee onboarding checklists' },
      { to: '/admin/separations', label: 'Separations', importance: 'optional', hint: 'Employee exit & full and final settlement' },
      { to: '/admin/import', label: 'Import Employees', importance: 'optional', hint: 'Bulk import from CSV/greytHR' },
      { to: '/admin/ai-extract', label: 'AI Extract', importance: 'optional', hint: 'AI-powered resume/document extraction' },
    ],
  },
  {
    label: 'Time & Pay (Admin)',
    icon: '💰',
    adminOnly: true,
    items: [
      { to: '/admin/attendance', label: 'Team Attendance', importance: 'optional', hint: 'View/manage all employee attendance' },
      { to: '/admin/shifts', label: 'Shift Management', importance: 'optional', hint: 'Create & assign work shifts' },
      { to: '/admin/leave-requests', label: 'Leave Requests', importance: 'optional', hint: 'Approve/reject employee leave' },
      { to: '/admin/holidays', label: 'Holidays', importance: 'optional', hint: 'Manage holiday calendar' },
      { to: '/admin/payroll', label: 'Payroll', importance: 'optional', hint: 'Process monthly payroll' },
      { to: '/admin/salary-setup', label: 'Salary Setup', importance: 'optional', hint: 'Configure salary structures' },
      { to: '/admin/expense-claims', label: 'Expense Claims', importance: 'optional', hint: 'Approve/reject expense claims' },
    ],
  },
  {
    label: 'Organization (Admin)',
    icon: '🏗️',
    adminOnly: true,
    items: [
      { to: '/admin/company-master', label: 'Company Master', importance: 'optional', hint: 'Company registration details' },
      { to: '/admin/branches', label: 'Branches', importance: 'optional', hint: 'Branch/location management' },
      { to: '/admin/assets', label: 'Assets', importance: 'optional', hint: 'Manage company assets' },
      { to: '/admin/vendor-analytics', label: 'Vendor Analytics', importance: 'optional', hint: 'Vendor performance metrics' },
      { to: '/admin/procurement', label: 'Procurement', importance: 'optional', hint: 'Purchase requests & orders' },
      { to: '/admin/order-approvals', label: 'Order Approvals', importance: 'optional', hint: 'Approve purchase orders' },
      { to: '/admin/inventory', label: 'Inventory', importance: 'optional', hint: 'Stock & inventory tracking' },
      { to: '/admin/predictive-maintenance', label: 'Predictive Maintenance', importance: 'optional', hint: 'AI-powered maintenance predictions' },
      { to: '/admin/insurance', label: 'Insurance', importance: 'optional', hint: 'Company insurance management' },
      { to: '/admin/contracts', label: 'Contracts', importance: 'optional', hint: 'Company contracts & agreements' },
      { to: '/admin/letters', label: 'Letters', importance: 'optional', hint: 'Generate official letters' },
      { to: '/admin/policies', label: 'Policy Manager', importance: 'optional', hint: 'Create & manage company policies' },
      { to: '/admin/surveys', label: 'Survey Manager', importance: 'optional', hint: 'Create & manage surveys' },
      { to: '/admin/tickets', label: 'Helpdesk Manager', importance: 'optional', hint: 'Manage employee support tickets' },
      { to: '/admin/suggestions', label: 'Suggestion Manager', importance: 'optional', hint: 'Review employee suggestions' },
      { to: '/admin/reports', label: 'HR Reports', importance: 'optional', hint: 'Generate HR analytics reports' },
      { to: '/admin/error-reports', label: 'Error Reports', importance: 'optional', hint: 'App error monitoring' },
      { to: '/admin/settings', label: 'Settings', importance: 'optional', hint: 'App configuration & settings' },
    ],
  },
];

const ALL_ROUTES = PERMISSION_SECTIONS.flatMap(s => s.items.map(i => i.to));
const REQUIRED_ROUTES = PERMISSION_SECTIONS.flatMap(s => s.items.filter(i => i.importance === 'required').map(i => i.to));
const EMPLOYEE_SECTIONS = PERMISSION_SECTIONS.filter(s => !s.adminOnly);
const EMPLOYEE_ROUTES = EMPLOYEE_SECTIONS.flatMap(s => s.items.map(i => i.to));

const ROLE_LABELS = {
  admin: 'Admin',
  sub_admin: 'Sub Admin',
  team_lead: 'Team Lead',
  member: 'Member',
};

const ROLE_STYLES = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  sub_admin: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  team_lead: 'bg-blue-100 text-blue-700 border-blue-200',
  member: 'bg-slate-100 text-slate-600 border-slate-200',
};

// ═══════════════════════════════════════════════════════════
// IMPORTANCE BADGE COMPONENT
// ═══════════════════════════════════════════════════════════

function ImportanceBadge({ importance, hint }) {
  if (importance === 'required') {
    return (
      <span className="group relative inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-semibold uppercase tracking-wide">
        Required
        {hint && (
          <span className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-56 p-2 bg-slate-800 text-white text-[11px] font-normal normal-case tracking-normal rounded-lg shadow-lg z-50">
            {hint}
          </span>
        )}
      </span>
    );
  }
  if (importance === 'recommended') {
    return (
      <span className="group relative inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-medium uppercase tracking-wide">
        Recommended
        {hint && (
          <span className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-56 p-2 bg-slate-800 text-white text-[11px] font-normal normal-case tracking-normal rounded-lg shadow-lg z-50">
            {hint}
          </span>
        )}
      </span>
    );
  }
  return hint ? (
    <span className="group relative">
      <Info className="w-3 h-3 text-slate-300 cursor-help" />
      <span className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-56 p-2 bg-slate-800 text-white text-[11px] rounded-lg shadow-lg z-50">
        {hint}
      </span>
    </span>
  ) : null;
}

// ═══════════════════════════════════════════════════════════
// TOGGLE SWITCH COMPONENT
// ═══════════════════════════════════════════════════════════

function Toggle({ enabled, onChange, size = 'sm' }) {
  const sizeClasses = size === 'sm'
    ? 'w-8 h-[18px] after:w-3.5 after:h-3.5 after:top-[1px]'
    : 'w-10 h-5 after:w-4 after:h-4 after:top-[2px]';

  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex shrink-0 rounded-full transition-colors duration-200 ease-in-out cursor-pointer
        ${enabled ? 'bg-green-500' : 'bg-slate-300'}
        ${sizeClasses}
      `}
    >
      <span
        className={`absolute rounded-full bg-white shadow transition-transform duration-200 ease-in-out
          ${size === 'sm' ? 'w-3.5 h-3.5 top-[2px]' : 'w-4 h-4 top-[2px]'}
          ${enabled
            ? (size === 'sm' ? 'translate-x-[15px]' : 'translate-x-[21px]')
            : 'translate-x-[2px]'
          }
        `}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// PERMISSION EDITOR (expanded row for one employee)
// ═══════════════════════════════════════════════════════════

function PermissionEditor({ employee, onSaved }) {
  const [denied, setDenied] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [configured, setConfigured] = useState(true);

  const isAdminRole = employee.role === 'admin' || employee.role === 'sub_admin' || employee.role === 'team_lead';
  const sections = isAdminRole ? PERMISSION_SECTIONS : EMPLOYEE_SECTIONS;
  const allRoutes = isAdminRole ? ALL_ROUTES : EMPLOYEE_ROUTES;

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get(`/users/${employee.id}/section-permissions`)
      .then(res => {
        const isConfigured = res.data.configured !== false;
        setConfigured(isConfigured);
        if (!isConfigured) {
          setDenied([...allRoutes]);
        } else {
          setDenied(res.data.deniedSections || []);
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [employee.id, allRoutes]);

  const isAllowed = (route) => !denied.includes(route);

  const toggleItem = (route) => {
    setDenied(prev =>
      prev.includes(route) ? prev.filter(r => r !== route) : [...prev, route]
    );
  };

  const toggleSectionAll = (sectionItems, allow) => {
    const routes = sectionItems.map(i => i.to);
    if (allow) {
      setDenied(prev => prev.filter(r => !routes.includes(r)));
    } else {
      setDenied(prev => [...new Set([...prev, ...routes])]);
    }
  };

  const grantEssential = () => {
    setDenied(prev => prev.filter(r => !REQUIRED_ROUTES.includes(r)));
  };

  const allowAll = () => setDenied([]);

  const denyAll = () => setDenied([...allRoutes]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put(`/users/${employee.id}/section-permissions`, { deniedSections: denied });
      setSuccess(true);
      setConfigured(true);
      setTimeout(() => setSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const allowedCount = allRoutes.filter(r => !denied.includes(r)).length;
  const totalCount = allRoutes.length;

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="bg-slate-50 border-t border-slate-200 p-4">
      {/* Guidance header */}
      <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
        <div className="flex items-start gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-700 mb-1">Permission Guide for {employee.name}</p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> <strong>Required</strong> — Must have access. Essential for daily work.
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> <strong>Recommended</strong> — Useful for most employees.
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" /> <strong>Optional</strong> — Give only if needed for their role.
              </span>
            </div>
            {!configured && (
              <p className="mt-1 text-amber-600 font-medium">
                New employee — all modules restricted by default. Click "Grant Essential" to quickly give basic access.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <AlertMessage type="error" message={error} />}
      {success && <AlertMessage type="success" message="Permissions saved successfully!" />}

      {/* Quick action buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={grantEssential}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Grant Essential
        </button>
        <button
          onClick={allowAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium rounded-lg hover:bg-green-100 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Allow All
        </button>
        <button
          onClick={denyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors"
        >
          <EyeOff className="w-3.5 h-3.5" /> Deny All
        </button>
        <div className="ml-auto text-xs text-slate-500">
          {allowedCount}/{totalCount} modules allowed
        </div>
      </div>

      {/* Section grid */}
      <div className="space-y-3">
        {sections.map((section) => {
          const sectionAllowed = section.items.every(i => !denied.includes(i.to));
          const sectionNoneAllowed = section.items.every(i => denied.includes(i.to));
          const hasRequired = section.items.some(i => i.importance === 'required');

          return (
            <div key={section.label} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{section.icon}</span>
                  <span className="text-sm font-semibold text-slate-700">{section.label}</span>
                  {section.adminOnly && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 border border-purple-200 font-medium">
                      Admin Only
                    </span>
                  )}
                  {hasRequired && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 font-medium">
                      Has required modules
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {section.items.filter(i => !denied.includes(i.to)).length}/{section.items.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSectionAll(section.items, true)}
                    className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                      sectionAllowed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    Allow All
                  </button>
                  <button
                    onClick={() => toggleSectionAll(section.items, false)}
                    className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                      sectionNoneAllowed
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Deny All
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-50">
                {section.items.map((item) => {
                  const allowed = isAllowed(item.to);
                  return (
                    <div
                      key={item.to}
                      className={`flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors ${
                        !allowed && item.importance === 'required' ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Toggle enabled={allowed} onChange={() => toggleItem(item.to)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${allowed ? 'text-slate-700' : 'text-slate-400'}`}>
                              {item.label}
                            </span>
                            <ImportanceBadge importance={item.importance} hint={item.hint} />
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{item.to}</p>
                        </div>
                      </div>
                      {!allowed && item.importance === 'required' && (
                        <span className="text-[10px] text-red-500 font-medium whitespace-nowrap ml-2">
                          Employee needs this!
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          {denied.filter(r => REQUIRED_ROUTES.includes(r)).length > 0 && (
            <span className="text-red-500 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {denied.filter(r => REQUIRED_ROUTES.includes(r)).length} required module(s) are denied
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function AccessControlManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState('');

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      // Sort: unconfigured first, then by name
      const sorted = (res.data || []).sort((a, b) => {
        const aConfig = a.sectionPermissions !== null;
        const bConfig = b.sectionPermissions !== null;
        if (aConfig !== bConfig) return aConfig ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setEmployees(sorted);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Compute stats
  const activeEmployees = employees.filter(e => e.isActive !== false);
  const configuredCount = activeEmployees.filter(e => e.sectionPermissions !== null).length;
  const unconfiguredCount = activeEmployees.length - configuredCount;
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();

  // Filters
  const filtered = activeEmployees.filter(emp => {
    if (emp.role === 'admin') return false; // Root admin can't be restricted
    if (roleFilter && emp.role !== roleFilter) return false;
    if (deptFilter && emp.department !== deptFilter) return false;
    if (statusFilter === 'configured' && emp.sectionPermissions === null) return false;
    if (statusFilter === 'unconfigured' && emp.sectionPermissions !== null) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (emp.name || '').toLowerCase().includes(q) ||
             (emp.email || '').toLowerCase().includes(q) ||
             (emp.employeeId || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Bulk grant essential to all unconfigured
  const handleBulkGrantEssential = async () => {
    const unconfigured = activeEmployees.filter(e => e.sectionPermissions === null && e.role !== 'admin');
    if (unconfigured.length === 0) return;
    if (!window.confirm(`Grant essential access to ${unconfigured.length} unconfigured employee(s)? This will allow Dashboard, Activity Reports, Attendance, Leave, Payslips, Support Tickets, Policies, and Announcements.`)) return;

    setBulkLoading(true);
    setBulkSuccess('');
    try {
      // For each unconfigured employee, set denied = all routes EXCEPT required ones
      const deniedSections = ALL_ROUTES.filter(r => !REQUIRED_ROUTES.includes(r));
      let successCount = 0;
      for (const emp of unconfigured) {
        try {
          await api.put(`/users/${emp.id}/section-permissions`, { deniedSections });
          successCount++;
        } catch {
          // Skip individual failures
        }
      }
      setBulkSuccess(`Essential access granted to ${successCount} employee(s)`);
      setTimeout(() => setBulkSuccess(''), 4000);
      fetchEmployees();
    } finally {
      setBulkLoading(false);
    }
  };

  const getAccessStatus = (emp) => {
    if (emp.sectionPermissions === null) return { label: 'Not Configured', color: 'amber' };
    const denied = Array.isArray(emp.sectionPermissions) ? emp.sectionPermissions : [];
    const isAdminRole = emp.role === 'sub_admin' || emp.role === 'team_lead';
    const routes = isAdminRole ? ALL_ROUTES : EMPLOYEE_ROUTES;
    const allowed = routes.filter(r => !denied.includes(r)).length;
    const total = routes.length;
    const missingRequired = REQUIRED_ROUTES.filter(r => denied.includes(r)).length;
    return { label: `${allowed}/${total}`, color: missingRequired > 0 ? 'red' : 'green', missingRequired };
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              Access Control
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage which modules each employee can access. Hover over badges for guidance.
            </p>
          </div>
          {unconfiguredCount > 0 && (
            <button
              onClick={handleBulkGrantEssential}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Grant Essential to {unconfiguredCount} Unconfigured
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && <AlertMessage type="error" message={error} />}
        {bulkSuccess && <AlertMessage type="success" message={bulkSuccess} />}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Employees" value={activeEmployees.length} color="blue" />
          <StatCard icon={ShieldCheck} label="Configured" value={configuredCount} color="green" />
          <StatCard icon={ShieldAlert} label="Not Configured" value={unconfiguredCount} color={unconfiguredCount > 0 ? 'amber' : 'slate'} />
          <StatCard icon={AlertTriangle} label="Missing Required" value={
            activeEmployees.filter(e => {
              if (e.role === 'admin') return false;
              const denied = Array.isArray(e.sectionPermissions) ? e.sectionPermissions : [];
              return REQUIRED_ROUTES.some(r => denied.includes(r));
            }).length
          } color="red" />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-600">
          <span className="font-medium text-slate-700">Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 font-semibold text-[10px]">REQUIRED</span>
            Must give access — essential for daily work
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-medium text-[10px]">RECOMMENDED</span>
            Useful for most employees
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            Optional — give only if role requires it
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Roles</option>
            <option value="sub_admin">Sub Admin</option>
            <option value="team_lead">Team Lead</option>
            <option value="member">Member</option>
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="configured">Configured</option>
            <option value="unconfigured">Not Configured</option>
          </select>
          {(searchQuery || roleFilter || deptFilter || statusFilter) && (
            <button
              onClick={() => { setSearchQuery(''); setRoleFilter(''); setDeptFilter(''); setStatusFilter(''); }}
              className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Employee list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="🛡️"
            title="No employees found"
            subtitle={searchQuery || roleFilter || deptFilter || statusFilter ? 'Try adjusting your filters' : 'No employees to configure'}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_120px_120px_90px] gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span>Employee</span>
              <span>Role</span>
              <span>Department</span>
              <span>Access</span>
              <span className="text-right">Action</span>
            </div>

            {/* Employee rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map((emp) => {
                const isExpanded = expandedId === emp.id;
                const status = getAccessStatus(emp);

                return (
                  <div key={emp.id}>
                    {/* Row */}
                    <div
                      className={`grid grid-cols-[1fr_100px_120px_120px_90px] gap-2 px-5 py-3 items-center cursor-pointer hover:bg-slate-50 transition-colors ${
                        isExpanded ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{emp.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{emp.email}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border font-medium ${ROLE_STYLES[emp.role] || ROLE_STYLES.member}`}>
                          {ROLE_LABELS[emp.role] || emp.role}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600 truncate">{emp.department || '—'}</span>
                      <div>
                        {status.color === 'amber' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                            <AlertTriangle className="w-3 h-3" /> Not Set
                          </span>
                        ) : status.color === 'red' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
                            {status.label} <span className="text-red-500">({status.missingRequired} req missing)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">
                            <CheckCircle className="w-3 h-3" /> {status.label}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : emp.id); }}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            emp.sectionPermissions === null
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {emp.sectionPermissions === null ? 'Configure' : 'Edit'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded permission editor */}
                    {isExpanded && (
                      <PermissionEditor
                        employee={emp}
                        onSaved={fetchEmployees}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="text-xs text-slate-400 text-center py-2">
          Root admin account cannot be restricted and is not shown in this list.
          Permissions are applied instantly — employee will see changes on their next page load.
        </div>
      </div>
    </div>
  );
}
