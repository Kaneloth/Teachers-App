import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { MailCheck, ClipboardList, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const queryClient = new QueryClient();

/**
 * RequireComplete — wraps all main app routes.
 * Blocks access if:
 *   1. Email not yet confirmed (show verify prompt)
 *   2. Profile type not yet chosen (show onboarding prompt)
 * Shows a friendly, actionable screen instead of a blank page or silent redirect.
 */
function RequireComplete() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Gate 1: Email not confirmed ────────────────────────────────────────────
  // Google OAuth users always have email_confirmed_at set by Supabase.
  // Only email/password signups need OTP confirmation.
  const emailConfirmed = !!(user?.email_confirmed_at || user?.confirmed_at);
  if (user && !emailConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
            <MailCheck className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Verify your email</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              We sent a verification code to <strong>{user.email}</strong>.
              Please check your inbox (and spam folder) and enter the code on the verification screen.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full rounded-xl h-11"
              onClick={() => window.location.href = '/register'}
            >
              Go to verification screen
            </Button>
            <p className="text-xs text-muted-foreground">
              Inbox full or not receiving emails?{' '}
              <a
                href="mailto:support@crosssa.co.za?subject=Email+Verification+Help&body=My+email+is+{user.email}"
                className="text-primary underline font-medium"
              >
                Contact support
              </a>
              {' '}and we'll verify you manually.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Gate 2: Profile type not yet chosen (onboarding incomplete) ───────────
  const profileType = user?.user_metadata?.profile_type as string | undefined;
  if (user && !profileType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Complete your profile</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              You need to finish setting up your profile before you can access the app.
              It only takes a minute!
            </p>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full rounded-xl h-11"
              onClick={() => window.location.href = '/onboarding'}
            >
              Complete setup
            </Button>
            <p className="text-xs text-muted-foreground">
              Having trouble?{' '}
              <a
                href="mailto:support@crosssa.co.za?subject=Onboarding+Help"
                className="text-primary underline font-medium"
              >
                <MessageCircle className="w-3 h-3 inline mr-0.5" />
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

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
                  <Route path="/cv-builder"    element={<CVBuilderPage />} />
                  <Route path="/career-tools"  element={<CareerToolsPage />} />
                  <Route path="/cover-letters" element={<CoverLettersPage />} />
                  <Route path="/settings"      element={<SettingsPage />} />
                  <Route path="/support"       element={<SupportPage />} />
                  <Route path="/credits"       element={<CreditsPage />} />
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