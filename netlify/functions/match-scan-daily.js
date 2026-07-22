/**
 * match-scan-daily — automatic daily match scan.
 *
 * This is a Netlify Scheduled Function. Unlike my first version of this
 * file, it does NOT use the `schedule()` helper from '@netlify/functions'
 * — that package isn't in this project's package.json, and importing it
 * broke the build ("Could not resolve @netlify/functions").
 *
 * Instead, this follows the same convention this repo already uses for
 * monthly-pro-credits.js: a plain handler, scheduled entirely via
 * netlify.toml. Add a matching entry there:
 *
 *   [functions."match-scan-daily"]
 *     schedule = "0 2 * * *"   # every day at 02:00 UTC — adjust as you like
 *     timeout  = 30
 *
 * Netlify enforces the schedule and rejects direct external HTTP calls to
 * a scheduled function in production, so — same as before — no admin/auth
 * check is needed here, unlike match-scan.js (the manually-triggered one).
 */

import { runMatchScan } from './match-scan-core.js';

export const handler = async () => {
  try {
    const result = await runMatchScan();
    console.log('[match-scan-daily] Scan complete:', result);
  } catch (err) {
    // Scheduled functions have no caller to report errors to — log loudly
    // so it shows up in Netlify's function logs / any log-drain alerting.
    console.error('[match-scan-daily] Uncaught error:', err);
  }
  // Scheduled functions must return a 200 response.
  return { statusCode: 200 };
};