/**
 * match-scan — scans all educator profiles and sends match notifications.
 *
 * Triggered by:
 *   - POST /.netlify/functions/match-scan  (admin only, manual trigger)
 *   - Can be scheduled via Netlify scheduled functions
 *
 * Logic:
 *   For every pair of educators (A, B):
 *     1. Both must be is_actively_looking = true
 *     2. Both must be educator profile_type
 *     3. Share at least one subject
 *     4. Match score >= 40 (meaningful match) OR town-swap qualifies
 *     5. Pair must not have been notified before (match_notification_log)
 *   If all pass → insert notification for both A and B
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MATCH_NOTIFY_THRESHOLD = 40; // minimum score to notify

function calculateMatch(me, them) {
  const setA   = new Set((me.subjects   || []).map(s => s.toLowerCase()));
  const setB   = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const common = [...setA].filter(s => setB.has(s)).length;
  if (common === 0) return 0;

  const totalDistinct = new Set([...setA, ...setB]).size;
  const subjectScore  = totalDistinct > 0 ? common / totalDistinct : 0;
  const phaseScore    = me.phase && them.phase && me.phase === them.phase ? 0.20 : 0;
  const provinceScore = me.current_province && them.current_province
                        && me.current_province === them.current_province ? 0.20 : 0;
  const districtScore = me.town && them.town && me.town === them.town ? 0.20 : 0;

  return Math.round((phaseScore + provinceScore + districtScore + subjectScore * 0.40) * 100);
}

function isTownSwap(a, b) {
  const subA = new Set((a.subjects || []).map(s => s.toLowerCase()));
  const subB = new Set((b.subjects || []).map(s => s.toLowerCase()));
  if (![...subA].some(s => subB.has(s))) return false;
  const iWantTheirTown  = !!(b.town && (a.preferred_districts || []).includes(b.town));
  const theyWantMyTown  = !!(a.town && (b.preferred_districts || []).includes(a.town));
  return iWantTheirTown || theyWantMyTown;
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join(':');
}

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  // Auth — only admins may trigger manually
  if (event.httpMethod === 'POST') {
    const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (jwt) {
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (!user?.user_metadata?.is_admin) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }), headers };
      }
    }
  }

  // 1. Load all actively-looking educators
  const { data: educators, error } = await supabase
    .from('educators')
    .select('id, user_id, full_name, current_province, preferred_provinces, preferred_districts, phase, subjects, town, is_actively_looking, profile_type, is_hidden')
    .eq('is_actively_looking', true)
    .eq('is_hidden', false)
    .or('profile_type.eq.educator,profile_type.is.null');

  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
  if (!educators?.length) return { statusCode: 200, body: JSON.stringify({ notified: 0 }), headers };

  // 2. Load already-notified pairs to avoid duplicates
  const { data: logRows } = await supabase
    .from('match_notification_log')
    .select('user_a, user_b');

  const notifiedPairs = new Set((logRows || []).map(r => pairKey(r.user_a, r.user_b)));

  // 3. Find new matching pairs
  const newNotifications = [];
  const newLogEntries    = [];

  for (let i = 0; i < educators.length; i++) {
    for (let j = i + 1; j < educators.length; j++) {
      const a = educators[i];
      const b = educators[j];

      if (!a.user_id || !b.user_id) continue;
      if (a.user_id === b.user_id)  continue;

      const key = pairKey(a.user_id, b.user_id);
      if (notifiedPairs.has(key)) continue;

      const score   = calculateMatch(a, b);
      const isTown  = isTownSwap(a, b);
      if (score < MATCH_NOTIFY_THRESHOLD && !isTown) continue;

      const matchLabel = isTown && score < MATCH_NOTIFY_THRESHOLD
        ? 'Town-swap match'
        : `${score}% match`;

      // Notification for A about B
      newNotifications.push({
        user_id: a.user_id,
        type:    'match_found',
        title:   `New transfer match found!`,
        body:    `${b.full_name || 'An educator'} could be a great transfer partner — ${matchLabel}.`,
        data:    { matched_educator_id: b.id, matched_user_id: b.user_id, score, is_town_swap: isTown },
      });

      // Notification for B about A
      newNotifications.push({
        user_id: b.user_id,
        type:    'match_found',
        title:   `New transfer match found!`,
        body:    `${a.full_name || 'An educator'} could be a great transfer partner — ${matchLabel}.`,
        data:    { matched_educator_id: a.id, matched_user_id: a.user_id, score, is_town_swap: isTown },
      });

      // Record pair so we don't notify again
      const [ua, ub] = [a.user_id, b.user_id].sort();
      newLogEntries.push({ user_a: ua, user_b: ub });
      notifiedPairs.add(key);
    }
  }

  if (!newNotifications.length) {
    return { statusCode: 200, body: JSON.stringify({ notified: 0, message: 'No new matches found' }), headers };
  }

  // 4. Insert notifications in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < newNotifications.length; i += BATCH) {
    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(newNotifications.slice(i, i + BATCH));
    if (!insertErr) inserted += Math.min(BATCH, newNotifications.length - i);
  }

  // 5. Log pairs
  if (newLogEntries.length) {
    await supabase.from('match_notification_log').upsert(newLogEntries, { onConflict: 'user_a,user_b' });
  }

  console.log(`[match-scan] Inserted ${inserted} notifications for ${newLogEntries.length} new pairs`);
  return {
    statusCode: 200,
    body: JSON.stringify({ notified: inserted, pairs: newLogEntries.length }),
    headers,
  };
};
