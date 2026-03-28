import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserButton } from '@clerk/clerk-react';
import { FileText, Menu, Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import Breadcrumb from './Breadcrumb';

export default function TopBar({ onMenuToggle, onSearchOpen }) {
  const { user, isAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center h-14 px-4 gap-3">

        {/* Left: hamburger + brand/breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onMenuToggle} className="p-2 rounded-lg hover:bg-slate-100 lg:hidden">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">CPIPL HR</span>
          </Link>
          <div className="hidden lg:block">
            <Breadcrumb />
          </div>
        </div>

        {/* Center: search bar — grows to fill available space */}
        <div className="flex-1 flex justify-center px-4">
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 w-full max-w-md px-4 py-2 text-slate-400 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 hover:text-slate-600 transition-colors"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left text-sm truncate">Search modules & features…</span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-400 shrink-0">⌃K</kbd>
          </button>
        </div>

        {/* Right: notification + user info + avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell />
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-700">{user?.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.department} · {user?.role?.replace('_', ' ')}</p>
          </div>
          <UserButton
            afterSignOutUrl="/login"
            {...(!isAdmin && {
              userProfileProps: {
                appearance: {
                  elements: {
                    profileSection__danger: { display: 'none' },
                  },
                },
              },
            })}
          />
        </div>

      </div>
    </header>
  );
}
