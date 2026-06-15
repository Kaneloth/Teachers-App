/**
 * Netlify Function: payfast-webhook (ITN handler)
 *
 * PayFast posts here (server-to-server, application/x-www-form-urlencoded)
 * after a payment attempt. This MUST:
 *   1. Verify the MD5 signature
 *   2. Confirm with PayFast's own "validate" endpoint (server-to-server)
 *   3. Check payment_status === 'COMPLETE'
 *   4. Check the amount matches the expected package price
 *   5. Grant credits exactly once (idempotent via pf_payment_id)
 *
 * Always responds 200 once the ITN has been processed/acknowledged —
 * PayFast retries on non-200, which would otherwise cause duplicate
 * processing attempts (handled safely here via idempotency, but best to
 * ack promptly).
 *
 * Deploy path: netlify/functions/payfast-webhook.js
 * Requires:    netlify/functions/lib/payfast.js
 *              netlify/functions/lib/packages.js
 *
 * IMPORTANT: set this exact URL as your Notify URL in PayFast:
 *   https://crosssa.co.za/.netlify/functions/payfast-webhook
 * (or whatever SITE_URL is configured to)
 */

import { createClient } from '@supabase/supabase-js';
import { generateITNSignature, PAYFAST_VALIDATE_URL } from './lib/payfast.js';
import { PACKAGES } from './lib/packages.js';
import { SUB_PLANS } from './lib/subscriptions.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || '';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Parse the form-encoded ITN body, preserving field order ────────────────
  const params = new URLSearchParams(event.body || '');
  const fields = {};
  for (const [k, v] of params.entries()) fields[k] = v;

  console.log('[payfast-webhook] ITN received:', { pf_payment_id: fields.pf_payment_id, payment_status: fields.payment_status, m_payment_id: fields.m_payment_id });

  // ── 1. Verify signature ─────────────────────────────────────────────────────
  const receivedSig = fields.signature;
  const expectedSig = generateITNSignature(fields, PASSPHRASE);

  if (receivedSig !== expectedSig) {
    console.error('[payfast-webhook] SIGNATURE MISMATCH — possible forged request');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  // ── 2. Server-to-server validation with PayFast ─────────────────────────────
  try {
    const validateRes = await fetch(PAYFAST_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: event.body,
    });
    const validateText = (await validateRes.text()).trim();
    if (validateText !== 'VALID') {
      console.error('[payfast-webhook] PayFast validate returned:', validateText);
      return { statusCode: 400, body: 'Invalid' };
    }
  } catch (err) {
    console.error('[payfast-webhook] validate request failed:', err);
    // Return 500 so PayFast retries — this is likely a transient network issue.
    return { statusCode: 500, body: 'Validation error' };
  }

  // ── 3. Only act on completed payments ───────────────────────────────────────
  if (fields.payment_status !== 'COMPLETE') {
    console.log(`[payfast-webhook] payment_status=${fields.payment_status} — no action taken`);
    return { statusCode: 200, body: 'OK' };
  }

  // ── 4. Resolve user from custom fields, then branch: subscription vs credit pack ──
  const user_id = fields.custom_str1;
  const custom2 = fields.custom_str2;

  if (!user_id) {
    console.error('[payfast-webhook] missing custom_str1 (user_id)', { custom2 });
    return { statusCode: 200, body: 'OK' }; // ack to stop retries; needs manual review
  }

  // ── 4a. Subscription payment (Pro plan — initial signup or recurring charge) ──
  if (SUB_PLANS[custom2]) {
    return await handleSubscriptionPayment(fields, user_id, custom2);
  }

  // ── 4b. Credit package purchase ──────────────────────────────────────────────
  const package_id = custom2;
  const pkg = PACKAGES[package_id];

  if (!pkg) {
    console.error('[payfast-webhook] unknown custom_str2 (not a plan or package)', { user_id, custom2 });
    return { statusCode: 200, body: 'OK' }; // ack to stop retries; needs manual review
  }

  // ── 5. Sanity-check the amount (allow tiny rounding differences) ────────────
  const expectedAmount = pkg.price_zar;
  const paidAmount = parseFloat(fields.amount_gross || fields.amount || '0');
  if (Math.abs(paidAmount - expectedAmount) > 0.5) {
    console.error(`[payfast-webhook] amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
    return { statusCode: 200, body: 'OK' }; // ack to stop retries; needs manual review
  }

  // ── 6. Idempotency — never grant the same payment twice ──────────────────────
  const { data: existing, error: existingErr } = await supabase
    .from('credit_ledger')
    .select('id')
    .eq('ref_id', fields.pf_payment_id)
    .eq('type', 'purchase')
    .maybeSingle();

  if (existingErr) {
    console.error('[payfast-webhook] idempotency check failed:', existingErr);
    return { statusCode: 500, body: 'Error' };
  }

  if (existing) {
    console.log(`[payfast-webhook] pf_payment_id=${fields.pf_payment_id} already processed — skipping`);
    return { statusCode: 200, body: 'OK' };
  }

  // ── 7. Grant the credits ──────────────────────────────────────────────────────
  const { error: creditErr } = await supabase.rpc('add_credits', {
    p_user_id:     user_id,
    p_amount:      pkg.credits,
    p_type:        'purchase',
    p_description: `${pkg.label} via PayFast — R${pkg.price_zar}`,
    p_ref_id:      fields.pf_payment_id,
  });

  if (creditErr) {
    console.error('[payfast-webhook] add_credits failed:', creditErr);
    return { statusCode: 500, body: 'Error' };
  }

  console.log(`[payfast-webhook] Granted ${pkg.credits} credits to user=${user_id} (pf_payment_id=${fields.pf_payment_id})`);
  return { statusCode: 200, body: 'OK' };
};

/**
 * Handle a subscription payment ITN — either the initial signup or a
 * recurring charge (PayFast sends an ITN for each billing cycle, identified
 * by a new pf_payment_id but the same `token`).
 *
 * Extends subscription_end from whichever is later: the user's current
 * subscription_end (if still in the future — i.e. they paid early/renewed
 * before expiry) or now (first signup / lapsed renewal).
 */
async function handleSubscriptionPayment(fields, user_id, planId) {
  const plan = SUB_PLANS[planId];

  // Sanity-check the amount (allow tiny rounding differences)
  const expectedAmount = plan.amount;
  const paidAmount = parseFloat(fields.amount_gross || fields.amount || '0');
  if (Math.abs(paidAmount - expectedAmount) > 0.5) {
    console.error(`[payfast-webhook] subscription amount mismatch: expected ${expectedAmount}, got ${paidAmount}`);
    return { statusCode: 200, body: 'OK' }; // ack to stop retries; needs manual review
  }

  // Idempotency — never extend the subscription twice for the same payment
  const { data: existing, error: existingErr } = await supabase
    .from('subscription_payments')
    .select('id')
    .eq('pf_payment_id', fields.pf_payment_id)
    .maybeSingle();

  if (existingErr) {
    console.error('[payfast-webhook] subscription idempotency check failed:', existingErr);
    return { statusCode: 500, body: 'Error' };
  }

  if (existing) {
    console.log(`[payfast-webhook] subscription pf_payment_id=${fields.pf_payment_id} already processed — skipping`);
    return { statusCode: 200, body: 'OK' };
  }

  // Extend from the later of (current subscription_end, now)
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_end')
    .eq('id', user_id)
    .maybeSingle();

  const now = new Date();
  const currentEnd = profile?.subscription_end ? new Date(profile.subscription_end) : null;
  const base = currentEnd && currentEnd > now ? currentEnd : now;

  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + plan.cycleMonths);

  // Update profiles — subscription_plan, subscription_end, payfast_token
  const profileUpdate = {
    subscription_plan: planId,
    subscription_end:  newEnd.toISOString(),
  };
  if (fields.token) profileUpdate.payfast_token = fields.token;

  const { error: profErr } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user_id);

  if (profErr) {
    console.error('[payfast-webhook] profiles update failed:', profErr);
    return { statusCode: 500, body: 'Error' };
  }

  // Mirror to user_metadata so client-side checks (which read user_metadata
  // directly) stay in sync immediately, and clear any prior cancellation flag.
  const { error: metaErr } = await supabase.auth.admin.updateUserById(user_id, {
    user_metadata: {
      subscription_plan: planId,
      subscription_end:  newEnd.toISOString(),
      subscription_cancelled: false,
    },
  });
  if (metaErr) {
    console.error('[payfast-webhook] user_metadata update failed:', metaErr);
    // Don't fail the whole request — profiles table is the source of truth;
    // metadata will resync next time the user's session refreshes.
  }

  // Record this payment for idempotency + audit trail
  const { error: payErr } = await supabase.from('subscription_payments').insert({
    user_id,
    pf_payment_id:    fields.pf_payment_id,
    plan:             planId,
    amount:           paidAmount,
    subscription_end: newEnd.toISOString(),
  });
  if (payErr) {
    console.error('[payfast-webhook] subscription_payments insert failed:', payErr);
    // Subscription was already extended — log but don't fail; worst case a
    // retry re-extends, which the unique constraint on pf_payment_id would
    // then catch on the SELECT above next time.
  }

  console.log(`[payfast-webhook] Extended subscription for user=${user_id} to plan=${planId}, ends=${newEnd.toISOString()} (pf_payment_id=${fields.pf_payment_id})`);
  return { statusCode: 200, body: 'OK' };
}
