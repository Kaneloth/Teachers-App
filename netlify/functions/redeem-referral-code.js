/**
 * Netlify Function: redeem-referral-code
 *
 * PUBLIC endpoint (not admin-gated) — called at signup time, right
 * alongside grant-signup-credits.js, when the user entered a referral code
 * at Register.tsx. A brand-new user has no educators row yet, so
 * requireAdmin.js would always reject them here; this function is
 * deliberately separate from admin-referral-codes.js for that reason.
 *
 * This grants ONLY the +90 referral bonus. The standard 90-credit signup
 * bonus (with its own IP/device/phone/email fraud guards) is untouched —
 * grant-signup-credits.js still fires unconditionally regardless of
 * whether a referral code was entered. The two are intentionally
 * independent grants, logged as separate credit_ledger rows
 * (type: 'signup_bonus' vs type: 'referral_bonus').
 *
 * Deploy path: netlify/functions/redeem-referral-code.js
 * Requires:    migration_referral_codes.sql already run against the DB
 *
 * POST body: { user_id, code }
 *
 * Response is always 200 for ordinary validation outcomes (invalid,
 * already used, etc.) — those are normal results of a user typing
 * a code wrong, not server errors, and the body's `error` string is meant
 * to be shown directly as a toast. Only a genuine failure (bad JSON,
 * missing fields, rate limit, DB/RPC error) uses a non-200 status.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[redeem-referral-code] Missing Supabase env vars — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_ equivalents) in Netlify.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const RATE_LIMIT_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 5;             // per IP per window, per the brief's anti-abuse table

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { user_id } = body;
  const rawCode = String(body.code || '').trim().toUpperCase();
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || event.headers['client-ip']
           || 'unknown';

  if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'user_id required' }) };
  if (!rawCode) return { statusCode: 400, body: JSON.stringify({ error: 'code required' }) };

  // Rate limit — logged regardless of outcome, so repeatedly guessing
  // codes from the same IP gets slowed down even if some guesses happen
  // to hit a real (but already-used) code.
  if (ip !== 'unknown') {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count, error: countErr } = await supabase
      .from('referral_code_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', windowStart);

    if (!countErr && (count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return {
        statusCode: 429,
        body: JSON.stringify({ redeemed: false, reason: 'rate_limited', error: 'Too many attempts — please try again later.' }),
      };
    }
    await supabase.from('referral_code_attempts').insert({ ip, code: rawCode, user_id });
  }

  // One redemption per user, ever — fast app-level check. The real guard
  // against a race is referral_redemptions.user_id's unique constraint
  // (see the insert below), this is just a friendlier early exit.
  const { data: priorRedemption } = await supabase
    .from('referral_redemptions')
    .select('id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (priorRedemption) {
    return {
      statusCode: 200,
      body: JSON.stringify({ redeemed: false, reason: 'already_redeemed', error: "You've already redeemed a referral code." }),
    };
  }

  const { data: ref, error: lookupErr } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', rawCode)
    .maybeSingle();

  if (lookupErr) {
    console.error('[redeem-referral-code] lookup failed:', lookupErr);
    return { statusCode: 500, body: JSON.stringify({ error: lookupErr.message }) };
  }

  if (!ref) {
    return { statusCode: 200, body: JSON.stringify({ redeemed: false, reason: 'not_found', error: 'That referral code was not found.' }) };
  }
  if (ref.status === 'revoked') {
    return { statusCode: 200, body: JSON.stringify({ redeemed: false, reason: 'revoked', error: 'This referral code is no longer valid.' }) };
  }
  if (ref.status === 'inactive') {
    return { statusCode: 200, body: JSON.stringify({ redeemed: false, reason: 'inactive', error: "This referral code hasn't been activated yet." }) };
  }
  if (ref.status === 'redeemed') {
    return { statusCode: 200, body: JSON.stringify({ redeemed: false, reason: 'already_used', error: 'This referral code has already been used.' }) };
  }

  // ref.status === 'active' — no time limit on an unused code, so there's
  // nothing further to check here. Claim it. The UPDATE is scoped to
  // status='active' so two concurrent requests for the same code can't
  // both succeed: the loser's UPDATE affects 0 rows and falls through to
  // the already_used response below.
  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('referral_codes')
    .update({ status: 'redeemed', redeemed_by: user_id, redeemed_at: nowIso, updated_at: nowIso })
    .eq('id', ref.id)
    .eq('status', 'active')
    .select()
    .maybeSingle();

  if (claimErr) {
    console.error('[redeem-referral-code] claim failed:', claimErr);
    return { statusCode: 500, body: JSON.stringify({ error: claimErr.message }) };
  }
  if (!claimed) {
    return { statusCode: 200, body: JSON.stringify({ redeemed: false, reason: 'already_used', error: 'This referral code has already been used.' }) };
  }

  const credits = Number(ref.credits) || 90;

  const { error: creditErr } = await supabase.rpc('add_credits', {
    p_user_id:     user_id,
    p_amount:      credits,
    p_type:        'referral_bonus',
    p_description: `Referral bonus — code ${ref.code}`,
    p_ref_id:      ref.id,
  });

  if (creditErr) {
    // Crediting failed after the code was already claimed — roll the code
    // back to active so it isn't burned for nothing, and report a real
    // error instead of silently pretending this succeeded.
    console.error('[redeem-referral-code] add_credits failed:', creditErr);
    await supabase.from('referral_codes')
      .update({ status: 'active', redeemed_by: null, redeemed_at: null, updated_at: new Date().toISOString() })
      .eq('id', ref.id);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not grant referral credits — please try again.' }) };
  }

  const { error: redemptionErr } = await supabase.from('referral_redemptions').insert({
    code_id: ref.id,
    user_id,
    credits_granted: credits,
  });
  if (redemptionErr) {
    // Credits are already granted at this point — log but don't fail the
    // request over the audit row alone. (If this insert fails because of
    // the unique(user_id) constraint, that means another request for a
    // DIFFERENT code beat this one to the redemption — a rare edge case
    // given the priorRedemption check above, surfaced here only in logs.)
    console.error('[redeem-referral-code] referral_redemptions insert failed:', redemptionErr);
  }

  console.log(`[redeem-referral-code] Granted ${credits} bonus credits to ${user_id} via code ${ref.code}`);
  return { statusCode: 200, body: JSON.stringify({ redeemed: true, credits }) };
};
