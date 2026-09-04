/**
 * Netlify Function: admin-pricing
 *
 * Admin-only CRUD over the tables lib/pricing.js reads from:
 *   - credit_packages       (Starter/Standard/Business/etc. purchase packages)
 *   - credit_costs          (per-action costs: cv_usage, letter_usage, ...)
 *   - app_settings          (currently just signup_bonus_credits)
 *
 * Deploy path: netlify/functions/admin-pricing.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              netlify/functions/lib/auditLog.js
 *              migration_pricing.sql already run against the DB
 *
 * POST body — one of:
 *   { action: 'list' }
 *   { action: 'create_package', package: { id, label, credits, price_zar, note?, is_popular?, sort_order?, active? } }
 *   { action: 'update_package', id, patch: { label?, credits?, price_zar?, note?, is_popular?, sort_order?, active? } }
 *   { action: 'delete_package', id }
 *   { action: 'update_cost',    action_type, patch: { cost?, label? } }
 *   { action: 'update_signup_bonus', value: number }
 *
 * `id` is never editable on an existing package — it's a stable code-level
 * identifier other functions look up by (payfast-initiate.js,
 * payfast-webhook.js, deduct-credits.js's chat_unlock check). Renaming it
 * here would silently orphan that package from the rest of the app.
 */

import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

// These ids are load-bearing elsewhere in the codebase (payfast-webhook.js
// checks package_id === 'chat_unlock' by literal string; the other three
// are the packages every existing purchase-flow test/screenshot assumes
// exist). Admins can still edit their price/credits/label/etc. freely —
// this only blocks deleting the row out from under the rest of the app.
const PROTECTED_PACKAGE_IDS = new Set(['single', 'standard', 'business', 'chat_unlock']);

