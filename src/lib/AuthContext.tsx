import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile extends Record<string, unknown> {
  account_status?: string;
  status_reason?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser]                     = useState<User | null>(null);
  const [session, setSession]               = useState<Session | null>(null);
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]   = useState(true);
  const [authChecked, setAuthChecked]       = useState(false);
  const mounted                             = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const loadProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (mounted.current) setProfile(data);
      return data;
    } catch {
      return null;
    }
  };

  const markDone = (authenticated: boolean) => {
    if (!mounted.current) return;
    setIsAuthenticated(authenticated);
    setIsLoadingAuth(false);
    setAuthChecked(true);
  };

  const isBlocked = (p: Profile | null) =>
    p?.account_status === 'suspended' || p?.account_status === 'banned';

  useEffect(() => {
    // Safety valve — never hang the spinner more than 10 s
    const safetyTimer = setTimeout(() => {
      if (mounted.current) markDone(false);
    }, 10_000);

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      clearTimeout(safetyTimer);
      if (!mounted.current) return;

      if (s?.user) {
        const p = await loadProfile(s.user.id);
        if (!mounted.current) return;

        if (isBlocked(p)) {
          try { sessionStorage.setItem('accountBlocked', JSON.stringify({ status: p!.account_status, reason: p!.status_reason })); } catch { /* noop */ }
          await supabase.auth.signOut();
          markDone(false);
          return;
        }
        setUser(s.user);
        setSession(s);
        markDone(true);
      } else {
        markDone(false);
      }
    }).catch(() => {
      clearTimeout(safetyTimer);
      markDone(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted.current) return;

      if (event === 'SIGNED_IN' && s?.user) {
        const p = await loadProfile(s.user.id);
        if (!mounted.current) return;
        if (isBlocked(p)) {
          try { sessionStorage.setItem('accountBlocked', JSON.stringify({ status: p!.account_status, reason: p!.status_reason })); } catch { /* noop */ }
          await supabase.auth.signOut();
          markDone(false);
          return;
        }
        setUser(s.user);
        setSession(s);
        markDone(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setSession(null); setProfile(null);
        markDone(false);
      } else if (event === 'TOKEN_REFRESHED' && s?.user) {
        setUser(s.user); setSession(s);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        const p = await loadProfile(s.user.id);
        if (isBlocked(p)) { markDone(false); return; }
        if (mounted.current) { setUser(s.user); setSession(s); }
        markDone(true);
      } else {
        markDone(false);
      }
    } catch {
      markDone(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut().catch(() => {});
    setUser(null); setSession(null); setProfile(null); setIsAuthenticated(false);
    if (shouldRedirect) window.location.href = '/login';
  };

  const navigateToLogin = () => { window.location.href = '/login'; };

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      isAuthenticated, isLoadingAuth, isLoadingPublicSettings: false,
      authError: null, authChecked,
      logout, navigateToLogin, checkUserAuth, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
