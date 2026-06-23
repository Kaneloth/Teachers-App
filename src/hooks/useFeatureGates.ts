/**
 * useFeatureGates — resolves feature gate state for the current user.
 *
 * Resolution order (highest priority first):
 *   1. Admin → always true (admins bypass all gates)
 *   2. Per-user override in feature_gates table
 *   3. Global gate in feature_gates table
 *   4. Hardcoded default (true — gates are opt-in restrictions, not opt-in features)
 *
 * Usage:
 *   const { gates, loading } = useFeatureGates();
 *   if (!gates.advanced_search) show upgrade prompt;
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

const DEFAULT_GATES: Gates = {
  advanced_search: true,
  matches_page:    true,
  guides_access:   true,
  cv_credits:      true,
  chat_credits:    true,
  id_verification: true,
};

export function useFeatureGates() {
  const { user } = useAuth();
  const [gates, setGates]   = useState<Gates>(DEFAULT_GATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    // Admins bypass everything
    if (user.user_metadata?.is_admin) {
      setGates(DEFAULT_GATES);
      setLoading(false);
      return;
    }

    // Fetch both global gates and this user's overrides in one query
    supabase
      .from('feature_gates')
      .select('gate_key, user_id, enabled')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .then(({ data }) => {
        if (!data) { setLoading(false); return; }

        const resolved = { ...DEFAULT_GATES };
        // Apply global gates first
        for (const row of data.filter(r => !r.user_id)) {
          if (row.gate_key in resolved) {
            (resolved as any)[row.gate_key] = row.enabled;
          }
        }
        // Per-user overrides take precedence
        for (const row of data.filter(r => r.user_id === user.id)) {
          if (row.gate_key in resolved) {
            (resolved as any)[row.gate_key] = row.enabled;
          }
        }
        setGates(resolved);
        setLoading(false);
      });
  }, [user?.id]);

  return { gates, loading };
}
