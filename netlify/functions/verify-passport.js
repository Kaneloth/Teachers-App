const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let passportNumber, frontBase64, frontType, backBase64, backType;
  try {
    ({ passportNumber, frontBase64, frontType, backBase64, backType } = JSON.parse(event.body));
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Invalid request body' }),
    };
  }

  if (!frontBase64 || !backBase64) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Both front and back images are required' }),
    };
  }

  const apiKey = process.env.VERIFYNOW_API_KEY;
  if (!apiKey) {
    console.error('[verify-passport] VERIFYNOW_API_KEY env var is not set');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Verification service not configured (missing API key)' }),
    };
  }

  const mode = process.env.VERIFYNOW_MODE || 'sandbox';
  const idempotencyKey = `passport-${crypto.createHash('md5').update((passportNumber || '') + Date.now()).digest('hex')}`;

  const frontBuffer = Buffer.from(frontBase64, 'base64');
  const backBuffer  = Buffer.from(backBase64,  'base64');
  const frontBlob   = new Blob([frontBuffer], { type: frontType || 'image/jpeg' });
  const backBlob    = new Blob([backBuffer],  { type: backType  || 'image/jpeg' });

  const formData = new FormData();
  formData.append('bundle', 'id_document_verification');
  formData.append('mode', mode);
  formData.append('front_image', frontBlob, 'front.jpg');
  formData.append('back_image',  backBlob,  'back.jpg');

  let vnData;
  try {
    const vnRes = await fetch('https://www.verifynow.co.za/api/external/id-document-verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Idempotency-Key': idempotencyKey,
        // No Content-Type — fetch sets multipart/form-data boundary automatically
      },
      body: formData,
    });

    const text = await vnRes.text();
    try {
      vnData = JSON.parse(text);
    } catch {
      console.error('[verify-passport] Non-JSON response from VerifyNow:', text);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: false, error: `VerifyNow error (HTTP ${vnRes.status})`, details: text }),
      };
    }

    if (!vnRes.ok) {
      console.error('[verify-passport] VerifyNow returned', vnRes.status, vnData);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verified: false,
          error: vnData?.message || vnData?.error || `VerifyNow returned HTTP ${vnRes.status}`,
          details: vnData,
        }),
      };
    }
  } catch (err) {
    console.error('[verify-passport] Fetch error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Could not reach VerifyNow: ' + err.message }),
    };
  }

  const verified =
    vnData?.verified === true ||
    vnData?.result?.verified === true ||
    vnData?.data?.verified === true ||
    vnData?.document?.verified === true ||
    vnData?.status === 'verified' ||
    vnData?.verificationStatus === 'verified';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified, raw: vnData }),
  };
};
