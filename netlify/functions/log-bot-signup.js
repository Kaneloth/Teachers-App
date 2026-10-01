/**
 * Netlify Function: log-bot-signup
 *
 * Fire-and-forget logging for signups caught by the honeypot trap in
 * Register.tsx. By the time this is called, the bot has ALREADY been
 * blocked client-side — supabase.auth.signUp was never called, so no
 * account, no email, no credits. This function does not block or reject
 * anything itself; it just records the attempt so admins can see bot
 * volume in bot_signup_attempts if they ever want to.
 *
 * Because it's fire-and-forget (the client doesn't await or act on the
 * response), this always returns 200 quickly and never throws — a logging
 * failure must never surface to, or slow down, whoever/whatever triggered it.
 *
 * Deploy path: netlify/functions/log-bot-signup.js
 * Requires:    migration_bot_signup_attempts.sql already run against the DB
 *
 * POST body:
 *   { email?, reason: 'honeypot_filled' | 'submitted_too_fast', elapsed_ms? }
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Never let a logging endpoint 500 on bad/missing env or bad JSON —
  // just no-op and return 200.
  if (!supabase) {
    console.error('[log-bot-signup] Missing Supabase env vars — skipping log.');
    return { statusCode: 200, body: JSON.stringify({ logged: false }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore, log what we can */ }

  const reason = ['honeypot_filled', 'submitted_too_fast'].includes(body.reason)
    ? body.reason
    : 'unknown';

  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || event.headers['client-ip']
           || null;

  try {
    await supabase.from('bot_signup_attempts').insert({
      email:      typeof body.email === 'string' ? body.email.slice(0, 320) : null,
      reason,
      ip,
      user_agent: event.headers['user-agent']?.slice(0, 500) || null,
      elapsed_ms: Number.isFinite(body.elapsed_ms) ? Math.round(body.elapsed_ms) : null,
    });
  } catch (err) {
    // Swallow — this is best-effort telemetry, not a critical path.
    console.error('[log-bot-signup] insert failed:', err);
  }

  return { statusCode: 200, body: JSON.stringify({ logged: true }) };
};
