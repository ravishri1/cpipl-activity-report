import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './components/auth/Login';

// ── Lazy-loaded components (code-splitting) ──────────────────────────
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const ReportForm = lazy(() => import('./components/reports/ReportForm'));
const ReportHistory = lazy(() => import('./components/reports/ReportHistory'));
const Leaderboard = lazy(() => import('./components/leaderboard/Leaderboard'));
const MyAttendance = lazy(() => import('./components/attendance/MyAttendance'));
const TeamAttendance = lazy(() => import('./components/attendance/TeamAttendance'));
const MyLeave = lazy(() => import('./components/leave/MyLeave'));
const LeaveApproval = lazy(() => import('./components/leave/LeaveApproval'));
const EmployeeDirectory = lazy(() => import('./components/employees/EmployeeDirectory'));
const EmployeeProfile = lazy(() => import('./components/employees/EmployeeProfile'));
const TeamManagement = lazy(() => import('./components/admin/TeamManagement'));
const HolidayManager = lazy(() => import('./components/admin/HolidayManager'));
const Settings = lazy(() => import('./components/admin/Settings'));
const EmployeeImport = lazy(() => import('./components/admin/EmployeeImport'));
const ResumeExtractor = lazy(() => import('./components/admin/ResumeExtractor'));
const PolicyAcceptance = lazy(() => import('./components/policies/PolicyAcceptance'));
const PolicyManager = lazy(() => import('./components/admin/PolicyManager'));
const PolicyScorecard = lazy(() => import('./components/admin/PolicyScorecard'));
const SalaryStructure = lazy(() => import('./components/admin/SalaryStructure'));
const PayrollDashboard = lazy(() => import('./components/admin/PayrollDashboard'));
const MyPayslips = lazy(() => import('./components/payroll/MyPayslips'));
const MyExpenses = lazy(() => import('./components/expenses/MyExpenses'));
const ExpenseApproval = lazy(() => import('./components/admin/ExpenseApproval'));
const Announcements = lazy(() => import('./components/announcements/Announcements'));
const LetterManager = lazy(() => import('./components/admin/LetterManager'));
const AssetManager = lazy(() => import('./components/admin/AssetManager'));
const OnboardingManager = lazy(() => import('./components/admin/OnboardingManager'));
const SeparationManager = lazy(() => import('./components/admin/SeparationManager'));
const HRReports = lazy(() => import('./components/admin/HRReports'));
const MyAssets = lazy(() => import('./components/assets/MyAssets'));
const SurveyManager = lazy(() => import('./components/admin/SurveyManager'));
const MySurveys = lazy(() => import('./components/surveys/MySurveys'));
const TicketManager = lazy(() => import('./components/admin/TicketManager'));
const MyTickets = lazy(() => import('./components/helpdesk/MyTickets'));
const WikiPage = lazy(() => import('./components/wiki/WikiPage'));
const SuggestionBox = lazy(() => import('./components/suggestions/SuggestionBox'));
const SuggestionManager = lazy(() => import('./components/admin/SuggestionManager'));
const MyTraining = lazy(() => import('./components/training/MyTraining'));
const TrainingManager = lazy(() => import('./components/admin/TrainingManager'));

// ── Loading spinner for lazy components ──────────────────────────────
function PageLoader() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
}

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
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/my-assets" element={<MyAssets />} />
                  <Route path="/surveys" element={<MySurveys />} />
                  <Route path="/my-tickets" element={<MyTickets />} />
                  <Route path="/wiki" element={<WikiPage />} />
                  <Route path="/suggestions" element={<SuggestionBox />} />
                  <Route path="/training" element={<MyTraining />} />

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
                  <Route path="/admin/assets" element={<AdminRoute><AssetManager /></AdminRoute>} />
                  <Route path="/admin/letters" element={<AdminRoute><LetterManager /></AdminRoute>} />
                  <Route path="/admin/onboarding" element={<AdminRoute><OnboardingManager /></AdminRoute>} />
                  <Route path="/admin/separations" element={<AdminRoute><SeparationManager /></AdminRoute>} />
                  <Route path="/admin/reports" element={<AdminRoute><HRReports /></AdminRoute>} />
                  <Route path="/admin/ai-extract" element={<AdminRoute><ResumeExtractor /></AdminRoute>} />
                  <Route path="/admin/surveys" element={<AdminRoute><SurveyManager /></AdminRoute>} />
                  <Route path="/admin/tickets" element={<AdminRoute><TicketManager /></AdminRoute>} />
                  <Route path="/admin/training" element={<AdminRoute><TrainingManager /></AdminRoute>} />
                  <Route path="/admin/suggestions" element={<AdminRoute><SuggestionManager /></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Suspense>
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
