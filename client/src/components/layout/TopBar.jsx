import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserButton } from '@clerk/clerk-react';
import { FileText, Menu } from 'lucide-react';

export default function TopBar({ onMenuToggle }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: hamburger + brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          {/* Brand — mobile only */}
          <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">CPIPL HR</span>
          </Link>
        </div>

        {/* Right: user info + Clerk button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-slate-700">{user?.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.department} · {user?.role?.replace('_', ' ')}</p>
          </div>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </div>
    </header>
  );
}
