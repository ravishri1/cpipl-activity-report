import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/shared/ErrorBoundary';
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
const MyTrainingAssignments = lazy(() => import('./components/training/MyTrainingAssignments'));
const TrainingLibrary = lazy(() => import('./components/training/TrainingLibrary'));
const ContributeToModule = lazy(() => import('./components/training/ContributeToModule'));
const TrainingManager = lazy(() => import('./components/training/TrainingManager'));
const MyPointsDashboard = lazy(() => import('./components/training/MyPointsDashboard'));
const TrainingLeaderboard = lazy(() => import('./components/training/Leaderboard'));
const MyFiles = lazy(() => import('./components/files/MyFiles'));
const MyInsuranceCard = lazy(() => import('./components/insurance/MyInsuranceCard'));
const AdminInsuranceManager = lazy(() => import('./components/insurance/AdminInsuranceManager'));
const AssetRepairTimeline = lazy(() => import('./components/admin/AssetRepairTimeline'));
const VendorAnalyticsDashboard = lazy(() => import('./components/admin/VendorAnalyticsDashboard'));
const ShiftManagement = lazy(() => import('./components/shifts/ShiftManagement'));
const TeamOverview = lazy(() => import('./components/team-lead/TeamOverview'));

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

function SeparatedRoute({ children }) {
  const { isSeparated } = useAuth();
  if (isSeparated) return <Navigate to="/payslips" replace />;
  return children;
}

function SeparatedFallback() {
  const { isSeparated } = useAuth();
  return <Navigate to={isSeparated ? '/payslips' : '/dashboard'} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Persist the current authenticated path so we can return to it after refresh/login
  useEffect(() => {
    if (user && location.pathname !== '/login' && location.pathname !== '/') {
      sessionStorage.setItem('lastPath', location.pathname);
    }
  }, [user, location.pathname]);

  // Show spinner while auth state is being resolved — prevents redirect flash
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

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
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Overview — restricted for separated employees */}
                  <Route path="/dashboard" element={<SeparatedRoute><Dashboard /></SeparatedRoute>} />

                  {/* My Work — restricted for separated employees */}
                  <Route path="/submit-report" element={<SeparatedRoute><ReportForm /></SeparatedRoute>} />
                  <Route path="/reports" element={<SeparatedRoute><ReportHistory /></SeparatedRoute>} />
                  <Route path="/attendance" element={<SeparatedRoute><MyAttendance /></SeparatedRoute>} />
                  <Route path="/leave" element={<SeparatedRoute><MyLeave /></SeparatedRoute>} />
                  <Route path="/expenses" element={<SeparatedRoute><MyExpenses /></SeparatedRoute>} />
                  <Route path="/policies" element={<SeparatedRoute><PolicyAcceptance /></SeparatedRoute>} />
                  <Route path="/announcements" element={<SeparatedRoute><Announcements /></SeparatedRoute>} />
                  <Route path="/my-assets" element={<SeparatedRoute><MyAssets /></SeparatedRoute>} />
                  <Route path="/my-repairs" element={<SeparatedRoute><AssetRepairTimeline /></SeparatedRoute>} />
                  <Route path="/surveys" element={<SeparatedRoute><MySurveys /></SeparatedRoute>} />
                  <Route path="/wiki" element={<SeparatedRoute><WikiPage /></SeparatedRoute>} />
                  <Route path="/training/my-assignments" element={<SeparatedRoute><MyTrainingAssignments /></SeparatedRoute>} />
                  <Route path="/training/library" element={<SeparatedRoute><TrainingLibrary /></SeparatedRoute>} />
                  <Route path="/training/contribute" element={<SeparatedRoute><ContributeToModule /></SeparatedRoute>} />
                  <Route path="/training/my-points" element={<SeparatedRoute><MyPointsDashboard /></SeparatedRoute>} />
                  <Route path="/training/leaderboard" element={<SeparatedRoute><TrainingLeaderboard /></SeparatedRoute>} />
                  <Route path="/my-insurance" element={<SeparatedRoute><MyInsuranceCard /></SeparatedRoute>} />

                  {/* Allowed for separated employees */}
                  <Route path="/payslips" element={<MyPayslips />} />
                  <Route path="/my-tickets" element={<MyTickets />} />
                  <Route path="/suggestions" element={<SuggestionBox />} />
                  <Route path="/my-files" element={<MyFiles />} />

                  {/* Team Lead — My Team Overview */}
                  <Route path="/my-team" element={<SeparatedRoute><AdminRoute><TeamOverview /></AdminRoute></SeparatedRoute>} />

                  {/* Team — restricted for separated employees */}
                  <Route path="/directory" element={<SeparatedRoute><EmployeeDirectory /></SeparatedRoute>} />
                  <Route path="/employee/:id" element={<SeparatedRoute><EmployeeProfile /></SeparatedRoute>} />
                  <Route path="/leaderboard" element={<SeparatedRoute><Leaderboard /></SeparatedRoute>} />

                  {/* Admin / Team Lead shared routes */}
                  <Route path="/training/manage" element={<SeparatedRoute><AdminRoute><TrainingManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/attendance" element={<SeparatedRoute><AdminRoute><TeamAttendance /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/leave-requests" element={<SeparatedRoute><AdminRoute><LeaveApproval /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/expense-claims" element={<SeparatedRoute><AdminRoute><ExpenseApproval /></AdminRoute></SeparatedRoute>} />

                  {/* Admin-only routes */}
                  <Route path="/admin/team" element={<SeparatedRoute><AdminRoute><TeamManagement /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/payroll" element={<SeparatedRoute><AdminRoute><PayrollDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/salary-setup" element={<SeparatedRoute><AdminRoute><SalaryStructure /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/holidays" element={<SeparatedRoute><AdminRoute><HolidayManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/shifts" element={<SeparatedRoute><AdminRoute><ShiftManagement /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/import" element={<SeparatedRoute><AdminRoute><EmployeeImport /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/policies" element={<SeparatedRoute><AdminRoute><PolicyManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/policy-scorecard" element={<SeparatedRoute><AdminRoute><PolicyScorecard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/assets" element={<SeparatedRoute><AdminRoute><AssetManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/vendor-analytics" element={<SeparatedRoute><AdminRoute><VendorAnalyticsDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/insurance" element={<SeparatedRoute><AdminRoute><AdminInsuranceManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/letters" element={<SeparatedRoute><AdminRoute><LetterManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/onboarding" element={<SeparatedRoute><AdminRoute><OnboardingManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/separations" element={<SeparatedRoute><AdminRoute><SeparationManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/reports" element={<SeparatedRoute><AdminRoute><HRReports /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/ai-extract" element={<SeparatedRoute><AdminRoute><ResumeExtractor /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/surveys" element={<SeparatedRoute><AdminRoute><SurveyManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/tickets" element={<SeparatedRoute><AdminRoute><TicketManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/training" element={<SeparatedRoute><AdminRoute><TrainingManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/suggestions" element={<SeparatedRoute><AdminRoute><SuggestionManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/settings" element={<SeparatedRoute><AdminRoute><Settings /></AdminRoute></SeparatedRoute>} />

                  {/* Fallback — separated users go to payslips, others to dashboard */}
                  <Route path="*" element={<SeparatedFallback />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
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
