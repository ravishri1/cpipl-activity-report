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
const EmployeeCalendarRoute = lazy(() => import('./components/attendance/EmployeeCalendarRoute'));
const MyLeave = lazy(() => import('./components/leave/MyLeave'));
const LeaveApproval = lazy(() => import('./components/leave/LeaveApproval'));
const LeaveGranter = lazy(() => import('./components/leave/LeaveGranter'));
const AdminLeaveDashboard = lazy(() => import('./components/leave/AdminLeaveDashboard'));
const EmployeeDirectory = lazy(() => import('./components/employees/EmployeeDirectory'));
const EmployeeProfile = lazy(() => import('./components/employees/EmployeeProfile'));
const TeamManagement = lazy(() => import('./components/admin/TeamManagement'));
const HolidayManager = lazy(() => import('./components/admin/HolidayManager'));
const Settings = lazy(() => import('./components/admin/Settings'));
const EmployeeImport = lazy(() => import('./components/admin/EmployeeImport'));
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
const MyFiles = lazy(() => import('./components/files/MyFiles'));
const MyInsuranceCard = lazy(() => import('./components/insurance/MyInsuranceCard'));
const AdminInsuranceManager = lazy(() => import('./components/insurance/AdminInsuranceManager'));
const AssetRepairTimeline = lazy(() => import('./components/admin/AssetRepairTimeline'));
const ShiftManagement = lazy(() => import('./components/shifts/ShiftManagement'));
const ShiftRoster = lazy(() => import('./components/shifts/ShiftRoster'));
const TeamOverview = lazy(() => import('./components/team-lead/TeamOverview'));
const ErrorReportsPanel = lazy(() => import('./components/admin/ErrorReportsPanel'));
// BranchManager is now embedded inside CompanyMaster (no direct route)
const ConfirmationManager = lazy(() => import('./components/admin/ConfirmationManager'));
const BiometricDashboard = lazy(() => import('./components/admin/BiometricDashboard'));
const CompanyContractsManager = lazy(() => import('./components/admin/CompanyContractsManager'));
const ContractSigningPage = lazy(() => import('./components/public/ContractSigningPage'));
const CompanyMaster = lazy(() => import('./components/admin/CompanyMaster'));
const ComplianceTracker = lazy(() => import('./components/admin/ComplianceTracker'));
const ActivityReports = lazy(() => import('./components/reports/ActivityReports'));
const MyWorkspace = lazy(() => import('./components/workspace/MyWorkspace'));
const MyCompliance = lazy(() => import('./components/compliance/MyCompliance'));
const MySupport = lazy(() => import('./components/support/MySupport'));
const MyCompOff = lazy(() => import('./components/compoff/MyCompOff'));
const CompOffManager = lazy(() => import('./components/compoff/CompOffManager'));
const RecruitmentManager = lazy(() => import('./components/recruitment/RecruitmentManager'));
const RenewalManager = lazy(() => import('./components/admin/RenewalManager'));
const AttendanceCalendarSearch = lazy(() => import('./components/attendance/AttendanceCalendarSearch'));
const AttendanceRegularization = lazy(() => import('./components/attendance/AttendanceRegularization'));
const RegularizationManager = lazy(() => import('./components/admin/RegularizationManager'));
const AttendanceMuster = lazy(() => import('./components/admin/AttendanceMuster'));
const AssetLifecycleDashboard = lazy(() => import('./components/admin/AssetLifecycleDashboard'));
const PredictiveMaintenanceDashboard = lazy(() => import('./components/admin/PredictiveMaintenanceDashboard'));
const HRAnalyticsDashboard = lazy(() => import('./components/admin/HRAnalyticsDashboard'));
const AccessControlManager = lazy(() => import('./components/admin/AccessControlManager'));
const CredentialManager = lazy(() => import('./components/admin/CredentialManager'));
const DepartmentSetup = lazy(() => import('./components/admin/DepartmentSetup'));
const SecurityAuditPanel = lazy(() => import('./components/admin/SecurityAuditPanel'));
const MyCredentials = lazy(() => import('./components/credentials/MyCredentials'));
const AppraisalManager = lazy(() => import('./components/admin/AppraisalManager'));
const MyAppraisals = lazy(() => import('./components/workspace/MyAppraisals'));
const MyGoals = lazy(() => import('./components/workspace/MyGoals'));
const LoanManager = lazy(() => import('./components/admin/LoanManager'));
const MyLoans = lazy(() => import('./components/workspace/MyLoans'));
const WFHManager = lazy(() => import('./components/admin/WFHManager'));
const MyWFH = lazy(() => import('./components/workspace/MyWFH'));
const ExitInterviewForm = lazy(() => import('./components/workspace/ExitInterviewForm'));
const ExitInterviewAdmin = lazy(() => import('./components/admin/ExitInterviewAdmin'));
const DocumentExpiryDashboard = lazy(() => import('./components/admin/DocumentExpiryDashboard'));
const HRCalendar = lazy(() => import('./components/admin/HRCalendar'));
const AssetRequestManager = lazy(() => import('./components/admin/AssetRequestManager'));
const MyAssetRequests = lazy(() => import('./components/workspace/MyAssetRequests'));
const VisitorRegister = lazy(() => import('./components/admin/VisitorRegister'));

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
      <Route path="/sign/:token" element={<ContractSigningPage />} />

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
                  <Route path="/my-insurance" element={<SeparatedRoute><MyInsuranceCard /></SeparatedRoute>} />

                  {/* Combined pages (new navigation) */}
                  <Route path="/activity-reports" element={<SeparatedRoute><ActivityReports /></SeparatedRoute>} />
                  <Route path="/my-workspace" element={<SeparatedRoute><MyWorkspace /></SeparatedRoute>} />
                  <Route path="/my-credentials" element={<SeparatedRoute><MyCredentials /></SeparatedRoute>} />
                  <Route path="/my-compliance" element={<SeparatedRoute><MyCompliance /></SeparatedRoute>} />
                  <Route path="/my-comp-off" element={<SeparatedRoute><MyCompOff /></SeparatedRoute>} />
                  <Route path="/attendance-regularization" element={<SeparatedRoute><AttendanceRegularization /></SeparatedRoute>} />
                  <Route path="/my-support" element={<MySupport />} />

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
                  <Route path="/admin/attendance" element={<SeparatedRoute><AdminRoute><TeamAttendance /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/attendance/calendar" element={<SeparatedRoute><AdminRoute><AttendanceCalendarSearch /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/attendance/:userId" element={<SeparatedRoute><AdminRoute><EmployeeCalendarRoute /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/leave-requests" element={<SeparatedRoute><AdminRoute><LeaveApproval /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/leave-granter" element={<SeparatedRoute><AdminRoute><LeaveGranter /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/leave-dashboard" element={<SeparatedRoute><AdminRoute><AdminLeaveDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/expense-claims" element={<SeparatedRoute><AdminRoute><ExpenseApproval /></AdminRoute></SeparatedRoute>} />

                  {/* Admin-only routes */}
                  <Route path="/admin/team" element={<SeparatedRoute><AdminRoute><TeamManagement /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/access-control" element={<SeparatedRoute><AdminRoute><AccessControlManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/payroll" element={<SeparatedRoute><AdminRoute><PayrollDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/salary-setup" element={<SeparatedRoute><AdminRoute><SalaryStructure /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/holidays" element={<SeparatedRoute><AdminRoute><HolidayManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/shifts" element={<SeparatedRoute><AdminRoute><ShiftManagement /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/shift-roster" element={<SeparatedRoute><AdminRoute><ShiftRoster /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/import" element={<SeparatedRoute><AdminRoute><EmployeeImport /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/policies" element={<SeparatedRoute><AdminRoute><PolicyManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/policy-scorecard" element={<SeparatedRoute><AdminRoute><PolicyManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/assets" element={<SeparatedRoute><AdminRoute><AssetManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/asset-lifecycle" element={<SeparatedRoute><AdminRoute><AssetLifecycleDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/predictive-maintenance" element={<SeparatedRoute><AdminRoute><PredictiveMaintenanceDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/hr-analytics" element={<SeparatedRoute><AdminRoute><HRAnalyticsDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/insurance" element={<SeparatedRoute><AdminRoute><AdminInsuranceManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/contracts" element={<SeparatedRoute><AdminRoute><CompanyContractsManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/letters" element={<SeparatedRoute><AdminRoute><LetterManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/branches" element={<SeparatedRoute><AdminRoute><CompanyMaster /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/confirmations" element={<SeparatedRoute><AdminRoute><ConfirmationManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/biometric" element={<SeparatedRoute><AdminRoute><BiometricDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/company-master" element={<SeparatedRoute><AdminRoute><CompanyMaster /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/compliance" element={<SeparatedRoute><AdminRoute><ComplianceTracker /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/comp-off" element={<SeparatedRoute><AdminRoute><CompOffManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/regularization" element={<SeparatedRoute><AdminRoute><RegularizationManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/muster" element={<SeparatedRoute><AdminRoute><AttendanceMuster /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/recruitment" element={<SeparatedRoute><AdminRoute><RecruitmentManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/renewals" element={<SeparatedRoute><AdminRoute><RenewalManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/onboarding" element={<SeparatedRoute><AdminRoute><OnboardingManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/separations" element={<SeparatedRoute><AdminRoute><SeparationManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/reports" element={<SeparatedRoute><AdminRoute><HRReports /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/surveys" element={<SeparatedRoute><AdminRoute><SurveyManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/tickets" element={<SeparatedRoute><AdminRoute><TicketManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/suggestions" element={<SeparatedRoute><AdminRoute><SuggestionManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/error-reports" element={<SeparatedRoute><AdminRoute><ErrorReportsPanel /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/settings" element={<SeparatedRoute><AdminRoute><Settings /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/credentials" element={<SeparatedRoute><AdminRoute><CredentialManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/departments" element={<SeparatedRoute><AdminRoute><DepartmentSetup /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/security-audit" element={<SeparatedRoute><AdminRoute><SecurityAuditPanel /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/appraisals" element={<SeparatedRoute><AdminRoute><AppraisalManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/my-appraisals" element={<SeparatedRoute><MyAppraisals /></SeparatedRoute>} />
                  <Route path="/my-goals" element={<SeparatedRoute><MyGoals /></SeparatedRoute>} />
                  <Route path="/admin/loans" element={<SeparatedRoute><AdminRoute><LoanManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/my-loans" element={<SeparatedRoute><MyLoans /></SeparatedRoute>} />
                  <Route path="/admin/wfh" element={<SeparatedRoute><AdminRoute><WFHManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/my-wfh" element={<SeparatedRoute><MyWFH /></SeparatedRoute>} />
                  <Route path="/my-exit-interview" element={<ExitInterviewForm />} />
                  <Route path="/admin/exit-interviews" element={<SeparatedRoute><AdminRoute><ExitInterviewAdmin /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/document-expiry" element={<SeparatedRoute><AdminRoute><DocumentExpiryDashboard /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/hr-calendar" element={<SeparatedRoute><AdminRoute><HRCalendar /></AdminRoute></SeparatedRoute>} />
                  <Route path="/admin/asset-requests" element={<SeparatedRoute><AdminRoute><AssetRequestManager /></AdminRoute></SeparatedRoute>} />
                  <Route path="/my-asset-requests" element={<SeparatedRoute><MyAssetRequests /></SeparatedRoute>} />
                  <Route path="/admin/visitors" element={<SeparatedRoute><AdminRoute><VisitorRegister /></AdminRoute></SeparatedRoute>} />

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
