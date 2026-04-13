import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30s — prevents infinite spinner if server hangs
});

// Clerk token will be set dynamically
let getTokenFn = null;

export function setClerkGetToken(fn) {
  getTokenFn = fn;
}

// Add Clerk auth token to every request
api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error('Failed to get Clerk token:', err);
    }
  }
  return config;
});

// ─── Error reporting helper (fire-and-forget) ─────────────────────────────────
// Sends API error details to the backend so admins can review and fix them.
// • Skips: 401 (auth), 403 (forbidden), errors from the error-reports endpoint
//   itself (prevent infinite loop), and errors while the user is not yet signed in.
function reportApiError(error) {
  try {
    const status  = error.response?.status;
    const url     = error.config?.url || '';

    // Don't report auth/permission errors or the error-reports endpoint itself
    if (!status || status === 401 || status === 403) return;
    if (url.includes('/error-reports')) return;
    // Don't report if no auth token available (user not signed in)
    if (!getTokenFn) return;

    const payload = {
      errorType:    'api',
      path:         url,
      method:       (error.config?.method || 'GET').toUpperCase(),
      statusCode:   status,
      errorMessage: error.response?.data?.error
                    || error.response?.data?.message
                    || error.message
                    || `HTTP ${status}`,
      context: {
        requestData: error.config?.data
          ? (() => { try { return JSON.parse(error.config.data); } catch { return null; } })()
          : null,
      },
    };

    // Fire-and-forget — don't await, never throw
    api.post('/error-reports', payload).catch(() => {});
  } catch {
    // Never let error reporting itself crash anything
  }
}

// ─── Response interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url    = error.config?.url || '';

    // Auto-report unexpected API errors to backend
    reportApiError(error);

    // Redirect to login on 401 (except for auth endpoints)
    if (status === 401) {
      const isAuthCall = url.includes('/auth/clerk-sync') || url.includes('/auth/me');
      const isAlreadyOnLogin = window.location.pathname === '/login' || window.location.pathname === '/';
      if (!isAuthCall && !isAlreadyOnLogin) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
