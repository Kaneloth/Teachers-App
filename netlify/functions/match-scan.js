/**
 * match-scan — manually triggered match scan (admin only).
 *
 * Triggered by:
 *   - POST /.netlify/functions/match-scan  (admin only, manual trigger from AdminTools)
 *
 * The automatic daily scan lives in match-scan-daily.js and shares the
 * same scanning logic via match-scan-core.js.
 */

import { supabase, runMatchScan } from './match-scan-core.js';

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }), headers };
    }

    // Auth — only admins may trigger manually. A missing/invalid token is
    // now always rejected (previously a missing Authorization header
    // skipped this check entirely, which let anyone trigger a scan).
    const jwt = (event.headers['authorization'] || '').replace('Bearer ', '').trim();
    if (!jwt) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }), headers };
    }
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user?.user_metadata?.is_admin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }), headers };
    }

    const result = await runMatchScan();
    return { statusCode: 200, body: JSON.stringify(result), headers };
  } catch (err) {
    console.error('[match-scan] Uncaught error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message || String(err) }),
      headers,
    };
  }
};
