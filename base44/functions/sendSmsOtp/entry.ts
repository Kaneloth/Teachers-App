import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, code } = await req.json();
    if (!phone || !code) return Response.json({ error: 'Missing phone or code' }, { status: 400 });

    // Normalise to international format: 0XX -> +27XX
    let normalised = phone.trim().replace(/\s+/g, '');
    if (normalised.startsWith('0')) {
      normalised = '+27' + normalised.slice(1);
    } else if (!normalised.startsWith('+')) {
      normalised = '+' + normalised;
    }

    const token = Deno.env.get('BULKSMS_API_TOKEN'); // format: tokenId:tokenSecret
    const [tokenId, tokenSecret] = token.split(':');
    const response = await fetch('https://api.bulksms.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${tokenId}:${tokenSecret}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalised,
        body: `Your Skootlink verification code is: ${code}. Valid for 10 minutes.`,
        routingGroup: 'STANDARD',
      }),
    });

    const responseText = await response.text();
    console.log('BulkSMS status:', response.status, 'body:', responseText);

    if (!response.ok) {
      return Response.json({ error: `SMS failed: ${responseText}` }, { status: 500 });
    }

    return Response.json({ success: true, bulksms_response: responseText });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});