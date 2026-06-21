import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL') ?? 'noreply@skootlink.co.za';
const FROM_NAME     = 'Crosssa';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, full_name, user_code, profile_type } = await req.json();
    if (!email || !user_code) {
      return new Response(JSON.stringify({ error: 'Missing email or user_code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const displayName = full_name || 'there';
    const isEducator   = profile_type === 'educator';

    // Tagline and body copy branch based on profile type — general users
    // (job seekers) never see educator-transfer language, since none of
    // that applies to them.
    const tagline = isEducator
      ? 'South African Educator Transfer Platform'
      : 'Professional CV &amp; Career Tools for South Africa';

    const introLine = isEducator
      ? "Your Crosssa account has been created successfully. We're excited to help you find your ideal transfer match across South Africa."
      : "Your Crosssa account has been created successfully. We're excited to help you build a standout CV, write tailored cover letters, and find your next job opportunity.";

    const whatsNextBody = isEducator
      ? 'Complete your profile to start matching with educators who want to swap schools with you. The more detail you add, the better your matches will be.'
      : `Here\'s what you can do on Crosssa:
        <ul style="margin:12px 0;padding-left:20px;color:#374151;font-size:14px;line-height:2;">
          <li><strong>Build a professional CV</strong> — choose from 10 templates and let our AI write your summary</li>
          <li><strong>Generate job-specific cover letters</strong> — paste in a job description and get a tailored letter instantly</li>
          <li><strong>Search vacancies</strong> — browse teaching and non-teaching jobs from across South Africa</li>
        </ul>
        Get started by completing your profile and building your first CV.`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Crosssa</title></head>
<body style="margin:0;padding:0;background:#f0fdfa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#10b981);padding:32px 32px 24px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:2px;">CROSSSA</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;letter-spacing:1px;">${tagline}</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">Welcome, ${displayName}! 🎉</h1>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              ${introLine}
            </p>

            <!-- User Code box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:#f0fdfa;border:2px solid #99f6e4;border-radius:12px;padding:20px 24px;text-align:center;">
                  <div style="font-size:12px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Your Crosssa Reference Code</div>
                  <div style="font-size:30px;font-weight:800;color:#0d9488;letter-spacing:4px;font-family:monospace;">${user_code}</div>
                  <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">
                    Please quote this code whenever you contact Crosssa support.<br>Keep it safe — it uniquely identifies your account.
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
              <strong>What's next?</strong><br>
              ${whatsNextBody}
            </p>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6;">
              If you have any questions, reply to this email or contact us and quote your reference code <strong>${user_code}</strong>.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Crosssa · A Skootlink (Pty) Ltd product</p>
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
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email, name: displayName }],
        subject: isEducator
          ? `Welcome to Crosssa — your reference code is ${user_code}`
          : `Welcome to Crosssa — start building your CV today`,
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
