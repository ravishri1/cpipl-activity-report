import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserButton } from '@clerk/clerk-react';
import { LayoutDashboard, FileText, Users, Settings, ClipboardEdit } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/submit-report', label: 'Submit Report', icon: ClipboardEdit },
    { to: '/reports', label: 'History', icon: FileText },
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-800">Color Papers</span>
          </div>

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
