import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardEdit,
  FileText,
  Trophy,
  Clock,
  CalendarOff,
  Users,
  Settings,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Upload,
  ChevronDown,
  ChevronRight,
  X,
  ShieldCheck,
  ShieldAlert,
  BarChart3,
  Megaphone,
  Wallet,
  IndianRupee,
  Receipt,
  CreditCard,
  Package,
  Mail,
  UserPlus,
  UserMinus,
  PieChart,
  ClipboardList,
  LifeBuoy,
  Banknote,
  MessageSquare,
  BookOpen,
  UsersRound,
  Bug,
  Boxes,
  Building2,
  BadgeCheck,
  ScrollText,
  Fingerprint,
  FolderOpen,
  Heart,
  Gift,
  Wrench,
  AlarmClock,
  Briefcase,
  RefreshCw,
  Activity,
  HeartPulse,
  LineChart,
  LayoutGrid,
  Calendar,
  KeyRound,
  Home,
  ClipboardSignature,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const SIDEBAR_STORAGE_KEY = 'cpipl-sidebar-expanded';
const DEFAULT_EXPANDED = {
  // Level-1 sections
  overview: true,
  myWork: true,
  myWorkspace: true,
  myTeam: true,
  team: true,
  people: false,
  timePay: false,
  organization: false,
  // Level-2 groups inside People
  peopleManagement: false,
  peopleHiring: false,
  peopleEngagement: false,
  // Level-2 groups inside Organization
  orgAssets: false,
  orgCompliance: false,
  orgDocuments: false,
  orgReports: false,
  orgSetup: false,
  // Level-2 groups inside My Work
  timeAttendance: true,
  moneyBenefits: false,
  supportPolicies: false,
  // Level-2 groups inside My Workspace
  personal: true,
};

