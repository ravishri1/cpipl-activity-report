import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Search, X, LayoutDashboard, ClipboardEdit, Clock, CalendarOff, AlarmClock,
  IndianRupee, Wallet, ShieldCheck, ClipboardList, LifeBuoy, BookOpen,
  Package, FolderOpen, Users, Trophy, UsersRound, CheckSquare, ClipboardCheck,
  Receipt, Upload, Briefcase, BadgeCheck, UserPlus, UserMinus, MessageSquare,
  BarChart3, CreditCard, Banknote, Fingerprint, Calendar, LayoutGrid,
  Gift, Activity, HeartPulse, RefreshCw, Heart, Mail, ScrollText,
  LineChart, PieChart, Bug, Building2, KeyRound, Settings, Megaphone,
  FileText, ArrowRight,
} from 'lucide-react';

// ─── All searchable routes ─────────────────────────────────────────────────────
// Add new routes here — they automatically become searchable.
const ALL_ROUTES = [
  // Overview
  { label: 'Dashboard',               path: '/dashboard',                  section: 'Overview',           group: '',                        icon: LayoutDashboard, keywords: 'home summary stats overview' },
  { label: 'Announcements',           path: '/announcements',              section: 'Overview',           group: '',                        icon: Megaphone,       keywords: 'news notice broadcast' },

  // My Work → Time & Attendance
  { label: 'Activity Reports',        path: '/activity-reports',           section: 'My Work',            group: 'Time & Attendance',       icon: ClipboardEdit,   keywords: 'eod report daily task' },
  { label: 'Attendance',              path: '/attendance',                 section: 'My Work',            group: 'Time & Attendance',       icon: Clock,           keywords: 'clock in out punch' },
  { label: 'Leave',                   path: '/leave',                      section: 'My Work',            group: 'Time & Attendance',       icon: CalendarOff,     keywords: 'holiday absence sick casual' },
  { label: 'Comp-Off',               path: '/my-comp-off',                 section: 'My Work',            group: 'Time & Attendance',       icon: AlarmClock,      keywords: 'compensatory off overtime' },
  { label: 'Regularization',         path: '/attendance-regularization',   section: 'My Work',            group: 'Time & Attendance',       icon: ClipboardEdit,   keywords: 'attendance correction fix miss' },

  // My Work → Money & Benefits
  { label: 'Payslips',               path: '/payslips',                    section: 'My Work',            group: 'Money & Benefits',        icon: IndianRupee,     keywords: 'salary pay slip ctc' },
  { label: 'Expenses',               path: '/expenses',                    section: 'My Work',            group: 'Money & Benefits',        icon: Wallet,          keywords: 'reimbursement claim bill' },

  // My Work → Support & Policies
  { label: 'Compliance',             path: '/my-compliance',               section: 'My Work',            group: 'Support & Policies',      icon: ShieldCheck,     keywords: 'policy accept sign' },
  { label: 'Surveys',               path: '/surveys',                      section: 'My Work',            group: 'Support & Policies',      icon: ClipboardList,   keywords: 'feedback form questionnaire' },
  { label: 'My Support',            path: '/my-support',                   section: 'My Work',            group: 'Support & Policies',      icon: LifeBuoy,        keywords: 'ticket helpdesk help request' },
  { label: 'Knowledge Base',        path: '/wiki',                         section: 'My Work',            group: 'Support & Policies',      icon: BookOpen,        keywords: 'wiki article doc faq guide' },

  // My Workspace
  { label: 'My Assets',             path: '/my-workspace',                 section: 'My Workspace',       group: '',                        icon: Package,         keywords: 'laptop device equipment assigned' },
  { label: 'My Files',              path: '/my-files',                     section: 'My Workspace',       group: '',                        icon: FolderOpen,      keywords: 'document upload drive file' },

  // Team
  { label: 'Directory',             path: '/directory',                    section: 'Team',               group: '',                        icon: Users,           keywords: 'employees list people contact' },
  { label: 'Leaderboard',          path: '/leaderboard',                   section: 'Team',               group: '',                        icon: Trophy,          keywords: 'points score ranking appreciation' },

  // My Team (team lead)
  { label: 'Team Overview',        path: '/my-team',                       section: 'My Team',            group: '',                        icon: UsersRound,      keywords: 'team lead reports subordinate' },

  // People → Employee Management (admin)
  { label: 'Access Control',       path: '/admin/access-control',          section: 'People',             group: 'Employee Management',     icon: ShieldCheck,     keywords: 'permissions role section deny restrict' },
  { label: 'Team Management',      path: '/admin/team',                    section: 'People',             group: 'Employee Management',     icon: Users,           keywords: 'manage employees admin' },
  { label: 'Import Employees',     path: '/admin/import',                  section: 'People',             group: 'Employee Management',     icon: Upload,          keywords: 'bulk csv upload import greythr' },

  // People → Hiring & Lifecycle (admin)
  { label: 'Recruitment',         path: '/admin/recruitment',              section: 'People',             group: 'Hiring & Lifecycle',      icon: Briefcase,       keywords: 'job opening candidate hire interview' },
  { label: 'Confirmations',       path: '/admin/confirmations',            section: 'People',             group: 'Hiring & Lifecycle',      icon: BadgeCheck,      keywords: 'probation confirm employee' },
  { label: 'Onboarding',         path: '/admin/onboarding',                section: 'People',             group: 'Hiring & Lifecycle',      icon: UserPlus,        keywords: 'new joiner joining checklist induction' },
  { label: 'Separations',        path: '/admin/separations',               section: 'People',             group: 'Hiring & Lifecycle',      icon: UserMinus,       keywords: 'exit fnf full final settlement resignation' },

  // People → Engagement (admin)
  { label: 'Survey Manager',     path: '/admin/surveys',                   section: 'People',             group: 'Engagement',              icon: ClipboardList,   keywords: 'survey create feedback' },
  { label: 'Suggestions',       path: '/admin/suggestions',                section: 'People',             group: 'Engagement',              icon: MessageSquare,   keywords: 'suggestion idea automation insight' },

  // Time & Pay → Attendance (admin)
  { label: 'Team Attendance',    path: '/admin/attendance',                section: 'Time & Pay',         group: 'Attendance',              icon: CheckSquare,     keywords: 'team clock in out track' },
  { label: 'Attendance Muster', path: '/admin/muster',                    section: 'Time & Pay',         group: 'Attendance',              icon: LayoutGrid,      keywords: 'muster roll monthly report register' },
  { label: 'Biometric',         path: '/admin/biometric',                  section: 'Time & Pay',         group: 'Attendance',              icon: Fingerprint,     keywords: 'fingerprint device sync' },
  { label: 'Shift Management',  path: '/admin/shifts',                     section: 'Time & Pay',         group: 'Attendance',              icon: Clock,           keywords: 'shift timing morning night general' },
  { label: 'Shift Roster',      path: '/admin/shift-roster',               section: 'Time & Pay',         group: 'Attendance',              icon: Calendar,        keywords: 'roster schedule assign shift' },
  { label: 'Comp-Off Manager',  path: '/admin/comp-off',                   section: 'Time & Pay',         group: 'Attendance',              icon: AlarmClock,      keywords: 'compensatory off approve' },
  { label: 'Regularization Manager', path: '/admin/regularization',        section: 'Time & Pay',         group: 'Attendance',              icon: ClipboardEdit,   keywords: 'attendance correction approve' },

  // Time & Pay → Leave (admin)
  { label: 'Leave Requests',    path: '/admin/leave-requests',             section: 'Time & Pay',         group: 'Leave',                   icon: ClipboardCheck,  keywords: 'approve reject leave request' },
  { label: 'Leave Granter',    path: '/admin/leave-granter',               section: 'Time & Pay',         group: 'Leave',                   icon: Gift,            keywords: 'grant credit leave balance' },
  { label: 'Leave Dashboard',  path: '/admin/leave-dashboard',             section: 'Time & Pay',         group: 'Leave',                   icon: BarChart3,       keywords: 'leave summary analytics' },
  { label: 'Holidays',         path: '/admin/holidays',                    section: 'Time & Pay',         group: 'Leave',                   icon: Calendar,        keywords: 'holiday calendar national festival' },

  // Time & Pay → Payroll (admin)
  { label: 'Payroll',          path: '/admin/payroll',                     section: 'Time & Pay',         group: 'Payroll',                 icon: CreditCard,      keywords: 'salary run payslip generate ctc' },
  { label: 'Salary Setup',    path: '/admin/salary-setup',                 section: 'Time & Pay',         group: 'Payroll',                 icon: Banknote,        keywords: 'salary structure component hra pf' },
  { label: 'Expense Claims',  path: '/admin/expense-claims',               section: 'Time & Pay',         group: 'Payroll',                 icon: Receipt,         keywords: 'approve reject expense reimbursement' },

  // Organization → Assets & Maintenance (admin)
  { label: 'Asset Manager',          path: '/admin/assets',                section: 'Organization',       group: 'Assets & Maintenance',    icon: Package,         keywords: 'laptop phone asset assign handover' },
  { label: 'Asset Lifecycle',        path: '/admin/asset-lifecycle',       section: 'Organization',       group: 'Assets & Maintenance',    icon: Activity,        keywords: 'asset lifecycle retire dispose' },
  { label: 'Predictive Maintenance', path: '/admin/predictive-maintenance',section: 'Organization',       group: 'Assets & Maintenance',    icon: HeartPulse,      keywords: 'maintenance repair predict schedule' },

  // Organization → Compliance & Risk (admin)
  { label: 'Compliance Tracker',    path: '/admin/compliance',             section: 'Organization',       group: 'Compliance & Risk',       icon: BadgeCheck,      keywords: 'compliance gst pf pt esi due date' },
  { label: 'Renewal Manager',      path: '/admin/renewals',                section: 'Organization',       group: 'Compliance & Risk',       icon: RefreshCw,       keywords: 'renew licence certificate expiry' },
  { label: 'Insurance Management', path: '/admin/insurance',               section: 'Organization',       group: 'Compliance & Risk',       icon: Heart,           keywords: 'health insurance gmc gpa policy' },

  // Organization → Documents & Policies (admin)
  { label: 'Letters',              path: '/admin/letters',                 section: 'Organization',       group: 'Documents & Policies',    icon: Mail,            keywords: 'offer appointment experience letter generate' },
  { label: 'Policy Manager',      path: '/admin/policies',                 section: 'Organization',       group: 'Documents & Policies',    icon: ShieldCheck,     keywords: 'policy create publish version accept' },
  { label: 'Company Contracts',   path: '/admin/contracts',                section: 'Organization',       group: 'Documents & Policies',    icon: ScrollText,      keywords: 'nda contract sign vendor agreement' },

  // Organization → Reports & Support (admin)
  { label: 'HR Analytics',        path: '/admin/hr-analytics',             section: 'Organization',       group: 'Reports & Support',       icon: LineChart,       keywords: 'analytics headcount attrition trend' },
  { label: 'HR Reports',          path: '/admin/reports',                  section: 'Organization',       group: 'Reports & Support',       icon: PieChart,        keywords: 'report download export employee data' },
  { label: 'Helpdesk',           path: '/admin/tickets',                   section: 'Organization',       group: 'Reports & Support',       icon: LifeBuoy,        keywords: 'ticket support sla resolve' },
  { label: 'Error Reports',      path: '/admin/error-reports',             section: 'Organization',       group: 'Reports & Support',       icon: Bug,             keywords: 'error crash log debug bug' },

  // Organization → Setup (admin)
  { label: 'Company Master',     path: '/admin/company-master',            section: 'Organization',       group: 'Setup',                   icon: Building2,       keywords: 'gstin company registration branch bank account legal entity' },
  { label: 'Credential Manager', path: '/admin/credentials',              section: 'Organization',       group: 'Setup',                   icon: KeyRound,        keywords: 'portal login password credential amazon flipkart' },
  { label: 'Departments',        path: '/admin/departments',               section: 'Organization',       group: 'Setup',                   icon: Building2,       keywords: 'department create manage' },
  { label: 'Settings',           path: '/admin/settings',                  section: 'Organization',       group: 'Setup',                   icon: Settings,        keywords: 'configuration ai key smtp google' },
];

