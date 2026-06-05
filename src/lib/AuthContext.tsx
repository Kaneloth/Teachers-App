import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const BIO_RT_KEY = 'crosssa_biometric_refresh_token';
const BIO_AT_KEY = 'crosssa_biometric_access_token';

function saveBioSession(at: string, rt: string) {
  localStorage.setItem(BIO_AT_KEY, at);
  localStorage.setItem(BIO_RT_KEY, rt);
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authChecked: boolean;
  authError: { type: string; message: string } | null;
  checkUserAuth: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserMeta: (data: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setAuthError(null);
    } catch (e: unknown) {
      const err = e as Error;
      setAuthError({ type: 'auth_error', message: err.message });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[auth-event]', event, 'hasRT:', !!newSession?.refresh_token, 'rt-tail:', newSession?.refresh_token?.slice(-8));

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAuthChecked(true);
      setIsLoadingAuth(false);

      // Only save the RT on events that produce a genuinely fresh token.
      // INITIAL_SESSION can fire with a stale cached session and clobber a fresher
      // RT that restoreSessionFromToken just wrote.
      if (
        newSession?.access_token &&
        newSession?.refresh_token &&
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
      ) {
        saveBioSession(newSession.access_token, newSession.refresh_token);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = async () => {
    // Snapshot the freshest RT BEFORE signing out, so biometric restore is guaranteed to have a valid token.
    const { data: { session: live } } = await supabase.auth.getSession();
    const atBefore = live?.access_token ?? localStorage.getItem(BIO_AT_KEY);
    const rtBefore = live?.refresh_token ?? localStorage.getItem(BIO_RT_KEY);
    console.log('[logout] rt-before:', rtBefore?.slice(-8), 'bio-key-before:', localStorage.getItem(BIO_RT_KEY)?.slice(-8));

    if (atBefore && rtBefore) saveBioSession(atBefore, rtBefore);

    await supabase.auth.signOut({ scope: 'local' });

    console.log('[logout] bio-key-after:', localStorage.getItem(BIO_RT_KEY)?.slice(-8));
    setUser(null);
    setSession(null);
  };

  const updateUserMeta = async (data: Record<string, unknown>) => {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
    const { data: { user: refreshed } } = await supabase.auth.getUser();
    if (refreshed) setUser(refreshed);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!user,
      isLoadingAuth,
      authChecked,
      authError,
      checkUserAuth,
      logout,
      updateUserMeta,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