function getInitialExpanded() {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored) return { ...DEFAULT_EXPANDED, ...JSON.parse(stored) };
  } catch { /* ignore parse errors */ }
  return DEFAULT_EXPANDED;
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, isStrictAdmin, isTeamLead, isSeparated, deniedSections } = useAuth();
  const location = useLocation();
  const [expanded, setExpanded] = useState(getInitialExpanded);

  // Persist sidebar state to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(expanded)); } catch { /* ignore */ }
  }, [expanded]);

  const isActive = (path) => location.pathname === path;

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) onClose?.();
  };

  // ── Separated employee: minimal menu only ───────────────────────
  if (isSeparated) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
        )}
        <aside
          className={`fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100 lg:hidden">
            <span className="font-semibold text-slate-800 text-sm">Navigation</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-2.5 h-14 px-4 border-b border-slate-100">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-800 text-[13px] block">CPIPL HR</span>
              <span className="text-[10px] text-slate-400 font-medium">Limited Access</span>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <div className="mx-1 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Your employment has ended. You have limited access to payslips and support.
              </p>
            </div>
            <div className="mb-1">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Available
              </div>
              <div className="space-y-0.5">
                {[
                  { to: '/payslips', label: 'My Payslips', icon: IndianRupee },
                  { to: '/my-support', label: 'My Support', icon: LifeBuoy },
                ].map((item) => (
                  <NavItem key={item.to} item={item} isActive={isActive(item.to)} onClick={handleLinkClick} />
                ))}
              </div>
            </div>
          </nav>
          <UserFooter user={user} label="Separated" labelClass="text-amber-600" />
        </aside>
      </>
    );
  }

  // ── Item lists ────────────────────────────────────────────────────
  const overviewItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/announcements', label: 'Announcements', icon: Megaphone },
  ];

  // My Work → Level-2 groups
  const myWorkGroups = [
    {
      key: 'timeAttendance',
      label: 'Time & Attendance',
      icon: Clock,
      items: [
        { to: '/activity-reports',           label: 'Activity Reports',      icon: ClipboardEdit },
        { to: '/attendance',                  label: 'Attendance',            icon: Clock },
        { to: '/leave',                       label: 'Leave',                 icon: CalendarOff },
        { to: '/my-comp-off',                 label: 'Comp-Off',              icon: AlarmClock },
        { to: '/attendance-regularization',   label: 'Regularization',        icon: ClipboardEdit },
        { to: '/my-wfh',                      label: 'Work From Home',        icon: Home },
      ],
    },
    {
      key: 'moneyBenefits',
      label: 'Money & Benefits',
      icon: IndianRupee,
      items: [
        { to: '/payslips',        label: 'Payslips',               icon: IndianRupee },
        { to: '/expenses',        label: 'Expenses',               icon: Wallet },
      ],
    },
    {
      key: 'supportPolicies',
      label: 'Support & Policies',
      icon: ShieldCheck,
      items: [
        { to: '/my-compliance',       label: 'Compliance',         icon: ShieldCheck },
        { to: '/surveys',             label: 'Surveys',            icon: ClipboardList },
        { to: '/my-support',          label: 'My Support',         icon: LifeBuoy },
        { to: '/wiki',                label: 'Knowledge Base',     icon: BookOpen },
        { to: '/my-appraisals',       label: 'My Appraisals',      icon: LineChart },
        { to: '/my-goals',            label: 'My Goals',           icon: CheckSquare },
        { to: '/my-exit-interview',   label: 'Exit Interview',     icon: ClipboardSignature },
        { to: '/my-grievances',       label: 'My Grievances',      icon: MessageSquare },
        { to: '/weekly-pulse',        label: 'Weekly Pulse',       icon: HeartPulse },
      ],
    },
  ];

  const myWorkspaceItems = [
    { to: '/my-workspace',       label: 'My Assets',      icon: Package },
    { to: '/my-asset-requests',  label: 'Asset Requests', icon: Briefcase },
    { to: '/my-skills',          label: 'My Skills',      icon: BadgeCheck },
    { to: '/my-files',           label: 'My Files',       icon: FolderOpen },
  ];

  const teamItems = [
    ...(isStrictAdmin || isTeamLead ? [{ to: '/directory', label: 'Directory', icon: Users }] : []),
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  const myTeamItems = [
    { to: '/my-team',                label: 'Team Overview',    icon: UsersRound },
    { to: '/admin/attendance',       label: 'Team Attendance',  icon: CheckSquare },
    { to: '/admin/leave-requests',   label: 'Leave Requests',   icon: ClipboardCheck },
    { to: '/admin/expense-claims',   label: 'Expense Claims',   icon: Receipt },
  ];

  const peopleGroups = [
    {
      key: 'peopleManagement',
      label: 'Employee Management',
      icon: Users,
      items: [
        { to: '/admin/access-control', label: 'Access Control',   icon: ShieldCheck },
        { to: '/admin/team',           label: 'Team Management',  icon: Users },
        { to: '/admin/import',         label: 'Import Employees', icon: Upload },
      ],
    },
    {
      key: 'peopleHiring',
      label: 'Hiring & Lifecycle',
      icon: Briefcase,
      items: [
        { to: '/admin/recruitment',       label: 'Recruitment',        icon: Briefcase },
        { to: '/admin/confirmations',     label: 'Confirmations',      icon: BadgeCheck },
        { to: '/admin/onboarding',        label: 'Onboarding',         icon: UserPlus },
        { to: '/admin/separations',       label: 'Separations',        icon: UserMinus },
        { to: '/admin/exit-interviews',   label: 'Exit Interviews',    icon: ClipboardSignature },
      ],
    },
    {
      key: 'peopleEngagement',
      label: 'Engagement',
      icon: MessageSquare,
      items: [
        { to: '/admin/surveys',        label: 'Survey Manager',   icon: ClipboardList },
        { to: '/admin/suggestions',    label: 'Suggestions',      icon: MessageSquare },
        { to: '/admin/appraisals',     label: 'Appraisals',       icon: LineChart },
        { to: '/admin/grievances',     label: 'Grievances',       icon: ScrollText },
        { to: '/admin/pulse',          label: 'Pulse Dashboard',  icon: HeartPulse },
        { to: '/admin/skills-matrix',  label: 'Skills Matrix',    icon: BadgeCheck },
      ],
    },
  ];

  const timePayGroups = [
    {
      key: 'adminAttendance',
      label: 'Attendance',
      icon: CheckSquare,
      items: [
        { to: '/admin/attendance',     label: 'Team Attendance',   icon: CheckSquare },
        { to: '/admin/muster',         label: 'Attendance Muster', icon: LayoutGrid },
        { to: '/admin/biometric',      label: 'Biometric',         icon: Fingerprint },
        { to: '/admin/shifts',         label: 'Shift Management',  icon: Clock },
        { to: '/admin/shift-roster',   label: 'Shift Roster',      icon: Calendar },
        { to: '/admin/comp-off',       label: 'Comp-Off Manager',  icon: AlarmClock },
        { to: '/admin/regularization', label: 'Regularization',    icon: ClipboardEdit },
        { to: '/admin/wfh',            label: 'WFH Manager',       icon: Home },
      ],
    },
    {
      key: 'adminLeave',
      label: 'Leave',
      icon: CalendarOff,
      items: [
        { to: '/admin/leave-requests',   label: 'Leave Requests',  icon: ClipboardCheck },
        { to: '/admin/leave-granter',    label: 'Leave Granter',   icon: Gift },
        { to: '/admin/leave-dashboard',  label: 'Leave Dashboard', icon: BarChart3 },
        { to: '/admin/holidays',         label: 'Holidays',        icon: CalendarDays },
      ],
    },
    {
      key: 'adminPayroll',
      label: 'Payroll',
      icon: CreditCard,
      items: [
        { to: '/admin/payroll',        label: 'Payroll',          icon: CreditCard },
        { to: '/admin/salary-setup',   label: 'Salary Setup',     icon: Banknote },
        { to: '/admin/expense-claims', label: 'Expense Claims',   icon: Receipt },
      ],
    },
  ];

  const organizationGroups = [
    {
      key: 'orgAssets',
      label: 'Assets & Maintenance',
      icon: Package,
      items: [
        { to: '/admin/assets',                  label: 'Asset Manager',           icon: Package },
        { to: '/admin/asset-requests',          label: 'Asset Requests',          icon: Briefcase },
        { to: '/admin/asset-lifecycle',         label: 'Asset Lifecycle',         icon: Activity },
        { to: '/admin/predictive-maintenance',  label: 'Predictive Maintenance',  icon: HeartPulse },
      ],
    },
    {
      key: 'orgCompliance',
      label: 'Compliance & Risk',
      icon: BadgeCheck,
      items: [
        { to: '/admin/compliance',              label: 'Compliance Tracker',      icon: BadgeCheck },
        { to: '/admin/renewals',                label: 'Renewal Manager',         icon: RefreshCw },
        { to: '/admin/insurance',               label: 'Insurance Management',    icon: Heart },
        { to: '/admin/document-expiry',         label: 'Document Expiry',         icon: CalendarDays },
      ],
    },
    {
      key: 'orgDocuments',
      label: 'Documents & Policies',
      icon: ScrollText,
      items: [
        { to: '/admin/letters',                 label: 'Letters',                 icon: Mail },
        { to: '/admin/policies',                label: 'Policy Manager',          icon: ShieldCheck },
        { to: '/admin/contracts',               label: 'Company Contracts',       icon: ScrollText },
      ],
    },
    {
      key: 'orgReports',
      label: 'Reports & Support',
      icon: PieChart,
      items: [
        { to: '/admin/hr-analytics',            label: 'HR Analytics',            icon: LineChart },
        { to: '/admin/hr-calendar',             label: 'HR Calendar',             icon: CalendarDays },
        { to: '/admin/visitors',                label: 'Visitor Register',        icon: UsersRound },
        { to: '/admin/reports',                 label: 'HR Reports',              icon: PieChart },
        { to: '/admin/tickets',                 label: 'Helpdesk',                icon: LifeBuoy },
        { to: '/admin/error-reports',           label: 'Error Reports',           icon: Bug },
      ],
    },
    {
      key: 'orgSetup',
      label: 'Setup',
      icon: Settings,
      items: [
        { to: '/admin/company-master',          label: 'Company Master',          icon: Building2 },
        { to: '/admin/credentials',             label: 'Credential Manager',      icon: KeyRound },
        { to: '/admin/departments',             label: 'Departments',             icon: Building2 },
        { to: '/admin/security-audit',          label: 'Security Audit',          icon: ShieldAlert },
        { to: '/admin/settings',                label: 'Settings',                icon: Settings },
      ],
    },
  ];

  // Helper: filter denied items (access-control + settings always visible for strict admins)
  const alwaysVisible = isStrictAdmin ? ['/admin/access-control', '/admin/settings'] : [];
  const filterItems = (items) => items.filter((item) => alwaysVisible.includes(item.to) || !deniedSections.includes(item.to));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100 lg:hidden">
          <span className="font-semibold text-slate-800 text-sm">Navigation</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Brand — desktop */}
        <div className="hidden lg:flex items-center gap-2.5 h-14 px-4 border-b border-slate-100">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-slate-800 text-[13px] block">CPIPL HR</span>
            <span className="text-[10px] text-slate-400 font-medium">Color Papers India</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">

          {/* ── Overview (flat) ─────────────────────────────── */}
          <FlatSection
            label="Overview"
            sectionKey="overview"
            items={filterItems(overviewItems)}
            expanded={expanded.overview}
            onToggle={() => toggle('overview')}
            isActive={isActive}
            onLinkClick={handleLinkClick}
          />

          {/* ── My Work (nested groups) ─────────────────────── */}
          <GroupedSection
            label="My Work"
            sectionKey="myWork"
            groups={myWorkGroups}
            expanded={expanded}
            onToggleSection={() => toggle('myWork')}
            onToggleGroup={(key) => toggle(key)}
            isActive={isActive}
            onLinkClick={handleLinkClick}
            filterItems={filterItems}
          />

          {/* ── My Workspace (nested groups) ───────────────── */}
          <FlatSection
            label="My Workspace"
            sectionKey="myWorkspace"
            items={filterItems(myWorkspaceItems)}
            expanded={expanded.myWorkspace}
            onToggle={() => toggle('myWorkspace')}
            isActive={isActive}
            onLinkClick={handleLinkClick}
          />

          {/* ── My Team (team lead, flat) ───────────────────── */}
          {isTeamLead && (
            <FlatSection
              label="My Team"
              sectionKey="myTeam"
              items={filterItems(myTeamItems)}
              expanded={expanded.myTeam}
              onToggle={() => toggle('myTeam')}
              isActive={isActive}
              onLinkClick={handleLinkClick}
              labelClass="text-emerald-500"
            />
          )}

          {/* ── Team (flat) ─────────────────────────────────── */}
          {filterItems(teamItems).length > 0 && (
            <FlatSection
              label="Team"
              sectionKey="team"
              items={filterItems(teamItems)}
              expanded={expanded.team}
              onToggle={() => toggle('team')}
              isActive={isActive}
              onLinkClick={handleLinkClick}
            />
          )}

          {/* ── Admin sections (flat) ───────────────────────── */}
          {isStrictAdmin && (
            <>
              <GroupedSection
                label="People"
                sectionKey="people"
                groups={peopleGroups}
                expanded={expanded}
                onToggleSection={() => toggle('people')}
                onToggleGroup={(key) => toggle(key)}
                isActive={isActive}
                onLinkClick={handleLinkClick}
                filterItems={filterItems}
                labelClass="text-amber-500"
              />
              <GroupedSection
                label="Time & Pay"
                sectionKey="timePay"
                groups={timePayGroups}
                expanded={expanded}
                onToggleSection={() => toggle('timePay')}
                onToggleGroup={(key) => toggle(key)}
                isActive={isActive}
                onLinkClick={handleLinkClick}
                filterItems={filterItems}
                labelClass="text-amber-500"
              />
              <GroupedSection
                label="Organization"
                sectionKey="organization"
                groups={organizationGroups}
                expanded={expanded}
                onToggleSection={() => toggle('organization')}
                onToggleGroup={(key) => toggle(key)}
                isActive={isActive}
                onLinkClick={handleLinkClick}
                filterItems={filterItems}
                labelClass="text-amber-500"
              />
            </>
          )}
        </nav>

        <UserFooter user={user} />
      </aside>
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────

function NavItem({ item, isActive, onClick, indent = false }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors ${
        indent ? 'px-3 py-1.5 ml-1' : 'px-3 py-2'
      } ${
        isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
      {item.label}
    </Link>
  );
}

function FlatSection({ label, sectionKey, items, expanded, onToggle, isActive, onLinkClick, labelClass = 'text-slate-400' }) {
  if (!items.length) return null;
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:text-slate-600 ${labelClass}`}
      >
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavItem key={item.to} item={item} isActive={isActive(item.to)} onClick={onLinkClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupedSection({ label, sectionKey, groups, expanded, onToggleSection, onToggleGroup, isActive, onLinkClick, filterItems, labelClass = 'text-slate-400' }) {
  const sectionExpanded = expanded[sectionKey];

  // Check if any group has visible items
  const hasAnyItems = groups.some((g) => filterItems(g.items).length > 0);
  if (!hasAnyItems) return null;

  return (
    <div className="mb-1">
      {/* Level-1 section header */}
      <button
        onClick={onToggleSection}
        className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${labelClass} hover:text-slate-600`}
      >
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sectionExpanded ? '' : '-rotate-90'}`} />
      </button>

      {sectionExpanded && (
        <div className="space-y-0.5">
          {groups.map((group) => {
            const visibleItems = filterItems(group.items);
            if (!visibleItems.length) return null;
            const groupExpanded = expanded[group.key];
            const hasActiveItem = visibleItems.some((item) => isActive(item.to));

            return (
              <div key={group.key}>
                {/* Level-2 group header */}
                <button
                  onClick={() => onToggleGroup(group.key)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    hasActiveItem
                      ? 'text-blue-700 bg-blue-50/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className={`w-3.5 h-3.5 flex-shrink-0 ${hasActiveItem ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${groupExpanded ? '' : '-rotate-90'}`} />
                </button>

                {/* Level-3 items */}
                {groupExpanded && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-slate-100 space-y-0.5">
                    {visibleItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={onLinkClick}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                          isActive(item.to)
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <item.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive(item.to) ? 'text-blue-600' : 'text-slate-400'}`} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserFooter({ user, label, labelClass = 'text-slate-400' }) {
  return (
    <div className="border-t border-slate-100 px-3 py-3">
      <div className="flex items-center gap-2.5">
        {user?.driveProfilePhotoUrl ? (
          <img src={user.driveProfilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 truncate">{user?.name}</p>
          {label ? (
            <p className={`text-[10px] font-medium ${labelClass}`}>{label}</p>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
              {user?.department && (
                <span className="text-[9px] text-slate-300">• {user.department}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
