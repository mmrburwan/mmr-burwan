import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "success@updates.mmrburwan.com";
// Define your site URL here or in Supabase Secrets
const SITE_URL = Deno.env.get("SITE_URL") || "https://mmrburwan.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    try {
        // 1. Parse the Webhook Payload
        const payload = await req.json();

        // The payload structure from a Supabase Webhook
        const { record, old_record, type, table } = payload;

        // 2. Security & Logic Gates
        // Gate A: Ensure this is an UPDATE event on the right table
        if (type !== 'UPDATE' || table !== 'applications') {
            return new Response("Ignored: Not an application update", { status: 200 });
        }

        // Gate B: Check if verified status changed TO true FROM false/null
        // The 'verified' column is a boolean in the applications table
        if (record.verified === true && old_record.verified !== true) {

            console.log(`Processing verification email for Application ID: ${record.id}`);

            // 3. Fetch User Email
            // The applications table has user_id, but not email. We need to fetch it.
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(record.user_id);

            if (userError || !userData.user) {
                console.error(`Failed to fetch user for ID: ${record.user_id}`, userError);
                return new Response("Failed to fetch user email", { status: 500 });
            }

            const userEmail = userData.user.email;

            if (!userEmail) {
                console.error(`No email found for user ID: ${record.user_id}`);
                return new Response("User has no email", { status: 200 });
            }

            // Extract user name for personalization
            const userDetails = record.user_details || {};
            const firstName = userDetails.firstName || "";
            const lastName = userDetails.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim() || "Applicant";

            console.log(`Sending email to ${userEmail} for Application ID: ${record.id}`);

            // 4. Call Resend API with Official Template
            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: `Marriage Registrar <${FROM_EMAIL}>`,
                    to: [userEmail],
                    subject: "Marriage Registration Application Verified",
                    html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Successful</title>
    <style>
      body { margin: 0; padding: 0; background-color: #fffbfb; font-family: Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; }
      table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      .serif-font { font-family: 'Times New Roman', Times, serif; }
      @media only screen and (max-width: 600px) {
        .main-table { width: 100% !important; }
        .padding-mobile { padding: 20px !important; }
        .hero-text { font-size: 24px !important; }
        .content-stack { display: block !important; width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #fffbfb;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbfb;">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <!-- Main Card -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="main-table" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 30px 0 20px 0;">
                <div style="width: 44px; height: 44px; background-color: #d4af37; border-radius: 50%; line-height: 44px; text-align: center; color: #ffffff; font-family: 'Times New Roman', serif; font-size: 24px; font-weight: bold; margin-bottom: 12px;">M</div>
                <div class="serif-font" style="font-size: 18px; color: #0f172a; font-weight: bold; letter-spacing: 0.5px;">MMR BURWAN</div>
                <div style="font-size: 10px; color: #d4af37; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; font-weight: bold;">Official Portal</div>
              </td>
            </tr>
            <!-- Verified Badge -->
            <tr>
              <td align="center" style="padding: 0 40px;">
                <div style="background-color: #dcfce7; border: 1px solid #bbf7d0; border-radius: 50px; padding: 8px 20px; display: inline-block;">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td valign="middle" style="padding-right: 8px; font-size: 16px; line-height: 1;">✅</td>
                      <td valign="middle" style="color: #166534; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Verified</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            <!-- Body Content -->
            <tr>
              <td class="padding-mobile" style="padding: 30px 40px;">
                <h1 class="serif-font hero-text" style="color: #0f172a; font-size: 28px; margin: 0 0 15px 0; font-weight: 400; text-align: center;">Application Approved</h1>
                <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0; line-height: 1.6; text-align: center;">
                  Dear <strong>${fullName}</strong>,
                </p>
                <p style="color: #4b5563; font-size: 15px; margin: 0 0 30px 0; line-height: 1.6; text-align: center;">
                  We are pleased to inform you that your marriage registration application has been successfully verified by the authority.
                </p>
                <!-- Certificate Details Box -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 30px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="50%" valign="top" class="content-stack" style="padding-bottom: 10px;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">Certificate No.</p>
                            <p style="margin: 0; color: #0f172a; font-family: monospace; font-size: 14px; background: #e2e8f0; padding: 4px 8px; border-radius: 4px; display: inline-block;">${record.certificate_number || 'Pending'}</p>
                          </td>
                          <td width="50%" valign="top" class="content-stack">
                            <p style="margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">Registration Date</p>
                            <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 500;">${record.registration_date || 'N/A'}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <!-- CTA Button -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <a href="${SITE_URL}/verify/${record.certificate_number}" style="background-color: #d4af37; color: #ffffff; display: inline-block; padding: 16px 40px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(212, 175, 55, 0.4);">
                        View Certificate
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="text-align: center; font-size: 13px; color: #94a3b8; margin-top: 25px;">
                  You can also download your certificate from your dashboard.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 10px 0;">
                  Need assistance? Contact support at <strong style="color: #0f172a;">1800-123-4567</strong>
                </p>
                <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 0;">
                  &copy; 2025 MMR Burwan Official Portal.<br>
                </p>
              </td>
            </tr>
          </table>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
            Disclaimer: Site Contents designed, developed, maintained and updated by <span style="color: #d4af37;">Epplicon Technologies</span>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Resend API Error:", errorText);
                return new Response(`Resend API Error: ${errorText}`, { status: 500 });
            }

            const data = await res.json();
            return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
        }

        return new Response("Status did not change to verified. No email sent.", { status: 200 });

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});