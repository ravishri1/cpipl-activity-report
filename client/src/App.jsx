import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ReportForm from './components/ReportForm';
import TeamManagement from './components/TeamManagement';
import ReportHistory from './components/ReportHistory';
import Settings from './components/Settings';
import Leaderboard from './components/Leaderboard';
import { Shield } from 'lucide-react';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>;
  return isAdmin ? children : <Navigate to="/dashboard" />;
}

function CopyrightFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">
              &copy; {new Date().getFullYear()} Color Papers India Private Limited
            </span>
          </div>
          <p className="text-[10px] text-slate-400 text-center sm:text-right">
            Proprietary & Confidential. Unauthorized use or distribution is prohibited.
          </p>
        </div>
      </div>
    </footer>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {user && <Navbar />}
      <div className={user ? 'pt-4 px-4 max-w-7xl mx-auto pb-8 w-full flex-1' : 'flex-1'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/submit-report" element={<PrivateRoute><ReportForm /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><ReportHistory /></PrivateRoute>} />
          <Route path="/leaderboard" element={<PrivateRoute><Leaderboard /></PrivateRoute>} />
          <Route path="/admin/team" element={<AdminRoute><TeamManagement /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
      {user && <CopyrightFooter />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
