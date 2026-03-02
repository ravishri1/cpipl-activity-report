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
  UserCircle,
  Settings,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Upload,
  Brain,
  ChevronDown,
  X,
} from 'lucide-react';
import { useState } from 'react';

const sectionIcons = {
  overview: LayoutDashboard,
  myWork: UserCircle,
  team: Users,
  admin: Settings,
};

export default function Sidebar({ isOpen, onClose }) {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    myWork: true,
    team: true,
    admin: true,
  });

  const isActive = (path) => location.pathname === path;

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const navSections = [
    {
      key: 'overview',
      label: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
      ],
    },
    {
      key: 'team',
      label: 'Team',
      items: [
        { to: '/directory', label: 'Directory', icon: Users },
        { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
      ],
    },
  ];

  // Admin section — only for admin/team_lead
  if (isAdmin) {
    navSections.push({
      key: 'admin',
      label: 'Admin',
      items: [
        { to: '/admin/team', label: 'Team Management', icon: Users },
        { to: '/admin/attendance', label: 'Team Attendance', icon: CheckSquare },
        { to: '/admin/leave-requests', label: 'Leave Requests', icon: ClipboardCheck },
        { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays },
        { to: '/admin/import', label: 'Import Employees', icon: Upload },
        { to: '/admin/ai-extract', label: 'AI Extract', icon: Brain },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    });
  }

  const handleLinkClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose?.();
    }
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
            const SectionIcon = sectionIcons[section.key] || LayoutDashboard;
            const isExpanded = expandedSections[section.key];

            return (
              <div key={section.key} className="mb-1">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
