
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Don't error if ANON_KEY is missing, we'll try to get it from headers
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENV_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

// Create admin client with service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

serve(async (req) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    };

    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const { applicationId, adminId } = await req.json();

        if (!applicationId || !adminId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: applicationId, adminId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get the API key from headers (which client sends as 'apikey')
        // This is more reliable than Env Vars in some Edge contexts
        const apiKey = req.headers.get('apikey') || ENV_ANON_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "Missing API Key configuration" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Verify user is admin (using the auth token)
        // IMPORTANT: Use the API Key and pass the Authorization header
        const supabaseClient = createClient(SUPABASE_URL, apiKey, {
            global: {
                headers: { Authorization: authHeader },
            },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            }
        });

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError) {
            return new Response(
                JSON.stringify({ error: `User retrieval failed: ${authError.message}` }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!user) {
            return new Response(
                JSON.stringify({ error: "User not found" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (user.user_metadata?.role !== 'admin') {
            return new Response(
                JSON.stringify({
                    error: "Forbidden: You are not an admin",
                    details: { role: user.user_metadata?.role || 'none' }
                }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Perform deletion using Service Role (bypassing RLS)
        const { error: deleteError } = await supabaseAdmin
            .from('applications')
            .delete()
            .eq('id', applicationId);

        if (deleteError) {
            return new Response(
                JSON.stringify({ error: `Failed to delete application: ${deleteError.message}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: "Application deleted successfully" }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
