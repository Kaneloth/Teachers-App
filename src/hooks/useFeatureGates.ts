/**
 * useFeatureGates
 *
 * Resolution order (highest priority first):
 *  1. Admin → all gates return true (bypass everything)
 *  2. Per-user override in feature_gates table (user_id = current user)
 *  3. Global gate in feature_gates table (user_id IS NULL)
 *  4. Default: true (gates are restrictions — default is open)
 *
 * Gate semantics:
 *  enabled = true  → gate is ACTIVE   (normal R79+ restriction applies)
 *  enabled = false → gate is DISABLED (everyone gets access, no purchase needed)
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

export function useFeatureGates() {
  const { user } = useAuth();
  const [gates, setGates]     = useState<Gates>(Object.fromEntries(ALL_GATES.map(k => [k, true])) as Gates);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Admins bypass all gates
    if (user.user_metadata?.is_admin) {
      setGates(Object.fromEntries(ALL_GATES.map(k => [k, false])) as Gates); // false = gate off = access granted
      setLoading(false);
      return;
    }

    supabase
      .from('feature_gates')
      .select('gate_key, user_id, enabled')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .then(({ data }) => {
        const resolved = Object.fromEntries(ALL_GATES.map(k => [k, true])) as Gates;
        // Apply global gates first
        for (const row of (data || []).filter(r => !r.user_id)) {
          if (row.gate_key in resolved) (resolved as any)[row.gate_key] = row.enabled;
        }
        // Per-user overrides win
        for (const row of (data || []).filter(r => r.user_id === user.id)) {
          if (row.gate_key in resolved) (resolved as any)[row.gate_key] = row.enabled;
        }
        setGates(resolved);
        setLoading(false);
      });
  }, [user?.id]);

  return { gates, loading };
}
