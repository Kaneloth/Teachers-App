/**
 * vacancies-refresh-daily — automatic daily vacancy refresh + cleanup.
 *
 * This is a Netlify Scheduled Function: Netlify itself invokes it on the
 * cron schedule configured in netlify.toml (same convention this repo
 * already uses for match-scan-daily.js and monthly-pro-credits.js — a
 * plain handler, scheduled entirely via config, not the `schedule()`
 * helper from '@netlify/functions', which isn't a project dependency).
 * Netlify enforces the schedule and rejects direct external HTTP calls to
 * a scheduled function in production, so no admin/auth check is needed
 * here — unlike fetch-vacancies.js (the manually-triggered one), which
 * requires a logged-in user's session token.
 *
 * Add a matching entry to netlify.toml:
 *
 *   [functions."vacancies-refresh-daily"]
 *     schedule = "0 3 * * *"   # every day at 03:00 UTC — adjust as you like
 *     timeout  = 26
 *
 * Without this, vacancies only ever get refreshed/cleaned up when some
 * logged-in user happens to tap the in-app Refresh button.
 */

import { runVacanciesRefresh } from './fetch-vacancies-core.js';

export const handler = async () => {
  try {
    const result = await runVacanciesRefresh();
    console.log('[vacancies-refresh-daily] Done:', {
      total: result.total,
      removed: result.removed,
      sources: result.sources,
    });
  } catch (err) {
    // Scheduled functions have no caller to report errors to — log loudly
    // so it shows up in Netlify's function logs / any log-drain alerting.
    console.error('[vacancies-refresh-daily] Uncaught error:', err);
  }
  // Scheduled functions must return a 200 response.
  return { statusCode: 200 };
};
