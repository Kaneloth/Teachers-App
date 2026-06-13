const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MONTHLY_PRO_CREDITS = 10;

// Schedule is declared in netlify.toml:
//   [functions."monthly-pro-credits"]
//   schedule = "0 2 1 * *"
// No npm package needed — Netlify reads it directly from netlify.toml.

exports.handler = async (event) => {
  const now = new Date();
  const monthLabel = now.toLocaleString('en-ZA', { month: 'long', year: 'numeric' });
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[monthly-pro-credits] Running for ${monthLabel}`);

  // Fetch all active Pro subscribers
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

    // Idempotency — skip if already granted this month
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