// Section color map
const SECTION_COLORS = {
  'Overview':      'bg-slate-100 text-slate-600',
  'My Work':       'bg-blue-50 text-blue-600',
  'My Workspace':  'bg-purple-50 text-purple-600',
  'Team':          'bg-green-50 text-green-600',
  'My Team':       'bg-emerald-50 text-emerald-600',
  'People':        'bg-amber-50 text-amber-600',
  'Time & Pay':    'bg-orange-50 text-orange-600',
  'Organization':  'bg-indigo-50 text-indigo-600',
};

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const { isAdmin, isStrictAdmin, isTeamLead, deniedSections } = useAuth();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter routes by role
  const allowedRoutes = ALL_ROUTES.filter(r => {
    if (deniedSections?.includes(r.path)) return false;
    const isAdminRoute = r.path.startsWith('/admin/');
    const isTeamRoute = r.section === 'My Team';
    const isTeamOrDirRoute = r.path === '/directory';
    if (isAdminRoute && !isStrictAdmin) return false;
    if (isTeamRoute && !isTeamLead && !isStrictAdmin) return false;
    if (isTeamOrDirRoute && !isStrictAdmin && !isTeamLead) return false;
    return true;
  });

  // Filter by query
  const results = query.trim()
    ? allowedRoutes.filter(r => {
        const q = query.toLowerCase();
        return (
          r.label.toLowerCase().includes(q) ||
          r.section.toLowerCase().includes(q) ||
          r.group.toLowerCase().includes(q) ||
          r.keywords.toLowerCase().includes(q)
        );
      })
    : allowedRoutes.slice(0, 12); // show first 12 when no query

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset active index on query change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleSelect = useCallback((path) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (results[activeIdx]) handleSelect(results[activeIdx].path); }
    else if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search modules and features…"
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border border-slate-200 rounded text-slate-400">Esc</kbd>
        </div>

        {/* Results */}
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              No results for "<span className="font-medium text-slate-600">{query}</span>"
            </li>
          ) : (
            results.map((r, idx) => {
              const Icon = r.icon;
              const isActive = idx === activeIdx;
              return (
                <li key={r.path} data-idx={idx}>
                  <button
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => handleSelect(r.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                        {highlight(r.label, query)}
                      </span>
                      {r.group && (
                        <span className="text-xs text-slate-400 ml-1.5">
                          · {r.group}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${SECTION_COLORS[r.section] || 'bg-slate-100 text-slate-500'}`}>
                      {r.section}
                    </span>
                    {isActive && <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400">
          <span><kbd className="font-mono border border-slate-200 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono border border-slate-200 rounded px-1">↵</kbd> open</span>
          <span><kbd className="font-mono border border-slate-200 rounded px-1">Esc</kbd> close</span>
          <span className="ml-auto opacity-60">{results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
