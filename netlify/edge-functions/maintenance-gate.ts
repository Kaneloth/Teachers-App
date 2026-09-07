/**
 * netlify/edge-functions/maintenance-gate.ts
 *
 * Checks the admin-toggleable `maintenance_mode` flag (app_settings table)
 * on every request and, if it's on, rewrites to /maintenance.html — same
 * static page built earlier, just now driven by a database flag instead
 * of a static _redirects on/off block that needed a redeploy to change.
 *
 * Replaces the "MAINTENANCE MODE ON" block that used to live in
 * _redirects. The functions-passthrough and bypass-page passthrough rules
 * in _redirects are harmless to keep (defense in depth) but this file is
 * now the actual source of truth for whether maintenance mode is active.
 *
 * Toggle it from Admin → Tools (AdminTools.tsx) via admin-maintenance.js,
 * which writes to the same app_settings row this reads from.
 */
import type { Config, Context } from "@netlify/edge-functions";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

const BYPASS_COOKIE = "crosssa_maintenance_bypass";

// Re-check at most this often per warm edge-function instance. This cache
// is module-scope, not shared globally across every Netlify edge location
// — different regions may briefly disagree for up to this long right
// after a toggle. That's an acceptable trade-off for a maintenance switch
// (it doesn't need to be instant-and-globally-consistent to the second)
// in exchange for not hitting Supabase on every single page load.
const CACHE_TTL_MS = 15_000;

let cached: { enabled: boolean; at: number } | null = null;

async function isMaintenanceModeOn(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.enabled;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[maintenance-gate] Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars — failing open (site stays up)");
    return false;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.maintenance_mode&select=value`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
    const rows = await res.json();
    const enabled = rows?.[0]?.value === true;
    cached = { enabled, at: Date.now() };
    return enabled;
  } catch (err) {
    // Fail OPEN — a transient Supabase error should never accidentally
    // take the whole live site down. Fall back to the last known value if
    // we have one, otherwise assume maintenance mode is off.
    console.error("[maintenance-gate] Failed to check maintenance_mode, failing open:", err);
    return cached?.enabled ?? false;
  }
}

export default async (request: Request, context: Context) => {
  const path = new URL(request.url).pathname;

  // Belt-and-suspenders explicit exemptions, in addition to the
  // excludedPath config below — these three must NEVER be gated, or you
  // could lock yourself out of the bypass page too, or break payment
  // webhooks.
  if (
    path.startsWith("/.netlify/functions/") ||
    path === "/maintenance.html" ||
    path === "/maintenance-access.html"
  ) {
    return;
  }

  // Already has the bypass cookie (set by visiting
  // maintenance-access.html?key=... with the correct secret) — let them
  // through to the real site regardless of the maintenance_mode flag.
  if (context.cookies.get(BYPASS_COOKIE)) {
    return;
  }

  if (await isMaintenanceModeOn()) {
    return context.rewrite("/maintenance.html");
  }

  // Normal operation — fall through to the real site.
};

export const config: Config = {
  path: "/*",
  // Skip this function entirely for static assets — no point paying the
  // (cached, but non-zero) cost of a maintenance check on every JS/CSS/
  // image/font request. Page navigations still always run through here.
  excludedPath: [
    "/.netlify/functions/*",
    "/assets/*",
    "/*.js",
    "/*.css",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.svg",
    "/*.webp",
    "/*.ico",
    "/*.woff",
    "/*.woff2",
    "/*.json",
    "/*.txt",
    "/*.xml",
  ],
};
