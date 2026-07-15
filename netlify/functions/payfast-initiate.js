/**
 * Netlify Function: payfast-initiate
 *
 * Called when a logged-in user clicks "Buy" on a credit package.
 * Builds a signed PayFast payment form and returns it to the frontend,
 * which auto-submits it (POST) to redirect the user to PayFast.
 *
 * Deploy path: netlify/functions/payfast-initiate.js
 * Requires:    netlify/functions/lib/payfast.js
 *              netlify/functions/lib/packages.js
 *
 * POST body: { package_id: 'single' | 'standard' | 'business' | 'chat_unlock' }
 * Response:  { action_url, fields } — frontend builds <form> from `fields`
 */

import { createClient } from '@supabase/supabase-js';
import { generateSignature, PAYFAST_PROCESS_URL, SITE_URL } from './lib/payfast.js';
import { PACKAGES } from './lib/packages.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MERCHANT_ID  = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE   = process.env.PAYFAST_PASSPHRASE || '';

// The shared Hookdeck source that fans out to both Crosssa's and
// Skootlink's webhooks (same PayFast merchant account, so PayFast's
// account-level Notify URL — not the per-transaction notify_url field —
// is what actually determines delivery; pointing this at the Hookdeck
// source directly keeps this explicit instead of relying on that override).
const PAYFAST_NOTIFY_URL = process.env.PAYFAST_NOTIFY_URL || `${SITE_URL}/.netlify/functions/payfast-webhook`;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!MERCHANT_ID || !MERCHANT_KEY) {
    console.error('[payfast-initiate] Missing PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Payments are not configured yet. Please try again later.' }) };
  }

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const pkg = PACKAGES[body.package_id];
  if (!pkg) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown package "${body.package_id}"` }) };
  }

  // Unique payment ID — also useful for support lookups in the PayFast dashboard.
  const m_payment_id = `cr_${user.id.slice(0, 8)}_${Date.now()}`;
  const firstName = (user.user_metadata?.full_name || 'Crosssa').split(' ')[0];

  // Field order matters — this matches PayFast's documented order for the
  // payment form. The ITN webhook re-derives its own signature from the
  // order PayFast sends fields back in, so order here doesn't need to match
  // the webhook exactly, but following PayFast's docs avoids edge cases.
  const fields = {
    merchant_id:       MERCHANT_ID,
    merchant_key:      MERCHANT_KEY,
    return_url:        `${SITE_URL}/credits?payment=success`,
    cancel_url:        `${SITE_URL}/credits?payment=cancelled`,
    notify_url:        PAYFAST_NOTIFY_URL,
    name_first:        firstName,
    email_address:     user.email,
    m_payment_id,
    amount:            pkg.price_zar.toFixed(2),
    item_name:         pkg.label,
    item_description:  body.package_id === 'chat_unlock'
      ? 'Unlocks in-app messaging with transfer partners'
      : `${pkg.credits} Crosssa credits`,
    custom_str1:       user.id,       // who to credit
    custom_str2:       body.package_id, // which package — webhook looks this up
    // NOTE: custom_str3 is intentionally left unused here — Skootlink uses
    // it for payment_category ('verification' vs credit purchase). Don't
    // repurpose it on this side or a future field could collide.
    custom_str4:       'crosssa',       // app tag — lets Hookdeck (and the webhook) route/ignore correctly since both apps share one merchant account
  };

  const signature = generateSignature(fields, PASSPHRASE);

  console.log(`[payfast-initiate] user=${user.id} package=${body.package_id} m_payment_id=${m_payment_id}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      action_url: PAYFAST_PROCESS_URL,
      fields: { ...fields, signature },
    }),
  };
};
