/**
 * useFeatureGates — resolves feature gate state for the current user.
 *
 * Gate semantics:
 *   gate enabled = true  → restriction is ACTIVE (normal R79+ check applies)
 *   gate enabled = false → restriction is OFF (everyone gets access freely)
 *
 * Resolution order:
 *   1. Admin            → all gates return false (bypassed)
 *   2. Per-user override → exact value from feature_gates where user_id = me
 *   3. Global gate       → value from feature_gates where user_id IS NULL
 *   4. Default           → true (gate active — safe fallback)
 *
 * Usage in a page:
 *   const { gates } = useFeatureGates();
 *   const effectiveIsPro = !gates.advanced_search || isPro;
 *   // gates.advanced_search = false → gate off → effectiveIsPro = true for all
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

export type GateKey =
  | 'advanced_search'
  | 'matches_page'
  | 'guides_access'
  | 'cv_credits'
  | 'chat_credits'
  | 'id_verification';

export type Gates = Record<GateKey, boolean>;

const ALL_GATES: GateKey[] = [
  'advanced_search', 'matches_page', 'guides_access',
  'cv_credits', 'chat_credits', 'id_verification',
];

const DEFAULTS: Gates = Object.fromEntries(ALL_GATES.map(k => [k, true])) as Gates;

export function useFeatureGates() {
  const { user } = useAuth();
  const [gates,   setGates]   = useState<Gates>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Admins bypass all gates — set all to false (= gate off = access granted)
    if (user.user_metadata?.is_admin) {
      setGates(Object.fromEntries(ALL_GATES.map(k => [k, false])) as Gates);
      setLoading(false);
      return;
    }

    supabase
      .from('feature_gates')
      .select('gate_key, user_id, enabled')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .then(({ data, error }) => {
        if (error || !data) {
          // Table missing or RLS blocked — keep defaults (all gates active)
          console.warn('[useFeatureGates] Could not load gates:', error?.message);
          setLoading(false);
          return;
        }

        const resolved = { ...DEFAULTS };

        // Apply global gates first (lower priority)
        for (const row of data.filter(r => !r.user_id)) {
          if (row.gate_key in resolved) (resolved as any)[row.gate_key] = row.enabled;
        }
        // Per-user overrides win (higher priority)
        for (const row of data.filter(r => r.user_id === user.id)) {
          if (row.gate_key in resolved) (resolved as any)[row.gate_key] = row.enabled;
        }

        setGates(resolved);
        setLoading(false);
      });
  }, [user?.id, user?.user_metadata?.is_admin]);

  return { gates, loading };
}
