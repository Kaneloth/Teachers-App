import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';

interface Props {
  requiredPlan?: SubscriptionPlan;
  children: ReactNode;
  feature?: string;
}

export default function SubscriptionGate({ requiredPlan = 'basic', children, feature }: Props) {
  const { plan, isBasic, isPro } = useSubscription();

  const hasAccess =
    requiredPlan === 'free' ||
    (requiredPlan === 'basic' && isBasic) ||
    (requiredPlan === 'pro' && isPro);

  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">
        {requiredPlan === 'pro' ? 'Pro Feature' : 'Subscription Required'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {feature
          ? `${feature} is available on the ${requiredPlan} plan.`
          : `Upgrade to ${requiredPlan} to access this feature.`}
      </p>
      <Link to="/settings?tab=subscription">
        <Button className="rounded-xl">View Plans</Button>
      </Link>
    </div>
  );
}
