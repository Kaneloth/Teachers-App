import { useAuth } from '@/lib/AuthContext';

export type SubscriptionPlan = 'free' | 'basic' | 'pro';

export function useSubscription() {
  const { user } = useAuth();
  const meta = user?.user_metadata ?? {};

  const plan: SubscriptionPlan = (meta.subscription_plan as SubscriptionPlan) || 'free';

  const isActive = (() => {
    if (plan === 'free') return true;
    if (!meta.subscription_end) return false;
    return new Date(meta.subscription_end as string) > new Date();
  })();

  const isPro = plan === 'pro' && isActive;
  const isBasic = (plan === 'basic' || plan === 'pro') && isActive;

  return { plan, isActive, isPro, isBasic };
}
