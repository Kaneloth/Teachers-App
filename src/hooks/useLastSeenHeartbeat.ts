/**
 * useLastSeenHeartbeat — periodically records that this user is actually
 * using the app right now, distinct from auth.users.last_sign_in_at (which
 * only updates on login and can be stale for hours while someone is
 * actively using the app).
 *
 * Mount this ONCE, in a top-level layout that wraps every authenticated
 * page (e.g. AppLayout.tsx) — not per-page, or it'll fire redundantly on
 * every route change.
 *
 * Usage:
 *   import { useLastSeenHeartbeat } from '@/hooks/useLastSeenHeartbeat';
 *
 *   export default function AppLayout() {
 *     useLastSeenHeartbeat();
 *     return ( ...existing layout JSX... );
 *   }
 *
 * Writes directly from the client via Supabase (not a Netlify Function) —
 * scoped by an RLS policy (see migration_last_seen.sql) so a user can only
 * ever update their own row's last_seen_at, nothing else.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// How often to attempt a check-in while the tab is open and visible.
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// A floor on how often we'll actually write, even if visibilitychange fires
// repeatedly (e.g. someone alt-tabbing back and forth) — this is meant to
// answer "is this person using the app right now", not track second-by-
// second focus changes, so there's no value in writing more often than this.
const MIN_WRITE_GAP_MS = 2 * 60 * 1000; // 2 minutes

export function useLastSeenHeartbeat() {
  const { user } = useAuth();
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;

    const checkIn = async () => {
      // Don't count a backgrounded/minimized tab as "active" — someone who
      // left the app open in an unfocused tab for hours shouldn't show as
      // currently active just because the process is still running.
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastWriteRef.current < MIN_WRITE_GAP_MS) return;
      lastWriteRef.current = now;

      const { error } = await supabase
        .from('educators')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id);

      // Never surfaced to the user — this is a background admin-visibility
      // feature, not something that should ever interrupt anyone's session
      // with an error toast if it fails.
      if (error) console.error('[useLastSeenHeartbeat] Failed to update last_seen_at:', error);
    };

    checkIn(); // immediate check-in when the app first mounts
    const interval = setInterval(checkIn, HEARTBEAT_INTERVAL_MS);
    // Also check in the moment someone switches back to this tab, rather
    // than waiting for the next interval tick — more responsive for "did
    // they just come back" without needing a shorter (and wasteful) interval.
    document.addEventListener('visibilitychange', checkIn);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkIn);
    };
  }, [user?.id]);
}
