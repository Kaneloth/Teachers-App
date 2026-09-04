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

// ── Live pricing (admin-controlled) ─────────────────────────────────────────
// Every number the purchase modal shows — package credits/prices, per-action
// credit costs, the signup bonus — used to be hardcoded here and in several
// Netlify functions. They now live in the credit_packages / credit_costs /
// app_settings tables (see migration_pricing.sql), editable from
// Admin → Money → Pricing (AdminPricing.tsx). This hook is the one place
// that reads them for the frontend; the FALLBACK_* constants below are only
// used if that fetch fails (e.g. a transient network error), so the modal
// still renders something reasonable rather than breaking outright.
//
// Messaging unlock (package id 'chat_unlock') is deliberately excluded from
// what this hook returns as "packages" — it's not a credit package, it's a
// standalone R150 PayFast payment triggered from ChatRoom.tsx's upsell
// modal (general users never see it, since they don't use in-app chat).

export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  price_zar: number;
  note: string | null;
  is_popular: boolean;
}

interface Pricing {
  packages: CreditPackage[];
  cvCost: number;
  letterCost: number;
  guideCost: number;
  idVerifyCost: number;
  signupBonus: number;
  loading: boolean;
}

const FALLBACK_PACKAGES: CreditPackage[] = [
  { id: 'single',   label: 'Starter Pack',         credits: 150,  price_zar: 39,  note: null, is_popular: false },
  { id: 'standard', label: 'Standard Credit Pack', credits: 300,  price_zar: 59,  note: null, is_popular: true },
  { id: 'business', label: 'Business Credit Pack', credits: 2000, price_zar: 199, note: null, is_popular: false },
];
const FALLBACK_CV_COST        = 90;
const FALLBACK_LETTER_COST    = 20;
const FALLBACK_GUIDE_COST     = 30;
const FALLBACK_ID_VERIFY_COST = 300;
const FALLBACK_SIGNUP_BONUS   = 240;

function usePricing(): Pricing {
  const [packages,     setPackages]     = useState<CreditPackage[]>(FALLBACK_PACKAGES);
  const [cvCost,        setCvCost]        = useState(FALLBACK_CV_COST);
  const [letterCost,    setLetterCost]    = useState(FALLBACK_LETTER_COST);
  const [guideCost,     setGuideCost]     = useState(FALLBACK_GUIDE_COST);
  const [idVerifyCost,  setIdVerifyCost]  = useState(FALLBACK_ID_VERIFY_COST);
  const [signupBonus,   setSignupBonus]   = useState(FALLBACK_SIGNUP_BONUS);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [pkgRes, costRes, settingRes] = await Promise.all([
          supabase.from('credit_packages').select('*').eq('active', true).neq('id', 'chat_unlock').order('sort_order', { ascending: true }),
          supabase.from('credit_costs').select('action_type, cost'),
          supabase.from('app_settings').select('value').eq('key', 'signup_bonus_credits').maybeSingle(),
        ]);
        if (cancelled) return;

        if (pkgRes.data?.length) {
          setPackages(pkgRes.data.map((p: any) => ({
            id:         p.id,
            label:      p.label,
            credits:    Number(p.credits),
            // price_zar is a Postgres `numeric` column — supabase-js
            // returns those as strings (not JS numbers) to avoid float
            // precision loss, so coerce explicitly before use.
            price_zar:  Number(p.price_zar),
            note:       p.note ?? null,
            is_popular: !!p.is_popular,
          })));
        }

        const costMap: Record<string, number> = {};
        for (const row of costRes.data || []) costMap[row.action_type] = Number(row.cost);
        if (costMap.cv_usage       != null) setCvCost(costMap.cv_usage);
        if (costMap.letter_usage   != null) setLetterCost(costMap.letter_usage);
        if (costMap.guide_download != null) setGuideCost(costMap.guide_download);
        if (costMap.id_verify      != null) setIdVerifyCost(costMap.id_verify);

        const bonus = Number(settingRes.data?.value);
        if (Number.isFinite(bonus)) setSignupBonus(bonus);
      } catch (err) {
        // Fall back to the hardcoded defaults above — already set as the
        // initial state, so there's nothing more to do here.
        console.error('[CreditBalance] Failed to load live pricing, using fallback values:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { packages, cvCost, letterCost, guideCost, idVerifyCost, signupBonus, loading };
}

// Package note shown under the label — uses the admin-set `note` if one was
// typed in, otherwise auto-generates one from this package's credits and
// the current CV/letter costs, so it never goes stale when either changes.
function packageNote(pkg: CreditPackage, cvCost: number, letterCost: number): string {
  if (pkg.note && pkg.note.trim()) return pkg.note.trim();
  const cvs = cvCost > 0 ? Math.floor(pkg.credits / cvCost) : 0;
  const letters = letterCost > 0 ? Math.floor(pkg.credits / letterCost) : 0;
  if (!cvs && !letters) return `${pkg.credits} credits`;
  if (!cvs) return `up to ${letters} letter${letters === 1 ? '' : 's'}`;
  if (!letters) return `up to ${cvs} CV${cvs === 1 ? '' : 's'}`;
  return `up to ${cvs} CV${cvs === 1 ? '' : 's'} or ${letters} letters`;
}

// ── Compact chip ─────────────────────────────────────────────────────────────
interface Props {
  showBuyButton?: boolean;
  variant?: 'chip' | 'full';
  onlyAfterPurchase?: boolean;
}

export default function CreditBalance({ showBuyButton = false, variant = 'chip', onlyAfterPurchase = false }: Props) {
  const { balance, loading, refetch } = useCredits();
  const { user } = useAuth();
  const pricing = usePricing();
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
        <CreditCard balance={balance} loading={loading} onBuy={() => setShowModal(true)} pricing={pricing} />
        {showModal && <PurchaseModal onClose={() => { setShowModal(false); refetch(); }} pricing={pricing} />}
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
      {showModal && <PurchaseModal onClose={() => { setShowModal(false); refetch(); }} pricing={pricing} />}
    </>
  );
}

