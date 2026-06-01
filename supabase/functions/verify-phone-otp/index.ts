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
    const { phone, code } = await req.json();
    if (!phone || !code) throw new Error('Phone and code are required');

    let normalised = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (normalised.startsWith('0')) normalised = '+27' + normalised.slice(1);
    if (!normalised.startsWith('+')) normalised = '+27' + normalised;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: otp, error } = await supabase
      .from('phone_otp_verifications')
      .select('*')
      .eq('phone', normalised)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !otp) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired code. Please try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('phone_otp_verifications').update({ verified: true }).eq('id', otp.id);

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
