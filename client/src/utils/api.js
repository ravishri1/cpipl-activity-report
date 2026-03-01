import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Clerk token will be set dynamically
let getTokenFn = null;

export function setClerkGetToken(fn) {
  getTokenFn = fn;
}

// Add Clerk auth token to every request
api.interceptors.request.use(async (config) => {
  // If we have a Clerk getToken function, use it
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

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clerk will handle re-auth, just redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
