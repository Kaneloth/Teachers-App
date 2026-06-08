import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { handleUpgrade } from '@/lib/payment';

const BILLING = [
  { id: 'monthly',     label: 'Monthly',     badge: null,      save: null,       sub: 'R59/mo',                price: 'R59', perMonth: 59  },
  { id: 'semi_annual', label: 'Semi-Annual', badge: 'Popular', save: 'Save 33%', sub: 'R234 every 6 months',   price: 'R39', perMonth: 39  },
  { id: 'annual',      label: 'Annual',      badge: null,      save: 'Save 51%', sub: 'R348/year',              price: 'R29', perMonth: 29  },
] as const;

// Update comparison to match your current free/pro limits
const COMPARISON = [
  { feature: 'CV builds / month', free: 'Unlimited',        pro: 'Unlimited' },
  { feature: 'CV watermark',      free: 'Yes',      		pro: 'No'        },
  { feature: 'Active chats',      free: 'Unlimited',        pro: 'Unlimited' },
  { feature: 'Job applications',  free: 'Unlimited',        pro: 'Unlimited' },
  { feature: 'Ads',               free: 'Yes',      		pro: 'No'        },
  { feature: 'Cover letters',     free: '0',        		pro: 'Unlimited' },
];

function getPlanEndDate(planId: string): string {
  const d = new Date();
  if (planId === 'semi_annual')  d.setMonth(d.getMonth() + 6);
  else if (planId === 'annual')  d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ subscription_plan: string; subscription_end: string | null } | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'semi_annual' | 'annual'>('semi_annual');
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_end')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [open, user]);

  if (!open) return null;

  const profilePlan = profile?.subscription_plan;
  const metaPlan = user?.user_metadata?.subscription_plan as string | undefined;
  const plan = (profilePlan && profilePlan !== 'free') ? profilePlan : (metaPlan || 'free');

  const profileEnd = profile?.subscription_end;
  const metaEnd = user?.user_metadata?.subscription_end as string | undefined;
  const subEnd = profileEnd ? new Date(profileEnd) : metaEnd ? new Date(metaEnd) : null;

  const isCancelled = user?.user_metadata?.subscription_cancelled === true;
  const isActive = plan !== 'free' && subEnd !== null && subEnd > new Date();
  const activePlanLabel = BILLING.find(b => b.id === plan)?.label ?? plan;
  const selected = BILLING.find(b => b.id === billing)!;

  const handleSubscribe = async () => {
    if (!user) return;
    setSubscribing(true);
    try {
      // Call Paystack initialisation (redirects to Paystack)
      await handleUpgrade(billing);
      // The page will redirect; no need to update Supabase here – webhook will do it.
      // But we close modal immediately to avoid double action.
      onClose();
    } catch (error) {
      toast.error('Payment initiation failed. Please try again.');
      console.error(error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to cancel? You will keep access until your current period ends.')) return;
    setCancelling(true);
    const { error } = await supabase.auth.updateUser({ data: { subscription_cancelled: true } });
    setCancelling(false);
    if (error) {
      toast.error('Failed to cancel: ' + error.message);
    } else {
      toast.success('Subscription cancelled. You keep access until your current period ends.');
      onClose();
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
      style={{ margin: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
        style={{ maxWidth: '100vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Upgrade to Pro</h2>
              <p className="text-xs text-muted-foreground">Unlock the full Crosssa experience</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-5 pb-6 space-y-4 flex-1">
          {/* Active plan banner */}
          {isActive && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
              <Star className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-primary">Pro · {activePlanLabel}</span>
                {subEnd && (
                  <span className="text-xs text-muted-foreground ml-2">
                    · {isCancelled ? 'Access ends' : 'Renews'} {fmtDate(subEnd)}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 text-white ${isCancelled ? 'bg-amber-500' : 'bg-primary'}`}>
                {isCancelled ? 'Cancelled' : 'Active'}
              </span>
            </div>
          )}

          {/* Billing selector */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-0.5">
              Choose billing cycle
            </p>
            <div className="space-y-2">
              {BILLING.map(b => (
                <button
                  key={b.id}
                  onClick={() => setBilling(b.id as typeof billing)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all text-left ${
                    billing === b.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    billing === b.id ? 'border-primary' : 'border-muted-foreground'
                  }`}>
                    {billing === b.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{b.label}</span>
                      {b.badge && <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">{b.badge}</span>}
                      {b.save && <span className="text-[10px] text-primary font-semibold">{b.save}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{b.sub}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">
                    {b.price}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Subscribe button */}
          <Button
            className="w-full h-12 rounded-2xl text-base font-semibold"
            onClick={handleSubscribe}
            disabled={subscribing}
          >
            {subscribing
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting to payment…</>
              : `Subscribe — R${selected.perMonth}/mo`}
          </Button>

          <p className="text-center text-xs text-muted-foreground -mt-1">
            Cancel anytime.{' '}
            {isActive && !isCancelled && (
              <a href="#" onClick={handleCancel} className="text-destructive underline underline-offset-2">
                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
              </a>
            )}
          </p>

          {/* Comparison table */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-0.5">
              What you get
            </p>
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground min-w-0">Feature</span>
                <span className="text-xs font-semibold text-muted-foreground text-center min-w-0">Free</span>
                <span className="text-xs font-semibold text-primary text-center min-w-0">Pro</span>
              </div>
              {COMPARISON.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-3 px-3 py-2 ${i < COMPARISON.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <span className="text-xs text-foreground min-w-0 break-words leading-tight">{row.feature}</span>
                  <span className="text-xs text-muted-foreground text-center min-w-0 break-words leading-tight">{row.free}</span>
                  <span className={`text-xs text-center font-medium min-w-0 break-words leading-tight ${row.pro === row.free ? 'text-muted-foreground' : 'text-primary'}`}>{row.pro}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}