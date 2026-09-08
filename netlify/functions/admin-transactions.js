/**
 * Netlify Function: admin-transactions
 *
 * Admin-only. Lists/filters/paginates/exports the Transactions table —
 * real Rand-value money flows (credit purchases, messaging unlocks).
 * Reads from transactions_with_names / transactions_archive_with_names
 * (see migration_transactions_views.sql) so results already carry the
 * user's name alongside their id, without a manual two-step lookup.
 *
 * Deploy path: netlify/functions/admin-transactions.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              migration_transactions.sql
 *              migration_transactions_views.sql
 *
 * POST body:
 *   {
 *     action: 'list' | 'export',
 *     source: 'live' | 'archive',       // default 'live'
 *     financial_year?: string,           // required when source = 'archive'
 *     page?: number,                     // 1-based, 'list' only (default 1)
 *     pageSize?: number,                 // 10 | 50 | 100, 'list' only (default 10)
 *     filters?: {
 *       name?: string,                   // partial match on user_full_name
 *       user_id?: string,                // exact match
 *       package_id?: string,             // exact match — 'standard' | 'business' | 'chat_unlock' | ...
 *       reason?: string,                 // partial match, for free-text search over reason
 *       amount_min?: number,
 *       amount_max?: number,
 *       balance_min?: number,
 *       balance_max?: number,
 *       date_from?: string,              // ISO date, inclusive
 *       date_to?: string,                // ISO date, inclusive
 *     }
 *   }
 */

import { requireAdmin } from './lib/requireAdmin.js';

const MAX_EXPORT_ROWS = 10000; // safety cap — see note in applyFilters below

function applyFilters(query, filters = {}) {
  if (filters.name)        query = query.ilike('user_full_name', `%${filters.name}%`);
  if (filters.user_id)     query = query.eq('user_id', filters.user_id);
  if (filters.package_id)  query = query.eq('package_id', filters.package_id);
  if (filters.reason)      query = query.ilike('reason', `%${filters.reason}%`);
  if (filters.amount_min != null)  query = query.gte('amount', filters.amount_min);
  if (filters.amount_max != null)  query = query.lte('amount', filters.amount_max);
  if (filters.balance_min != null) query = query.gte('balance_after', filters.balance_min);
  if (filters.balance_max != null) query = query.lte('balance_after', filters.balance_max);
  if (filters.date_from)   query = query.gte('created_at', filters.date_from);
  if (filters.date_to) {
    // Treat date_to as inclusive of the whole day, not just 00:00:00 on
    // that date — otherwise "filter up to today" would silently exclude
    // every transaction that happened today.
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
  const source = body.source === 'archive' ? 'archive' : 'live';

  if (source === 'archive' && !body.financial_year) {
    return { statusCode: 400, body: JSON.stringify({ error: 'financial_year is required when source is "archive"' }) };
  }

  const table = source === 'archive' ? 'transactions_archive_with_names' : 'transactions_with_names';

  if (action === 'list') {
    const page = Math.max(1, Number(body.page) || 1);
    const pageSizeRaw = Number(body.pageSize) || 10;
    const pageSize = [10, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(table)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false }) // latest first
      .order('id', { ascending: false })          // tie-break for same-timestamp rows, keeps ordering stable across pages
      .range(from, to);

    if (source === 'archive') query = query.eq('financial_year', body.financial_year);
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
    // Exports EVERY matching row (not just the current page) — a CSV
    // export that only contained the visible page would be a confusing,
    // near-useless financial record. Capped at MAX_EXPORT_ROWS as a
    // sanity guard against an unbounded export accidentally locking up
    // the function on a very large, very unfiltered table; a real-world
    // export narrowed by date range will be far below this in practice.
    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MAX_EXPORT_ROWS);

    if (source === 'archive') query = query.eq('financial_year', body.financial_year);
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
