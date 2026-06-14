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
import { generateITNSignature, buildITNSignatureString, PAYFAST_VALIDATE_URL } from './lib/payfast.js';
import { PACKAGES } from './lib/packages.js';

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

  // ── TEMPORARY DEBUG LOGGING ──────────────────────────────────────────────
  // Remove this block once the signature mismatch is resolved.
  const debugString = buildITNSignatureString(fields, PASSPHRASE)
    .replace(/&passphrase=.*$/, PASSPHRASE ? '&passphrase=***MASKED***' : '');
  console.log('[payfast-webhook] DEBUG all_received_fields=' + JSON.stringify(fields));
  console.log('[payfast-webhook] DEBUG passphrase_set=' + (PASSPHRASE ? `yes (length ${PASSPHRASE.length})` : 'no'));
  console.log('[payfast-webhook] DEBUG signature_string=' + debugString);
  console.log('[payfast-webhook] DEBUG expected_signature=' + expectedSig);
  console.log('[payfast-webhook] DEBUG received_signature=' + receivedSig);
  // ── END TEMPORARY DEBUG LOGGING ───────────────────────────────────────────

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

  // ── 4. Resolve user + package from custom fields ────────────────────────────
  const user_id    = fields.custom_str1;
  const package_id = fields.custom_str2;
  const pkg = PACKAGES[package_id];

  if (!user_id || !pkg) {
    console.error('[payfast-webhook] missing/unknown user_id or package_id', { user_id, package_id });
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
