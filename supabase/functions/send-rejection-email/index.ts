import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "reject@updates.mmrburwan.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://mmrburwan.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const getDocumentTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    aadhaar: 'Aadhaar Card',
    tenth_certificate: '10th Certificate',
    voter_id: 'Voter ID',
    id: 'ID Document',
    photo: 'Photo',
    certificate: 'Certificate',
    other: 'Other',
  };
  return labels[type] || type;
};

serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, type, table } = payload;

    // 1. Gate: Listen for INSERT on notifications table
    if (type !== 'INSERT' || table !== 'notifications') {
      return new Response("Ignored: Not a notification insert", { status: 200 });
    }

    // 2. Gate: Check if it's a document rejection
    if (record.type !== 'document_rejected') {
      return new Response("Ignored: Not a document rejection", { status: 200 });
    }

    console.log(`Processing rejection email for Notification ID: ${record.id}`);

    // 3. Fetch User Email
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

    // 4. Fetch Document Details (Optional but good for context)
    let documentName = "Document";
    let documentTypeLabel = "Document";

    if (record.document_id) {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('name, type')
        .eq('id', record.document_id)
        .single();

      if (!docError && docData) {
        documentName = docData.name;
        documentTypeLabel = getDocumentTypeLabel(docData.type);
      }
    }

    // 5. Prepare Email
    const rejectionReason = record.message;
    // Try to get user name from metadata if possible, or just use "Applicant"
    const displayName = "Applicant";

    const emailSubject = `Document Rejection Notice - ${documentTypeLabel}`;
    const emailHtml = `
    <!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Document Rejection Notice</title>
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
                            <!-- CSS Logo M -->
                            <div style="width: 44px; height: 44px; background-color: #d4af37; border-radius: 50%; line-height: 44px; text-align: center; color: #ffffff; font-family: 'Times New Roman', serif; font-size: 24px; font-weight: bold; margin-bottom: 12px;">M</div>
                            <div class="serif-font" style="font-size: 18px; color: #0f172a; font-weight: bold; letter-spacing: 0.5px;">MMR BURWAN</div>
                            <div style="font-size: 10px; color: #d4af37; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; font-weight: bold;">Official Portal</div>
                        </td>
                    </tr>

                    <!-- Alert Banner -->
                    <tr>
                        <td align="center" style="padding: 0 40px;">
                           <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 15px;">
                                <h2 class="serif-font hero-text" style="color: #991b1b; font-size: 24px; margin: 0; font-weight: 600;">Action Required</h2>
                           </div>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td class="padding-mobile" style="padding: 30px 40px;">
                            
                            <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0; line-height: 1.6;">
                                Dear <strong>${displayName}</strong>,
                            </p>
                            
                            <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                                We regret to inform you that a document in your application has been <strong>rejected</strong> during the review process. Please review the details below.
                            </p>
                            
                            <!-- Rejected Document Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fff1f2; border-left: 4px solid #e11d48; margin-bottom: 20px; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; color: #9f1239; font-weight: bold;">Rejected Document</p>
                                        <p style="margin: 0; color: #881337; font-size: 15px;">
                                            <strong>Type:</strong> ${documentTypeLabel}<br>
                                            <span style="font-size: 13px; color: #9f1239;">File: ${documentName}</span>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Reason Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; margin-bottom: 20px; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; color: #92400e; font-weight: bold;">Reason for Rejection</p>
                                        <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${rejectionReason}</p>
                                    </td>
                                </tr>
                            </table>

                             <!-- Next Steps Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; color: #1e40af; font-weight: bold;">Next Steps</p>
                                        <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.5;">
                                            Please log in to your dashboard and upload a new, corrected document.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px;">
                                <tr>
                                    <td align="center">
                                        <a href="${SITE_URL}/dashboard" style="background-color: #0f172a; color: #ffffff; display: inline-block; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">Log In to Dashboard</a>
                                    </td>
                                </tr>
                            </table>

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
</html>
    `;

    // 6. Send Email
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Marriage Registrar <${FROM_EMAIL}>`,
        to: [userEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API Error:", errorText);
      return new Response(`Resend API Error: ${errorText}`, { status: 500 });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
