import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GlobalSearch from '../shared/GlobalSearch';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { isSeparated } = useAuth();

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - constrained height for sticky scroll */}
        <div className="h-screen overflow-hidden">
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        {/* Main content area - scrollable */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} onSearchOpen={() => setSearchOpen(true)} />
          <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

          {/* Separated employee banner */}
          {isSeparated && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
              <div className="max-w-7xl mx-auto flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Your employment has ended. You have limited access to view payslips, raise tickets, and submit suggestions.
                </p>
              </div>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white/60 backdrop-blur-sm">
            <div className="px-4 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Shield className="w-3 h-3" />
                  <span className="text-[10px] font-medium">
                    &copy; {new Date().getFullYear()} Color Papers India Private Limited
                  </span>
                </div>
                <p className="text-[9px] text-slate-400">
                  Proprietary & Confidential. Unauthorized use prohibited.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
