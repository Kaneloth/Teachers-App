import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Plan definitions
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
  const { data: user, isLoading } = useQuery({
    queryKey: ['current-user-sub'],
    queryFn: () => base44.auth.me(),
    staleTime: 30000,
  });

  const now = new Date();
  const isSubscribed = user?.subscription_end
    ? new Date(user.subscription_end) > now
    : false;

  // Determine tier: free for everyone by default, upgrade if subscribed
  const subscriptionPlan = user?.subscription_plan;
  let tier = 'free';
  if (isSubscribed && subscriptionPlan) {
    tier = 'pro';
  }

  const tierConfig = PLAN_TIERS[tier];

  // CV builds this month
  const cvBuildsThisMonth = user?.cv_builds_this_month || 0;
  const cvBuildsMonthKey = user?.cv_builds_month_key || '';
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const cvBuildsUsed = cvBuildsMonthKey === thisMonthKey ? cvBuildsThisMonth : 0;
  const canBuildCV = tierConfig.cvBuildsPerMonth === Infinity || cvBuildsUsed < tierConfig.cvBuildsPerMonth;
  const cvBuildsRemaining = tierConfig.cvBuildsPerMonth === Infinity ? Infinity : tierConfig.cvBuildsPerMonth - cvBuildsUsed;

  return {
    isSubscribed,
    isLoading,
    user,
    tier,
    tierConfig,
    canBuildCV,
    cvBuildsRemaining,
    cvBuildsUsed,
  };
}