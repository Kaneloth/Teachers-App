/**
 * usePricing — live, admin-controlled pricing for the credit system.
 *
 * Moved out of CreditBalance.tsx into its own file so useCredits.ts can use
 * it too, without creating a circular import (CreditBalance.tsx imports
 * useCredits.ts for the user's balance; if useCredits.ts then imported
 * pricing FROM CreditBalance.tsx, that would be a cycle). CreditBalance.tsx
 * now imports from here and re-exports, so nothing that already imports
 * usePricing/PurchaseModal from CreditBalance.tsx needs to change.
 *
 * Every number here — package credits/prices, per-action credit costs, the
 * signup bonus — lives in the credit_packages / credit_costs / app_settings
 * tables (see migration_pricing.sql), editable from Admin → Money → Pricing
 * (AdminPricing.tsx). The FALLBACK_* constants below are only used if the
 * fetch fails (e.g. a transient network error), so callers still get a
 * reasonable value rather than breaking outright.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CreditPackage {
  id: string;
  label: string;
  credits: number;
  price_zar: number;
  note: string | null;
  is_popular: boolean;
}

export interface Pricing {
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

export function usePricing(): Pricing {
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
        console.error('[usePricing] Failed to load live pricing, using fallback values:', err);
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
export function packageNote(pkg: CreditPackage, cvCost: number, letterCost: number): string {
  if (pkg.note && pkg.note.trim()) return pkg.note.trim();
  const cvs = cvCost > 0 ? Math.floor(pkg.credits / cvCost) : 0;
  const letters = letterCost > 0 ? Math.floor(pkg.credits / letterCost) : 0;
  if (!cvs && !letters) return `${pkg.credits} credits`;
  if (!cvs) return `up to ${letters} letter${letters === 1 ? '' : 's'}`;
  if (!letters) return `up to ${cvs} CV${cvs === 1 ? '' : 's'}`;
  return `up to ${cvs} CV${cvs === 1 ? '' : 's'} or ${letters} letters`;
}
