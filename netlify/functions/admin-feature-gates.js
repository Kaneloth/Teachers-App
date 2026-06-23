/**
 * admin-feature-gates.js — read and write feature gate toggles
 *
 * GET  /.netlify/functions/admin-feature-gates
 *      Returns { global: Gate[], perUser: Gate[] }
 *
 * POST /.netlify/functions/admin-feature-gates
 *      Body: { gate_key, user_id?, enabled }
 *      Sets a global (user_id omitted/null) or per-user gate
 *
 * DELETE /.netlify/functions/admin-feature-gates
 *      Body: { gate_key, user_id }
 *      Removes a per-user override (falls back to global)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
);

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  // Verify admin JWT
  const jwt = (event.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }), headers };
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user?.user_metadata?.is_admin) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }), headers };
  }

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('feature_gates')
      .select('*')
      .order('gate_key');
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };

    const global  = (data || []).filter(g => !g.user_id);
    const perUser = (data || []).filter(g => !!g.user_id);
    return { statusCode: 200, body: JSON.stringify({ global, perUser }), headers };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { gate_key, user_id, enabled } = body;
    if (!gate_key || enabled === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: 'gate_key and enabled required' }), headers };
    }

    const { error } = await supabase.from('feature_gates').upsert(
      { gate_key, user_id: user_id || null, enabled: !!enabled, updated_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'gate_key,user_id' }
    );
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
    return { statusCode: 200, body: JSON.stringify({ success: true }), headers };
  }

  if (event.httpMethod === 'DELETE') {
    const body = JSON.parse(event.body || '{}');
    const { gate_key, user_id } = body;
    if (!gate_key || !user_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'gate_key and user_id required for DELETE' }), headers };
    }
    const { error } = await supabase.from('feature_gates')
      .delete().eq('gate_key', gate_key).eq('user_id', user_id);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }), headers };
    return { statusCode: 200, body: JSON.stringify({ success: true }), headers };
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }), headers };
};
