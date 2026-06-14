/**
 * Netlify Function: admin-update-user
 *
 * Admin-only. Update a user's account status, subscription, or admin flag.
 *
 * Deploy path: netlify/functions/admin-update-user.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * POST body — any combination of:
 *   {
 *     target_user_id: 'uuid',
 *     account_status: 'active' | 'suspended' | 'banned',
 *     subscription_plan: 'free' | 'monthly' | 'semi' | 'annual',
 *     subscription_end: '2026-12-31T00:00:00.000Z' | null,
 *     is_admin: true | false
 *   }
 */

import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase, user: adminUser } = auth;

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { target_user_id, account_status, subscription_plan, subscription_end, is_admin } = body;

  if (!target_user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'target_user_id required' }) };
  }

  const results = {};

  // ── Account status (educators table) ───────────────────────────────────
  if (account_status !== undefined) {
    if (!['active', 'suspended', 'banned'].includes(account_status)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid account_status' }) };
    }
    const { error } = await supabase
      .from('educators')
      .update({ account_status })
      .eq('user_id', target_user_id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: `account_status: ${error.message}` }) };
    results.account_status = account_status;
  }

  // ── Subscription plan / end (profiles table + user_metadata) ────────────
  if (subscription_plan !== undefined || subscription_end !== undefined) {
    const updatePayload = {};
    if (subscription_plan !== undefined) updatePayload.subscription_plan = subscription_plan;
    if (subscription_end  !== undefined) updatePayload.subscription_end  = subscription_end;

    const { error: profErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', target_user_id);
    if (profErr) return { statusCode: 500, body: JSON.stringify({ error: `profiles: ${profErr.message}` }) };

    // Mirror into user_metadata so client-side checks that read from
    // user.user_metadata stay in sync immediately.
    const { error: metaErr } = await supabase.auth.admin.updateUserById(target_user_id, {
      user_metadata: updatePayload,
    });
    if (metaErr) return { statusCode: 500, body: JSON.stringify({ error: `user_metadata: ${metaErr.message}` }) };

    results.subscription_plan = subscription_plan;
    results.subscription_end  = subscription_end;
  }

  // ── Admin flag ────────────────────────────────────────────────────────────
  if (is_admin !== undefined) {
    if (target_user_id === adminUser.id && is_admin === false) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cannot remove your own admin access' }) };
    }
    const { error } = await supabase.auth.admin.updateUserById(target_user_id, {
      user_metadata: { is_admin: !!is_admin },
    });
    if (error) return { statusCode: 500, body: JSON.stringify({ error: `is_admin: ${error.message}` }) };
    results.is_admin = !!is_admin;
  }

  console.log(`[admin-update-user] ${adminUser.email} updated user ${target_user_id}:`, results);

  await logAdminAction(supabase, {
    admin: adminUser,
    action: 'user_update',
    target_user_id,
    details: results,
  });

  return { statusCode: 200, body: JSON.stringify({ success: true, updated: results }) };
};
