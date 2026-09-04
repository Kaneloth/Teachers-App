/**
 * lib/pricing.js — single source of truth for admin-configurable pricing:
 * credit packages, per-action credit costs, and the signup bonus.
 *
 * Replaces the old hardcoded PACKAGES map in lib/packages.js and the
 * hardcoded COSTS / FREE_CREDITS constants previously scattered across
 * deduct-credits.js, grant-signup-credits.js and purchase-credits.js.
 * Every value now lives in the database (credit_packages / credit_costs /
 * app_settings tables — see migration_pricing.sql) and is editable from
 * Admin → Money → Pricing (AdminPricing.tsx), via admin-pricing.js.
 *
 * No in-memory caching here on purpose: Netlify Functions are short-lived
 * per-invocation, so a module-level cache would just go stale between
 * deploys/cold-starts without a lot of extra invalidation plumbing for very
 * little benefit — these are simple indexed reads on tiny tables, not
 * expensive queries.
 *
 * Every function takes `supabase` as its first argument (the caller's own
 * client — usually the service-role client already created in each
 * function file) rather than constructing its own, so there's exactly one
 * Supabase client per function invocation.
 */

const SIGNUP_BONUS_FALLBACK = 240; // matches the value that was hardcoded before this table existed, in case the row is ever missing

/** All packages, active-only by default (what the purchase modal should show). */
export async function getPackages(supabase, { activeOnly = true } = {}) {
  let q = supabase.from('credit_packages').select('*').order('sort_order', { ascending: true });
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw new Error(`[pricing] getPackages failed: ${error.message}`);
  return data || [];
}

/**
 * A single package by id, regardless of active status — used at payment
 * time (initiate + webhook) so a package an admin has since deactivated
 * can still complete a payment that was already in flight against it.
 * Returns null if the id doesn't exist at all.
 */
export async function getPackage(supabase, id) {
  const { data, error } = await supabase.from('credit_packages').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`[pricing] getPackage(${id}) failed: ${error.message}`);
  return data;
}

/** All per-action credit costs as a { action_type: cost } map. */
export async function getCosts(supabase) {
  const { data, error } = await supabase.from('credit_costs').select('action_type, cost, label');
  if (error) throw new Error(`[pricing] getCosts failed: ${error.message}`);
  const costs = {};
  const labels = {};
  for (const row of data || []) { costs[row.action_type] = row.cost; labels[row.action_type] = row.label; }
  return { costs, labels };
}

/** A single action's cost, or null if that action_type has no row yet. */
export async function getCost(supabase, actionType) {
  const { data, error } = await supabase.from('credit_costs').select('cost').eq('action_type', actionType).maybeSingle();
  if (error) throw new Error(`[pricing] getCost(${actionType}) failed: ${error.message}`);
  return data ? data.cost : null;
}

/** The current signup bonus (credits granted to a brand-new user). */
export async function getSignupBonus(supabase) {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'signup_bonus_credits').maybeSingle();
  if (error) throw new Error(`[pricing] getSignupBonus failed: ${error.message}`);
  const v = data?.value;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : SIGNUP_BONUS_FALLBACK;
}
