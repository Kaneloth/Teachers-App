import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const PLANS = [
  {
    id: 'pro-monthly',
    label: 'Monthly',
    price: 'R59',
    priceNum: 59,
    period: '/month',
    total: 'R59/mo',
    savings: null,
    popular: false,
  },
  {
    id: 'pro-semi-annual',
    label: 'Semi-Annual',
    price: 'R47',
    priceNum: 47,
    period: '/month',
    total: 'R282 every 6 months',
    savings: 'Save 20%',
    popular: true,
  },
  {
    id: 'pro-annual',
    label: 'Annual',
    price: 'R35',
    priceNum: 35,
    period: '/month',
    total: 'R420/year',
    savings: 'Save 41%',
    popular: false,
  },
];

const COMPARISON = [
  { feature: 'CV builds per month', free: '1', pro: 'Unlimited' },
  { feature: 'Personal details', free: 'Locked to profile', pro: 'Locked to profile' },
  { feature: 'CV watermark', free: 'Yes', pro: 'No' },
  { feature: 'Active chats', free: '2', pro: 'Unlimited' },
  { feature: 'Vacancies', free: 'View only', pro: 'View + apply' },
  { feature: 'Ads', free: 'Yes', pro: 'No' },
];

const getPlanEndDate = (planId) => {
  const now = new Date();
  if (planId.includes('semi-annual')) now.setMonth(now.getMonth() + 6);
  else if (planId.includes('annual')) now.setFullYear(now.getFullYear() + 1);
  else now.setMonth(now.getMonth() + 1);
  return now.toISOString();
};

function PlanSelector({ plans, selected, onSelect }) {
  return (
    <div className="space-y-2">
      {plans.map(plan => (
        <button
          key={plan.id}
          onClick={() => onSelect(plan.id)}
          className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
            selected === plan.id
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-border bg-card hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                selected === plan.id ? 'border-primary bg-primary' : 'border-border'
              }`}>
                {selected === plan.id && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{plan.label}</span>
                  {plan.popular && <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground border-0">Popular</Badge>}
                  {plan.savings && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-primary">{plan.savings}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.total}</p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-lg font-bold text-foreground">{plan.price}</span>
              <span className="text-xs text-muted-foreground">{plan.period}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function SubscriptionSettings() {
  const [selectedPlan, setSelectedPlan] = useState('pro-semi-annual');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.subscription_plan) setCurrentPlan(user.subscription_plan);
      if (user?.subscription_end) setSubscriptionEnd(user.subscription_end);
    });
  }, []);

  const isActive = currentPlan && subscriptionEnd && new Date(subscriptionEnd) > new Date();
  const activePlanLabel = isActive
    ? (PLANS.find(p => p.id === currentPlan)?.label || currentPlan)
    : null;

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const endDate = getPlanEndDate(selectedPlan);
      await base44.auth.updateMe({
        subscription_plan: selectedPlan,
        subscription_start: new Date().toISOString(),
        subscription_end: endDate,
        subscription_cancelled: false,
      });
      setCurrentPlan(selectedPlan);
      setSubscriptionEnd(endDate);
      const planObj = PLANS.find(p => p.id === selectedPlan);
      toast.success(`🎉 Pro ${planObj?.label} plan activated!`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to cancel? You will keep access until your current period ends.')) return;
    setCancelling(true);
    try {
      await base44.auth.updateMe({ subscription_cancelled: true });
      toast.success('Subscription cancelled. You keep access until your current period ends.');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current plan banner */}
      {isActive && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
          <Star className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-primary">
              Pro · {activePlanLabel}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              · Renews {new Date(subscriptionEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">Active</Badge>
        </div>
      )}

      {/* Free tier info */}
      {!isActive && (
        <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2.5">
          <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            You're on the <span className="font-semibold text-foreground">Free Tier</span> — 1 CV/mo, 2 chats, view-only vacancies.
          </p>
        </div>
      )}

      {/* Plan selector */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pro Plan — Choose Billing</h2>

        <PlanSelector plans={PLANS} selected={selectedPlan} onSelect={setSelectedPlan} />

        <Button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="w-full h-12 rounded-xl text-base font-semibold mt-4"
        >
          {subscribing
            ? 'Activating...'
            : `Subscribe — ${PLANS.find(p => p.id === selectedPlan)?.price}/mo`}
        </Button>

        <p className="text-center text-xs text-muted-foreground mt-2">
          Cancel anytime.{' '}
          {isActive && (
            <a href="#" onClick={handleCancel} className="text-destructive underline underline-offset-2">
              {cancelling ? 'Cancelling...' : 'Cancel subscription'}
            </a>
          )}
        </p>
      </div>

      {/* Comparison table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Plan Comparison</h2>
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0 border-b border-border bg-muted/50">
            <div className="p-3 text-xs font-semibold text-muted-foreground">Feature</div>
            <div className="p-3 text-xs font-semibold text-center text-muted-foreground">Free</div>
            <div className="p-3 text-xs font-semibold text-center text-primary">Pro</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 gap-0 ${i < COMPARISON.length - 1 ? 'border-b border-border' : ''}`}>
              <div className="p-3 text-xs font-medium text-foreground">{row.feature}</div>
              <div className="p-3 text-xs text-center text-muted-foreground">{row.free}</div>
              <div className="p-3 text-xs text-center text-primary font-medium">{row.pro}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}