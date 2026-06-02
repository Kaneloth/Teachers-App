/**
 * verify-passport.js
 * Verifies a passport (or SA ID card) via uploaded front + back images.
 * Uses VerifyNow's /api/external/id-document-verify endpoint.
 * No authentication required — called during registration.
 *
 * Uses a manual multipart builder (no npm deps, no native FormData/Blob)
 * to ensure compatibility across all Netlify Node runtimes.
 */
const crypto = require('crypto');

const VERIFYNOW_API_KEY = process.env.VERIFYNOW_API_KEY;
// ⚠️ SANDBOX MODE — set VERIFYNOW_MODE=live in Netlify env vars to go live
const MODE = process.env.VERIFYNOW_MODE || 'sandbox';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ── Manual multipart builder (pure Node buffers, no FormData/Blob) ───────────
function buildMultipart(textFields, fileFields) {
  const boundary = `----VNBdy${Date.now().toString(16)}`;
  const CRLF = '\r\n';
  const parts = [];

  for (const [name, value] of Object.entries(textFields)) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`
    ));
  }
  for (const { name, buffer, filename } of fileFields) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"; filename="${filename}"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`
    ));
    parts.push(buffer);
    parts.push(Buffer.from(CRLF));
  }
  parts.push(Buffer.from(`--${boundary}--${CRLF}`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ── Generic HTTPS request (no npm fetch dependency) ───────────────────────────
const https = require('https');

function httpsRequest(method, url, reqHeaders, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers: reqHeaders },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(text); } catch { json = { _raw: text }; }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, json, text });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!VERIFYNOW_API_KEY) {
    console.error('[verify-passport] VERIFYNOW_API_KEY env var is not set');
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

  const { frontBase64, backBase64 } = body;
  if (!frontBase64 || !backBase64) {
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'Both front and back images are required.' }),
    };
  }

  // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
  const toBuffer = b64 => Buffer.from(b64.includes(',') ? b64.split(',')[1] : b64, 'base64');
  const frontBuf = toBuffer(frontBase64);
  const backBuf  = toBuffer(backBase64);

  console.log('[verify-passport] Image sizes: front=%dB back=%dB', frontBuf.length, backBuf.length);

  const textFields = { bundle: 'id_document_verification' };
  if (MODE === 'sandbox') textFields.mode = 'sandbox';

  const { body: formBody, contentType } = buildMultipart(textFields, [
    { name: 'front_image', buffer: frontBuf, filename: 'passport-front.jpg' },
    { name: 'back_image',  buffer: backBuf,  filename: 'passport-back.jpg'  },
  ]);

  console.log('[verify-passport] Multipart built: %dB', formBody.length);

  let vnRes;
  try {
    vnRes = await httpsRequest('POST',
      'https://www.verifynow.co.za/api/external/id-document-verify',
      {
        'x-api-key':      VERIFYNOW_API_KEY,
        'Idempotency-Key': uuid(),
        'Content-Type':   contentType,
        'Content-Length': formBody.length,
      },
      formBody,
    );
  } catch (err) {
    console.error('[verify-passport] Network error:', err.message);
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: 'Verification service unreachable. You may still continue.' }),
    };
  }

  const vn = vnRes.json;
  console.log('[verify-passport] VerifyNow HTTP=%d response=%s', vnRes.status, JSON.stringify(vn));

  if (!vnRes.ok) {
    const errMsg = vn?.message || vn?.error || (Array.isArray(vn?.errors) ? vn.errors.join(', ') : null) || `HTTP ${vnRes.status}`;
    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ verified: false, message: `Verification failed: ${errMsg}`, _debug: vn }),
    };
  }

  // ── Interpret result using VerifyNow's nested structure ───────────────────
  const isVerified =
    vn.results?.id_document_verification?.Status === 'Success' ||
    vn.results?.id_document_verification?.status === 'success' ||
    vn.success   === true       ||
    vn.status    === 'completed'||
    vn.status    === 'verified' ||
    vn.status    === 'success'  ||
    vn.verified  === true       ||
    vn.result?.status === 'success' ||
    vn.data?.status   === 'verified';

  const message = isVerified
    ? 'Passport documents verified successfully.'
    : (vn.message || vn.reason || vn.results?.id_document_verification?.Message ||
       'Passport could not be verified. Ensure both photos are clear and try again.');

  return {
    statusCode: 200, headers: CORS_HEADERS,
    body: JSON.stringify({ verified: isVerified, message, _debug: vn }),
  };
};
