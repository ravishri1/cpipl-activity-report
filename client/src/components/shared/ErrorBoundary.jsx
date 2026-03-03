import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="p-4 bg-red-50 rounded-full mb-5">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500 text-center max-w-md mb-6">
            This page encountered an unexpected error. Try refreshing or go back to the dashboard.
          </p>
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
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="mt-6 p-4 bg-slate-900 text-red-300 rounded-lg text-xs max-w-lg overflow-auto max-h-40">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
