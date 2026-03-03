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
  Brain,
  ChevronDown,
  X,
  Shield,
  ShieldCheck,
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
  GraduationCap,
  MessageSquare,
  BookOpen,
  UsersRound,
  FolderOpen,
} from 'lucide-react';
import { useState } from 'react';

export default function Sidebar({ isOpen, onClose }) {
  const { user, isStrictAdmin, isTeamLead, isSeparated } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    myWork: true,
    myTeam: true,
    team: true,
    people: false,
    timePay: false,
    organization: false,
  });

  const isActive = (path) => location.pathname === path;

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // ── Separated employee: minimal menu only ───────────────────────
  if (isSeparated) {
    const separatedSections = [
      {
        key: 'limitedAccess',
        label: 'Available',
        items: [
          { to: '/payslips', label: 'My Payslips', icon: IndianRupee },
          { to: '/my-tickets', label: 'My Tickets', icon: LifeBuoy },
          { to: '/suggestions', label: 'Suggestions', icon: MessageSquare },
        ],
      },
    ];

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
            {/* Info notice */}
            <div className="mx-1 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Your employment has ended. You have limited access to payslips, tickets, and suggestions.
              </p>
            </div>
            {separatedSections.map((section) => (
              <div key={section.key} className="mb-1">
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => window.innerWidth < 1024 && onClose?.()}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive(item.to)
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 flex-shrink-0 ${
                        isActive(item.to) ? 'text-blue-600' : 'text-slate-400'
                      }`} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-slate-100 px-3 py-3">
            <div className="flex items-center gap-2.5">
              {user?.driveProfilePhotoUrl ? (
                <img src={user.driveProfilePhotoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{user?.name}</p>
                <p className="text-[10px] text-amber-600 font-medium">Separated</p>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

  // ── Build navigation sections based on role ───────────────────────
  const navSections = [
    {
      key: 'overview',
      label: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      key: 'myWork',
      label: 'My Work',
      items: [
        { to: '/submit-report', label: 'Submit Report', icon: ClipboardEdit },
        { to: '/reports', label: 'Report History', icon: FileText },
        { to: '/attendance', label: 'Attendance', icon: Clock },
        { to: '/leave', label: 'Leave', icon: CalendarOff },
        { to: '/expenses', label: 'Expenses', icon: Wallet },
        { to: '/payslips', label: 'Payslips', icon: IndianRupee },
        { to: '/my-assets', label: 'My Assets', icon: Package },
        { to: '/policies', label: 'Policies', icon: Shield },
        { to: '/surveys', label: 'Surveys', icon: ClipboardList },
        { to: '/my-tickets', label: 'My Tickets', icon: LifeBuoy },
        { to: '/training', label: 'Training', icon: GraduationCap },
        { to: '/suggestions', label: 'Suggestions', icon: MessageSquare },
        { to: '/wiki', label: 'Knowledge Base', icon: BookOpen },
        { to: '/my-files', label: 'My Files', icon: FolderOpen },
      ],
    },
  ];

  // ── Team Lead: "My Team" section ──────────────────────────────────
  if (isTeamLead) {
    navSections.push({
      key: 'myTeam',
      label: 'My Team',
      teamLeadOnly: true,
      items: [
        { to: '/my-team', label: 'Team Overview', icon: UsersRound },
        { to: '/admin/attendance', label: 'Team Attendance', icon: CheckSquare },
        { to: '/admin/leave-requests', label: 'Leave Requests', icon: ClipboardCheck },
        { to: '/admin/expense-claims', label: 'Expense Claims', icon: Receipt },
      ],
    });
  }

  // ── Common: Team directory section ────────────────────────────────
  navSections.push({
    key: 'team',
    label: 'Team',
    items: [
      { to: '/directory', label: 'Directory', icon: Users },
      { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  });

  // ── Admin-only sections ───────────────────────────────────────────
  if (isStrictAdmin) {
    navSections.push(
      {
        key: 'people',
        label: 'People',
        adminOnly: true,
        items: [
          { to: '/admin/team', label: 'Team Management', icon: Users },
          { to: '/admin/onboarding', label: 'Onboarding', icon: UserPlus },
          { to: '/admin/separations', label: 'Separations', icon: UserMinus },
          { to: '/admin/import', label: 'Import Employees', icon: Upload },
          { to: '/admin/ai-extract', label: 'AI Extract', icon: Brain },
        ],
      },
      {
        key: 'timePay',
        label: 'Time & Pay',
        adminOnly: true,
        items: [
          { to: '/admin/attendance', label: 'Team Attendance', icon: CheckSquare },
          { to: '/admin/shifts', label: 'Shift Management', icon: Clock },
          { to: '/admin/leave-requests', label: 'Leave Requests', icon: ClipboardCheck },
          { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays },
          { to: '/admin/payroll', label: 'Payroll', icon: CreditCard },
          { to: '/admin/salary-setup', label: 'Salary Setup', icon: Banknote },
          { to: '/admin/expense-claims', label: 'Expense Claims', icon: Receipt },
        ],
      },
      {
        key: 'organization',
        label: 'Organization',
        adminOnly: true,
        items: [
          { to: '/admin/assets', label: 'Asset Manager', icon: Package },
          { to: '/admin/letters', label: 'Letters', icon: Mail },
          { to: '/admin/policies', label: 'Policy Manager', icon: ShieldCheck },
          { to: '/admin/policy-scorecard', label: 'Policy Scorecard', icon: BarChart3 },
          { to: '/admin/surveys', label: 'Survey Manager', icon: ClipboardList },
          { to: '/admin/tickets', label: 'Helpdesk', icon: LifeBuoy },
          { to: '/admin/training', label: 'Training Manager', icon: GraduationCap },
          { to: '/admin/suggestions', label: 'Suggestions', icon: MessageSquare },
          { to: '/admin/reports', label: 'HR Reports', icon: PieChart },
          { to: '/admin/settings', label: 'Settings', icon: Settings },
        ],
      }
    );
  }

  const handleLinkClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose?.();
    }
  };

  // Section header color: admin=amber, teamLead=emerald, default=slate
  const getSectionColor = (section) => {
    if (section.adminOnly) return 'text-amber-500';
    if (section.teamLeadOnly) return 'text-emerald-500';
    return 'text-slate-400';
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100 lg:hidden">
          <span className="font-semibold text-slate-800 text-sm">Navigation</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Brand — desktop only */}
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
          {navSections.map((section) => {
            const isExpanded = expandedSections[section.key];

            return (
              <div key={section.key} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:text-slate-600 ${getSectionColor(section)}`}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isExpanded ? '' : '-rotate-90'
                    }`}
                  />
                </button>

                {/* Section items */}
                {isExpanded && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={handleLinkClick}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                          isActive(item.to)
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 ${
                          isActive(item.to) ? 'text-blue-600' : 'text-slate-400'
                        }`} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info — bottom of sidebar */}
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
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                {user?.department && (
                  <span className="text-[9px] text-slate-300">• {user.department}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
