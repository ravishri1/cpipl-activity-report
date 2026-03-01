import { SignIn, useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Building2, Globe, AlertCircle } from 'lucide-react';

export default function Login() {
  const { isSignedIn } = useUser();
  const { user, loading, accessDenied } = useAuth();

  // If signed in with Clerk AND synced to DB, redirect
  if (isSignedIn && user && !loading) {
    return <Navigate to={user.role === 'member' ? '/submit-report' : '/dashboard'} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Color Papers</h1>
          <p className="text-slate-500 mt-1">Daily Activity Report System</p>
        </div>

        {/* Access Denied for External Users */}
        {accessDenied && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Access Denied</p>
              <p className="mt-1">{accessDenied}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && isSignedIn && (
          <div className="text-center py-4 mb-4">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-slate-500">Verifying access...</p>
          </div>
        )}

        {/* Clerk Sign-In Component */}
        {!isSignedIn && (
          <div className="flex justify-center mb-6">
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none border-0 p-0 w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'w-full',
                  footer: 'hidden',
                },
              }}
              routing="hash"
              forceRedirectUrl="/dashboard"
            />
          </div>
        )}

        {/* Info Cards */}
        <div className="space-y-3 mt-4">
          <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3">
            <Building2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Internal Employees</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Sign in with your <strong>@colorpapers.in</strong> Google Workspace account. Auto-verified.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-3">
            <Globe className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">External Employees</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Sign in with your Google email. Admin must add you first.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
