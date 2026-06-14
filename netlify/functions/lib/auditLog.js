/**
 * auditLog — shared helper for recording admin actions
 *
 * Usage in any admin-*.js function (after a successful mutation):
 *
 *   import { logAdminAction } from './lib/auditLog.js';
 *
 *   await logAdminAction(supabase, {
 *     admin:          auth.user,           // from requireAdmin()
 *     action:         'credit_adjustment',
 *     target_user_id: target_user_id,
 *     target_email:   targetEmail,
 *     details:        { amount, description, new_balance },
 *   });
 *
 * Failures to log are swallowed (logged to console only) — a logging
 * failure should never block the admin action itself.
 *
 * Place this file at: netlify/functions/lib/auditLog.js
 */

export async function logAdminAction(supabase, { admin, action, target_user_id = null, target_email = null, details = {} }) {
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      admin_id:       admin.id,
      admin_email:    admin.email,
      action,
      target_user_id,
      target_email,
      details,
    });
    if (error) console.error('[auditLog] insert failed:', error);
  } catch (err) {
    console.error('[auditLog] unexpected error:', err);
  }
}
