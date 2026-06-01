import { RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function UserNotRegisteredError() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6">
          <RefreshCw className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Complete your setup</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Your account is ready — just set up your educator profile to start using the app.
        </p>
        <Button
          className="w-full h-12 rounded-xl font-semibold"
          onClick={() => (window.location.href = '/onboarding')}
        >
          Set Up My Profile
        </Button>
        <button
          className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto transition-colors"
          onClick={() => logout().then(() => (window.location.href = '/login'))}
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
