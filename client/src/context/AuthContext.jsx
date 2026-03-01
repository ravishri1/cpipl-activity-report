import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import api, { setClerkGetToken } from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken, signOut } = useClerkAuth();
  const [dbUser, setDbUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncDone, setSyncDone] = useState(false);

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
    try {
      const token = await getToken();
      if (!token) return;

      const res = await api.post('/auth/clerk-sync', {
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress,
        name: clerkUser.fullName || clerkUser.firstName || '',
        picture: clerkUser.imageUrl,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDbUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    } catch (err) {
      console.error('User sync error:', err);
      if (err.response?.status === 403) {
        setDbUser({ error: err.response.data.error });
      }
    } finally {
      setSyncDone(true);
    }
  }, [isSignedIn, clerkUser, getToken]);

  useEffect(() => {
    if (clerkLoaded) {
      if (isSignedIn && clerkUser) {
        syncUser().finally(() => setLoading(false));
      } else {
        setDbUser(null);
        setSyncDone(false);
        localStorage.removeItem('user');
        setLoading(false);
      }
    }
  }, [clerkLoaded, isSignedIn, clerkUser?.id]);

  const logout = async () => {
    setDbUser(null);
    localStorage.removeItem('user');
    await signOut();
  };

  const user = dbUser?.error ? null : dbUser;
  const isAdmin = user?.role === 'admin' || user?.role === 'team_lead';
  const accessDenied = dbUser?.error || null;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, accessDenied, logout, clerkUser, isSignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
