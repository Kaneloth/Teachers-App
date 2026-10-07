/**
 * Netlify Function: admin-referral-codes
 *
 * Admin-only CRUD for the referral code system (see
 * migration_referral_codes.sql):
 *   - referral_codes       (one row per issued code)
 *   - referral_redemptions (audit log of who redeemed what — read via 'list'
 *                            joins are not needed here; redeemed_by/redeemed_at
 *                            already live on referral_codes itself)
 *
 * The actual redemption at signup happens in redeem-referral-code.js, which
 * is deliberately NOT admin-gated (a brand-new user has no educators row
 * yet, so requireAdmin would always reject them) — this file only covers
 * the admin side of issuing/managing codes.
 *
 * Deploy path: netlify/functions/admin-referral-codes.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              netlify/functions/lib/auditLog.js
 *              migration_referral_codes.sql already run against the DB
 *
 * POST body — one of:
 *   { action: 'list', status?: string, search?: string }
 *   { action: 'create', recipient_name, recipient_initials, credits?, activate? }
 *   { action: 'bulk_upload', rows: [{ name, initials }], activate? }
 *   { action: 'activate',   id }
 *   { action: 'deactivate', id }
 *   { action: 'revoke',     id }
 *   { action: 'delete',     id }
 *   { action: 'export', status? }   // omitted/'active' → active only; 'all' → everything
 */

import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

const DEFAULT_CREDITS = 90;
const EXPIRY_DAYS     = 30;
const MAX_BULK_ROWS   = 500;

// Excludes O/0, I/1, L — characters easily confused with one another (or
// with a digit) when a learner reads a code off a printed sheet or a phone
// screen, per the brief's spec.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSuffix(len = 3) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function makeCode(initials, year) {
  const init = String(initials || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2).padEnd(2, 'X');
  const yy = String(year).slice(-2);
  return `CR-${init}${yy}-${randomSuffix(3)}`;
}

function expiryFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d.toISOString();
}

