import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import api, { setClerkGetToken } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken, signOut } = useClerkAuth();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);
  const syncAttemptRef = useRef(false);

  // Wire up Clerk token for API calls
  useEffect(() => {
    if (isSignedIn) {
      setClerkGetToken(() => getToken());
    } else {
      setClerkGetToken(null);
    }
  }, [isSignedIn, getToken]);

  // Sync Clerk user with our database
  const syncUser = useCallback(async () => {
    if (!isSignedIn || !clerkUser) return;

    setSyncError(null);

    try {
      const token = await getToken();
      if (!token) {
        setSyncError('Could not get authentication token. Please try again.');
        return;
      }

      const res = await api.post('/auth/clerk-sync', {
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        name: clerkUser.fullName || clerkUser.firstName || '',
        picture: clerkUser.imageUrl,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000, // 15s timeout to prevent hanging
      });

      setDbUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    } catch (err) {
      console.error('User sync error:', err);
      if (err.response?.status === 403) {
        setDbUser({ error: err.response.data.error });
      } else if (err.response?.status === 401) {
        setSyncError('Authentication failed. Please sign out and sign in again.');
      } else if (err.code === 'ECONNABORTED' || !err.response) {
        setSyncError('Server is not responding. Please refresh the page.');
      } else {
        setSyncError(
          err.response?.data?.error || 'Failed to connect to server. Please try again.'
        );
      }
    }
  }, [isSignedIn, clerkUser, getToken]);

  useEffect(() => {
    if (clerkLoaded) {
      if (isSignedIn && clerkUser) {
        // Prevent duplicate sync on re-renders
        if (!syncAttemptRef.current) {
          syncAttemptRef.current = true;
          syncUser().finally(() => setLoading(false));
        }
      } else {
        setDbUser(null);
        setSyncError(null);
        syncAttemptRef.current = false;
        localStorage.removeItem('user');
        setLoading(false);
      }
    }
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  const logout = async () => {
    setDbUser(null);
    setSyncError(null);
    syncAttemptRef.current = false;
    localStorage.removeItem('user');
    await signOut();
  };

  // Retry sync — callable from Login page
  const retrySync = useCallback(async () => {
    setLoading(true);
    setSyncError(null);
    syncAttemptRef.current = false;
    await syncUser();
    setLoading(false);
  }, [syncUser]);

  const user = dbUser?.error ? null : dbUser;
  const isAdmin = user?.role === 'admin' || user?.role === 'team_lead';
  const accessDenied = dbUser?.error || null;

  return (
    <AuthContext.Provider value={{
      user, loading, isAdmin, accessDenied, syncError,
      logout, retrySync, clerkUser, isSignedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
