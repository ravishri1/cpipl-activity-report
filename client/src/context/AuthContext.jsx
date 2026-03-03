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
        const code = err.response.data.code;
        setDbUser({
          error: err.response.data.error,
          ...(code === 'HIBERNATED' ? {
            isHibernated: true,
            canSelfReactivate: err.response.data.canSelfReactivate || false,
            remainingReactivations: err.response.data.remainingReactivations ?? 0,
          } : {}),
        });
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

  // Self-reactivation for hibernated users
  const selfReactivate = useCallback(async () => {
    if (!isSignedIn || !clerkUser) return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await api.post('/auth/self-reactivate', {
        email: clerkUser.primaryEmailAddress?.emailAddress,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      // Success — retry sync to load the user normally
      syncAttemptRef.current = false;
      setLoading(true);
      await syncUser();
      setLoading(false);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Self-reactivation failed. Please contact HR.';
      setDbUser((prev) => ({ ...prev, error: msg, canSelfReactivate: false }));
      throw new Error(msg);
    }
  }, [isSignedIn, clerkUser, getToken, syncUser]);

  // Refresh user data from server — called after profile updates to ensure cache is fresh
  const refreshUserData = useCallback(async () => {
    if (!isSignedIn || !dbUser || dbUser.error) return;
    try {
      // Fetch complete user profile to get all fields (name, photo, company info, etc.)
      const res = await api.get(`/users/${dbUser.id}/profile`);
      setDbUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      console.error('Failed to refresh user data:', err);
      // Don't show error to user — silently fail, data might be stale
    }
  }, [isSignedIn, dbUser]);

  // Update photo URL in global state without re-syncing
  const updateUserPhoto = useCallback((photoUrl) => {
    setDbUser(prev => {
      if (!prev || prev.error) return prev;
      const updated = { ...prev, driveProfilePhotoUrl: photoUrl };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const user = dbUser?.error ? null : dbUser;
  const isAdmin = user?.role === 'admin' || user?.role === 'team_lead';
  const isStrictAdmin = user?.role === 'admin';
  const isTeamLead = user?.role === 'team_lead';
  const isSeparated = user?.isSeparated || user?.employmentStatus === 'separated';
  const isHibernated = dbUser?.isHibernated || false;
  const canSelfReactivate = dbUser?.canSelfReactivate || false;
  const remainingReactivations = dbUser?.remainingReactivations ?? 0;
  const accessDenied = dbUser?.error || null;

  return (
    <AuthContext.Provider value={{
      user, loading, isAdmin, isStrictAdmin, isTeamLead, isSeparated, isHibernated, canSelfReactivate, remainingReactivations, accessDenied, syncError,
      logout, retrySync, selfReactivate, updateUserPhoto, refreshUserData, clerkUser, isSignedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
