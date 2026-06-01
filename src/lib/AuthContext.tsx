import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = async () => {
    await supabase.auth.signOut();
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
