import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Shield } from 'lucide-react';

export default function AppLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

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
