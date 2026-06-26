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

// District → towns for fallback town matching (inline)
const DISTRICT_TOWNS = {
  'Capricorn South':['Polokwane','Seshego'],'Capricorn North':['Bela-Bela','Mokopane'],
  'Tshwane North':['Pretoria North','Soshanguve','Hammanskraal'],'Tshwane South':['Centurion','Pretoria East'],'Tshwane West':['Atteridgeville','Ga-Rankuwa'],
  'Johannesburg Central':['Johannesburg CBD','Soweto','Orlando'],'Johannesburg North':['Sandburg','Randburg','Midrand'],'Johannesburg East':['Bedfordview','Edenvale','Katlehong'],'Johannesburg South':['Lenasia','Ennerdale','Orange Farm'],
  'Ekurhuleni North':['Tembisa','Kempton Park'],'Ekurhuleni South':['Alberton','Germiston','Boksburg'],
  'Mopani East':['Tzaneen','Letsitele'],'Mopani West':['Phalaborwa','Giyani'],
  'Vhembe East':['Thohoyandou','Malamulele'],'Vhembe West':['Louis Trichardt','Musina'],
  'Umgungundlovu':['Pietermaritzburg','Howick'],'Ugu':['Port Shepstone','Margate'],
  'Ilembe':['KwaDukuza','Stanger'],'King Cetshwayo':['Richards Bay','Empangeni'],
  'Pinetown':['Pinetown','Westville','Kloof'],
  'Motheo':['Bloemfontein','Botshabelo'],'Ehlanzeni':['Mbombela','White River'],
  'Bojanala':['Rustenburg','Brits'],'Metro Central':['Cape Town CBD','Bellville'],
};

function townInPreferred(town, preferred) {
  if (!town || !preferred.length) return false;
  const t = town.toLowerCase();
  for (const p of preferred) {
    if (p.toLowerCase() === t) return true;
    if ((DISTRICT_TOWNS[p] || []).some(x => x.toLowerCase() === t)) return true;
  }
  return false;
}

function calculateMatch(me, them) {
  const setA   = new Set((me.subjects   || []).map(s => s.toLowerCase()));
  const setB   = new Set((them.subjects || []).map(s => s.toLowerCase()));
  const common = [...setA].filter(s => setB.has(s)).length;
  if (common === 0) return 0;

  const totalDistinct = new Set([...setA, ...setB]).size;
  const subjectScore  = totalDistinct > 0 ? common / totalDistinct : 0;
  const phaseScore    = me.phase && them.phase && me.phase === them.phase ? 0.20 : 0;

  // Province: bidirectional — both must want each other's current province
  const myPrefProvinces   = me.preferred_provinces   || [];
  const themPrefProvinces = them.preferred_provinces || [];
  const provinceScore = (
    them.current_province && myPrefProvinces.includes(them.current_province) &&
    me.current_province   && themPrefProvinces.includes(me.current_province)
  ) ? 0.20 : 0;

  // Town: bidirectional — both must want each other's current town
  const townScore = (
    townInPreferred(them.town || '', me.preferred_districts   || []) &&
    townInPreferred(me.town   || '', them.preferred_districts || [])
  ) ? 0.20 : 0;

  return Math.round((phaseScore + provinceScore + townScore + subjectScore * 0.40) * 100);
}

function isTownSwap(a, b) {
  const subA = new Set((a.subjects || []).map(s => s.toLowerCase()));
  const subB = new Set((b.subjects || []).map(s => s.toLowerCase()));
  if (![...subA].some(s => subB.has(s))) return false;
  // Bidirectional — both must want each other's town
  return townInPreferred(b.town || '', a.preferred_districts || []) &&
         townInPreferred(a.town || '', b.preferred_districts || []);
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
    .select('id, user_id, full_name, current_province, preferred_provinces, preferred_districts, preferred_town_coords, town_lat, town_lng, phase, subjects, town, is_actively_looking, profile_type, is_hidden')
    .eq('is_actively_looking', true)
    .or('profile_type.eq.educator,profile_type.is.null');

  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
  console.log('[match-scan] Loaded', educators?.length ?? 0, 'actively-looking educators');
  if (!educators?.length) return { statusCode: 200, body: JSON.stringify({ notified: 0, debug: 'no actively-looking educators found' }), headers };

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

      const score = calculateMatch(a, b);

      // Minimum requirements:
      // 1. At least 1 common subject
      // 2. At least one location criterion matches (province OR town bidirectional)
      const setA = new Set((a.subjects || []).map(s => s.toLowerCase()));
      const setB = new Set((b.subjects || []).map(s => s.toLowerCase()));
      const hasCommonSubject = [...setA].some(s => setB.has(s));
      if (!hasCommonSubject) {
        console.log('[match-scan] Skip (no common subjects):', a.full_name, '↔', b.full_name);
        continue;
      }

      // Check if province or town match (bidirectional)
      const myPrefProvinces   = a.preferred_provinces || [];
      const themPrefProvinces = b.preferred_provinces || [];
      const provinceMatch = (
        b.current_province && myPrefProvinces.includes(b.current_province) &&
        a.current_province && themPrefProvinces.includes(a.current_province)
      );
      const townMatch = (
        townInPreferred(b.town || '', a.preferred_districts || []) &&
        townInPreferred(a.town || '', b.preferred_districts || [])
      );

      console.log('[match-scan] Checking:', a.full_name, '↔', b.full_name, '| score:', score, '| province:', provinceMatch, '| town:', townMatch, '| a.pref_prov:', myPrefProvinces, '| b.current_prov:', b.current_province, '| a.pref_dist:', a.preferred_districts, '| b.town:', b.town);

      if (!provinceMatch && !townMatch) continue;

      const matchLabel = `${score}% match`;

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
