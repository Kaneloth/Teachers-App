import { createClient } from '@supabase/supabase-js';
import { getPackage } from './lib/pricing.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[credits] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// This function isn't wired into the live purchase flow — that's
// payfast-initiate.js + payfast-webhook.js. It previously kept its own
// hardcoded copy of the package list, which could silently drift from the
// real one; it now reads from the same credit_packages table via
// lib/pricing.js, so that's no longer possible. It still always grants
// type='purchase' unconditionally below — if this file is ever revived,
// it needs the same messaging_unlock branching payfast-webhook.js has, or
// reviving it would let someone "buy" a 0-credit chat_unlock package
// tagged as a purchase instead of properly unlocking messaging.

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

  const { package_id, payment_ref } = body;
  const pkg = await getPackage(supabase, package_id);

  if (!pkg) return { statusCode: 400, body: JSON.stringify({ error: `Unknown package "${package_id}"` }) };
  if (!payment_ref) return { statusCode: 400, body: JSON.stringify({ error: 'payment_ref required' }) };

  // credits/price_zar come back from Postgres as numeric — supabase-js
  // returns `numeric` columns as strings (not JS numbers) to avoid float
  // precision loss, so coerce explicitly before doing arithmetic on them.
  const pkgCredits  = Number(pkg.credits);
  const pkgPriceZar = Number(pkg.price_zar);

  // Idempotency — prevent double-crediting the same payment
  const { data: existing } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('ref_id', payment_ref)
    .eq('type', 'purchase')
    .maybeSingle();

  if (existing) {
    return { statusCode: 200, body: JSON.stringify({ success: true, credits: pkgCredits, reason: 'already_processed' }) };
  }

  // TODO: replace with your Paystack / Yoco / PayFast verification
  // const Paystack = require('paystack-sdk-node');
  // const paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
  // const verification = await paystack.transaction.verify(payment_ref);
  // if (verification.data.status !== 'success') {
  //   return { statusCode: 402, body: JSON.stringify({ error: 'payment_not_verified' }) };
  // }

  const { data: newBalance, error: creditErr } = await supabase.rpc('add_credits', {
    p_user_id:     user.id,
    p_amount:      pkgCredits,
    p_type:        'purchase',
    p_description: `${pkg.label} — R${pkgPriceZar}`,
    p_ref_id:      payment_ref,
  });

  if (creditErr) {
    console.error('[purchase-credits] add_credits failed:', creditErr);
    return { statusCode: 500, body: JSON.stringify({ error: creditErr.message }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, credits: pkgCredits, new_balance: newBalance, package: pkg.label }),
  };
};
