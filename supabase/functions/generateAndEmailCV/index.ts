import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Personal {
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface CVBody {
  personal?: Personal;
  _pdf_url_override?: string;
  [key: string]: unknown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: CVBody = await req.json();

    const recipientEmail = body.personal?.email;
    const recipientName  = body.personal?.full_name || 'Educator';
    const pdfUrl         = body._pdf_url_override;

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'No email address found in CV data.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'BREVO_API_KEY secret is not set.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@skootlink.co.za';
    const FROM_NAME  = 'Crosssa CV Builder';

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: recipientEmail, name: recipientName }],
        subject: `Your CV is ready, ${recipientName}!`,
        htmlContent: buildEmailHTML(recipientName, pdfUrl),
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result?.message ?? `Resend API error ${res.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function buildEmailHTML(name: string, pdfUrl?: string): string {
  const downloadSection = pdfUrl
    ? `
      <div style="text-align:center;margin:32px 0;">
        <a href="${pdfUrl}"
           style="display:inline-block;background:#16a34a;color:#fff;font-size:15px;
                  font-weight:600;text-decoration:none;padding:14px 36px;
                  border-radius:10px;letter-spacing:0.3px;">
          ⬇ Download My CV
        </a>
        <p style="margin-top:12px;font-size:12px;color:#9ca3af;">
          Or copy this link into your browser:<br/>
          <a href="${pdfUrl}" style="color:#16a34a;word-break:break-all;">${pdfUrl}</a>
        </p>
      </div>`
    : `<p style="text-align:center;color:#6b7280;margin:24px 0;">
         Your CV has been generated. Log in to Crosssa to download it.
       </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Your Crosssa CV</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.07);max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e2a3a;padding:28px 36px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;
                         letter-spacing:1px;">Crosssa</p>
              <p style="margin:4px 0 0;font-size:12px;color:#a0aec0;
                         letter-spacing:0.5px;text-transform:uppercase;">
                South African Educator Transfer Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">
                Hi ${name}, your CV is ready! 🎉
              </h1>
              <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
                Your professional educator CV has been successfully generated through the
                Crosssa CV Builder. Click the button below to download your PDF.
              </p>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                Keep this email — you can re-download your CV at any time using the link below.
              </p>

              ${downloadSection}

              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;"/>

              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                <strong style="color:#374151;">Didn't request this?</strong><br/>
                You can safely ignore this email — no action is required.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:18px 36px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
                Crosssa · South African Educator Transfer Platform<br/>
                This email was sent because you generated a CV on Crosssa.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
