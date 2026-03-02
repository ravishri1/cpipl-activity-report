import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import ReportForm from './components/reports/ReportForm';
import ReportHistory from './components/reports/ReportHistory';
import Leaderboard from './components/leaderboard/Leaderboard';
import MyAttendance from './components/attendance/MyAttendance';
import TeamAttendance from './components/attendance/TeamAttendance';
import MyLeave from './components/leave/MyLeave';
import LeaveApproval from './components/leave/LeaveApproval';
import EmployeeDirectory from './components/employees/EmployeeDirectory';
import EmployeeProfile from './components/employees/EmployeeProfile';
import TeamManagement from './components/admin/TeamManagement';
import HolidayManager from './components/admin/HolidayManager';
import Settings from './components/admin/Settings';
import EmployeeImport from './components/admin/EmployeeImport';
import ResumeExtractor from './components/admin/ResumeExtractor';
import PolicyAcceptance from './components/policies/PolicyAcceptance';
import PolicyManager from './components/admin/PolicyManager';
import PolicyScorecard from './components/admin/PolicyScorecard';
import SalaryStructure from './components/admin/SalaryStructure';
import PayrollDashboard from './components/admin/PayrollDashboard';
import MyPayslips from './components/payroll/MyPayslips';
import MyExpenses from './components/expenses/MyExpenses';
import ExpenseApproval from './components/admin/ExpenseApproval';
import Announcements from './components/announcements/Announcements';

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

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* All authenticated routes wrapped in AppLayout */}
      <Route
        path="/*"
        element={
          user ? (
            <AppLayout>
              <Routes>
                {/* Overview */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* My Work */}
                <Route path="/submit-report" element={<ReportForm />} />
                <Route path="/reports" element={<ReportHistory />} />
                <Route path="/attendance" element={<MyAttendance />} />
                <Route path="/leave" element={<MyLeave />} />
                <Route path="/expenses" element={<MyExpenses />} />
                <Route path="/payslips" element={<MyPayslips />} />
                <Route path="/policies" element={<PolicyAcceptance />} />
                <Route path="/announcements" element={<Announcements />} />

                {/* Team */}
                <Route path="/directory" element={<EmployeeDirectory />} />
                <Route path="/employee/:id" element={<EmployeeProfile />} />
                <Route path="/leaderboard" element={<Leaderboard />} />

                {/* Admin */}
                <Route path="/admin/team" element={<AdminRoute><TeamManagement /></AdminRoute>} />
                <Route path="/admin/attendance" element={<AdminRoute><TeamAttendance /></AdminRoute>} />
                <Route path="/admin/leave-requests" element={<AdminRoute><LeaveApproval /></AdminRoute>} />
                <Route path="/admin/expense-claims" element={<AdminRoute><ExpenseApproval /></AdminRoute>} />
                <Route path="/admin/payroll" element={<AdminRoute><PayrollDashboard /></AdminRoute>} />
                <Route path="/admin/salary-setup" element={<AdminRoute><SalaryStructure /></AdminRoute>} />
                <Route path="/admin/holidays" element={<AdminRoute><HolidayManager /></AdminRoute>} />
                <Route path="/admin/import" element={<AdminRoute><EmployeeImport /></AdminRoute>} />
                <Route path="/admin/policies" element={<AdminRoute><PolicyManager /></AdminRoute>} />
                <Route path="/admin/policy-scorecard" element={<AdminRoute><PolicyScorecard /></AdminRoute>} />
                <Route path="/admin/ai-extract" element={<AdminRoute><ResumeExtractor /></AdminRoute>} />
                <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </AppLayout>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
