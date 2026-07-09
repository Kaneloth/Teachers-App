/**
 * requireAdmin — shared auth middleware for admin-only Netlify functions
 *
 * Usage in any admin-*.js function:
 *
 *   import { requireAdmin } from './lib/requireAdmin.js';
 *
 *   export const handler = async (event) => {
 *     const auth = await requireAdmin(event);
 *     if (auth.error) return auth.error; // 401 or 403 response — return immediately
 *     const { user, supabase } = auth;   // verified admin user + service-role client
 *     ...
 *   };
 *
 * Place this file at: netlify/functions/lib/requireAdmin.js
 * (esbuild will bundle local relative imports automatically)
 *
 * SECURITY NOTE: admin status is checked against educators.is_admin (a real
 * DB column, writable only by service-role code) — NOT user.user_metadata.
 * user_metadata is client-writable: any signed-in user can call
 * supabase.auth.updateUser({ data: { is_admin: true } }) from their own
 * browser and flip that field for their own account. Trusting it here would
 * let any user self-grant admin access to every admin-*.js function. The
 * educators.is_admin column is safe ONLY if Row Level Security prevents
 * users from updating their own row's is_admin column — worth confirming
 * separately (e.g. `select relrowsecurity from pg_class where relname =
 * 'educators';` plus checking the actual UPDATE policy), since this check
 * moving to the DB column is necessary but not sufficient on its own.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export async function requireAdmin(event) {
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
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) } };
  }

  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) {
    return { error: { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) } };
  }

  // Verify admin status against the real DB column, not client-writable
  // user_metadata. See security note above.
  const { data: educatorRow, error: lookupErr } = await supabase
    .from('educators')
    .select('is_admin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (lookupErr) {
    console.error('[requireAdmin] educators lookup failed:', lookupErr);
    return { error: { statusCode: 500, body: JSON.stringify({ error: 'Could not verify admin status' }) } };
  }

  if (!educatorRow?.is_admin) {
    return { error: { statusCode: 403, body: JSON.stringify({ error: 'Forbidden — admin access required' }) } };
  }

  return { user, supabase };
}
