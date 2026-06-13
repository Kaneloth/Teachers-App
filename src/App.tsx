import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/AuthContext';

import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';
import AppLayout from '@/components/AppLayout';
import AuthLayout from '@/components/AuthLayout';
import PublicLayout from '@/components/PublicLayout';  // ✅ new import

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
import AboutPage from '@/pages/AboutPage';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter basename={base}>
            <ScrollToTop />
            <Routes>
              {/* Public landing (no header) */}
              <Route path="/" element={<LandingPage />} />

              {/* Public pages with header (no authentication required) */}
              <Route element={<PublicLayout />}>
                <Route path="/about" element={<AboutPage />} />
              </Route>

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

              {/* Main app (requires auth + full app chrome) */}
              <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
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