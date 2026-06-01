import React, { createContext, useState, useContext, useEffect } from 'react';
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    return data;
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        const profileData = await loadProfile(s.user.id);
        if (profileData?.account_status === 'suspended' || profileData?.account_status === 'banned') {
          const blocked = { status: profileData.account_status, reason: profileData.status_reason };
          sessionStorage.setItem('accountBlocked', JSON.stringify(blocked));
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          setAuthChecked(true);
          return;
        }
        setUser(s.user);
        setSession(s);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setSession(null);
        setIsAuthenticated(false);
      }
    } catch (error: unknown) {
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user) {
        loadProfile(s.user.id).then((profileData) => {
          if (profileData?.account_status === 'suspended' || profileData?.account_status === 'banned') {
            const blocked = { status: profileData.account_status, reason: profileData.status_reason };
            sessionStorage.setItem('accountBlocked', JSON.stringify(blocked));
            supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setIsAuthenticated(false);
          } else {
            setUser(s.user);
            setSession(s);
            setIsAuthenticated(true);
          }
          setIsLoadingAuth(false);
          setAuthChecked(true);
        });
      } else {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'SIGNED_IN' && s?.user) {
        const profileData = await loadProfile(s.user.id);
        if (profileData?.account_status === 'suspended' || profileData?.account_status === 'banned') {
          const blocked = { status: profileData.account_status, reason: profileData.status_reason };
          sessionStorage.setItem('accountBlocked', JSON.stringify(blocked));
          await supabase.auth.signOut();
          return;
        }
        setUser(s.user);
        setSession(s);
        setIsAuthenticated(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setProfile(null);
        setIsAuthenticated(false);
      } else if (event === 'TOKEN_REFRESHED' && s?.user) {
        setUser(s.user);
        setSession(s);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
