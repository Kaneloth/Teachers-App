import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, user_id } = await req.json();
    if (!phone) throw new Error('Phone number is required');

    // Normalise to international format
    let normalised = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (normalised.startsWith('0')) normalised = '+27' + normalised.slice(1);
    if (!normalised.startsWith('+')) normalised = '+27' + normalised;

    // Generate 6-digit OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Remove any existing OTPs for this phone
    await supabase.from('phone_otp_verifications').delete().eq('phone', normalised);

    // Store new OTP (10 min expiry)
    const { error: insertErr } = await supabase.from('phone_otp_verifications').insert({
      phone: normalised,
      user_id: user_id || null,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertErr) throw new Error('Failed to store OTP');

    // Send via BulkSMS
    const bulkToken = Deno.env.get('BULKSMS_API_TOKEN');
    if (!bulkToken) throw new Error('SMS service not configured');

    const smsRes = await fetch('https://api.bulksms.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(bulkToken)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalised,
        body: `Your EduCross verification code is: ${code}\nValid for 10 minutes. Do not share this code.`,
        encoding: 'TEXT',
        longMessageMaxParts: 1,
      }),
    });

    if (!smsRes.ok) {
      const errText = await smsRes.text();
      throw new Error(`SMS delivery failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
