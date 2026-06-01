import { useSubscription } from '@/hooks/useSubscription';
import { CheckCircle2, Zap, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const FREE_FEATURES = [
  '1 CV build per month',
  'Browse all educators',
  'Send up to 2 messages',
  'Basic search filters',
];

const PRO_FEATURES = [
  'Unlimited CV builds',
  'Unlimited messaging',
  'Priority in search results',
  'Advanced filters',
  'No watermarks on CV',
];

export default function SubscriptionSettings() {
  const { isSubscribed, isLoading, tier, profile } = useSubscription();

  const handleUpgrade = () => {
    toast.info('Payment integration coming soon. Contact support@educross.co.za to upgrade.');
  };

  if (isLoading) {
    return <div className="flex justify-center pt-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {isSubscribed && (
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <Crown className="w-8 h-8 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Pro Plan Active</p>
            <p className="text-xs text-muted-foreground">
              {profile?.subscription_end
                ? `Expires ${new Date(profile.subscription_end).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Active subscription'
              }
            </p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">Free Plan</h3>
          {tier === 'free' && <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 font-medium">Current</span>}
        </div>
        <p className="text-2xl font-bold text-foreground mb-3">R0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        <ul className="space-y-2">
          {FREE_FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />{f}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-primary rounded-2xl p-4 text-primary-foreground">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Pro Plan</h3>
          {isSubscribed && <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-medium">Active</span>}
        </div>
        <p className="text-2xl font-bold mb-3">R99<span className="text-sm font-normal opacity-80">/month</span></p>
        <ul className="space-y-2 mb-4">
          {PRO_FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-primary-foreground/90">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{f}
            </li>
          ))}
        </ul>
        {!isSubscribed && (
          <Button variant="secondary" className="w-full rounded-xl font-semibold" onClick={handleUpgrade}>
            <Zap className="w-4 h-4 mr-2" />Upgrade to Pro
          </Button>
        )}
      </div>
    </div>
  );
}
