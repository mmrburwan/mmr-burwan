import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create admin client with service role key for user creation
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

serve(async (req) => {
    try {
        // Handle CORS preflight
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

        // Only allow POST requests
        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({ error: "Method not allowed" }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
                    },
                }
            );
        }

        // Parse request body
        let body;
        try {
            body = await req.json();
        } catch (parseError) {
            return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
        }

        const { email, password, name, phone } = body;

        // Validate required fields
        if (!email || !password || !name) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
        }

        // Strict domain check
        if (!email.toLowerCase().endsWith("@mmrburwan.com")) {
            return new Response(JSON.stringify({ error: "This endpoint is restricted to mmrburwan.com emails" }), { status: 403 });
        }

        // Create user with auto-verification
        const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-verify
            user_metadata: {
                raw_user_meta_data: {
                    name: name,
                    phone: phone,
                    role: 'client', // Default to client
                },
                name: name,
                phone: phone,
                role: 'client',
            },
        });

        if (userError) {
            // Check for duplicate
            if (userError.message?.includes("already registered") || userError.message?.includes("already exists")) {
                return new Response(JSON.stringify({ error: "User already exists", code: "USER_ALREADY_EXISTS" }), { status: 409 });
            }
            throw userError;
        }

        // Return success
        return new Response(
            JSON.stringify({
                success: true,
                user: userData.user,
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
                },
            }
        );

    } catch (error: any) {
        console.error("Error in register-internal-user:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
                },
            }
        );
    }
});
