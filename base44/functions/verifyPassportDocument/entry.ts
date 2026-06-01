import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { front_url, back_url } = await req.json();
    if (!front_url) return Response.json({ error: 'front_url is required' }, { status: 400 });

    const apiKey = Deno.env.get('VERIFYNOW_API_KEY');

    // Fetch image files from their URLs
    const frontRes = await fetch(front_url);
    const frontBlob = await frontRes.blob();

    const form = new FormData();
    form.append('bundle', 'id_document_verification');
    form.append('mode', 'production');
    form.append('front_image', frontBlob, 'front.jpg');

    if (back_url) {
      const backRes = await fetch(back_url);
      const backBlob = await backRes.blob();
      form.append('back_image', backBlob, 'back.jpg');
    }

    const vnRes = await fetch('https://www.verifynow.co.za/api/external/id-document-verify', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: form,
    });

    const vnData = await vnRes.json();

    if (!vnRes.ok) {
      return Response.json({ success: false, message: 'Document verification failed.', raw: vnData });
    }

    // Update user verification status based on result
    const passed = vnData?.status === 'success' || vnData?.verified === true;

    await base44.asServiceRole.entities.User.update(user.id, {
      id_verified: passed,
      id_verification_status: passed ? 'verified' : 'needs_review',
    });

    return Response.json({ success: true, passed, raw: vnData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});