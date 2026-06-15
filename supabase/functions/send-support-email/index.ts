import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL') ?? 'noreply@skootlink.co.za';
const FROM_NAME     = 'Crosssa';
const SUPPORT_EMAIL = 'support@crosssa.co.za';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, full_name, user_code, subject, message } = await req.json();

    if (!email || !message) {
      return new Response(JSON.stringify({ error: 'Missing email or message' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const displayName = full_name || 'A Crosssa user';
    const refCode     = user_code || 'Not assigned';
    const subjectLine = subject?.trim() ? subject.trim() : 'General enquiry';

    // Escape basic HTML so message content can't break the email layout.
    const escapeHtml = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crosssa Support Request</title></head>
<body style="margin:0;padding:0;background:#f0fdfa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#10b981);padding:28px 32px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:2px;">CROSSSA</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;letter-spacing:1px;">Support Request</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <h1 style="margin:0 0 16px;font-size:18px;color:#111827;">${escapeHtml(subjectLine)}</h1>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6b7280;width:120px;">From</td>
                <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${escapeHtml(displayName)} &lt;${escapeHtml(email)}&gt;</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#6b7280;">Reference Code</td>
                <td style="padding:6px 0;font-size:13px;color:#0d9488;font-weight:700;font-family:monospace;letter-spacing:1px;">${escapeHtml(refCode)}</td>
              </tr>
            </table>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
            </div>

            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">
              Reply directly to this email to respond to ${escapeHtml(displayName)} — Reply-To is set to ${escapeHtml(email)}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:  { name: FROM_NAME, email: FROM_EMAIL },
        to:      [{ email: SUPPORT_EMAIL, name: 'Crosssa Support' }],
        replyTo: { email, name: displayName },
        subject: `[Support] ${subjectLine} — ${refCode}`,
        htmlContent: htmlBody,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
