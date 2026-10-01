/**
 * Netlify Function: admin-list-bot-signups
 *
 * Admin-only. Lists rows from bot_signup_attempts (see
 * migration_bot_signup_attempts.sql) — signups caught client-side by the
 * honeypot trap in Register.tsx before any account was ever created.
 * Also returns simple rolling-window counts so the admin page can show
 * "X caught today / this week" without a second round trip.
 *
 * Deploy path: netlify/functions/admin-list-bot-signups.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              migration_bot_signup_attempts.sql already run against the DB
 *
 * POST body:
 *   { page?: 1, perPage?: 50, reason?: 'honeypot_filled' | 'submitted_too_fast' }
 */

import { requireAdmin } from './lib/requireAdmin.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }

  const page    = parseInt(body.page, 10)    || 1;
  const perPage = Math.min(parseInt(body.perPage, 10) || 50, 200);
  const reason  = ['honeypot_filled', 'submitted_too_fast'].includes(body.reason) ? body.reason : null;
  const from    = (page - 1) * perPage;
  const to      = from + perPage - 1;

  let query = supabase
    .from('bot_signup_attempts')
    .select('id, email, reason, ip, user_agent, elapsed_ms, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (reason) query = query.eq('reason', reason);

  const { data: rows, error, count } = await query;
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

  // Rolling-window counts for the stat tiles — cheap head-count queries,
  // not affected by the `reason` filter above (always totals).
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: count24h }, { count: count7d }] = await Promise.all([
    supabase.from('bot_signup_attempts').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('bot_signup_attempts').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
  ]);

  return {
    statusCode: 200,
    body: JSON.stringify({
      rows: rows ?? [],
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / perPage)),
      count_24h: count24h ?? 0,
      count_7d:  count7d ?? 0,
    }),
  };
};
