/**
 * Netlify Function: admin-maintenance
 *
 * Admin-only. Reads or toggles the `maintenance_mode` flag in app_settings
 * — the same flag netlify/edge-functions/maintenance-gate.ts checks on
 * every request. Toggling here takes effect site-wide within ~15 seconds
 * (the edge function's cache TTL), no redeploy required.
 *
 * Deploy path: netlify/functions/admin-maintenance.js
 * Requires:    netlify/functions/lib/requireAdmin.js
 *              netlify/functions/lib/auditLog.js
 *              migration_maintenance_mode.sql already run against the DB
 *
 * POST body:
 *   { action: 'get' }
 *   { action: 'set', enabled: true | false }
 */

import { requireAdmin } from './lib/requireAdmin.js';
import { logAdminAction } from './lib/auditLog.js';

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

  if (action === 'get') {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'maintenance_mode')
      .maybeSingle();

    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    return {
      statusCode: 200,
      body: JSON.stringify({
        enabled: data?.value === true,
        updated_at: data?.updated_at ?? null,
      }),
    };
  }

  if (action === 'set') {
    const enabled = !!body.enabled;

    const { error } = await supabase.from('app_settings').upsert(
      { key: 'maintenance_mode', value: enabled, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

    await logAdminAction(supabase, {
      admin: auth.user,
      action: 'maintenance_mode_toggled',
      details: { enabled },
    });

    console.log(`[admin-maintenance] ${auth.user.email} set maintenance_mode=${enabled}`);

    return { statusCode: 200, body: JSON.stringify({ success: true, enabled }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: `Unknown action "${action}"` }) };
};
