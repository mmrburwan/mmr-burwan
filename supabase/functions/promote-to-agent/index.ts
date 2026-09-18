import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

serve(async (req) => {
    try {
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

        if (req.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
        }

        const body = await req.json();
        const { email } = body;

        if (!email) {
            return new Response(JSON.stringify({ error: "Missing required fields: email" }), { status: 400 });
        }

        // Get user by email
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const targetUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!targetUser) {
            return new Response(JSON.stringify({ error: "User not found with this email" }), { status: 404 });
        }

        if (targetUser.user_metadata?.role === 'agent') {
            return new Response(JSON.stringify({ error: "User is already an agent" }), { status: 400 });
        }

        // Update user metadata to role 'agent'
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUser.id,
            { user_metadata: { ...targetUser.user_metadata, role: 'agent' } }
        );

        if (updateError) throw updateError;

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: updatedUser.user.id,
                    email: updatedUser.user.email,
                    name: updatedUser.user.user_metadata?.name || '',
                    role: 'agent',
                }
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
