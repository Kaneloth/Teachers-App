import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const PLAN_TIERS = {
  free: {
    label: 'Free Tier',
    cvBuildsPerMonth: 1,
    maxChats: 2,
    watermark: true,
    vacancies: 'view',
    ads: true,
  },
  pro: {
    label: 'Pro',
    cvBuildsPerMonth: Infinity,
    maxChats: Infinity,
    watermark: false,
    vacancies: 'apply',
    ads: false,
  },
};

export function useSubscription() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['current-user-sub'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_end, cv_builds_this_month, cv_builds_month_key')
        .eq('id', user.id)
        .single();
      return data;
    },
    staleTime: 30000,
  });

  const now = new Date();
  const isSubscribed = profile?.subscription_end
    ? new Date(profile.subscription_end) > now
    : false;

  let tier = 'free';
  if (isSubscribed && profile?.subscription_plan) {
    tier = 'pro';
  }

  const tierConfig = PLAN_TIERS[tier as keyof typeof PLAN_TIERS];

  const cvBuildsThisMonth = profile?.cv_builds_this_month || 0;
  const cvBuildsMonthKey = profile?.cv_builds_month_key || '';
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const cvBuildsUsed = cvBuildsMonthKey === thisMonthKey ? cvBuildsThisMonth : 0;
  const canBuildCV = tierConfig.cvBuildsPerMonth === Infinity || cvBuildsUsed < tierConfig.cvBuildsPerMonth;
  const cvBuildsRemaining = tierConfig.cvBuildsPerMonth === Infinity ? Infinity : tierConfig.cvBuildsPerMonth - cvBuildsUsed;

  return {
    isSubscribed,
    isLoading,
    profile,
    tier,
    tierConfig,
    canBuildCV,
    cvBuildsRemaining,
    cvBuildsUsed,
  };
}
