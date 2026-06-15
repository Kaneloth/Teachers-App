/**
 * Netlify Function: payfast-initiate-subscription
 *
 * Called when a logged-in user clicks "Subscribe" in SubscriptionModal.
 * Builds a signed PayFast RECURRING BILLING payment form (subscription_type=1)
 * and returns it to the frontend, which auto-submits it (POST) to redirect
 * the user to PayFast.
 *
 * Deploy path: netlify/functions/payfast-initiate-subscription.js
 * Requires:    netlify/functions/lib/payfast.js
 *              netlify/functions/lib/subscriptions.js
 *
 * POST body: { plan: 'monthly' | 'semi_annual' | 'annual' }
 * Response:  { action_url, fields } — frontend builds <form> from `fields`
 */

import { createClient } from '@supabase/supabase-js';
import { generateSignature, PAYFAST_PROCESS_URL, SITE_URL } from './lib/payfast.js';
import { SUB_PLANS } from './lib/subscriptions.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MERCHANT_ID  = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE   = process.env.PAYFAST_PASSPHRASE || '';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!MERCHANT_ID || !MERCHANT_KEY) {
    console.error('[payfast-initiate-subscription] Missing PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Payments are not configured yet. Please try again later.' }) };
  }

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const plan = SUB_PLANS[body.plan];
  if (!plan) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown plan "${body.plan}"` }) };
  }

  const m_payment_id = `sub_${user.id.slice(0, 8)}_${Date.now()}`;
  const firstName = (user.user_metadata?.full_name || 'Crosssa').split(' ')[0];

  // Bill the first cycle immediately (today).
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Field order follows PayFast's documented order for subscription payments.
  const fields = {
    merchant_id:       MERCHANT_ID,
    merchant_key:      MERCHANT_KEY,
    return_url:        `${SITE_URL}/settings?subscription=success`,
    cancel_url:        `${SITE_URL}/settings?subscription=cancelled`,
    notify_url:        `${SITE_URL}/.netlify/functions/payfast-webhook`,
    name_first:        firstName,
    email_address:     user.email,
    m_payment_id,
    amount:            plan.amount.toFixed(2),
    item_name:         plan.label,
    item_description:  `Crosssa Pro subscription (${body.plan.replace('_', ' ')})`,
    custom_str1:       user.id,    // who to upgrade
    custom_str2:       body.plan,  // which plan — webhook looks this up in SUB_PLANS
    subscription_type: '1',
    billing_date:      today,
    recurring_amount:  plan.amount.toFixed(2),
    frequency:         String(plan.frequency),
    cycles:            '0', // 0 = bill until cancelled
  };

  const signature = generateSignature(fields, PASSPHRASE);

  console.log(`[payfast-initiate-subscription] user=${user.id} plan=${body.plan} m_payment_id=${m_payment_id}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      action_url: PAYFAST_PROCESS_URL,
      fields: { ...fields, signature },
    }),
  };
};
