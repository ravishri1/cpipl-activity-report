import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserButton } from '@clerk/clerk-react';
import { LayoutDashboard, FileText, Users, Settings, ClipboardEdit, Trophy } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/submit-report', label: 'Submit Report', icon: ClipboardEdit },
    { to: '/reports', label: 'History', icon: FileText },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  if (isAdmin) {
    links.push({ to: '/admin/team', label: 'Team', icon: Users });
    links.push({ to: '/admin/settings', label: 'Settings', icon: Settings });
  }

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-slate-800 text-sm block group-hover:text-blue-700 transition-colors">EOD Report</span>
              <span className="text-[10px] text-slate-400 font-medium">Color Papers India</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user?.name} <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{user?.role}</span>
            </span>
            <UserButton afterSignOutUrl="/login" />
          </div>
        </div>
      </div>
    </nav>
  );
}
