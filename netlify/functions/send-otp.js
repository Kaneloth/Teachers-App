const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let phone;
  try {
    ({ phone } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!phone) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Phone is required' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bulkSmsUsername = process.env.BULKSMS_USERNAME;
  const bulkSmsPassword = process.env.BULKSMS_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !bulkSmsUsername || !bulkSmsPassword) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Delete any existing OTPs for this phone
  await fetch(
    `${supabaseUrl}/rest/v1/phone_verifications?phone=eq.${encodeURIComponent(phone)}`,
    { method: 'DELETE', headers }
  );

  // Store hashed OTP
  const storeRes = await fetch(`${supabaseUrl}/rest/v1/phone_verifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, otp_hash: otpHash, expires_at: expiresAt, verified: false }),
  });

  if (!storeRes.ok) {
    const err = await storeRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to store OTP: ' + err }) };
  }

  // Send SMS via BulkSMS
  const credentials = Buffer.from(`${bulkSmsUsername}:${bulkSmsPassword}`).toString('base64');
  const smsRes = await fetch('https://api.bulksms.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phone,
      body: `Your EduCross verification code is: ${otp}\nValid for 10 minutes. Do not share this code.`,
    }),
  });

  if (!smsRes.ok) {
    const err = await smsRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send SMS: ' + err }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};
