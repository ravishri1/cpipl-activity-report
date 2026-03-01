import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ReportForm from './components/ReportForm';
import TeamManagement from './components/TeamManagement';
import ReportHistory from './components/ReportHistory';
import Settings from './components/Settings';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;
  return isAdmin ? children : <Navigate to="/dashboard" />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      {user && <Navbar />}
      <div className={user ? 'pt-4 px-4 max-w-7xl mx-auto pb-8' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/submit-report" element={<PrivateRoute><ReportForm /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><ReportHistory /></PrivateRoute>} />
          <Route path="/admin/team" element={<AdminRoute><TeamManagement /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </div>
  );
}
