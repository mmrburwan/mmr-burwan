import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@mmrburwan.gov.in";

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
            // We can use the admin RPC 'get_user_emails' or query auth.users if we had access (but auth.users is restricted)
            // Or we can try to get it from a public profile table if it exists.
            // However, the best way with service role key is to use the admin API to get user by ID.

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

            // 4. Call Resend API
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
                    html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h2 style="color: #0f172a; margin-top: 0;">Application Verified</h2>
                <p style="color: #475569;">Dear ${fullName},</p>
                <p style="color: #475569;">We are pleased to inform you that your marriage registration application has been <strong>successfully verified</strong>.</p>
                
                <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #cbd5e1; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Certificate Number:</strong> ${record.certificate_number || 'Pending Generation'}</p>
                  <p style="margin: 5px 0;"><strong>Registration Date:</strong> ${record.registration_date || 'N/A'}</p>
                </div>

                <p style="color: #475569;">You may now log in to the portal to check your status. Once the certificate is generated, you will be able to download it.</p>
                
                <br/>
                <p style="color: #64748b; font-size: 0.875rem;">Regards,<br/>Marriage Registration Authority</p>
              </div>
            </div>
          `,
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
