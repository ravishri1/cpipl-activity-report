import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../../utils/api';

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches unhandled React render/lifecycle errors, reports them to the backend
// (fire-and-forget so reporting never blocks the fallback UI), and shows a
// friendly "Something went wrong" screen with retry / go-home options.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] caught:', error, errorInfo);
    this._reportError(error, errorInfo);
  }

  _reportError(error, errorInfo) {
    try {
      const payload = {
        errorType:      'client',
        path:           window.location.pathname,
        errorMessage:   error?.message || String(error),
        stackTrace:     error?.stack || null,
        componentStack: errorInfo?.componentStack || null,
        context: {
          href: window.location.href,
          name: error?.name || null,
        },
      };

      // Fire-and-forget; never throw
      api.post('/error-reports', payload)
        .then(() => this.setState({ reported: true }))
        .catch(() => {});
    } catch {
      // Never let reporting crash the boundary itself
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, reported: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="p-4 bg-red-50 rounded-full mb-5">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 text-center max-w-md mb-1">
            This page encountered an unexpected error. Try refreshing or go back to the dashboard.
          </p>
          {this.state.reported && (
            <p className="text-xs text-green-600 mb-5">
              ✓ Error reported — our team has been notified.
            </p>
          )}
          {!this.state.reported && (
            <p className="text-xs text-slate-400 mb-5">Reporting error to admin…</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <a
              href="/dashboard"
              className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 p-4 bg-slate-900 text-red-300 rounded-lg text-xs max-w-lg overflow-auto max-h-40">
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
