/**
 * sms.js — shared BulkSMS sending helper.
 *
 * Used by match-scan-core.js to text educators when a new transfer match
 * is found. In-app notifications alone get missed by educators who stay
 * offline for long stretches, so this is a backup channel for the same
 * event — it never replaces the in-app notification, it only supplements it.
 *
 * Reuses the same BulkSMS Basic-Auth REST call already used by
 * send-otp.js. Env vars (already configured in Netlify for the OTP flow):
 *   BULKSMS_USERNAME
 *   BULKSMS_PASSWORD
 *
 * Unlike send-otp.js, there is no verification step here — a wrong number
 * just means that educator won't get matched, which is the trade-off
 * requested (no OTP loop at onboarding, just a double-entry field on the
 * form itself to catch typos before they're ever saved).
 */

const BULKSMS_USERNAME = process.env.BULKSMS_USERNAME;
const BULKSMS_PASSWORD = process.env.BULKSMS_PASSWORD;

/**
 * Normalises a South African number to E.164 ("+27...") so numbers stored
 * however the user typed them at onboarding ("071 000 0000", "+27 71 000
 * 0000", "27710000000", ...) all resolve to the same shape BulkSMS
 * expects. Returns null for anything that doesn't look like a usable
 * number at all, rather than silently sending to a malformed destination.
 */
export function normalisePhone(phone) {
  if (!phone) return null;
  let n = String(phone).trim().replace(/[\s-]/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '+27' + n.slice(1);
  if (!n.startsWith('+')) n = '+27' + n;
  return /^\+27\d{9}$/.test(n) ? n : null;
}

/**
 * Sends a single SMS via BulkSMS. Never throws — logs and returns false on
 * any failure (bad number, missing env vars, BulkSMS error/outage) so
 * callers can fire-and-continue without a texting problem ever blocking
 * the in-app notification, which is the primary channel and already
 * succeeded by the time this runs.
 */
export async function sendSms(phone, message) {
  const to = normalisePhone(phone);
  if (!to) return false;

  if (!BULKSMS_USERNAME || !BULKSMS_PASSWORD) {
    console.error('[sms] Missing BULKSMS_USERNAME/BULKSMS_PASSWORD env vars — skipping SMS send');
    return false;
  }

  try {
    const credentials = Buffer.from(`${BULKSMS_USERNAME}:${BULKSMS_PASSWORD}`).toString('base64');
    const res = await fetch('https://api.bulksms.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, body: message }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[sms] BulkSMS send failed for ${to}: ${res.status} ${err}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[sms] BulkSMS send threw for ${to}:`, err);
    return false;
  }
}

/**
 * Sends a batch of { phone, message } SMS jobs concurrently and returns
 * how many succeeded. Failures are logged individually by sendSms and
 * never thrown, so one bad number can't stop the rest of the batch.
 */
export async function sendSmsBatch(jobs) {
  if (!jobs.length) return 0;
  const results = await Promise.allSettled(jobs.map(j => sendSms(j.phone, j.message)));
  return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}
