/**
 * Netlify Function: contact-support
 *
 * Receives a support message from the Register page OTP screen
 * (e.g. user whose email bounced) and logs it to Supabase for
 * admin review, then sends a notification email to support.
 *
 * Deploy path: netlify/functions/contact-support.js
 *
 * POST body: { email, name, message }
 * No auth required — user is not yet verified at this point.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.SUPABASE_URL             || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, name, message } = body;
  if (!email || !message) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'email and message required' }) };
  }

  // Rate limit: max 3 support tickets per email per day
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since.toISOString());

  if ((count ?? 0) >= 3) {
    return {
      statusCode: 429,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Too many requests — please email support@crosssa.co.za directly.' }),
    };
  }

  // Log to support_tickets table for admin review
  const { error: insertErr } = await supabase.from('support_tickets').insert({
    email:   email.toLowerCase().trim(),
    name:    name  || 'Unknown',
    message: message.trim(),
    type:    'otp_verification',
    status:  'open',
  });

  if (insertErr) {
    console.error('[contact-support] insert failed:', insertErr);
    // Don't fail silently — tell client to use mailto fallback
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: insertErr.message }) };
  }

  console.log(`[contact-support] New OTP support ticket from ${email}`);
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
};
