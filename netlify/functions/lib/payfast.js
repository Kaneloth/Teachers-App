/**
 * payfast — shared PayFast helpers (signature generation, URLs, encoding)
 * Place at: netlify/functions/lib/payfast.js
 *
 * Env vars used:
 *   PAYFAST_MERCHANT_ID   — your merchant ID (sandbox: 10000100)
 *   PAYFAST_MERCHANT_KEY  — your merchant key (sandbox: 46f0cd694581a)
 *   PAYFAST_PASSPHRASE    — passphrase set in PayFast dashboard → Integration
 *   PAYFAST_MODE          — 'sandbox' (default) or 'live'
 *   SITE_URL              — your production domain, default https://crosssa.co.za
 */

import crypto from 'crypto';

export const PAYFAST_MODE = (process.env.PAYFAST_MODE || 'sandbox').toLowerCase();
export const PAYFAST_HOST = PAYFAST_MODE === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
export const PAYFAST_PROCESS_URL  = `https://${PAYFAST_HOST}/eng/process`;
export const PAYFAST_VALIDATE_URL = `https://${PAYFAST_HOST}/eng/query/validate`;

export const SITE_URL = process.env.SITE_URL || 'https://crosssa.co.za';

// PayFast requires PHP-style urlencoding: spaces become '+', and PHP's
// urlencode() encodes everything except A-Z a-z 0-9 - _ . — including
// ! ~ * ' ( ) which JS's encodeURIComponent leaves un-encoded by default.
// Without this extra step, a passphrase or field value containing any of
// those characters produces a signature mismatch with PayFast.
export function pfEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Generate the MD5 signature PayFast expects.
 *
 * `fields` must be a plain object whose key ORDER matches the order PayFast
 * expects (for outgoing payment forms, follow PayFast's documented field
 * order; for incoming ITN webhooks, use the order the fields were received
 * in — JS objects built from URLSearchParams preserve insertion order).
 *
 * Algorithm: concatenate "key=urlencoded(value)" pairs with '&', skipping
 * empty/undefined values and the 'signature' field itself, then append
 * "&passphrase=urlencoded(passphrase)" if a passphrase is configured,
 * then MD5-hash the resulting string.
 */
/**
 * Build the raw string that gets MD5-hashed for the PayFast signature.
 * Exposed separately so it can be logged for debugging without exposing
 * the passphrase itself.
 */
export function buildSignatureString(fields, passphrase) {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'signature') continue;
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join('&');
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return str;
}

export function generateSignature(fields, passphrase) {
  const str = buildSignatureString(fields, passphrase);
  return crypto.createHash('md5').update(str).digest('hex');
}
