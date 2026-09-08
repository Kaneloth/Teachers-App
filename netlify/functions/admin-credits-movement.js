/**
 * Netlify Function: admin-credits-movement
 *
 * Admin-only. Lists/filters/paginates/exports credit MOVEMENTS — what
 * activities move credits, and in which direction — sourced from
 * credit_ledger_with_names (see migration_credit_ledger_view.sql).
 *
 * Always excludes:
 *   - type = 'signup_bonus'      (explicitly requested: not a "movement"
 *                                  in the sense being tracked here)
 *   - type = 'messaging_unlock'  (these rows are always amount = 0 — zero
 *                                  credits moving isn't a credit movement,
 *                                  it's a record of a real Rand payment,
 *                                  which is what the Transactions table is
 *                                  for. My call, not explicitly requested —
 *                                  flag it if you'd rather these stayed in.)
 * These exclusions are hardcoded, not user-toggleable filters, since they
 * were specified as "never show these" rather than "default off".
 *
 * Deploy path: netlify/functions/admin-credits-movement.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              migration_credit_ledger_view.sql
 *
 * POST body:
 *   {
 *     action: 'list' | 'export',
 *     page?: number,                     // 1-based, 'list' only (default 1)
 *     pageSize?: number,                 // 10 | 50 | 100, 'list' only (default 10)
 *     filters?: {
 *       name?: string,                   // partial match on user_full_name
 *       user_id?: string,                // exact match
 *       type?: string,                   // exact match — 'purchase' | 'cv_usage' | 'letter_usage' | 'admin_adjustment' | ...
 *       reason?: string,                 // partial match on description, free-text search
 *       amount_min?: number,
 *       amount_max?: number,
 *       date_from?: string,              // ISO date, inclusive
 *       date_to?: string,                // ISO date, inclusive
 *     }
 *   }
 */

import { requireAdmin } from './lib/requireAdmin.js';

const MAX_EXPORT_ROWS = 10000;
const EXCLUDED_TYPES = ['signup_bonus', 'messaging_unlock'];

function applyFilters(query, filters = {}) {
  if (filters.name)     query = query.ilike('user_full_name', `%${filters.name}%`);
  if (filters.user_id)  query = query.eq('user_id', filters.user_id);
  if (filters.type)     query = query.eq('type', filters.type);
  if (filters.reason)   query = query.ilike('description', `%${filters.reason}%`);
  if (filters.amount_min != null) query = query.gte('amount', filters.amount_min);
  if (filters.amount_max != null) query = query.lte('amount', filters.amount_max);
  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) {
    const end = new Date(filters.date_to);
    end.setHours(23, 59, 59, 999);
    query = query.lte('created_at', end.toISOString());
  }
  return query;
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

  const { action, filters = {} } = body;

  if (action === 'list') {
    const page = Math.max(1, Number(body.page) || 1);
    const pageSizeRaw = Number(body.pageSize) || 10;
    const pageSize = [10, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('credit_ledger_with_names')
      .select('*', { count: 'exact' })
      .not('type', 'in', `(${EXCLUDED_TYPES.join(',')})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    query = applyFilters(query, filters);

    const { data, error, count } = await query;
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    return {
      statusCode: 200,
      body: JSON.stringify({
        rows: data || [],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      }),
    };
  }

  if (action === 'export') {
    let query = supabase
      .from('credit_ledger_with_names')
      .select('*')
      .not('type', 'in', `(${EXCLUDED_TYPES.join(',')})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MAX_EXPORT_ROWS);

    query = applyFilters(query, filters);

    const { data, error } = await query;
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    return {
      statusCode: 200,
      body: JSON.stringify({ rows: data || [], truncated: (data || []).length >= MAX_EXPORT_ROWS }),
    };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
