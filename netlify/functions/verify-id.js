/**
 * verify-id.js
 * Verifies a South African ID number (or passport number for text-only check)
 * against VerifyNow's /api/external/verify endpoint.
 * No authentication required — called during registration before account creation.
 */
const { randomUUID } = require('crypto');

const VERIFYNOW_API_KEY = process.env.VERIFYNOW_API_KEY;
// ⚠️ SANDBOX MODE — set VERIFYNOW_MODE=live in Netlify env vars to go live
const MODE = process.env.VERIFYNOW_MODE || 'sandbox';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!VERIFYNOW_API_KEY) {
    console.error('[verify-id] VERIFYNOW_API_KEY env var is not set');
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'Verification service not configured.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch {
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'Invalid request body.' }),
    };
  }

  // documentType: 'sa_id' | 'passport'  (defaults to 'sa_id')
  const { idNumber, documentType = 'sa_id' } = body;
  if (!idNumber) {
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'idNumber is required.' }),
    };
  }

  const cleanId = idNumber.trim().toUpperCase();

  // Build payload — SA ID uses said_verification, passport text uses document_authentication
  const payload = { mode: MODE };
  if (documentType === 'sa_id') {
    payload.reportType = 'said_verification';
    payload.idNumber = cleanId;
  } else {
    payload.reportType = 'document_authentication';
    payload.passportNumber = cleanId;
  }

  let vnResult, vnHttpStatus;
  try {
    const vnRes = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': VERIFYNOW_API_KEY,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    vnHttpStatus = vnRes.status;
    const text = await vnRes.text();
    console.log('[verify-id] VerifyNow HTTP=%d raw=%s', vnHttpStatus, text);
    try { vnResult = JSON.parse(text); }
    catch { vnResult = { _raw: text }; }

    if (!vnRes.ok) {
      const errMsg = vnResult?.message || vnResult?.error || `VerifyNow error HTTP ${vnHttpStatus}`;
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ verified: false, message: errMsg, _debug: vnResult }),
      };
    }
  } catch (err) {
    console.error('[verify-id] fetch error:', err);
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'Verification service unreachable. You may still continue.' }),
    };
  }

  // ── Interpret result using VerifyNow's nested structure ───────────────────
  let verified = false;
  let message = '';

  const reportKey = documentType === 'sa_id' ? 'said_verification' : 'document_authentication';
  const reportResult = vnResult.results?.[reportKey];

  if (reportResult) {
    if (
      reportResult.Status === 'Success' ||
      reportResult.realTimeResults?.Status === 'ID Number Valid'
    ) {
      verified = true;
      message = 'Identity verified successfully.';
    } else {
      message =
        reportResult.realTimeResults?.Status ||
        reportResult.message ||
        'Verification failed — check your details and try again.';
    }
  } else if (vnResult.success === true) {
    verified = true;
    message = 'Identity verified successfully.';
  } else {
    // Fallback for other response shapes
    verified =
      vnResult.status   === 'verified'  ||
      vnResult.verified === true         ||
      vnResult.result   === 'pass'       ||
      vnResult.result   === 'verified'   ||
      vnResult.data?.verified === true   ||
      vnResult.data?.status   === 'verified';
    message = verified
      ? 'Identity verified successfully.'
      : (vnResult.message || vnResult.reason || 'Could not verify identity. Check your details and try again.');
  }

  return {
    statusCode: 200, headers: CORS_HEADERS,
    body: JSON.stringify({ verified, message, _debug: vnResult }),
  };
};
