/**
 * Netlify Function: admin-adjust-credits
 *
 * Admin-only. View a user's credit ledger and balance, or apply a manual
 * adjustment (positive or negative).
 *
 * Deploy path: netlify/functions/admin-adjust-credits.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * POST body:
 *   { action: 'view',   target_email: 'user@example.com' }
 *   { action: 'adjust', target_user_id: 'uuid', amount: 10, description: 'Goodwill credit' }
 *
 *   `amount` can be positive (add) or negative (deduct). Negative amounts
 *   are NOT checked against balance — admins can push a balance negative
 *   if needed (e.g. to correct a refund). Use with care.
 */

import { requireAdmin } from './lib/requireAdmin.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { action } = body;

  // ── View a user's balance + ledger history ──────────────────────────────
  if (action === 'view') {
    const { target_email, target_user_id } = body;

    let userId = target_user_id;
    if (!userId) {
      if (!target_email) {
        return { statusCode: 400, body: JSON.stringify({ error: 'target_email or target_user_id required' }) };
      }
      // Look up user by email via admin API
      const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) return { statusCode: 500, body: JSON.stringify({ error: listErr.message }) };
      const found = list.users.find(u => u.email?.toLowerCase() === target_email.toLowerCase());
      if (!found) return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
      userId = found.id;
    }

    const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: userId });

    const { data: ledger, error: ledgerErr } = await supabase
      .from('credit_ledger')
      .select('id, amount, type, description, ref_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ledgerErr) return { statusCode: 500, body: JSON.stringify({ error: ledgerErr.message }) };

    return {
      statusCode: 200,
      body: JSON.stringify({ user_id: userId, balance: balance ?? 0, ledger }),
    };
  }

  // ── Apply a manual adjustment ────────────────────────────────────────────
  if (action === 'adjust') {
    const { target_user_id, amount, description } = body;

    if (!target_user_id) return { statusCode: 400, body: JSON.stringify({ error: 'target_user_id required' }) };
    if (typeof amount !== 'number' || amount === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'amount must be a non-zero number' }) };
    }

    const desc = description || `Admin adjustment by ${auth.user.email}`;

    let newBalance;
    if (amount > 0) {
      const { data, error } = await supabase.rpc('add_credits', {
        p_user_id:     target_user_id,
        p_amount:      amount,
        p_type:        'adjustment',
        p_description: desc,
        p_ref_id:      `admin:${auth.user.id}`,
      });
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      newBalance = data;
    } else {
      // Negative adjustment — insert directly (bypasses deduct_credits'
      // insufficient-balance check, since admins may need to correct to
      // a negative balance e.g. after a chargeback).
      const { error: insertErr } = await supabase.from('credit_ledger').insert({
        user_id:     target_user_id,
        amount:      amount, // already negative
        type:        'adjustment',
        description: desc,
        ref_id:      `admin:${auth.user.id}`,
      });
      if (insertErr) return { statusCode: 500, body: JSON.stringify({ error: insertErr.message }) };

      const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: target_user_id });
      newBalance = balance;
    }

    console.log(`[admin-adjust-credits] ${auth.user.email} adjusted user ${target_user_id} by ${amount} → new balance ${newBalance}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, new_balance: newBalance }),
    };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
