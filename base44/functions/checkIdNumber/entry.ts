import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('checkIdNumber called');
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id_number, full_name } = await req.json();
    if (!id_number?.trim()) return Response.json({ error: 'ID number is required' }, { status: 400 });

    const normalised = id_number.trim().toUpperCase();
    console.log('Checking ID:', normalised);

    // Check duplicate ID across all users
    const existingById = await base44.asServiceRole.entities.User.filter({ id_number: normalised });
    const duplicatesById = existingById.filter(u => u.id !== user.id);
    if (duplicatesById.length > 0) {
      return Response.json({ available: false, message: 'An account already exists with this ID number. If this is your account, please log in instead.' });
    }

    // Determine if SA ID (13 digits) or passport
    const isSAID = /^\d{13}$/.test(normalised);

    if (isSAID) {
      const apiKey = Deno.env.get('VERIFYNOW_API_KEY');
      console.log('API key present:', !!apiKey, 'length:', apiKey?.length);

      const vnRes = await fetch('https://www.verifynow.co.za/api/external/verify', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          reportType: 'said_verification',
          idNumber: normalised,
          mode: 'production',
        }),
      });

      const vnRawText = await vnRes.text();
      console.log('VerifyNow status:', vnRes.status, 'body:', vnRawText);

      if (!vnRes.ok) {
        return Response.json({ available: false, message: 'Your ID number could not be verified. Please contact support.' });
      }

      const vnData = JSON.parse(vnRawText);
      const verification = vnData?.results?.said_verification?.realTimeResults;
      console.log('verification object:', JSON.stringify(verification));

      if (!verification || verification.Status !== 'ID Number Valid') {
        return Response.json({ available: false, message: 'Your ID number could not be verified. Please check your ID number and name, or contact support.' });
      }

      // If full_name provided, check names match
      if (full_name && full_name.trim()) {
        const vnFirstnames = (verification.Verification?.Firstnames || '').toLowerCase();
        const vnLastname = (verification.Verification?.Lastname || '').toLowerCase();
        const vnFullName = `${vnFirstnames} ${vnLastname}`.trim();

        const inputName = full_name.trim().toLowerCase();
        const inputParts = inputName.split(/\s+/);
        const anyMatch = inputParts.some(part => part.length > 1 && vnFullName.includes(part));
        console.log('Name check - vnFullName:', vnFullName, 'inputName:', inputName, 'anyMatch:', anyMatch);

        if (!anyMatch) {
          return Response.json({ available: false, message: 'The name you entered does not match the ID number. Please check your details.' });
        }
      }

      return Response.json({ available: true, id_type: 'said' });
    } else {
      // Passport — no VerifyNow check; requires document upload
      return Response.json({ available: true, id_type: 'passport', requiresUpload: true });
    }
  } catch (error) {
    console.log('CATCH ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});