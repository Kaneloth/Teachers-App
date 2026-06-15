import { createClient } from '@supabase/supabase-js';

// Fall back to VITE_-prefixed vars if the plain server-side ones
// haven't been added to Netlify env vars yet.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FREE_CREDITS   = 8;
const IP_WINDOW_DAYS = 30;
const IP_MAX_GRANTS  = 2;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { user_id, phone, device_fingerprint } = body;
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || event.headers['client-ip']
           || 'unknown';

  if (!user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'user_id required' }) };
  }

  // Guard: only grant once per user ever
  const { data: existing, error: existingErr } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('user_id', user_id)
    .eq('type', 'signup_bonus')
    .maybeSingle();

  if (existingErr) {
    console.error('[grant-signup-credits] existing check failed:', existingErr);
    return { statusCode: 500, body: JSON.stringify({ error: existingErr.message }) };
  }

  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'already_granted' }) };
  }

  // Layer 1: Phone fingerprint
  if (phone && phone.trim() !== '') {
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^+\d]/g, '');
    const { data: phoneFp } = await supabase
      .from('phone_fingerprints')
      .select('credit_granted')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (phoneFp?.credit_granted) {
      await recordNoGrant(user_id, ip, 'phone_fingerprint');
      return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'phone_known' }) };
    }
    await supabase.from('phone_fingerprints')
      .upsert({ phone: cleanPhone, user_id, credit_granted: true }, { onConflict: 'phone' });
  }

  // Layer 2: Device fingerprint
  if (device_fingerprint && device_fingerprint.trim() !== '') {
    const { data: devFp } = await supabase
      .from('device_fingerprints')
      .select('credit_granted')
      .eq('fingerprint', device_fingerprint)
      .maybeSingle();

    if (devFp?.credit_granted) {
      await recordNoGrant(user_id, ip, 'device_fingerprint');
      return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'device_known' }) };
    }
    await supabase.from('device_fingerprints')
      .upsert({ fingerprint: device_fingerprint, user_id, credit_granted: true }, { onConflict: 'fingerprint' });
  }

  // Layer 3: IP rate limit
  if (ip !== 'unknown') {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - IP_WINDOW_DAYS);

    const { count } = await supabase
      .from('ip_signups')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', windowStart.toISOString());

    await supabase.from('ip_signups').insert({ ip, user_id });

    if ((count ?? 0) >= IP_MAX_GRANTS) {
      await recordNoGrant(user_id, ip, 'ip_limit');
      return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'ip_limit' }) };
    }
  }

  // All checks passed — grant free credits
  const { error } = await supabase.rpc('add_credits', {
    p_user_id:     user_id,
    p_amount:      FREE_CREDITS,
    p_type:        'signup_bonus',
    p_description: 'Welcome bonus — 8 free credits',
    p_ref_id:      null,
  });

  if (error) {
    console.error('[grant-signup-credits] add_credits failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  console.log(`[grant-signup-credits] Granted ${FREE_CREDITS} credits to ${user_id} (ip=${ip})`);
  return {
    statusCode: 200,
    body: JSON.stringify({ granted: FREE_CREDITS, reason: 'clean_identity' }),
  };
};

async function recordNoGrant(user_id, ip, reason) {
  await supabase.from('credit_ledger').insert({
    user_id,
    amount:      0,
    type:        'adjustment',
    description: `Signup bonus denied: ${reason}`,
    ref_id:      `ip=${ip}`,
  });
  console.warn(`[grant-signup-credits] Denied bonus to ${user_id} — reason: ${reason}`);
}
