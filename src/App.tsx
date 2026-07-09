import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import AppLayout from '@/components/AppLayout';
import AuthLayout from '@/components/AuthLayout';
// No PublicLayout needed – About is now a landing section

import LandingPage from '@/pages/LandingPage';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import Search from '@/pages/Search';
import EducatorProfile from '@/pages/EducatorProfile';
import ChatsPage from '@/pages/ChatsPage';
import ChatRoom from '@/pages/ChatRoom';
import VacanciesPage from '@/pages/VacanciesPage';
import MatchesPage from '@/pages/MatchesPage';
import ProfilePage from '@/pages/ProfilePage';
import CVBuilderPage from '@/pages/CVBuilderPage';
import CareerToolsPage from '@/pages/CareerToolsPage';
import CoverLettersPage from '@/pages/CoverLettersPage';
import GuidesPage from '@/pages/GuidesPage';
import SettingsPage from '@/pages/SettingsPage';
import SupportPage from '@/pages/SupportPage';
import CreditsPage from '@/pages/CreditsPage';
// AboutPage import removed
import NotFound from '@/pages/not-found';
import NotificationsPage from '@/pages/NotificationsPage';
// Admin Dashboard Imports
import AdminRoute from '@/pages/admin/AdminRoute';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';

const queryClient = new QueryClient();
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * RequireComplete — gates app access for users who haven't finished setup.
 *
 * Uses <Navigate> (render-safe) not window.location.href (causes session crash).
 * Only runs checks once loading is definitively false so session refresh
 * mid-render never triggers a redirect.
 *
 * Gate 1: Email not confirmed → back to /register (OTP screen)
 * Gate 2: No profile_type chosen → to /onboarding
 *
 * Admins bypass both gates.
 */
function RequireComplete() {
  const { user, loading } = useAuth();
  const [profileChecked, setProfileChecked] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Check the educators table directly — user_metadata.profile_type may lag
    // behind after onboarding until the session refreshes. The DB is always
    // up-to-date and avoids the infinite redirect loop.
    const metaType = user.user_metadata?.profile_type as string | undefined;
    if (metaType) {
      // Fast path: metadata already has profile_type
      setHasProfile(true);
      setProfileChecked(true);
    } else {
      // Slow path: check DB (catches the gap right after onboarding saves)
      import('@/lib/supabase').then(({ supabase }) => {
        supabase
          .from('educators')
          .select('profile_type')
          .eq('user_id', user.id)
          .single()
          .then(({ data }) => {
            setHasProfile(!!(data?.profile_type));
            setProfileChecked(true);
          });
      });
    }
  }, [user?.id]);

  // While auth or profile check is loading, render nothing
  if (loading || (user && !profileChecked)) return null;

  // Not logged in — ProtectedRoute above us handles this redirect
  if (!user) return <Outlet />;

  // Admins bypass all gates
  if (user.user_metadata?.is_admin) return <Outlet />;

  // Gate 1: Email not confirmed (Google OAuth users always pass — they have confirmed_at)
  const emailConfirmed = !!(user.email_confirmed_at || user.confirmed_at);
  if (!emailConfirmed) return <Navigate to="/register" replace />;

  // Gate 2: Profile type not chosen (onboarding incomplete)
  if (!hasProfile) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter basename={base}>
            <ScrollToTop />
            <Routes>
              {/* Public landing (includes About section) */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth routes (landing‑style, no header) */}
              <Route element={<AuthLayout />}>
                <Route path="/login"           element={<Login />} />
                <Route path="/register"        element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password"  element={<ResetPassword />} />
              </Route>

              {/* Onboarding (requires auth, no app chrome) */}
              <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
                <Route path="/onboarding" element={<Onboarding />} />
              </Route>

              {/* Main app (requires auth + email confirmed + profile complete) */}
              <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
                <Route element={<RequireComplete />}>
                <Route element={<AppLayout />}>
                  <Route path="/home"          element={<Home />} />
                  <Route path="/search"        element={<Search />} />
                  <Route path="/educator/:id"  element={<EducatorProfile />} />
                  <Route path="/chats"         element={<ChatsPage />} />
                  <Route path="/guides"        element={<GuidesPage />} />
                  <Route path="/chat/:partnerId" element={<ChatRoom />} />
                  <Route path="/vacancies"     element={<VacanciesPage />} />
                  <Route path="/matches"       element={<MatchesPage />} />
                  <Route path="/profile"       element={<ProfilePage />} />
                  <Route path="/profile/:userId"  element={<ProfilePage />} />
                  <Route path="/cv-builder"    element={<CVBuilderPage />} />
                  <Route path="/career-tools"  element={<CareerToolsPage />} />
                  <Route path="/cover-letters" element={<CoverLettersPage />} />
                  <Route path="/settings"      element={<SettingsPage />} />
                  <Route path="/support"       element={<SupportPage />} />
                  <Route path="/credits"       element={<CreditsPage />} />
                  <Route path="/notifications"  element={<NotificationsPage />} />
                </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}