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
import { createPortal } from 'react-dom';
import { Coins, X, Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ── Credit packages (mirror your screenshot) ────────────────────────────────
const PACKAGES = [
  { id: 'single',   label: 'Starter Pack',          price: 39,  credits: 15,  note: '1 CV + 6 letters' },
  { id: 'standard', label: 'Standard Credit Pack', price: 59,  credits: 30,  note: '3 CVs + 3 letters' },
  { id: 'pro_pack', label: 'Pro Credit Pack',       price: 99,  credits: 60,  note: 'Messaging unlock (credits not added to balance)', popular: true },
  { id: 'business', label: 'Business Credit Pack',  price: 199, credits: 200, note: '22 CVs + 2 letters' },
] as const;

type PackageId = typeof PACKAGES[number]['id'];

// ── Compact chip ─────────────────────────────────────────────────────────────
interface Props {
  showBuyButton?: boolean;
  variant?: 'chip' | 'full';
  onlyAfterPurchase?: boolean;
}

export default function CreditBalance({ showBuyButton = false, variant = 'chip', onlyAfterPurchase = false }: Props) {
  const { balance, loading, refetch } = useCredits();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [hasPurchased, setHasPurchased] = useState<boolean | null>(null);

  // Hide chip until user has made a purchase (onlyAfterPurchase mode)
  useEffect(() => {
    if (!onlyAfterPurchase || !user) { setHasPurchased(false); return; }
    supabase.from('credit_ledger').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('type', 'purchase')
      .then(({ count }) => setHasPurchased((count ?? 0) > 0));
  }, [user?.id, onlyAfterPurchase]);

  // After a PayFast redirect back to the app, the URL will contain
  // ?payment=success or ?payment=cancelled. The actual credit grant
  // happens server-side via the payfast-webhook ITN — this just informs
  // the user and refreshes the displayed balance (the webhook may take a
  // few seconds to arrive, so we retry once after a short delay).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');
    const subStatus = params.get('subscription');
    if (!status && !subStatus) return;

    if (status === 'success') {
      toast.success('Payment received! Your credits will appear shortly.');
      refetch();
      const t = setTimeout(() => refetch(), 4000); // webhook may lag slightly
      return () => clearTimeout(t);
    } else if (status === 'cancelled') {
      toast.info('Payment cancelled — no credits were charged.');
    } else if (subStatus === 'success') {
      toast.success('Subscription activated! Refresh to see your new Pro features.');
    } else if (subStatus === 'cancelled') {
      toast.info('Subscription checkout cancelled — you have not been charged.');
    }

    // Clean the query param so a page refresh doesn't re-show the toast.
    params.delete('payment');
    params.delete('subscription');
    const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', newUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (onlyAfterPurchase && hasPurchased === false) return null;

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
            Top up
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
            <p className="text-xs text-muted-foreground">CV = 9 credits · Letter = 1 credit</p>
          </div>
        </div>
        <div className="text-right">
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />
            : <p className="text-2xl font-bold text-primary">{balance}</p>}
          <p className="text-xs text-muted-foreground">available</p>
        </div>
      </div>
      {balance < 9 && !loading && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {balance === 0
              ? 'You have no credits. Purchase a pack to generate CVs and cover letters.'
              : `You have ${balance} credit${balance > 1 ? 's' : ''} — enough for ${balance} cover letter${balance > 1 ? 's' : ''} but not a CV (needs 9).`}
          </p>
        </div>
      )}
      <Button onClick={onBuy} className="w-full rounded-xl gap-2">
        <Zap className="w-4 h-4" /> Top Up Credits
      </Button>
    </div>
  );
}

// ── Balance display inside modal ─────────────────────────────────────────────
function BalanceDisplay() {
  const { balance, loading } = useCredits();
  return (
    <div className="mx-4 mt-4 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground">Your current balance</p>
        <p className="text-2xl font-bold text-primary leading-tight">
          {loading ? '…' : balance} <span className="text-sm font-normal text-muted-foreground">credits</span>
        </p>
      </div>
      <Coins className="w-8 h-8 text-primary/30" />
    </div>
  );
}

// ── Low credits prompt — invite user to view packages, don't show them directly
export function LowCreditsPrompt({ onViewPackages, message }: { onViewPackages: () => void; message?: string }) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-4">
      <div className="flex items-start gap-3">
        <Coins className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Not enough credits</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            {message || "You don't have enough credits for this action."}
          </p>
          <button
            onClick={onViewPackages}
            className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:no-underline"
          >
            View credit packages →
          </button>
        </div>
      </div>
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

  // Hide bottom nav while modal is open, restore on close
  useEffect(() => {
    const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null;
    if (nav) nav.style.display = 'none';
    return () => { if (nav) nav.style.display = ''; };
  }, []);

  // Rendered via a portal straight into <body> — some pages (e.g. CV Builder,
  // which wraps its content in animated framer-motion elements) have an
  // ancestor with a CSS transform applied. Per the CSS spec, a transformed
  // ancestor becomes the containing block for `position: fixed` descendants,
  // which was clipping/mispositioning this modal instead of covering the
  // real viewport. Portaling to document.body escapes any such ancestor so
  // `fixed inset-0` always means "relative to the actual screen," everywhere
  // this component is used.
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl my-auto min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground">Top Up Credits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">CV = 9 credits · Cover letter = 2 credits · Chat = 5 credits</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Current balance */}
        <BalanceDisplay />

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
              Purchased credits never expire and carry over month to month
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              All new users receive 18 free credits on signup
            </p>
            <p className="text-xs font-medium text-foreground mt-1 pt-1 border-t border-border">Credit costs:</p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              CV download = 9cr · Cover letter = 2cr · New chat = 5cr
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              Guide download = 3cr · ID verification = 30cr
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              R79+ pack unlocks advanced search filters
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
