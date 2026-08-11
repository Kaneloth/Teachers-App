/**
 * Netlify Function: backfill-town-coords (admin-only, one-off maintenance)
 *
 * Finds educators with a `town` set but missing town_lat/town_lng — this
 * happens for any account created before Onboarding.tsx started geocoding
 * the current town at signup. Those rows only ever got coordinates if the
 * person later manually re-saved their profile (ProfilePage.tsx's doSave()
 * is the only other place this ever happened), which — given the 30-day
 * edit lock — many accounts simply never did. Without town_lat/town_lng,
 * match-scan-core.js's 50km radius fallback silently can't work for that
 * person, even when an exact town-name/district match also fails (exactly
 * what broke the John Sibanda / Thabo Molele test pair).
 *
 * Writes results back via the same set_educator_geo_location RPC
 * ProfilePage.tsx / Onboarding.tsx already use — not a raw UPDATE — so
 * whatever else that RPC does stays consistent regardless of call site.
 *
 * Mirrors src/lib/geocode.js's exact 3-tier fallback (Photon → Open-Meteo →
 * Nominatim). Reimplemented here rather than imported, since that file is
 * a browser module (relative /.netlify/functions/geocode fetch — doesn't
 * resolve outside a browser). The Nominatim leg calls the real deployed
 * geocode function via an absolute URL instead of re-implementing
 * Nominatim access a second time, so User-Agent/rate-limit handling can't
 * drift out of sync between the two.
 *
 * POST /.netlify/functions/backfill-town-coords
 * Auth: admin only (requireAdmin.js)
 * Body: { limit?: number }  — defaults to 30, capped at 100 per call.
 *       Safe to call repeatedly: each successful geocode removes that row
 *       from the next call's candidate set automatically. Check the
 *       `remaining` count in the response to know whether to call again.
 *
 * Response: { processed, geocoded, skipped, failed, remaining, results: [...] }
 *   - skipped: town is the literal "Other" placeholder — not geocodable,
 *     needs the person to go back and pick/type a real town.
 *   - failed:  a real town name that no geocoder could resolve (typo,
 *     obscure/informal place name, etc.) — reason included per row.
 */

import { requireAdmin } from './lib/requireAdmin.js';

const SITE_URL = process.env.URL || 'https://crosssa.co.za';

async function tryGeocode(query) {
  // 1. Photon
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const geojson = await res.json();
      const feature = geojson?.features?.[0];
      if (feature) {
        const [longitude, latitude] = feature.geometry.coordinates;
        return { latitude, longitude, source: 'photon' };
      }
    }
  } catch { /* Photon unavailable */ }

  // 2. Open-Meteo
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const data = await res.json();
      const r = data?.results?.[0];
      if (r) return { latitude: r.latitude, longitude: r.longitude, source: 'open-meteo' };
    }
  } catch { /* Open-Meteo unavailable */ }

  // 3. Nominatim — via the real deployed proxy function (same one
  // geocode.js's browser-direct calls hit), not reimplemented here.
  try {
    const res = await fetch(
      `${SITE_URL}/.netlify/functions/geocode?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      const r = data?.[0];
      if (r) return { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon), source: 'nominatim' };
    }
  } catch { /* Nominatim unavailable */ }

  return null;
}

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }), headers };
  }

  const auth = await requireAdmin(event);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const limit = Math.min(Math.max(parseInt(body.limit, 10) || 30, 1), 100);

  // Candidates: has a town, missing at least one coordinate.
  const { data: candidates, error: fetchErr } = await supabase
    .from('educators')
    .select('id, user_id, full_name, town, district, current_province')
    .not('town', 'is', null)
    .neq('town', '')
    .or('town_lat.is.null,town_lng.is.null')
    .limit(limit);

  if (fetchErr) {
    return { statusCode: 500, body: JSON.stringify({ error: fetchErr.message }), headers };
  }

  if (!candidates?.length) {
    return {
      statusCode: 200,
      body: JSON.stringify({ processed: 0, geocoded: 0, skipped: 0, failed: 0, remaining: 0, results: [], message: 'Nothing to backfill.' }),
      headers,
    };
  }

  const results = [];
  let geocoded = 0, skipped = 0, failedCount = 0;

  for (const row of candidates) {
    // "Other" is the literal placeholder from the town picker, not a real
    // place name — attempting it would just waste a request and produce a
    // misleading "failed" result instead of an accurate "skipped".
    if (row.town.trim().toLowerCase() === 'other') {
      skipped++;
      results.push({
        id: row.id, full_name: row.full_name, town: row.town,
        status: 'skipped', reason: 'town is the literal "Other" placeholder — needs manual entry',
      });
      continue;
    }

    const target = [row.town, row.district, row.current_province, 'South Africa']
      .filter(Boolean)
      .join(', ');
    const coords = await tryGeocode(target);

    if (!coords) {
      failedCount++;
      results.push({
        id: row.id, full_name: row.full_name, town: row.town,
        status: 'failed', reason: 'no geocoder could resolve this location',
      });
    } else {
      const { error: rpcErr } = await supabase.rpc('set_educator_geo_location', {
        p_user_id: row.user_id,
        p_lng:     coords.longitude,
        p_lat:     coords.latitude,
      });
      if (rpcErr) {
        failedCount++;
        results.push({
          id: row.id, full_name: row.full_name, town: row.town,
          status: 'failed', reason: `RPC error: ${rpcErr.message}`,
        });
      } else {
        geocoded++;
        results.push({
          id: row.id, full_name: row.full_name, town: row.town,
          status: 'geocoded', source: coords.source,
          latitude: coords.latitude, longitude: coords.longitude,
        });
      }
    }

    // Small delay between rows — considerate of the free-tier services
    // even though most requests resolve on the first (Photon) attempt.
    // This runs as a background admin task, not something a user is
    // waiting on, so the extra time costs nothing real.
    await new Promise(r => setTimeout(r, 300));
  }

  const { count: remaining } = await supabase
    .from('educators')
    .select('id', { count: 'exact', head: true })
    .not('town', 'is', null)
    .neq('town', '')
    .or('town_lat.is.null,town_lng.is.null');

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: candidates.length,
      geocoded,
      skipped,
      failed: failedCount,
      remaining: remaining ?? 0,
      results,
    }),
    headers,
  };
};