// Tries up to 5 random suffixes before giving up, in case of a code
// collision (23505 = unique_violation) — vanishingly unlikely at the
// brief's scale (cohorts of up to 500), but cheap to guard against.
async function insertWithUniqueCode(supabase, { recipient_name, recipient_initials, credits, activate, created_by, year }) {
  let lastErr = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode(recipient_initials, year);
    const { data, error } = await supabase.from('referral_codes').insert({
      code,
      recipient_name,
      recipient_initials: String(recipient_initials).toUpperCase().slice(0, 2),
      year,
      credits,
      status: activate ? 'active' : 'inactive',
      expires_at: activate ? expiryFromNow() : null,
      created_by,
    }).select().maybeSingle();

    if (!error) return { data, error: null };
    lastErr = error;
    if (error.code !== '23505') break; // only retry on duplicate-code collisions
  }
  return { data: null, error: lastErr };
}

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
  const year = new Date().getFullYear();

  // ── List ──────────────────────────────────────────────────────────────
  if (action === 'list') {
    let query = supabase.from('referral_codes').select('*').order('created_at', { ascending: false });
    if (body.status && body.status !== 'all') query = query.eq('status', body.status);
    if (body.search) {
      const term = String(body.search).trim().replace(/[%,]/g, '');
      if (term) query = query.or(`code.ilike.%${term}%,recipient_name.ilike.%${term}%`);
    }
    const { data, error } = await query.limit(1000);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ codes: data || [] }) };
  }

  // ── Create a single code ─────────────────────────────────────────────
  if (action === 'create') {
    const recipient_name = String(body.recipient_name || '').trim();
    const recipient_initials = String(body.recipient_initials || '').trim();
    if (!recipient_name)     return { statusCode: 400, body: JSON.stringify({ error: 'recipient_name is required' }) };
    if (!recipient_initials) return { statusCode: 400, body: JSON.stringify({ error: 'recipient_initials is required' }) };

    const credits = Number.isFinite(body.credits) && body.credits > 0 ? body.credits : DEFAULT_CREDITS;
    const activate = body.activate !== false; // default: active immediately

    const { data: inserted, error } = await insertWithUniqueCode(supabase, {
      recipient_name, recipient_initials, credits, activate, created_by: auth.user.id, year,
    });

    if (!inserted) {
      return { statusCode: 500, body: JSON.stringify({ error: error?.message || 'Failed to create code — please try again.' }) };
    }

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_code_created', details: { code: inserted.code, recipient_name } });
    return { statusCode: 200, body: JSON.stringify({ success: true, referral_code: inserted }) };
  }

  // ── Bulk upload (CSV parsed client-side → rows here) ────────────────────
  if (action === 'bulk_upload') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length === 0)           return { statusCode: 400, body: JSON.stringify({ error: 'No rows to upload' }) };
    if (rows.length > MAX_BULK_ROWS) return { statusCode: 400, body: JSON.stringify({ error: `Max ${MAX_BULK_ROWS} rows per upload` }) };

    const activate = body.activate !== false;
    const created = [];
    const skipped = [];

    for (const row of rows) {
      const recipient_name = String(row.name || '').trim();
      const recipient_initials = String(row.initials || '').trim();
      if (!recipient_name || !recipient_initials) {
        skipped.push({ row, reason: 'Missing name or initials' });
        continue;
      }

      const { data: inserted, error } = await insertWithUniqueCode(supabase, {
        recipient_name, recipient_initials, credits: DEFAULT_CREDITS, activate, created_by: auth.user.id, year,
      });

      if (inserted) created.push(inserted);
      else skipped.push({ row, reason: error?.message || 'Failed to generate a unique code' });
    }

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_codes_bulk_uploaded', details: { created: created.length, skipped: skipped.length } });
    return { statusCode: 200, body: JSON.stringify({ success: true, created, skipped }) };
  }

  // ── Activate (inactive/expired → active, resets the 30-day clock) ───────
  if (action === 'activate') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

    const { data, error } = await supabase
      .from('referral_codes')
      .update({ status: 'active', expires_at: expiryFromNow(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['inactive', 'expired'])
      .select()
      .maybeSingle();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Only inactive or expired codes can be activated.' }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_code_activated', details: { id, code: data.code } });
    return { statusCode: 200, body: JSON.stringify({ success: true, referral_code: data }) };
  }

  // ── Deactivate (active → inactive, only before anyone redeems it) ──────
  if (action === 'deactivate') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

    const { data, error } = await supabase
      .from('referral_codes')
      .update({ status: 'inactive', expires_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .maybeSingle();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Only active, unredeemed codes can be deactivated.' }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_code_deactivated', details: { id, code: data.code } });
    return { statusCode: 200, body: JSON.stringify({ success: true, referral_code: data }) };
  }

  // ── Revoke (permanently block a not-yet-redeemed code) ──────────────────
  if (action === 'revoke') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

    const { data, error } = await supabase
      .from('referral_codes')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('id', id)
      .neq('status', 'redeemed')
      .select()
      .maybeSingle();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Already redeemed — nothing to revoke.' }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_code_revoked', details: { id, code: data.code } });
    return { statusCode: 200, body: JSON.stringify({ success: true, referral_code: data }) };
  }

  // ── Delete (only codes never redeemed — keeps redemption history intact) ─
  if (action === 'delete') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

    const { data: row } = await supabase.from('referral_codes').select('status, code').eq('id', id).maybeSingle();
    if (!row) return { statusCode: 404, body: JSON.stringify({ error: 'Code not found' }) };
    if (row.status === 'redeemed') {
      return { statusCode: 400, body: JSON.stringify({ error: "Redeemed codes can't be deleted — they're part of the redemption history." }) };
    }

    const { error } = await supabase.from('referral_codes').delete().eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'referral_code_deleted', details: { id, code: row.code } });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // ── Export (for the "Learner Name,Token" CSV download) ──────────────────
  if (action === 'export') {
    let query = supabase.from('referral_codes').select('recipient_name, code, status').order('recipient_name', { ascending: true });
    if (!body.status || body.status === 'active') query = query.eq('status', 'active');
    else if (body.status !== 'all') query = query.eq('status', body.status);

    const { data, error } = await query.limit(1000);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ rows: data || [] }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
