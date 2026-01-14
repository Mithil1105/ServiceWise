import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create admin client
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Get token from header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = authHeader.replace("Bearer ", "").trim();

        // Validate token by calling Supabase Auth API directly
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "apikey": serviceRoleKey,
            },
        });

        if (!authResponse.ok) {
            const errorData = await authResponse.json().catch(() => ({}));
            console.error("Auth API error:", authResponse.status, errorData);
            return new Response(
                JSON.stringify({
                    error: "Invalid or expired token",
                    details: errorData.message || `HTTP ${authResponse.status}`,
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userData = await authResponse.json();
        if (!userData || !userData.id) {
            return new Response(
                JSON.stringify({ error: "User data not found in token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("Authenticated user:", userData.id, userData.email);

        // Check admin role using service role client (bypasses RLS)
        const { data: roles, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.id)
            .eq("role", "admin");

        if (roleError) {
            console.error("Role check error:", roleError);
            return new Response(
                JSON.stringify({ error: "Failed to verify admin access", details: roleError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!roles || roles.length === 0) {
            const { data: allRoles } = await supabaseAdmin
                .from("user_roles")
                .select("role")
                .eq("user_id", userData.id);

            return new Response(
                JSON.stringify({
                    error: "Admin access required",
                    details: `User has roles: ${allRoles?.map((r) => r.role).join(", ") || "none"}`,
                    userId: userData.id,
                }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("Admin verified:", userData.email);

        // Parse request
        const { email, password, name, role } = await req.json();

        if (!email || !password || !name) {
            return new Response(
                JSON.stringify({ error: "Email, password, and name are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (role && !["admin", "manager", "supervisor"].includes(role)) {
            return new Response(
                JSON.stringify({ error: "Invalid role. Must be admin, manager, or supervisor" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: { name: name.trim() },
        });

        if (createError) {
            console.error("Create user error:", createError);
            return new Response(
                JSON.stringify({ error: "Failed to create user", details: createError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!newUser.user) {
            return new Response(
                JSON.stringify({ error: "User creation failed" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create profile
        await supabaseAdmin
            .from("profiles")
            .upsert({
                id: newUser.user.id,
                name: name.trim(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: "id" });

        // Assign role
        if (role) {
            const { error: roleError } = await supabaseAdmin
                .from("user_roles")
                .insert({
                    user_id: newUser.user.id,
                    role: role as "admin" | "manager" | "supervisor",
                    created_at: new Date().toISOString(),
                });

            if (roleError) {
                console.error("Role assignment error:", roleError);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: newUser.user.id,
                    email: newUser.user.email,
                    name: name.trim(),
                    role: role || null,
                },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        return new Response(
            JSON.stringify({
                error: "Internal server error",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

