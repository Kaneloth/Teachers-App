/**
 * Netlify Function: admin-list-users
 *
 * Admin-only. Returns a combined view of all users: auth data (email,
 * created_at, is_admin), educators/profile data (full_name, profile_type,
 * account_status), subscription info, and credit balance.
 *
 * Deploy path: netlify/functions/admin-list-users.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * GET (or POST) — optional query/body params:
 *   { search: 'thabo' }   — filters by name or email (case-insensitive substring)
 *   { page: 1, perPage: 50 }
 */

import { requireAdmin } from './lib/requireAdmin.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  let params = {};
  if (event.httpMethod === 'POST') {
    try { params = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  } else {
    params = event.queryStringParameters || {};
  }

  const search  = (params.search || '').toLowerCase().trim();
  const page    = parseInt(params.page, 10)    || 1;
  const perPage = parseInt(params.perPage, 10) || 50;

  // ── 1. List auth users (service role — bypasses RLS) ────────────────────
  const { data: authList, error: authErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (authErr) return { statusCode: 500, body: JSON.stringify({ error: authErr.message }) };

  const userIds = authList.users.map(u => u.id);

  // ── 2. Fetch educators/profiles rows for these users ─────────────────────
  const { data: educatorRows } = await supabase
    .from('educators')
    .select('user_id, full_name, profile_type, account_status, current_school, templates_unlocked')
    .in('user_id', userIds);

  const educatorMap = new Map((educatorRows ?? []).map(r => [r.user_id, r]));

  // ── 3. Fetch subscription info from profiles ─────────────────────────────
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, subscription_plan, subscription_end, deleted_at')
    .in('id', userIds);

  const profileMap = new Map((profileRows ?? []).map(r => [r.id, r]));

  // ── 4. Fetch credit balances ──────────────────────────────────────────────
  const { data: creditRows } = await supabase
    .from('user_credits')
    .select('user_id, balance')
    .in('user_id', userIds);

  const creditMap = new Map((creditRows ?? []).map(r => [r.user_id, r.balance]));

  // ── 5. Combine ─────────────────────────────────────────────────────────────
  let combined = authList.users.map(u => {
    const edu = educatorMap.get(u.id);
    const prof = profileMap.get(u.id);
    return {
      id:                u.id,
      email:             u.email,
      full_name:         edu?.full_name || u.user_metadata?.full_name || '',
      user_code:         u.user_metadata?.user_code || null,
      profile_type:      edu?.profile_type || null,
      account_status:    edu?.account_status || 'active',
      current_school:    edu?.current_school || null,
      is_admin:          !!u.user_metadata?.is_admin,
      // email_confirmed is null for Google OAuth users (they don't need OTP)
      // and for unverified email users. Treat Google OAuth (no email_confirmed_at
      // but confirmed_at exists) as confirmed.
      email_confirmed:    !!(u.email_confirmed_at || u.confirmed_at),
      templates_unlocked: !!(edu?.templates_unlocked),
      subscription_plan: prof?.subscription_plan || u.user_metadata?.subscription_plan || 'free',
      subscription_end:  prof?.subscription_end  || u.user_metadata?.subscription_end  || null,
      deleted_at:        prof?.deleted_at || null,
      credit_balance:    creditMap.get(u.id) ?? 0,
      created_at:        u.created_at,
      last_sign_in_at:   u.last_sign_in_at,
    };
  });

  // ── 6. Filter by search ───────────────────────────────────────────────────
  // Matches name, email, or Crosssa reference code (CR-DDDDLLL). The
  // user_code is normalized to lowercase for comparison so "cr-1234abc",
  // "CR-1234ABC", or just "1234abc" all match.
  if (search) {
    combined = combined.filter(u =>
      u.email?.toLowerCase().includes(search) ||
      u.full_name?.toLowerCase().includes(search) ||
      u.user_code?.toLowerCase().includes(search)
    );
  }

  // ── 7. Sort newest first ──────────────────────────────────────────────────
  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    statusCode: 200,
    body: JSON.stringify({
      users: combined,
      total: combined.length,
    }),
  };
};
