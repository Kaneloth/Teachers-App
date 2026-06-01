import { Toaster as SonnerToaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingPage from '@/pages/OnboardingPage';
import Home from '@/pages/Home';
import SearchPage from '@/pages/SearchPage';
import EducatorProfile from '@/pages/EducatorProfile';
import ChatsPage from '@/pages/ChatsPage';
import ChatRoom from '@/pages/ChatRoom';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import VacanciesPage from '@/pages/VacanciesPage';
import CVBuilderPage from '@/pages/CVBuilderPage';
import MatchesPage from '@/pages/MatchesPage';
import LandingPage from '@/pages/LandingPage';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<LandingPage />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/educator/:id" element={<EducatorProfile />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chat/:conversationId" element={<ChatRoom />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/vacancies" element={<VacanciesPage />} />
          <Route path="/cv-builder" element={<CVBuilderPage />} />
          <Route path="/matches" element={<MatchesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename={import.meta.env.BASE_URL?.replace(/\/$/, '') || ''}>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <SonnerToaster position="top-center" richColors duration={4000} />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
