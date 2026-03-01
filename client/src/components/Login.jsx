import { SignIn, useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Building2, Globe, AlertCircle, Shield } from 'lucide-react';

export default function Login() {
  const { isSignedIn } = useUser();
  const { user, loading, accessDenied } = useAuth();

  // If signed in with Clerk AND synced to DB, redirect
  if (isSignedIn && user && !loading) {
    return <Navigate to={user.role === 'member' ? '/submit-report' : '/dashboard'} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl px-6 py-5 w-full max-w-sm">
        {/* Header — compact */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-md">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">EOD Report System</h1>
          <p className="text-blue-600 font-semibold text-xs mt-0.5">Color Papers India Private Limited</p>
        </div>

        {/* Access Denied */}
        {accessDenied && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-4 text-xs flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Access Denied</p>
              <p className="mt-0.5">{accessDenied}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && isSignedIn && (
          <div className="text-center py-3 mb-3">
            <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-1.5"></div>
            <p className="text-xs text-slate-500">Verifying access...</p>
          </div>
        )}

        {/* Clerk Sign-In Component */}
        {!isSignedIn && (
          <div className="flex justify-center mb-4">
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-none border-0 p-0 w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton: 'w-full',
                  footer: 'hidden',
                  footerAction: 'hidden',
                  footerActionLink: 'hidden',
                  badge: 'hidden',
                  dividerRow: 'hidden',
                  internal: 'hidden',
                },
              }}
              routing="hash"
              forceRedirectUrl="/dashboard"
            />
          </div>
        )}

        {/* Info Cards — compact */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 bg-blue-50 rounded-lg px-3 py-2">
            <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-900">Internal Employees</p>
              <p className="text-[10px] text-blue-700 mt-0.5">
                Sign in with <strong>@colorpapers.in</strong> Google account
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 bg-amber-50 rounded-lg px-3 py-2">
            <Globe className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-900">External / Freelance</p>
              <p className="text-[10px] text-amber-700 mt-0.5">
                Sign in with any Google email to submit reports
              </p>
            </div>
          </div>
        </div>

        {/* Confidential Notice — compact */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
            <Shield className="w-3 h-3" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Proprietary & Confidential</span>
          </div>
          <p className="text-[9px] text-slate-400 text-center leading-relaxed">
            This system is the exclusive property of Color Papers India Private Limited.
            Unauthorized access or distribution is strictly prohibited.
          </p>
        </div>
      </div>

      {/* Copyright Footer */}
      <p className="text-blue-200/60 text-[9px] mt-4 text-center">
        &copy; {new Date().getFullYear()} Color Papers India Private Limited. All rights reserved.
      </p>
    </div>
  );
}
