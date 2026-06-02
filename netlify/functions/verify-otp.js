const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let phone, otp;
  try {
    ({ phone, otp } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!phone || !otp) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Phone and OTP are required' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const now = new Date().toISOString();

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Look up a matching, unexpired, unverified OTP
  const res = await fetch(
    `${supabaseUrl}/rest/v1/phone_verifications?phone=eq.${encodeURIComponent(phone)}&otp_hash=eq.${otpHash}&verified=eq.false&expires_at=gt.${encodeURIComponent(now)}&select=id`,
    { headers }
  );

  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid or expired code. Please request a new one.' }) };
  }

  // Mark as verified
  await fetch(
    `${supabaseUrl}/rest/v1/phone_verifications?id=eq.${rows[0].id}`,
    { method: 'PATCH', headers, body: JSON.stringify({ verified: true }) }
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
};
