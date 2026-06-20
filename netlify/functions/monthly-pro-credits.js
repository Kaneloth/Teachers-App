import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MONTHLY_PRO_CREDITS = 10;

// Schedule is declared in netlify.toml:
//   [functions."monthly-pro-credits"]
//   schedule = "0 2 1 * *"

// ── Monthly Pro credit grants have been removed as of the credits-only
// funding model. This function now exits immediately without granting
// any credits. It is kept deployed so the netlify.toml schedule entry
// doesn't cause a missing-function error — it just does nothing.
export const handler = async (event) => {
  console.log('[monthly-pro-credits] Disabled — credits-only model, no monthly grants.');
  return { statusCode: 200, body: JSON.stringify({ granted: 0, reason: 'disabled' }) };
  // ── Original code below (kept for reference) ──
  const _DISABLED = true; if (_DISABLED) return { statusCode: 200, body: '{}' };
  // eslint-disable-next-line no-unreachable
  const __handler = async (event) => {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[monthly-pro-credits] Running for ${monthLabel}`);

  const { data: proUsers, error: fetchErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('subscription_plan', 'pro')
    .gt('subscription_end', now.toISOString())
    .is('deleted_at', null);

  if (fetchErr) {
    console.error('[monthly-pro-credits] Failed to fetch pro users:', fetchErr);
    return { statusCode: 500, body: JSON.stringify({ error: fetchErr.message }) };
  }

  if (!proUsers || proUsers.length === 0) {
    console.log('[monthly-pro-credits] No active pro subscribers.');
    return { statusCode: 200, body: JSON.stringify({ granted: 0, users: 0 }) };
  }

  let grantedCount = 0;
  let skippedCount = 0;
  let errorCount   = 0;

  for (const user of proUsers) {
    const ref_id = `monthly_pro:${yearMonth}:${user.id}`;

    const { data: alreadyGranted } = await supabase
      .from('credit_ledger')
      .select('id')
      .eq('ref_id', ref_id)
      .maybeSingle();

    if (alreadyGranted) { skippedCount++; continue; }

    const { error: creditErr } = await supabase.rpc('add_credits', {
      p_user_id:     user.id,
      p_amount:      MONTHLY_PRO_CREDITS,
      p_type:        'monthly_pro',
      p_description: `Pro subscriber monthly credits — ${monthLabel}`,
      p_ref_id:      ref_id,
    });

    if (creditErr) {
      console.error(`[monthly-pro-credits] Failed for ${user.id}:`, creditErr.message);
      errorCount++;
    } else {
      grantedCount++;
    }
  }

  const summary = { month: monthLabel, total: proUsers.length, granted: grantedCount, skipped: skippedCount, errors: errorCount };
  console.log('[monthly-pro-credits] Done:', summary);
  return { statusCode: 200, body: JSON.stringify(summary) };
};
