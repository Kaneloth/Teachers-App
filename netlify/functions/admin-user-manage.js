/**
 * Netlify Function: admin-user-manage
 *
 * Admin-only. Create users, generate a new login password for a user, and
 * "delete" a user.
 *
 * Deploy path: netlify/functions/admin-user-manage.js
 * Requires:    netlify/functions/lib/requireAdmin.js, lib/auditLog.js
 *
 * POST body:
 *   { action: 'create',         email, password, full_name? }
 *   { action: 'reset_password', target_user_id }          -> returns { password } ONCE
 *   { action: 'delete',         target_user_id, confirm_email }
 *
 * DELETE = anonymise, not a hard delete. credit_ledger is ON DELETE CASCADE
 * and transactions blocks deletion, so removing the auth user would destroy
 * the credit history. Instead the profile information is erased, the login
 * is permanently disabled and the email is replaced with a placeholder
 * (freeing the address). The credit ledger, transactions and the user's CV
 * data (user_metadata.last_cv_*) are kept for your records.
 */

import { randomBytes } from 'node:crypto';
import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

const json = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const PERMANENT_BAN = '876000h'; // ~100 years

// Unambiguous characters only (no 0/O, 1/l/I) — easy to read out over the phone.
function generatePassword(len = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[randomBytes(1)[0] % set.length];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < len) chars.push(pick(all));
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase, user: adminUser } = auth;

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const { action } = body;

  // ── Create user ───────────────────────────────────────────────────────────
  if (action === 'create') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Enter a valid email address' });
    if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters' });

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // admin-created: no OTP needed
      user_metadata: { full_name: fullName, subscription_plan: 'free', created_by_admin: true },
    });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return json(taken ? 409 : 500, { error: taken ? 'A user with that email already exists' : error.message });
    }
    await logAdminAction(supabase, {
      admin: adminUser, action: 'user_create', target_user_id: data.user.id, details: { email },
    });
    return json(200, { success: true, user_id: data.user.id, email });
  }

  // Everything below targets an existing user.
  const targetId = body.target_user_id;
  if (!targetId) return json(400, { error: 'target_user_id required' });
  if (targetId === adminUser.id) return json(400, { error: 'You cannot do this to your own account' });

  const { data: target, error: getErr } = await supabase.auth.admin.getUserById(targetId);
  if (getErr || !target?.user) return json(404, { error: 'User not found' });

  const { data: eduRow } = await supabase
    .from('educators').select('is_admin').eq('user_id', targetId).maybeSingle();
  if (eduRow?.is_admin || target.user.user_metadata?.is_admin) {
    return json(403, { error: 'Remove this user\'s admin access first' });
  }

  const { data: profRow } = await supabase
    .from('profiles').select('deleted_at').eq('id', targetId).maybeSingle();
  if (profRow?.deleted_at) return json(400, { error: 'This user has already been deleted' });

  // ── Generate a new password ───────────────────────────────────────────────
  if (action === 'reset_password') {
    const password = generatePassword(12);
    const { error } = await supabase.auth.admin.updateUserById(targetId, { password });
    if (error) return json(500, { error: error.message });
    // The password itself is never logged.
    await logAdminAction(supabase, {
      admin: adminUser, action: 'password_reset_generated', target_user_id: targetId,
      details: { email: target.user.email },
    });
    return json(200, { success: true, email: target.user.email, password });
  }

  // ── Delete (anonymise) ───────────────────────────────────────────────────
  if (action === 'delete') {
    const confirm = String(body.confirm_email || '').trim().toLowerCase();
    if (!confirm || confirm !== String(target.user.email || '').toLowerCase()) {
      return json(400, { error: 'Confirmation email does not match' });
    }

    const placeholder = `deleted-${targetId}@deleted.invalid`;

    // 1. Erase profile information (row kept so nothing referencing it breaks)
    const { error: eduErr } = await supabase.from('educators').update({
      full_name: 'Deleted user',
      email: placeholder,
      phone: null, bio: null, avatar_url: null,
      current_school: null, town: null, town_lat: null, town_lng: null,
      geo_location: null, preferred_town_coords: null,
      sace_number: null, personal_number: null, district: null,
      payfast_token: null,
      is_actively_looking: false, is_hidden: true,
      account_status: 'banned',
    }).eq('user_id', targetId);
    if (eduErr) return json(500, { error: `Profile clean-up failed: ${eduErr.message}` });

    // 2. Mark deleted
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: targetId, deleted_at: new Date().toISOString() }, { onConflict: 'id' });
    if (profErr) console.error('[admin-user-manage] profiles.deleted_at:', profErr.message);

    // 3. Disable the login for good, free up the email, scrub personal metadata.
    //    CV data (last_cv_*) and user_code stay for your records.
    const m = target.user.user_metadata || {};
    const kept = {};
    for (const k of ['last_cv_data', 'last_cv_pdf_url', 'last_cv_generated_at', 'cv_count', 'user_code']) {
      if (m[k] !== undefined) kept[k] = m[k];
    }
    const { error: authErr } = await supabase.auth.admin.updateUserById(targetId, {
      email: placeholder,
      email_confirm: true,
      password: randomBytes(24).toString('base64url'),
      ban_duration: PERMANENT_BAN,
      user_metadata: { ...kept, deleted: true, deleted_at: new Date().toISOString() },
    });
    if (authErr) return json(500, { error: `Account disable failed: ${authErr.message}` });

    await supabase.auth.admin.signOut(targetId).catch(() => {});

    await logAdminAction(supabase, {
      admin: adminUser, action: 'user_delete', target_user_id: targetId,
      details: { former_email: target.user.email },
    });
    return json(200, { success: true });
  }

  return json(400, { error: `Unknown action "${action}"` });
};
