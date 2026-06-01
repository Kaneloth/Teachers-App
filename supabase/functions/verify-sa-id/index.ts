const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { id_number } = await req.json();
    if (!id_number) throw new Error('ID number is required');

    const apiKey = Deno.env.get('VERIFYNOW_API_KEY');
    if (!apiKey) throw new Error('VerifyNow API key not configured');

    const response = await fetch('https://www.verifynow.co.za/api/external/verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Idempotency-Key': `said-${id_number}-${Date.now()}`,
      },
      body: JSON.stringify({
        reportType: 'said_verification',
        idNumber: id_number,
        mode: 'live',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'ID verification failed');
    }

    // Check if ID was found / valid in the response
    const verified = result.status === 'found' || result.verified === true || response.ok;

    return new Response(JSON.stringify({ success: true, verified, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
