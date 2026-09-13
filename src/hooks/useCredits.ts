/**
 * useCredits — React hook for the credit system
 *
 * Usage:
 *   const { balance, loading, deduct, refetch, insufficientCredits, dismissInsufficientCredits } = useCredits();
 *
 *   // Before generating a CV:
 *   const ok = await deduct('cv_usage', cvId);
 *   if (!ok) return; // insufficientCredits is now set — render
 *                     // <InsufficientCreditsModal> based on it, see that
 *                     // component's usage docs
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { usePricing } from './usePricing';

export interface InsufficientCreditsInfo {
  needed: number;
  have: number;
  // Set when deduct-credits.js returns a specific explanation — e.g. the
  // free career-tool cap ("You've used your 180 free credits...") is a
  // genuinely different situation from plain insufficient balance, and
  // showing the generic "you need X, have Y" framing for it would be
  // misleading (the user might have credits left, just not usable for
  // this action). Falls back to the generic framing when absent.
  message?: string;
}

export interface CreditState {
  balance:  number;
  loading:  boolean;
  deduct:   (type: 'cv_usage' | 'letter_usage', refId?: string) => Promise<boolean>;
  refetch:  () => Promise<void>;
  // Set instead of firing a toast whenever deduct() fails due to
  // insufficient balance — render <InsufficientCreditsModal> based on
  // this rather than a toast (see that component for the exact pattern).
  insufficientCredits: InsufficientCreditsInfo | null;
  dismissInsufficientCredits: () => void;
}

export function useCredits(): CreditState {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [insufficientCredits, setInsufficientCredits] = useState<InsufficientCreditsInfo | null>(null);

  // Real, admin-controlled costs — previously this hook hardcoded
  // `type === 'cv_usage' ? 9 : 2`, completely disconnected from the
  // credit_costs table every other part of the app reads from. That
  // hardcoded 9 is where the "Each CV build costs 9 credits" text on the
  // general-user home page actually came from — not a display bug, a bug
  // in this hook's own logic.
  const { cvCost, letterCost } = usePricing();

  const isAdmin = !!(user?.user_metadata?.is_admin);

  const fetchBalance = useCallback(async () => {
    if (!user) { setBalance(0); setLoading(false); return; }

    // Admins have unlimited credits — skip the network call entirely.
    if (isAdmin) { setBalance(999999); setLoading(false); return; }

    setLoading(true);
    const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
    if (!error) setBalance(data ?? 0);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const dismissInsufficientCredits = useCallback(() => setInsufficientCredits(null), []);

  /**
   * Deduct credits for a CV or cover letter generation.
   * Returns true if the deduction succeeded (generation can proceed).
   * Returns false if insufficient credits — insufficientCredits is set
   * instead of a toast; render <InsufficientCreditsModal> based on it.
   */
  const deduct = useCallback(async (
    type: 'cv_usage' | 'letter_usage',
    refId?: string,
  ): Promise<boolean> => {
    // Admins bypass the credit system entirely — no deduction, no balance
    // check. We still log a zero-cost ledger entry (fire-and-forget, never
    // blocks generation) so admin activity isn't invisible to the ledger —
    // this keeps the public "CVs Created" stat on the landing page honest,
    // since it counts every credit_ledger row of this type.
    if (isAdmin) {
      if (session?.access_token) {
        fetch('/.netlify/functions/log-admin-usage', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ type, ref_id: refId }),
        }).catch(() => {}); // never let logging failure affect the admin's flow
      }
      return true;
    }

    if (!session?.access_token) {
      toast.error('Please sign in to generate your CV.');
      return false;
    }

    const cost = type === 'cv_usage' ? cvCost : letterCost;

    // Optimistic UI — immediately decrement so the button feels instant
    setBalance(prev => prev - cost);

    try {
      const res = await fetch('/.netlify/functions/deduct-credits', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type, ref_id: refId }),
      });

      const data = await res.json();

      if (res.status === 402) {
        // Reverse the optimistic update
        setBalance(prev => prev + cost);
        // deduct-credits.js has two different 402 scenarios with different
        // response shapes: plain insufficient_credits includes `required`
        // (the server's own authoritative cost — preferred over the
        // client's cost when present, in case client/server pricing
        // briefly disagree right after an admin changes a price), while
        // career_cap_reached includes a specific `message` instead and no
        // `required` field at all. Was a toast — now sets state instead,
        // so the calling component can show InsufficientCreditsModal with
        // a direct path to topping up, rather than a toast that just
        // disappears with no next step.
        setInsufficientCredits({
          needed: data.required ?? cost,
          have: data.balance ?? 0,
          message: data.message,
        });
        return false;
      }

      if (!res.ok) {
        setBalance(prev => prev + cost);
        toast.error('Something went wrong. Please try again.');
        return false;
      }

      // Confirm with server balance
      setBalance(data.new_balance);
      return true;

    } catch (err) {
      // Network error — reverse optimistic update
      setBalance(prev => prev + cost);
      toast.error('Network error. Please check your connection and try again.');
      return false;
    }
  }, [session, isAdmin, cvCost, letterCost]);

  return { balance, loading, deduct, refetch: fetchBalance, insufficientCredits, dismissInsufficientCredits };
}

/**
 * Call this once after a user's email is verified (first SIGNED_IN event).
 * Handles the free signup credit grant with all abuse-prevention checks.
 */
export async function grantSignupCredits(params: {
  user_id:            string;
  phone?:             string;
  device_fingerprint?: string;
}): Promise<{ granted: number; reason: string }> {
  try {
    const res = await fetch('/.netlify/functions/grant-signup-credits', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return { granted: 0, reason: 'network_error' };
  }
}

/**
 * Generate a stable device fingerprint from browser signals.
 * Not perfect, but adds a meaningful extra layer alongside phone + IP.
 * Store the result in localStorage so it persists across sessions.
 */
export function getDeviceFingerprint(): string {
  const STORAGE_KEY = 'crosssa_device_fp';
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const signals = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? '',
    (navigator as any).deviceMemory ?? '',
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < signals.length; i++) {
    hash = ((hash << 5) - hash) + signals.charCodeAt(i);
    hash |= 0;
  }
  const fp = Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  localStorage.setItem(STORAGE_KEY, fp);
  return fp;
}
