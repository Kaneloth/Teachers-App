/**
 * Netlify Function: geocode
 *
 * Proxies Nominatim (OpenStreetMap) searches server-side, since Nominatim's
 * usage policy requires a descriptive User-Agent and doesn't reliably allow
 * direct browser CORS requests. This is the 3rd/last fallback in
 * src/lib/geocode.js — Photon and Open-Meteo are tried first, browser-direct.
 *
 * Deploy path: netlify/functions/geocode.js
 *
 * GET /.netlify/functions/geocode?q=<place name>
 * Response: Nominatim's raw JSON array (same shape geocode.js expects):
 *   [{ lat, lon, name, address: { city/town/village, state, country, ... }, ... }]
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Nominatim's usage policy: max 1 request/sec, descriptive User-Agent required.
const USER_AGENT = 'Crosssa/1.0 (https://crosssa.co.za; contact: support@crosssa.co.za)';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const q = event.queryStringParameters?.q;
  if (!q || !q.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing q parameter' }) };
  }

  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&countrycodes=za`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    });

    if (!res.ok) {
      console.error('[geocode] Nominatim returned', res.status);
      return { statusCode: 502, body: JSON.stringify({ error: 'Geocoding service unavailable' }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[geocode] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Geocoding failed' }) };
  }
};
