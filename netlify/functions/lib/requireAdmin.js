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

  if (!user.user_metadata?.is_admin) {
    return { error: { statusCode: 403, body: JSON.stringify({ error: 'Forbidden — admin access required' }) } };
  }

  return { user, supabase };
}
