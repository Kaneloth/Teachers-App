/**
 * Netlify Function: admin-archive-transactions
 *
 * Admin-only. Handles the financial-year "start fresh" workflow for the
 * transactions table:
 *   - preview:    how many live transactions exist right now (so the admin
 *                 can see what they're about to archive before confirming)
 *   - archive:    actually do it — copies every live row into
 *                 transactions_archive under the given financial_year
 *                 label, then empties transactions and resets its id
 *                 counter back to 1
 *   - list_years: which financial years have already been archived, and
 *                 how many transactions each one holds (for browsing
 *                 history / picking a year to view in the Transactions UI)
 *
 * Deploy path: netlify/functions/admin-archive-transactions.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              netlify/functions/lib/auditLog.js
 *              migration_transactions.sql already run against the DB
 *              (specifically the archive_transactions() Postgres function)
 *
 * POST body — one of:
 *   { action: 'preview' }
 *   { action: 'archive', financial_year: '2025/2026' }
 *   { action: 'list_years' }
 */

import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

// Deliberately loose — admins pick their own label format (calendar year,
// SA tax year, whatever matches how they actually think about "financial
// year"). We only care that it's non-empty and reasonably short, not that
// it matches a specific pattern.
function isValidYearLabel(label) {
  return typeof label === 'string' && label.trim().length > 0 && label.trim().length <= 32;
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

  // ── Preview: how many live transactions would this archive right now ──────
  if (action === 'preview') {
    const { count, error } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true });

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    // Also surface the earliest/latest dates in the live table so the
    // admin can see the actual date range they're about to archive, not
    // just a bare count.
    let earliest = null, latest = null;
    if ((count ?? 0) > 0) {
      const [firstRes, lastRes] = await Promise.all([
        supabase.from('transactions').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('transactions').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      earliest = firstRes.data?.created_at ?? null;
      latest = lastRes.data?.created_at ?? null;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ count: count ?? 0, earliest, latest }),
    };
  }

  // ── Archive: the actual "start fresh" action ────────────────────────────────
  if (action === 'archive') {
    const financial_year = (body.financial_year || '').trim();
    if (!isValidYearLabel(financial_year)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'financial_year is required (max 32 characters)' }) };
    }

    // Guard against accidentally archiving twice under the same label —
    // e.g. a double-click, or picking a year label that was already used.
    // This checks the ARCHIVE table (previously-archived years), not the
    // live table — running "archive" with an empty live table is harmless
    // and allowed (e.g. re-running on a day with zero transactions so far).
    const { count: existingCount, error: existingErr } = await supabase
      .from('transactions_archive')
      .select('id', { count: 'exact', head: true })
      .eq('financial_year', financial_year);

    if (existingErr) return { statusCode: 500, body: JSON.stringify({ error: existingErr.message }) };
    if ((existingCount ?? 0) > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: `"${financial_year}" has already been used for an archive (${existingCount} transactions). Choose a different label, or this was already done.` }),
      };
    }

    const { data: archivedCount, error: rpcErr } = await supabase.rpc('archive_transactions', {
      p_financial_year: financial_year,
    });

    if (rpcErr) {
      console.error('[admin-archive-transactions] archive_transactions RPC failed:', rpcErr);
      return { statusCode: 500, body: JSON.stringify({ error: rpcErr.message }) };
    }

    await logAdminAction(supabase, {
      admin: auth.user,
      action: 'transactions_archived',
      details: { financial_year, archived_count: archivedCount },
    });

    console.log(`[admin-archive-transactions] ${auth.user.email} archived ${archivedCount} transactions under "${financial_year}"`);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, archived_count: archivedCount ?? 0, financial_year }),
    };
  }

  // ── List years: browse archiving history ────────────────────────────────────
  if (action === 'list_years') {
    // Supabase's JS client can't GROUP BY directly — fetch the (small)
    // per-year rows we need and aggregate here. This table only grows by
    // one row per financial year per past transaction, so pulling
    // financial_year + created_at for aggregation is cheap even after
    // several years of history.
    const { data, error } = await supabase
      .from('transactions_archive')
      .select('financial_year, created_at')
      .order('created_at', { ascending: true });

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    const byYear = new Map();
    for (const row of data || []) {
      const entry = byYear.get(row.financial_year) || { financial_year: row.financial_year, count: 0, earliest: row.created_at, latest: row.created_at };
      entry.count += 1;
      if (row.created_at < entry.earliest) entry.earliest = row.created_at;
      if (row.created_at > entry.latest) entry.latest = row.created_at;
      byYear.set(row.financial_year, entry);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ years: Array.from(byYear.values()) }),
    };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
