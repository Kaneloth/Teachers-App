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

export const handler = async (event) => {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[monthly-pro-credits] Running for ${monthLabel}`);

  const { data: proUsers, error: fetchErr } = await supabase
    .from('profiles')
    .select('id')
    .in('subscription_plan', ['monthly', 'semi_annual', 'annual'])
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

    // Monthly credits expire at end of current month — insert directly
    // so we can set the expires_at column (add_credits RPC doesn't have
    // an expiry parameter).
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const { error: creditErr } = await supabase
      .from('credit_ledger')
      .insert({
        user_id:     user.id,
        amount:      MONTHLY_PRO_CREDITS,
        type:        'monthly_pro',
        description: `Pro subscriber monthly credits — ${monthLabel}`,
        ref_id,
        expires_at:  endOfMonth.toISOString(),
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
