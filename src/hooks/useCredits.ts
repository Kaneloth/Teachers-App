/**
 * useCredits — React hook for the credit system
 *
 * Usage:
 *   const { balance, loading, deduct, refetch } = useCredits();
 *
 *   // Before generating a CV:
 *   const ok = await deduct('cv_usage', cvId);
 *   if (!ok) return; // modal shown automatically
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export interface CreditState {
  balance:  number;
  loading:  boolean;
  deduct:   (type: 'cv_usage' | 'letter_usage', refId?: string) => Promise<boolean>;
  refetch:  () => Promise<void>;
}

export function useCredits(): CreditState {
  const { user, session } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

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

  /**
   * Deduct credits for a CV or cover letter generation.
   * Returns true if the deduction succeeded (generation can proceed).
   * Returns false if insufficient credits (purchase modal should be shown).
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

    const cost = type === 'cv_usage' ? 6 : 1;

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
        toast.error(
          `Not enough credits. You need ${cost} credit${cost > 1 ? 's' : ''} but have ${data.balance}.`,
          { duration: 5000 }
        );
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
  }, [session, isAdmin]);

  return { balance, loading, deduct, refetch: fetchBalance };
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
