import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function SubscriptionGate({ message = 'Subscribe to access this feature.' }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-2">Subscription Required</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">{message}</p>
      <Button
        onClick={() => navigate('/settings', { state: { tab: 'subscription' } })}
        className="rounded-xl px-8 h-11 text-base font-semibold"
      >
        View Plans
      </Button>
    </div>
  );
}