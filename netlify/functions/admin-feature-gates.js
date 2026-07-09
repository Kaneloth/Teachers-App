/**
 * Netlify Function: admin-feature-gates — read and write feature gate toggles
 *
 * GET  /.netlify/functions/admin-feature-gates
 *      Returns { global: Gate[], perUser: Gate[] }
 *
 * POST /.netlify/functions/admin-feature-gates
 *      Body: { gate_key, user_id?, enabled }
 *      Sets a global (user_id omitted/null) or per-user gate
 *
 * DELETE /.netlify/functions/admin-feature-gates
 *      Body: { gate_key, user_id }
 *      Removes a per-user override (falls back to global)
 *
 * Deploy path: netlify/functions/admin-feature-gates.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * SECURITY: this function previously checked user.user_metadata.is_admin
 * directly, independently of requireAdmin.js — that field is
 * client-writable (any signed-in user can call
 * supabase.auth.updateUser({ data: { is_admin: true } }) on their own
 * account), so this function was NOT actually admin-gated. It let anyone
 * globally toggle monetization gates (cv_credits, chat_credits,
 * id_verification, etc.) for every user on the platform. Now routed
 * through requireAdmin.js, which checks the real educators.is_admin DB
 * column (writable only by service-role code), matching every other
 * admin-*.js function.
 *
 * NOTE: this file was previously written in CommonJS (require/exports)
 * while requireAdmin.js and the rest of the admin-*.js functions use ESM
 * (import/export) — converted to ESM here so the import works at all.
 */

import { requireAdmin } from './lib/requireAdmin.js';

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  const auth = await requireAdmin(event);
  if (auth.error) {
    // requireAdmin's error responses don't set the CORS header this
    // function has always sent — merge it in so behavior stays identical
    // for existing callers.
    return { ...auth.error, headers: { ...headers, ...(auth.error.headers || {}) } };
  }
  const { supabase, user } = auth;

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('feature_gates')
      .select('*')
      .order('gate_key');
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };

    const global  = (data || []).filter(g => !g.user_id);
    const perUser = (data || []).filter(g => !!g.user_id);
    return { statusCode: 200, body: JSON.stringify({ global, perUser }), headers };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { gate_key, user_id, enabled } = body;
    if (!gate_key || enabled === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: 'gate_key and enabled required' }), headers };
    }

    const now = new Date().toISOString();

    if (!user_id) {
      // Global gate — NULL user_id breaks upsert onConflict, so use UPDATE then INSERT
      const { data: existing, error: findErr } = await supabase
        .from('feature_gates')
        .select('id, enabled')
        .eq('gate_key', gate_key)
        .is('user_id', null)
        .maybeSingle();

      console.log(`[admin-feature-gates] gate_key=${gate_key} existing=`, JSON.stringify(existing), 'findErr=', findErr?.message);

      let error;
      if (existing) {
        const result = await supabase
          .from('feature_gates')
          .update({ enabled: !!enabled, updated_by: user.id, updated_at: now })
          .eq('id', existing.id)
          .select();
        console.log(`[admin-feature-gates] UPDATE result=`, JSON.stringify(result.data), 'error=', result.error?.message);
        error = result.error;
      } else {
        const result = await supabase
          .from('feature_gates')
          .insert({ gate_key, user_id: null, enabled: !!enabled, updated_by: user.id, updated_at: now })
          .select();
        console.log(`[admin-feature-gates] INSERT result=`, JSON.stringify(result.data), 'error=', result.error?.message);
        error = result.error;
      }
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
    } else {
      // Per-user gate — user_id is set so upsert conflict works normally
      const { error } = await supabase.from('feature_gates').upsert(
        { gate_key, user_id, enabled: !!enabled, updated_by: user.id, updated_at: now },
        { onConflict: 'gate_key,user_id' }
      );
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }), headers };
  }

  if (event.httpMethod === 'DELETE') {
    const body = JSON.parse(event.body || '{}');
    const { gate_key, user_id } = body;
    if (!gate_key || !user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'gate_key and user_id required for DELETE' }), headers };
    }
    const { error } = await supabase.from('feature_gates')
      .delete().eq('gate_key', gate_key).eq('user_id', user_id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
    return { statusCode: 200, body: JSON.stringify({ success: true }), headers };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers };
};
