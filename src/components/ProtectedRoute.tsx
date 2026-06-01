import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import type { ReactNode } from 'react';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
  </div>
);

interface ProtectedRouteProps {
  fallback?: ReactNode;
  unauthenticatedElement?: ReactNode;
}

export default function ProtectedRoute({
  fallback = <DefaultFallback />,
  unauthenticatedElement,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
}