// credit_costs rows are tied 1:1 to actual `type` values deduct-credits.js
// is called with elsewhere in the codebase — admins can retune the cost or
// relabel it, but can't rename action_type or add arbitrary new ones here,
// since a cost with no matching code path would be confusing dead weight
// (and one with a typo'd action_type would silently never apply).
const KNOWN_ACTION_TYPES = new Set(['cv_usage', 'letter_usage', 'guide_download', 'id_verify']);

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

  // ── List everything the admin page needs in one call ──────────────────────
  if (action === 'list') {
    const [pkgRes, costRes, settingRes] = await Promise.all([
      supabase.from('credit_packages').select('*').order('sort_order', { ascending: true }),
      supabase.from('credit_costs').select('*').order('action_type', { ascending: true }),
      supabase.from('app_settings').select('value').eq('key', 'signup_bonus_credits').maybeSingle(),
    ]);
    if (pkgRes.error)  return { statusCode: 500, body: JSON.stringify({ error: pkgRes.error.message }) };
    if (costRes.error) return { statusCode: 500, body: JSON.stringify({ error: costRes.error.message }) };
    if (settingRes.error) return { statusCode: 500, body: JSON.stringify({ error: settingRes.error.message }) };

    const rawBonus = settingRes.data?.value;
    const signup_bonus = Number.isFinite(Number(rawBonus)) ? Number(rawBonus) : 240;

    return {
      statusCode: 200,
      body: JSON.stringify({
        packages: pkgRes.data || [],
        costs:    costRes.data || [],
        signup_bonus,
      }),
    };
  }

  // ── Create a new package ───────────────────────────────────────────────────
  if (action === 'create_package') {
    const p = body.package || {};
    const id = String(p.id || '').trim();
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'package.id is required' }) };
    if (!/^[a-z0-9_-]+$/.test(id)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'package.id must be lowercase letters, numbers, - or _ only' }) };
    }
    if (!p.label || typeof p.label !== 'string') return { statusCode: 400, body: JSON.stringify({ error: 'package.label is required' }) };
    if (!Number.isFinite(p.credits) || p.credits < 0) return { statusCode: 400, body: JSON.stringify({ error: 'package.credits must be a non-negative number' }) };
    if (!Number.isFinite(p.price_zar) || p.price_zar < 0) return { statusCode: 400, body: JSON.stringify({ error: 'package.price_zar must be a non-negative number' }) };

    const { data, error } = await supabase.from('credit_packages').insert({
      id,
      label:      p.label,
      credits:    p.credits,
      price_zar:  p.price_zar,
      note:       p.note ?? null,
      is_popular: !!p.is_popular,
      sort_order: Number.isFinite(p.sort_order) ? p.sort_order : 0,
      active:     p.active !== false,
    }).select().single();

    if (error) {
      if (error.code === '23505') return { statusCode: 409, body: JSON.stringify({ error: `A package with id "${id}" already exists.` }) };
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    await logAdminAction(supabase, { admin: auth.user, action: 'pricing_package_created', details: { package: data } });
    return { statusCode: 200, body: JSON.stringify({ success: true, package: data }) };
  }

  // ── Update an existing package ─────────────────────────────────────────────
  if (action === 'update_package') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };

    const patch = body.patch || {};
    const allowed = ['label', 'credits', 'price_zar', 'note', 'is_popular', 'sort_order', 'active'];
    const update = {};
    for (const key of allowed) if (key in patch) update[key] = patch[key];

    if ('credits' in update && (!Number.isFinite(update.credits) || update.credits < 0)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'credits must be a non-negative number' }) };
    }
    if ('price_zar' in update && (!Number.isFinite(update.price_zar) || update.price_zar < 0)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'price_zar must be a non-negative number' }) };
    }
    if (Object.keys(update).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'patch must include at least one editable field' }) };
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('credit_packages').update(update).eq('id', id).select().maybeSingle();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    if (!data) return { statusCode: 404, body: JSON.stringify({ error: `No package with id "${id}"` }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'pricing_package_updated', details: { id, patch: update } });
    return { statusCode: 200, body: JSON.stringify({ success: true, package: data }) };
  }

  // ── Delete a package ────────────────────────────────────────────────────────
  if (action === 'delete_package') {
    const id = body.id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };
    if (PROTECTED_PACKAGE_IDS.has(id)) {
      return { statusCode: 400, body: JSON.stringify({ error: `"${id}" is a core package other parts of the app rely on — deactivate it instead of deleting it (set Active off).` }) };
    }

    const { error } = await supabase.from('credit_packages').delete().eq('id', id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'pricing_package_deleted', details: { id } });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  // ── Update a per-action cost ────────────────────────────────────────────────
  if (action === 'update_cost') {
    const actionType = body.action_type;
    if (!actionType) return { statusCode: 400, body: JSON.stringify({ error: 'action_type required' }) };
    if (!KNOWN_ACTION_TYPES.has(actionType)) {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown action_type "${actionType}" — costs can only be set for action types deduct-credits.js actually charges for.` }) };
    }

    const patch = body.patch || {};
    const update = {};
    if ('cost' in patch) {
      if (!Number.isFinite(patch.cost) || patch.cost < 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'cost must be a non-negative number' }) };
      }
      update.cost = patch.cost;
    }
    if ('label' in patch) update.label = patch.label;
    if (Object.keys(update).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'patch must include cost and/or label' }) };
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('credit_costs').update(update).eq('action_type', actionType).select().maybeSingle();
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    if (!data) return { statusCode: 404, body: JSON.stringify({ error: `No cost row for action_type "${actionType}"` }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'pricing_cost_updated', details: { action_type: actionType, patch: update } });
    return { statusCode: 200, body: JSON.stringify({ success: true, cost: data }) };
  }

  // ── Update the signup bonus ──────────────────────────────────────────────────
  if (action === 'update_signup_bonus') {
    const value = body.value;
    if (!Number.isFinite(value) || value < 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'value must be a non-negative number' }) };
    }

    const { error } = await supabase.from('app_settings').upsert(
      { key: 'signup_bonus_credits', value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    await logAdminAction(supabase, { admin: auth.user, action: 'pricing_signup_bonus_updated', details: { value } });
    return { statusCode: 200, body: JSON.stringify({ success: true, signup_bonus: value }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
