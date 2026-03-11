import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// ── Parent section landing routes ─────────────────────────────────────
const PARENT_ROUTES = {
  'My Work':        '/activity-reports',
  'Organization':   '/admin/company-master',
  'Company Master': '/admin/company-master',
  'Training':       '/training/my-assignments',
  'Team':           '/directory',
  'My Info':        '/payslips',
};

// ── Route map: pathname → { label, parent? } ──────────────────────────
// parent = the section label shown as the middle breadcrumb crumb
const ROUTE_MAP = {
  // ── My Work ──────────────────────────────────────────────────
  '/submit-report':                 { label: 'Submit Report',             parent: 'My Work' },
  '/reports':                       { label: 'Reports',                   parent: 'My Work' },
  '/activity-reports':              { label: 'Activity Reports',          parent: 'My Work' },
  '/my-workspace':                  { label: 'My Workspace',              parent: 'My Work' },
  '/attendance':                    { label: 'Attendance',                parent: 'My Work' },
  '/attendance-regularization':     { label: 'Regularization',           parent: 'My Work' },
  '/leave':                         { label: 'Leave',                     parent: 'My Work' },
  '/overtime':                      { label: 'Overtime',                  parent: 'My Work' },
  '/my-comp-off':                   { label: 'Comp Off',                  parent: 'My Work' },
  '/expenses':                      { label: 'Expenses',                  parent: 'My Work' },
  '/my-investment':                 { label: 'Investment Declaration',    parent: 'My Work' },
  '/my-performance':                { label: 'Performance',               parent: 'My Work' },

  // ── My Info ──────────────────────────────────────────────────
  '/payslips':                      { label: 'My Payslips' },
  '/my-assets':                     { label: 'My Assets' },
  '/my-repairs':                    { label: 'Asset Repairs' },
  '/my-insurance':                  { label: 'Insurance Card' },
  '/my-files':                      { label: 'My Files' },
  '/my-loans':                      { label: 'Loans' },
  '/my-compliance':                 { label: 'My Compliance' },
  '/policies':                      { label: 'Policies' },

  // ── Support & Social ─────────────────────────────────────────
  '/my-tickets':                    { label: 'My Tickets' },
  '/my-support':                    { label: 'Support' },
  '/suggestions':                   { label: 'Suggestions' },
  '/surveys':                       { label: 'Surveys' },
  '/announcements':                 { label: 'Announcements' },
  '/wiki':                          { label: 'Knowledge Base' },
  '/leaderboard':                   { label: 'Leaderboard' },

  // ── Training ──────────────────────────────────────────────────
  '/training/my-assignments':       { label: 'My Assignments',           parent: 'Training' },
  '/training/library':              { label: 'Library',                  parent: 'Training' },
  '/training/contribute':           { label: 'Contribute',               parent: 'Training' },
  '/training/my-points':            { label: 'My Points',                parent: 'Training' },
  '/training/leaderboard':          { label: 'Leaderboard',              parent: 'Training' },

  // ── Team ──────────────────────────────────────────────────────
  '/directory':                     { label: 'Employee Directory',        parent: 'Team' },
  '/employee/:id':                  { label: 'Employee Profile',          parent: 'Team' },
  '/my-team':                       { label: 'My Team',                   parent: 'Team' },

  // ── Organization (Admin) ─────────────────────────────────────
  '/admin/team':                    { label: 'Team Management',           parent: 'Organization' },
  '/admin/leave-requests':          { label: 'Leave Requests',            parent: 'Organization' },
  '/admin/expense-claims':          { label: 'Expense Claims',            parent: 'Organization' },
  '/admin/attendance':              { label: 'Team Attendance',           parent: 'Organization' },
  '/admin/payroll':                 { label: 'Payroll',                   parent: 'Organization' },
  '/admin/salary-setup':            { label: 'Salary Setup',              parent: 'Organization' },
  '/admin/holidays':                { label: 'Holidays',                  parent: 'Organization' },
  '/admin/shifts':                  { label: 'Shifts',                    parent: 'Organization' },
  '/admin/import':                  { label: 'Import Employees',          parent: 'Organization' },
  '/admin/branches':                { label: 'Branches',                  parent: 'Company Master' },
  '/admin/confirmations':           { label: 'Confirmations',             parent: 'Organization' },
  '/admin/biometric':               { label: 'Biometric',                 parent: 'Organization' },
  '/admin/separations':             { label: 'Separations',               parent: 'Organization' },
  '/admin/onboarding':              { label: 'Onboarding',                parent: 'Organization' },
  '/admin/overtime':                { label: 'Overtime',                  parent: 'Organization' },
  '/admin/comp-off':                { label: 'Comp Off',                  parent: 'Organization' },
  '/admin/regularization':          { label: 'Regularization',            parent: 'Organization' },
  '/admin/loans':                   { label: 'Loans',                     parent: 'Organization' },
  '/admin/investment-declarations': { label: 'Investment Declarations',   parent: 'Organization' },
  '/admin/assets':                  { label: 'Assets',                    parent: 'Organization' },
  '/admin/asset-lifecycle':         { label: 'Asset Lifecycle',           parent: 'Organization' },
  '/admin/predictive-maintenance':  { label: 'Predictive Maintenance',    parent: 'Organization' },
  '/admin/procurement':             { label: 'Procurement',               parent: 'Organization' },
  '/admin/order-approvals':         { label: 'Order Approvals',           parent: 'Organization' },
  '/admin/inventory':               { label: 'Inventory Analytics',       parent: 'Organization' },
  '/admin/vendor-analytics':        { label: 'Vendor Analytics',          parent: 'Organization' },
  '/admin/contracts':               { label: 'Contracts',                 parent: 'Organization' },
  '/admin/insurance':               { label: 'Insurance',                 parent: 'Organization' },
  '/admin/reports':                 { label: 'HR Reports',                parent: 'Organization' },
  '/admin/hr-analytics':            { label: 'HR Analytics',              parent: 'Organization' },
  '/admin/ai-extract':              { label: 'Resume Extractor',          parent: 'Organization' },
  '/admin/policies':                { label: 'Policies',                  parent: 'Organization' },
  '/admin/policy-scorecard':        { label: 'Policy Scorecard',          parent: 'Organization' },
  '/admin/letters':                 { label: 'Letters',                   parent: 'Organization' },
  '/admin/surveys':                 { label: 'Surveys',                   parent: 'Organization' },
  '/admin/tickets':                 { label: 'Tickets',                   parent: 'Organization' },
  '/admin/training':                { label: 'Training',                  parent: 'Organization' },
  '/admin/suggestions':             { label: 'Suggestions',               parent: 'Organization' },
  '/admin/error-reports':           { label: 'Error Reports',             parent: 'Organization' },
  '/admin/settings':                { label: 'Settings',                  parent: 'Organization' },
  '/admin/company-master':          { label: 'Company Master',            parent: 'Organization' },
  '/admin/compliance':              { label: 'Compliance Tracker',        parent: 'Organization' },
  '/admin/renewals':                { label: 'Renewal Manager',           parent: 'Organization' },
  '/admin/recruitment':             { label: 'Recruitment',               parent: 'Organization' },
  '/admin/performance':             { label: 'Performance',               parent: 'Organization' },
};

// Normalise dynamic segments so /employee/42 → /employee/:id
function normalizePath(pathname) {
  return pathname
    .replace(/^\/employee\/[^/]+$/, '/employee/:id');
}

export default function Breadcrumb() {
  const { pathname } = useLocation();

  // Dashboard is "home" — no breadcrumb needed
  if (pathname === '/dashboard' || pathname === '/') return null;

  const normalized = normalizePath(pathname);
  const route = ROUTE_MAP[normalized];

  // Unknown route — don't render a broken breadcrumb
  if (!route) return null;

  // Build crumb list: Home > [Parent] > Current
  const crumbs = [{ label: 'Home', to: '/dashboard', isHome: true }];
  if (route.parent) crumbs.push({ label: route.parent, to: PARENT_ROUTES[route.parent] });
  crumbs.push({ label: route.label });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs select-none">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            )}
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors"
              >
                {crumb.isHome && <Home className="w-3 h-3" />}
                <span>{crumb.label}</span>
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
