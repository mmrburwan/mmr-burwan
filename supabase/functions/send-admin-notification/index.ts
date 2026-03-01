import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "admin@mmrburwan.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "admin-alerts@updates.mmrburwan.com";
const SITE_URL = Deno.env.get("SITE_URL") || "https://mmrburwan.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    try {
        // Handle CORS
        if (req.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
                },
            });
        }

        const payload = await req.json();
        const { record } = payload; // Support { record: ... } payload directly or from webhook

        if (!record || !record.user_id) {
            console.log("No record or user_id found in payload");
            return new Response(JSON.stringify({ message: "No record or user_id found" }), {
                status: 200, // Don't fail the webhook/call
                headers: { "Content-Type": "application/json" }
            });
        }

        // Get User Email to check domain
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(record.user_id);

        if (userError || !user || !user.email) {
            console.error("Error fetching user:", userError);
            // Fallback: Proceed to notify admin but mention user details missing? 
            // Or safer: skip if strictly required. Let's send anyway but note it.
        } else {
            // Domain Check
            if (user.email.toLowerCase().endsWith("@mmrburwan.com")) {
                console.log(`Skipping admin notification for internal user: ${user.email}`);
                return new Response(JSON.stringify({ message: "Skipped internal user" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }

        const userName = user?.user_metadata?.name || "Unknown User";
        const userEmail = user?.email || "Unknown Email";
        const applicationId = record.id;
        const submittedAt = record.submitted_at ? new Date(record.submitted_at).toLocaleString() : new Date().toLocaleString();

        // Extract additional details
        const groomName = `${record.user_details?.firstName || ''} ${record.user_details?.lastName || ''}`.trim() || "N/A";
        const brideName = `${record.partner_form?.firstName || ''} ${record.partner_form?.lastName || ''}`.trim() || "N/A";
        const mobileNumber = record.user_details?.mobileNumber || "N/A";
        const marriageDate = record.declarations?.marriageDate || "N/A";

        console.log(`Sending admin notification for application ${applicationId} from ${userEmail}`);

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: ADMIN_EMAIL,
                subject: `New Application Submitted: ${groomName} & ${brideName}`,
                html: `
          <!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Application Submitted</title>
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

                    <!-- Notification Badge -->
                    <tr>
                        <td align="center" style="padding: 0 40px;">
                           <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 50px; padding: 8px 20px; display: inline-block;">
                                <table border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td valign="middle" style="padding-right: 8px; font-size: 16px; line-height: 1;">🔔</td>
                                        <td valign="middle" style="color: #1e40af; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">New Application</td>
                                    </tr>
                                </table>
                           </div>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td class="padding-mobile" style="padding: 30px 40px;">
                            
                            <h1 class="serif-font hero-text" style="color: #0f172a; font-size: 26px; margin: 0 0 25px 0; font-weight: 400; text-align: center;">Application Submitted</h1>
                            
                            <!-- Application Details Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="color: #475569; font-size: 14px; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Application Details</h3>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="40%" style="padding: 5px 0; color: #64748b; font-size: 14px;"><strong>Application ID:</strong></td>
                                                <td style="padding: 5px 0; color: #0f172a; font-family: monospace; font-size: 14px;">${applicationId}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0; color: #64748b; font-size: 14px;"><strong>Submitted At:</strong></td>
                                                <td style="padding: 5px 0; color: #0f172a; font-size: 14px;">${submittedAt}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0; color: #64748b; font-size: 14px;"><strong>Reg. Email:</strong></td>
                                                <td style="padding: 5px 0; color: #0f172a; font-size: 14px;">${userEmail}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Applicants Box -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="color: #92400e; font-size: 14px; text-transform: uppercase; margin: 0 0 15px 0; letter-spacing: 0.5px; border-bottom: 1px solid #fde68a; padding-bottom: 8px;">Applicants Info</h3>
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="40%" style="padding: 5px 0; color: #92400e; font-size: 14px;"><strong>Groom:</strong></td>
                                                <td style="padding: 5px 0; color: #451a03; font-size: 14px;">${groomName}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0; color: #92400e; font-size: 14px;"><strong>Bride:</strong></td>
                                                <td style="padding: 5px 0; color: #451a03; font-size: 14px;">${brideName}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0; color: #92400e; font-size: 14px;"><strong>Mobile:</strong></td>
                                                <td style="padding: 5px 0; color: #451a03; font-size: 14px;">${mobileNumber}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 5px 0; color: #92400e; font-size: 14px;"><strong>Marriage Date:</strong></td>
                                                <td style="padding: 5px 0; color: #451a03; font-size: 14px;">${marriageDate}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- CTA Button -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <a href="${SITE_URL}/admin/applications/${applicationId}" style="background-color: #0f172a; color: #ffffff; display: inline-block; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.3);">
                                            Review Application
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 25px;">
                                Please log in to the admin panel to verify documents.
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 0;">
                                &copy; 2025 MMR Burwan Official Portal.<br>
                                Automated Admin Notification System.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `,
            }),
        });

        const data = await res.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error: any) {
        console.error("Error in send-admin-notification:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
});
