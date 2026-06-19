/**
 * Netlify Function: admin-verify-user
 *
 * Admin-only. Manually marks a user's email as confirmed, bypassing the
 * OTP flow. Use when a user's OTP email bounced (e.g. inbox full) and
 * they cannot complete normal email verification.
 *
 * Deploy path: netlify/functions/admin-verify-user.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * POST body: { target_user_id: 'uuid' }
 *
 * Uses Supabase Admin API's updateUserById to set email_confirm = true,
 * which is equivalent to the user clicking the confirmation link.
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

  const { target_user_id } = body;
  if (!target_user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'target_user_id required' }) };
  }

  // Fetch the target user first so we can log their email
  const { data: targetData, error: fetchErr } = await supabase.auth.admin.getUserById(target_user_id);
  if (fetchErr || !targetData?.user) {
    return { statusCode: 404, body: JSON.stringify({ error: 'User not found' }) };
  }

  const targetEmail = targetData.user.email;

  // Mark email as confirmed — equivalent to the user clicking the OTP link.
  // email_confirm: true tells Supabase to set email_confirmed_at = now()
  // and allow the user to sign in without completing OTP.
  const { error: updateErr } = await supabase.auth.admin.updateUserById(target_user_id, {
    email_confirm: true,
  });

  if (updateErr) {
    console.error('[admin-verify-user] updateUserById failed:', updateErr);
    return { statusCode: 500, body: JSON.stringify({ error: updateErr.message }) };
  }

  console.log(`[admin-verify-user] ${adminUser.email} manually verified ${targetEmail} (${target_user_id})`);

  await logAdminAction(supabase, {
    admin:          adminUser,
    action:         'manual_email_verification',
    target_user_id,
    details: {
      target_email: targetEmail,
      reason:       'Admin bypass — OTP could not be delivered',
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, verified_email: targetEmail }),
  };
};
