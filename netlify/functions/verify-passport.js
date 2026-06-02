const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let passportNumber, frontBase64, frontType, backBase64, backType;
  try {
    ({ passportNumber, frontBase64, frontType, backBase64, backType } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!frontBase64 || !backBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Both front and back images are required' }) };
  }

  const apiKey = process.env.VERIFYNOW_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: VERIFYNOW_API_KEY not set' }) };
  }

  const idempotencyKey = `passport-${crypto.createHash('md5').update((passportNumber || '') + Date.now()).digest('hex')}`;

  // Decode base64 images and build multipart FormData
  const frontBuffer = Buffer.from(frontBase64, 'base64');
  const backBuffer  = Buffer.from(backBase64,  'base64');

  const frontBlob = new Blob([frontBuffer], { type: frontType || 'image/jpeg' });
  const backBlob  = new Blob([backBuffer],  { type: backType  || 'image/jpeg' });

  const formData = new FormData();
  formData.append('bundle', 'id_document_verification');
  formData.append('mode', process.env.VERIFYNOW_MODE || 'live');
  formData.append('front_image', frontBlob, 'front.jpg');
  formData.append('back_image',  backBlob,  'back.jpg');

  let vnRes, vnData;
  try {
    vnRes = await fetch('https://www.verifynow.co.za/api/external/id-document-verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Idempotency-Key': idempotencyKey,
        // Do NOT set Content-Type — fetch sets it automatically with the boundary for FormData
      },
      body: formData,
    });
    vnData = await vnRes.json();
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Failed to reach VerifyNow: ' + err.message }),
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
    statusCode: vnRes.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified, raw: vnData }),
  };
};
