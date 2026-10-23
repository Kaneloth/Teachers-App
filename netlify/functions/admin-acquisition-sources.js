/**
 * Netlify Function: admin-acquisition-sources
 *
 * Admin-only. Aggregates the "How did you hear about us?" answers
 * (public.signup_sources, see migration_signup_sources.sql) for a date range.
 *
 * Deploy path: netlify/functions/admin-acquisition-sources.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *
 * POST { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' }   (inclusive, SAST days)
 *
 * Returns { success, total, answered, skipped, by_source: [{source,count}],
 *           by_day: [{day, <source>: n, ...}], others: [{text, created_at}] }
 */

import { requireAdmin } from './lib/requireAdmin.js';

const DAY_OFFSET = '+02:00'; // South Africa

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }

  const isDay = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

  let q = supabase
    .from('signup_sources')
    .select('source, source_other, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);
  if (isDay(body.from)) q = q.gte('created_at', `${body.from}T00:00:00${DAY_OFFSET}`);
  if (isDay(body.to))   q = q.lte('created_at', `${body.to}T23:59:59.999${DAY_OFFSET}`);

  const { data, error } = await q;
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

  const rows = data ?? [];
  const bySource = {};
  const byDay = {};
  const others = [];
  let skipped = 0;

  for (const r of rows) {
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.source === 'skipped') skipped += 1;

    // Bucket by South African calendar day
    const day = new Date(new Date(r.created_at).getTime() + 2 * 3600 * 1000).toISOString().slice(0, 10);
    const d = (byDay[day] ??= { day });
    d[r.source] = (d[r.source] || 0) + 1;

    if (r.source === 'other' && r.source_other) {
      others.push({ text: r.source_other, created_at: r.created_at });
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: true,
      total: rows.length,
      answered: rows.length - skipped,
      skipped,
      by_source: Object.entries(bySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      by_day: Object.values(byDay).sort((a, b) => (a.day < b.day ? 1 : -1)),
      others: others.slice(0, 100),
    }),
  };
};
