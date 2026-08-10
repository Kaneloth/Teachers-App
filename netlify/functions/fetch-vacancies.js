/**
 * Netlify Function: fetch-vacancies — manually triggered vacancy refresh.
 *
 * Trigger: POST /.netlify/functions/fetch-vacancies
 * Auth:    Header  Authorization: Bearer <user's Supabase session JWT>
 *          Any logged-in user may trigger this (not admin-only) — the
 *          refresh button is exposed to all users so vacancies can be
 *          kept fresh even when the admin isn't available to do it.
 *          Verified via a direct call to Supabase's auth REST endpoint
 *          (no @supabase/supabase-js dependency needed, consistent with
 *          the rest of this file's raw-fetch approach).
 *
 * The actual fetch/upsert/cleanup logic lives in fetch-vacancies-core.js,
 * shared with vacancies-refresh-daily.js (the automatic scheduled
 * version) — same split as match-scan.js / match-scan-daily.js /
 * match-scan-core.js elsewhere in this repo.
 *
 * Converted from CommonJS (exports.handler) to ESM (export const handler)
 * to match every other function in this repo and clear the bundler
 * warning esbuild raised about mixing CommonJS syntax into an ESM
 * package ("type": "module" in package.json) — no behavior change.
 */

import { runVacanciesRefresh } from './fetch-vacancies-core.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/* ─── Auth: verify the caller's Supabase session JWT ────────────────────── */
async function verifyUser(event) {
  const jwt = (event.headers['authorization'] || event.headers['Authorization'] || '')
    .replace('Bearer ', '').trim();
  if (!jwt) return { error: 'Unauthorized — please log in' };

  try {
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!res.ok) return { error: 'Invalid or expired session — please log in again' };
    const user = await res.json();
    return { user };
  } catch (e) {
    return { error: `Auth check failed: ${e.message}` };
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Any logged-in user may trigger this — verified via their own Supabase
  // session JWT (no shared secret baked into frontend code, which would be
  // visible to anyone via browser dev tools since it's a VITE_-bundled var).
  const auth = await verifyUser(event);
  if (auth.error) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: auth.error }) };
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing Supabase env vars' }) };
  }

  try {
    const result = await runVacanciesRefresh();
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (e) {
    console.error('[fetch-vacancies] Fatal:', e);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: e.message }),
    };
  }
};
