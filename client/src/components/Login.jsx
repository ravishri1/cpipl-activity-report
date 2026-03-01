import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { FileText, Building2, Globe } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const user = await googleLogin(credentialResponse.credential);
      if (user.role === 'member') {
        navigate('/submit-report');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In was cancelled or failed. Please try again.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Color Papers</h1>
          <p className="text-slate-500 mt-1">Daily Activity Report System</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-4 mb-4">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-slate-500">Signing you in...</p>
          </div>
        )}

        {/* Google Sign-In Button */}
        {!loading && (
          <div className="flex justify-center mb-8">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              size="large"
              width="350"
              text="signin_with"
              shape="rectangular"
              theme="outline"
            />
          </div>
        )}

        {/* Info Cards */}
        <div className="space-y-3">
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
