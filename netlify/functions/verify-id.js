const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let idNumber;
  try {
    ({ idNumber } = JSON.parse(event.body));
  } catch {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Invalid request body' }),
    };
  }

  if (!idNumber) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'idNumber is required' }),
    };
  }

  const apiKey = process.env.VERIFYNOW_API_KEY;
  if (!apiKey) {
    console.error('[verify-id] VERIFYNOW_API_KEY env var is not set');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false, error: 'Verification service not configured (missing API key)' }),
    };
  }

  const mode = process.env.VERIFYNOW_MODE || 'sandbox';
  const idempotencyKey = `said-${crypto.createHash('md5').update(idNumber + Date.now()).digest('hex')}`;

  let vnData;
  try {
    const vnRes = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ reportType: 'said_verification', idNumber, mode }),
    });

    const text = await vnRes.text();
    try {
      vnData = JSON.parse(text);
    } catch {
      console.error('[verify-id] Non-JSON response from VerifyNow:', text);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: false, error: `VerifyNow error (HTTP ${vnRes.status})`, details: text }),
      };
    }

    if (!vnRes.ok) {
      console.error('[verify-id] VerifyNow returned', vnRes.status, vnData);
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
    console.error('[verify-id] Fetch error:', err);
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
    vnData?.status === 'verified' ||
    vnData?.verificationStatus === 'verified';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified, raw: vnData }),
  };
};
