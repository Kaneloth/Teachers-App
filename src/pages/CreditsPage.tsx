import { ArrowLeft, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreditBalance from '@/components/credits/CreditBalance';

export default function CreditsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <Coins className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Credits</h1>
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-sm text-muted-foreground">
          View your balance, buy more credits, or check what each action costs.
        </p>
      </div>

      <div className="px-4 pb-8">
        <CreditBalance variant="full" />
      </div>
    </div>
  );
}
