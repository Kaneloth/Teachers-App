/**
 * CreditBalance — shows the user's current credit balance
 * with a buy-more button that opens the purchase modal.
 *
 * Usage:
 *   <CreditBalance />                    // compact chip (for header/nav)
 *   <CreditBalance showBuyButton />      // chip + buy button
 *   <CreditBalance variant="full" />     // full card with package grid
 */

import { useState, useEffect } from 'react';
import { Coins, X, Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

// ── Credit packages (mirror your screenshot) ────────────────────────────────
const PACKAGES = [
  { id: 'single',   label: 'Single CV',            price: 19,  credits: 6,   note: 'enough for 2 CVs + 2 letters' },
  { id: 'standard', label: 'Standard Credit Pack', price: 49,  credits: 30,  note: '10 CVs + 10 letters', popular: true },
  { id: 'pro_pack', label: 'Pro Credit Pack',       price: 79,  credits: 60,  note: '20 CVs + 20 letters' },
  { id: 'business', label: 'Business Credit Pack',  price: 199, credits: 200, note: 'for recruitment agencies' },
] as const;

type PackageId = typeof PACKAGES[number]['id'];

// ── Compact chip ─────────────────────────────────────────────────────────────
interface Props {
  showBuyButton?: boolean;
  variant?: 'chip' | 'full';
}

export default function CreditBalance({ showBuyButton = false, variant = 'chip' }: Props) {
  const { balance, loading, refetch } = useCredits();
  const [showModal, setShowModal] = useState(false);

  // After a PayFast redirect back to the app, the URL will contain
  // ?payment=success or ?payment=cancelled. The actual credit grant
  // happens server-side via the payfast-webhook ITN — this just informs
  // the user and refreshes the displayed balance (the webhook may take a
  // few seconds to arrive, so we retry once after a short delay).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');
    if (!status) return;

    if (status === 'success') {
      toast.success('Payment received! Your credits will appear shortly.');
      refetch();
      const t = setTimeout(() => refetch(), 4000); // webhook may lag slightly
      return () => clearTimeout(t);
    } else if (status === 'cancelled') {
      toast.info('Payment cancelled — no credits were charged.');
    }

    // Clean the query param so a page refresh doesn't re-show the toast.
    params.delete('payment');
    const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', newUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (variant === 'full') {
    return (
      <>
        <CreditCard balance={balance} loading={loading} onBuy={() => setShowModal(true)} />
        {showModal && <PurchaseModal onClose={() => { setShowModal(false); refetch(); }} />}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          <Coins className="w-3.5 h-3.5" />
          {loading ? '…' : balance}
          <span className="font-normal text-xs opacity-70">credits</span>
        </button>
        {showBuyButton && (
          <button onClick={() => setShowModal(true)}
            className="text-xs text-primary font-medium hover:underline">
            Buy more
          </button>
        )}
      </div>
      {showModal && <PurchaseModal onClose={() => { setShowModal(false); refetch(); }} />}
    </>
  );
}

// ── Full credit card (for settings / CV builder page) ────────────────────────
function CreditCard({ balance, loading, onBuy }: { balance: number; loading: boolean; onBuy: () => void }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Coins className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your Credits</p>
            <p className="text-xs text-muted-foreground">CV = 3 credits · Letter = 1 credit</p>
          </div>
        </div>
        <div className="text-right">
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />
            : <p className="text-2xl font-bold text-primary">{balance}</p>}
          <p className="text-xs text-muted-foreground">available</p>
        </div>
      </div>
      {balance < 3 && !loading && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {balance === 0
              ? 'You have no credits. Purchase a pack to generate CVs and cover letters.'
              : `You have ${balance} credit${balance > 1 ? 's' : ''} — enough for ${balance} cover letter${balance > 1 ? 's' : ''} but not a CV (needs 3).`}
          </p>
        </div>
      )}
      <Button onClick={onBuy} className="w-full rounded-xl gap-2">
        <Zap className="w-4 h-4" /> Buy Credits
      </Button>
    </div>
  );
}

// ── Purchase modal ────────────────────────────────────────────────────────────
function PurchaseModal({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const [purchasing, setPurchasing] = useState<PackageId | null>(null);

  const handlePurchase = async (pkg: typeof PACKAGES[number]) => {
    if (!session?.access_token) { toast.error('Please sign in first.'); return; }
    setPurchasing(pkg.id);

    try {
      const res = await fetch('/.netlify/functions/payfast-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ package_id: pkg.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start payment');

      // Build a hidden form and submit it — this redirects the browser to
      // PayFast's payment page (POST, as PayFast requires).
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action_url;
      Object.entries(data.fields as Record<string, string>).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      // Don't reset `purchasing` — the page is navigating away.
    } catch (err: any) {
      toast.error(err.message || 'Could not start payment. Please try again.');
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground">Buy Credits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">CV = 3 credits · Cover letter = 1 credit</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Package list */}
        <div className="p-4 space-y-3">
          {PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg)}
              disabled={purchasing !== null}
              className={`w-full text-left rounded-2xl border p-4 transition-all hover:border-primary hover:shadow-sm disabled:opacity-60 ${
                pkg.popular ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">{pkg.label}</p>
                    {pkg.popular && (
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pkg.credits} credits · {pkg.note}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold text-foreground">R{pkg.price}</p>
                  {purchasing === pkg.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto mt-1" />
                    : <p className="text-[10px] text-muted-foreground">R{(pkg.price / pkg.credits).toFixed(2)}/credit</p>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info footer */}
        <div className="px-4 pb-4 space-y-2">
          <div className="bg-muted rounded-xl px-3 py-2 space-y-1">
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              Credits never expire and carry over month to month
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              Pro subscribers receive 10 free credits every month
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              New users get 6 free credits on signup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
