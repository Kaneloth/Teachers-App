import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// NOTE: these are x10 of the original values (cosmetic credit-system
// overhaul — see packages.js). Real Rand prices/value are unchanged; only
// the credit unit got bigger/more granular-looking.
const COSTS = {
  cv_usage:      90,   // CV generation
  letter_usage:  20,   // Cover letter / AI action
  chat_start:    50,   // Starting a new conversation
  guide_download:30,   // Downloading a transfer guide
  id_verify:     300,  // ID/passport verification
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
    const [globalResult, userResult] = await Promise.all([
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).is('user_id', null).maybeSingle(),
      supabase.from('feature_gates').select('enabled').eq('gate_key', gateKey).eq('user_id', user.id).maybeSingle(),
    ]);

    const globalRow = globalResult.data;
    const userRow   = userResult.data;

    console.log(`[deduct-credits] gate=${gateKey} globalRow=`, JSON.stringify(globalRow), 'globalErr=', globalResult.error?.message, 'userRow=', JSON.stringify(userRow));

    // Per-user override wins over global; global wins over default (true = gate active)
    const gateEnabled = userRow ? userRow.enabled : (globalRow ? globalRow.enabled : true);

    console.log(`[deduct-credits] gateEnabled=${gateEnabled} for type=${type} user=${user.email}`);

    if (!gateEnabled) {
      console.log(`[deduct-credits] Gate '${gateKey}' disabled — free pass for ${user.email}, type=${type}`);
      return { statusCode: 200, body: JSON.stringify({ success: true, deducted: 0, new_balance: 999999 }) };
    }
  }

  if (!COSTS[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown type "${type}"` }) };
  }

  // ── Career tools cap (cv_usage, letter_usage) ─────────────────────────────
  // Educators get 180 free career-tool credits from the signup bonus.
  // Once used, they must top up — UNLESS they have credits from any other
  // source (admin adjustment, monthly pro grant, etc.).
  // The cap is bypassed if:
  //   a) user has ANY non-signup credit entries (purchase, admin, pro grant)
  //   b) the cv_credits gate is disabled for this user (already handled above)
  const CAREER_TOOL_TYPES = ['cv_usage', 'letter_usage'];
  if (CAREER_TOOL_TYPES.includes(type)) {
    // Check for ANY topped-up credits — not just 'purchase' type.
    // Admin adjustments use type='admin_adjustment', pro grants use 'monthly_pro' etc.
    const { count: toppedUpCount } = await supabase
      .from('credit_ledger').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('type', 'in', '("signup_bonus","cv_usage","letter_usage","chat_start","guide_download","id_verify","messaging_unlock")');

    if ((toppedUpCount ?? 0) === 0) {
      // No topped-up credits — apply the 180-credit free tier cap
      const { data: careerUsage } = await supabase
        .from('credit_ledger').select('amount')
        .eq('user_id', user.id).in('type', CAREER_TOOL_TYPES);

      const totalCareerSpent = (careerUsage || []).reduce((sum, r) => sum + Math.abs(r.amount), 0);
      if (totalCareerSpent >= 180) {
        const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
        return {
          statusCode: 402,
          body: JSON.stringify({
            error: 'career_cap_reached',
            message: "You've used your 180 free career tool credits. Top up to continue generating CVs and cover letters.",
            balance: balance ?? 0,
          }),
        };
      }
    }
  }

  const cost = COSTS[type];
  const DESCRIPTIONS = {
    cv_usage:       'CV generated (90 credits)',
    letter_usage:   'Cover letter / AI action (20 credits)',
    chat_start:     'New chat started (50 credits)',
    guide_download: 'Transfer guide downloaded (30 credits)',
    id_verify:      'ID verification (300 credits)',
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