// ── Full credit card (for settings / CV builder page) ────────────────────────
function CreditCard({ balance, loading, onBuy, pricing }: { balance: number; loading: boolean; onBuy: () => void; pricing: Pricing }) {
  const { cvCost, letterCost } = pricing;
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Coins className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your Credits</p>
            <p className="text-xs text-muted-foreground">CV = {cvCost} credits · Letter = {letterCost} credits</p>
          </div>
        </div>
        <div className="text-right">
          {loading
            ? <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />
            : <p className="text-2xl font-bold text-primary">{balance}</p>}
          <p className="text-xs text-muted-foreground">available</p>
        </div>
      </div>
      {balance < cvCost && !loading && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {balance === 0
              ? 'You have no credits. Purchase a pack to generate CVs and cover letters.'
              : `You have ${balance} credit${balance > 1 ? 's' : ''} — enough for ${Math.floor(balance / letterCost)} cover letter${Math.floor(balance / letterCost) === 1 ? '' : 's'} but not a CV (needs ${cvCost}).`}
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
function PurchaseModal({ onClose, pricing }: { onClose: () => void; pricing: Pricing }) {
  const { session } = useAuth();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { packages, cvCost, letterCost, guideCost, idVerifyCost, signupBonus } = pricing;

  const handlePurchase = async (pkg: CreditPackage) => {
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
            <p className="text-xs text-muted-foreground mt-0.5">CV = {cvCost} credits · Cover letter = {letterCost} credits</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Current balance */}
        <BalanceDisplay />

        {/* Package list */}
        <div className="p-4 space-y-3">
          {packages.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg)}
              disabled={purchasing !== null}
              className={`w-full text-left rounded-2xl border p-4 transition-all hover:border-primary hover:shadow-sm disabled:opacity-60 ${
                pkg.is_popular ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">{pkg.label}</p>
                    {pkg.is_popular && (
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pkg.credits} credits · {packageNote(pkg, cvCost, letterCost)}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold text-foreground">R{pkg.price_zar}</p>
                  {purchasing === pkg.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto mt-1" />
                    : <p className="text-[10px] text-muted-foreground">R{(pkg.price_zar / pkg.credits).toFixed(2)}/credit</p>}
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
              All new users receive {signupBonus} free credits on signup
            </p>
            <p className="text-xs font-medium text-foreground mt-1 pt-1 border-t border-border">Credit costs:</p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              CV download = {cvCost}cr · Cover letter = {letterCost}cr
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              Guide download = {guideCost}cr · ID verification = {idVerifyCost}cr
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
