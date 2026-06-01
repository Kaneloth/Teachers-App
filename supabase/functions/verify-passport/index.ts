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
    const { front_url, back_url, user_id } = await req.json();
    if (!front_url || !back_url) throw new Error('Both passport image URLs are required');

    const apiKey = Deno.env.get('VERIFYNOW_API_KEY');
    if (!apiKey) throw new Error('VerifyNow API key not configured');

    // Download both images
    const [frontRes, backRes] = await Promise.all([fetch(front_url), fetch(back_url)]);
    if (!frontRes.ok || !backRes.ok) throw new Error('Failed to download passport images');

    const [frontBlob, backBlob] = await Promise.all([frontRes.blob(), backRes.blob()]);

    const form = new FormData();
    form.append('bundle', 'id_document_verification');
    form.append('mode', 'live');
    form.append('front_image', frontBlob, 'passport_front.jpg');
    form.append('back_image', backBlob, 'passport_back.jpg');

    const response = await fetch('https://www.verifynow.co.za/api/external/id-document-verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Idempotency-Key': `passport-${user_id}-${Date.now()}`,
      },
      body: form,
    });

    const result = await response.json().catch(() => ({}));

    // Update profile verification status
    if (user_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabase.from('profiles').update({
        id_verification_status: response.ok ? 'submitted' : 'needs_review',
      }).eq('id', user_id);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
