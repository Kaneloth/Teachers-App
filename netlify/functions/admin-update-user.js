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

  const { target_user_id, account_status, subscription_plan, subscription_end, is_admin, templates_unlocked, is_hidden } = body;

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

  // ── Subscription plan / end ──────────────────────────────────────────────
  // Writes to BOTH tables so everything stays in sync:
  //   - profiles        → what SettingsPage reads client-side
  //   - educators       → what the webhook writes (source of truth for PayFast)
  //   - user_metadata   → instant client-side reflection without session refresh
  if (subscription_plan !== undefined || subscription_end !== undefined) {
    // Auto-calculate subscription_end if a paid plan is set but no end date
    // was provided — prevents accidentally clearing the end date when the
    // admin only meant to set/change the plan name.
    let resolvedEnd = subscription_end;
    if (subscription_plan && subscription_plan !== 'free' && !resolvedEnd) {
      const d = new Date();
      if      (subscription_plan === 'monthly')     d.setMonth(d.getMonth() + 1);
      else if (subscription_plan === 'semi_annual') d.setMonth(d.getMonth() + 6);
      else if (subscription_plan === 'annual')      d.setFullYear(d.getFullYear() + 1);
      resolvedEnd = d.toISOString();
    }
    // If explicitly setting to free, clear the end date too
    if (subscription_plan === 'free') resolvedEnd = null;

    const updatePayload = {};
    if (subscription_plan !== undefined) updatePayload.subscription_plan = subscription_plan;
    if (resolvedEnd        !== undefined) updatePayload.subscription_end  = resolvedEnd;

    // Write to profiles (upsert — row may not exist yet)
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: target_user_id, ...updatePayload }, { onConflict: 'id' });
    if (profErr) console.error('[admin-update-user] profiles upsert error (non-fatal):', profErr.message);

    // Write to educators (this is what the webhook uses)
    const { error: eduErr } = await supabase
      .from('educators')
      .update(updatePayload)
      .eq('user_id', target_user_id);
    if (eduErr) console.error('[admin-update-user] educators update error (non-fatal):', eduErr.message);

    // Mirror to user_metadata — MUST fetch-and-merge to avoid wiping
    // unrelated fields like is_admin, user_code, full_name, etc.
    const { data: existingUserData, error: getUserErr } = await supabase.auth.admin.getUserById(target_user_id);
    if (getUserErr) {
      console.error('[admin-update-user] could not fetch user for metadata merge:', getUserErr.message);
    } else {
      const mergedMeta = {
        ...(existingUserData?.user?.user_metadata || {}),
        ...updatePayload,
        subscription_cancelled: subscription_plan === 'free' || subscription_plan === null ? true : false,
      };
      const { error: metaErr } = await supabase.auth.admin.updateUserById(target_user_id, {
        user_metadata: mergedMeta,
      });
      if (metaErr) return { statusCode: 500, body: JSON.stringify({ error: `user_metadata: ${metaErr.message}` }) };
    }

    results.subscription_plan = subscription_plan;
    results.subscription_end  = subscription_end;
  }

  // ── Admin flag ────────────────────────────────────────────────────────────
  if (is_admin !== undefined) {
    if (target_user_id === adminUser.id && is_admin === false) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cannot remove your own admin access' }) };
    }
    // Fetch-and-merge to avoid wiping other metadata fields
    const { data: adminTargetData, error: adminGetErr } = await supabase.auth.admin.getUserById(target_user_id);
    if (adminGetErr) return { statusCode: 500, body: JSON.stringify({ error: `is_admin fetch: ${adminGetErr.message}` }) };
    const mergedAdminMeta = {
      ...(adminTargetData?.user?.user_metadata || {}),
      is_admin: !!is_admin,
    };
    const { error } = await supabase.auth.admin.updateUserById(target_user_id, {
      user_metadata: mergedAdminMeta,
    });
    if (error) return { statusCode: 500, body: JSON.stringify({ error: `is_admin: ${error.message}` }) };
    results.is_admin = !!is_admin;
  }

  console.log(`[admin-update-user] ${adminUser.email} updated user ${target_user_id}:`, results);

  // ── is_hidden — admin show/hide profile in browse lists ──────────────────
  if (is_hidden !== undefined) {
    const { error: hidErr } = await supabase
      .from('educators')
      .update({ is_hidden: !!is_hidden })
      .eq('user_id', target_user_id);
    if (hidErr) console.error('[admin-update-user] is_hidden error:', hidErr.message);
    else results.is_hidden = !!is_hidden;
  }

  // ── templates_unlocked — grant/revoke template access without purchase ───
  if (templates_unlocked !== undefined) {
    const { error: tplErr } = await supabase
      .from('educators')
      .update({ templates_unlocked: !!templates_unlocked })
      .eq('user_id', target_user_id);
    if (tplErr) console.error('[admin-update-user] templates_unlocked error:', tplErr.message);
    else results.templates_unlocked = !!templates_unlocked;
  }

  await logAdminAction(supabase, {
    admin: adminUser,
    action: 'user_update',
    target_user_id,
    details: results,
  });

  return { statusCode: 200, body: JSON.stringify({ success: true, updated: results }) };
};
