/**
 * match-scan-daily — automatic daily match scan.
 *
 * This is a Netlify Scheduled Function: Netlify itself invokes it on the
 * cron schedule below (no manual HTTP trigger is possible in production —
 * Netlify rejects direct calls to scheduled functions from the outside,
 * so no admin/auth check is needed here, unlike match-scan.js).
 *
 * Docs: https://docs.netlify.com/functions/scheduled-functions/
 *
 * Schedule: "@daily" runs once every day at 00:00 UTC. Change the cron
 * expression below if you'd prefer a different time, e.g. "0 3 * * *"
 * for 03:00 UTC.
 */

import { schedule } from '@netlify/functions';
import { runMatchScan } from './match-scan-core.js';

const dailyScan = async () => {
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

export const handler = schedule('@daily', dailyScan);
