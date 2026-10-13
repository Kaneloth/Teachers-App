/**
 * Netlify Function: admin-user-credits
 *
 * Admin-only. Returns one user's credit picture for the Users panel:
 * current balance, lifetime totals in/out, a per-type breakdown and the most
 * recent ledger rows (including "Signup bonus denied: …" zero-amount rows).
 *
 * Deploy path: netlify/functions/admin-user-credits.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * POST { user_id: '<uuid>', limit?: 25 }   (limit capped at 200)
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

  const userId = body.user_id;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'user_id is required' }) };
  }
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 25, 1), 200);

  const [balRes, recentRes, allRes] = await Promise.all([
    supabase.from('user_credits').select('balance').eq('user_id', userId).maybeSingle(),
    supabase
      .from('credit_ledger')
      .select('id, created_at, type, amount, description')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    // Lightweight pass over every row for lifetime totals / per-type counts.
    supabase.from('credit_ledger').select('type, amount').eq('user_id', userId),
  ]);

  if (recentRes.error) {
    return { statusCode: 500, body: JSON.stringify({ error: recentRes.error.message }) };
  }

  let totalIn = 0;
  let totalOut = 0;
  const byType = {};
  for (const r of allRes.data ?? []) {
    const amt = Number(r.amount) || 0;
    if (amt > 0) totalIn += amt; else totalOut += -amt;
    const t = (byType[r.type] ??= { type: r.type, count: 0, net: 0 });
    t.count += 1;
    t.net += amt;
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      balance: balRes.data?.balance ?? 0,
      total_in: totalIn,
      total_out: totalOut,
      by_type: Object.values(byType).sort((a, b) => b.count - a.count),
      total_rows: (allRes.data ?? []).length,
      transactions: recentRes.data ?? [],
    }),
  };
};
