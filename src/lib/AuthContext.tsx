import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ── Biometric session backup keys ─────────────────────────────────────────────
// Kept as a fallback for when the Supabase session has truly expired (60+ days).
const BIO_RT_KEY  = 'crosssa_biometric_refresh_token';
const BIO_AT_KEY  = 'crosssa_biometric_access_token';
// Lock screen flag — set on biometric "logout", cleared on successful unlock.
const LOCK_KEY    = 'crosssa_biometric_locked';

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
  unlockApp: () => Promise<boolean>;
  updateUserMeta: (data: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<User | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError]     = useState<{ type: string; message: string } | null>(null);

  // Skip session restore while the app is in biometric-lock state.
  const checkUserAuth = useCallback(async () => {
    if (localStorage.getItem(LOCK_KEY) === '1') {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
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
      const locked = localStorage.getItem(LOCK_KEY) === '1';

      if (locked) {
        // App is in lock-screen mode. Allow background token rotation to update
        // our backup keys so biometric restore stays current, but do NOT change
        // the React auth state (user must stay null until biometric passes).
        if (
          newSession?.access_token &&
          newSession?.refresh_token &&
          (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
        ) {
          saveBioSession(newSession.access_token, newSession.refresh_token);
        }
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAuthChecked(true);
      setIsLoadingAuth(false);

      // Keep backup tokens current so they can be used if the Supabase session
      // fully expires (60+ days of inactivity).
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

  // ── Lock screen logout ────────────────────────────────────────────────────
  // For biometric users: keep the Supabase session alive in storage (scope:local
  // is NOT called), just hide the app behind the biometric prompt.
  // For password users: full sign-out that revokes the session server-side.
  const logout = async () => {
    const isBiometric = localStorage.getItem('loginMethod') === 'biometric';
    if (isBiometric) {
      localStorage.setItem(LOCK_KEY, '1');
      setUser(null);
      setSession(null);
    } else {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    }
  };

  // ── Biometric unlock ─────────────────────────────────────────────────────
  // Called after the fingerprint is verified. Reads the session that was kept
  // alive in Supabase's localStorage. Returns true on success, false if the
  // session has genuinely expired (caller should fall back to password).
  const unlockApp = useCallback(async (): Promise<boolean> => {
    localStorage.removeItem(LOCK_KEY);

    // Primary path: Supabase session is still alive (the common case).
    const { data: { session: liveSession } } = await supabase.auth.getSession();
    if (liveSession) {
      setSession(liveSession);
      setUser(liveSession.user);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return true;
    }

    // Fallback: session expired — try to exchange the backup tokens.
    const at = localStorage.getItem(BIO_AT_KEY);
    const rt = localStorage.getItem(BIO_RT_KEY);
    if (at && rt) {
      const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      if (!error && data.session) {
        saveBioSession(data.session.access_token, data.session.refresh_token);
        setSession(data.session);
        setUser(data.session.user);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return true;
      }
    }

    // Both failed — session truly gone (60+ days inactive).
    return false;
  }, []);

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
      unlockApp,
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
