/**
 * requireUser — shared auth middleware for functions any logged-in user
 * may call (not admin-only). Verifies the Supabase session JWT but does
 * NOT check is_admin — use requireAdmin.js instead for admin-only routes.
 *
 * Usage:
 *
 *   const { requireUser } = require('./lib/requireUser.js');
 *
 *   exports.handler = async (event) => {
 *     const auth = await requireUser(event);
 *     if (auth.error) return auth.error; // 401 response — return immediately
 *     const { user, supabase } = auth;   // verified user + service-role client
 *     ...
 *   };
 *
 * Place this file at: netlify/functions/lib/requireUser.js
 * (CommonJS — matches fetch-vacancies.js's module style; requireAdmin.js
 * uses ESM for admin-only routes, this is the analogous helper for routes
 * any logged-in user, not just admins, should be able to call.)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function requireUser(event) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server misconfigured — missing Supabase env vars' }),
      },
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!jwt) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized — please log in' }) } };
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired session — please log in again' }) } };
  }

  return { user, supabase };
}

module.exports = { requireUser };
