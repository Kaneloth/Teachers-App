/**
 * Netlify Function: log-admin-usage
 *
 * Admin-only. Inserts a zero-cost credit_ledger entry when an admin
 * generates a CV or cover letter — admins bypass real credit deduction
 * (see useCredits.ts), but without this, their activity would be
 * invisible to the ledger entirely, including the public "CVs Created"
 * landing page stat (which counts credit_ledger rows where
 * type = 'cv_usage'). This keeps that count honest by including every
 * CV ever generated, not just ones that cost real credits.
 *
 * Deploy path: netlify/functions/log-admin-usage.js
 *
 * POST /.netlify/functions/log-admin-usage
 * Body: { type: 'cv_usage' | 'letter_usage', ref_id?: string }
 * Auth: Header Authorization: Bearer <admin's Supabase session JWT>
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const VALID_TYPES = ['cv_usage', 'letter_usage'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  // Only log for actual admins — this endpoint is not a general-purpose
  // free-CV logger for regular users.
  if (!user.user_metadata?.is_admin) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { type, ref_id } = body;
  if (!VALID_TYPES.includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unknown type "${type}"` }) };
  }

  const description = type === 'cv_usage'
    ? 'CV generated (admin — 0 credits, record only)'
    : 'Cover letter / AI action (admin — 0 credits, record only)';

  // Insert directly at amount: 0 — this does NOT touch the user's actual
  // balance (admins display 999999 client-side regardless), it's purely
  // an activity record so the public stats count is accurate.
  const { error: insertErr } = await supabase
    .from('credit_ledger')
    .insert([{
      user_id:     user.id,
      amount:      0,
      type,
      description,
      ref_id:      ref_id ?? null,
    }]);

  if (insertErr) {
    console.error('[log-admin-usage] error:', insertErr);
    return { statusCode: 500, body: JSON.stringify({ error: insertErr.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
