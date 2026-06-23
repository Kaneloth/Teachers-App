import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const COSTS = {
  cv_usage:      9,   // CV generation
  letter_usage:  2,   // Cover letter / AI action
  chat_start:    5,   // Starting a new conversation
  guide_download:3,   // Downloading a transfer guide
  id_verify:     30,  // ID/passport verification
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { type, ref_id } = body;

  // Admins bypass all credit gates — log for audit but don't deduct
  if (user.user_metadata?.is_admin) {
    console.log(`[deduct-credits] Admin bypass for ${user.email} — type=${type}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, deducted: 0, new_balance: 999999 }) };
  }

  // Check feature_gates — if the gate for this action is disabled globally
  // or overridden OFF for this user, skip deduction entirely (free for everyone)
  const GATE_MAP = {
    cv_usage:       'cv_credits',
    letter_usage:   'cv_credits',
    chat_start:     'chat_credits',
    guide_download: 'guides_access',
    id_verify:      'id_verification',
  };
  const gateKey = GATE_MAP[type];
  if (gateKey) {
    // Check per-user override first, then global gate
    // Fetch global gate and per-user override separately to avoid NULL comparison issues
    const [{ data: globalRow }, { data: userRow }] = await Promise.all([
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).is('user_id', null).maybeSingle(),
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).eq('user_id', user.id).maybeSingle(),
    ]);

    // Per-user override wins over global; global wins over default (true = gate active)
    const gateEnabled = userRow ? userRow.enabled : (globalRow ? globalRow.enabled : true);

    if (!gateEnabled) {
      console.log(`[deduct-credits] Gate '${gateKey}' disabled — free pass for ${user.email}, type=${type}`);
      return { statusCode: 200, body: JSON.stringify({ success: true, deducted: 0, new_balance: 999999 }) };
    }
  }

  if (!COSTS[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown type "${type}"` }) };
  }

  const cost = COSTS[type];
  const DESCRIPTIONS = {
    cv_usage:       'CV generated (9 credits)',
    letter_usage:   'Cover letter / AI action (2 credits)',
    chat_start:     'New chat started (5 credits)',
    guide_download: 'Transfer guide downloaded (3 credits)',
    id_verify:      'ID verification (30 credits)',
  };
  const description = DESCRIPTIONS[type] || type;

  const { data: newBalance, error: deductErr } = await supabase.rpc('deduct_credits', {
    p_user_id:     user.id,
    p_amount:      cost,
    p_type:        type,
    p_description: description,
    p_ref_id:      ref_id ?? null,
  });

  if (deductErr) {
    if (deductErr.message?.includes('insufficient_credits')) {
      const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
      return {
        statusCode: 402,
        body: JSON.stringify({ error: 'insufficient_credits', balance: balance ?? 0, required: cost }),
      };
    }
    console.error('[deduct-credits] error:', deductErr);
    return { statusCode: 500, body: JSON.stringify({ error: deductErr.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, deducted: cost, new_balance: newBalance }),
  };
};
