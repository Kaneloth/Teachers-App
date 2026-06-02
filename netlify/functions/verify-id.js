const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let idNumber;
  try {
    ({ idNumber } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!idNumber) {
    return { statusCode: 400, body: JSON.stringify({ error: 'idNumber is required' }) };
  }

  const apiKey = process.env.VERIFYNOW_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: VERIFYNOW_API_KEY not set' }) };
  }

  const idempotencyKey = `said-${crypto.createHash('md5').update(idNumber + Date.now()).digest('hex')}`;

  let vnRes, vnData;
  try {
    vnRes = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        reportType: 'said_verification',
        idNumber,
        mode: process.env.VERIFYNOW_MODE || 'live',
      }),
    });
    vnData = await vnRes.json();
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach VerifyNow: ' + err.message }),
    };
  }

  // Normalise the verified flag across possible response shapes
  const verified =
    vnData?.verified === true ||
    vnData?.result?.verified === true ||
    vnData?.data?.verified === true ||
    vnData?.status === 'verified' ||
    vnData?.verificationStatus === 'verified';

  return {
    statusCode: vnRes.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified, raw: vnData }),
  };
};
