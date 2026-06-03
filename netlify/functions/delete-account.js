/**
 * delete-account.js
 *
 * Permanently deletes the authenticated user's account.
 * Uses the Supabase service role key (admin) to remove the user
 * from auth.users, which cascades to profiles and related rows.
 *
 * Trigger: POST /.netlify/functions/delete-account
 * Auth:    Header  Authorization: Bearer <supabase_access_token>
 *
 * Env vars:
 *   VITE_SUPABASE_URL              — Supabase project URL
 *   VITE_SUPABASE_SERVICE_ROLE_KEY — Service role key (never exposed to client)
 */

exports.handler = async (event) => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method not allowed' };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Missing auth token' }) };

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  try {
    /* 1. Resolve the user ID from their access token */
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SERVICE_ROLE_KEY,
      },
    });

    if (!userRes.ok) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid or expired session' }) };
    }

    const { id: userId } = await userRes.json();

    /* 2. Delete the user via admin API (cascades to profiles etc.) */
    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    });

    if (!deleteRes.ok) {
      const err = await deleteRes.text();
      return { statusCode: deleteRes.status, headers: CORS, body: JSON.stringify({ error: err }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
