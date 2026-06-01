import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Record<string, unknown> | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: { type: string; message: string } | null;
  authChecked: boolean;
  logout: (shouldRedirect?: boolean) => Promise<void>;
  navigateToLogin: () => void;
  checkUserAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Safe sessionStorage wrapper — Safari private mode throws on access
const safeSession = {
  setItem: (key: string, value: string) => {
    try { sessionStorage.setItem(key, value); } catch { /* noop */ }
  },
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]                   = useState<User | null>(null);
  const [session, setSession]             = useState<Session | null>(null);
  const [profile, setProfile]             = useState<Record<string, unknown> | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings]         = useState(false);
  const [authError]                       = useState<{ type: string; message: string } | null>(null);
  const [authChecked, setAuthChecked]     = useState(false);

  // Guard against calling setState after unmount
  const mounted = useRef(true);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  const done = (authenticated: boolean) => {
    if (!mounted.current) return;
    setIsAuthenticated(authenticated);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (mounted.current) setProfile(data);
      return data as Record<string, unknown> | null;
    } catch {
      return null;
    }
  };

  const isBlocked = (profileData: Record<string, unknown> | null) =>
    profileData?.account_status === 'suspended' ||
    profileData?.account_status === 'banned';

  const handleBlocked = async (profileData: Record<string, unknown>) => {
    safeSession.setItem(
      'accountBlocked',
      JSON.stringify({ status: profileData.account_status, reason: profileData.status_reason }),
    );
    await supabase.auth.signOut().catch(() => {});
    if (mounted.current) {
      setUser(null); setSession(null); setProfile(null);
    }
    done(false);
  };

  const checkUserAuth = async () => {
    if (mounted.current) setIsLoadingAuth(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        const profileData = await loadProfile(s.user.id);
        if (isBlocked(profileData)) { await handleBlocked(profileData!); return; }
        if (mounted.current) { setUser(s.user); setSession(s); }
        done(true);
      } else {
        if (mounted.current) { setUser(null); setSession(null); }
        done(false);
      }
    } catch {
      done(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    // Safety timeout — if auth check takes >8 s (bad mobile network), unblock the UI
    const timeout = setTimeout(() => {
      if (mounted.current && isLoadingAuth) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }, 8000);

    const init = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!mounted.current) return;

        if (s?.user) {
          const profileData = await loadProfile(s.user.id);
          if (!mounted.current) return;

          if (isBlocked(profileData)) {
            await handleBlocked(profileData!);
          } else {
            setUser(s.user);
            setSession(s);
            done(true);
          }
        } else {
          done(false);
        }
      } catch {
        if (mounted.current) done(false);
      } finally {
        clearTimeout(timeout);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted.current) return;

      if (event === 'SIGNED_IN' && s?.user) {
        // Hold ProtectedRoute in spinner while we load the profile.
        // Without this, navigate("/home") in Login arrives before isAuthenticated=true
        // and ProtectedRoute redirects back to /login immediately.
        if (mounted.current) setIsLoadingAuth(true);
        const profileData = await loadProfile(s.user.id);
        if (!mounted.current) return;
        if (isBlocked(profileData)) { await handleBlocked(profileData!); return; }
        setUser(s.user);
        setSession(s);
        done(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setSession(null); setProfile(null);
        done(false);
      } else if (event === 'TOKEN_REFRESHED' && s?.user) {
        setUser(s.user);
        setSession(s);
        if (mounted.current) { setIsLoadingAuth(false); setAuthChecked(true); }
      } else if (event === 'INITIAL_SESSION') {
        // Supabase v2 fires INITIAL_SESSION; if no user, we're done
        if (!s?.user) done(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut().catch(() => {});
    setUser(null); setSession(null); setProfile(null);
    setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, authChecked,
      logout, navigateToLogin, checkUserAuth, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
