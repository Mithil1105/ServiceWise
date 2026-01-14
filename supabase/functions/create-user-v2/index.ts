import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Get environment variables (automatically provided by Supabase)
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
            console.error("Missing environment variables");
            return new Response(
                JSON.stringify({ error: "Server configuration error" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Get authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization header" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Extract token
        const token = authHeader.replace("Bearer ", "").trim();
        if (!token) {
            return new Response(
                JSON.stringify({ error: "Invalid authorization token" }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Create admin client with service role (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Verify the user from the token using admin client
        // Using service role allows us to verify any user token
        const {
            data: { user },
            error: userError,
        } = await supabaseAdmin.auth.getUser(token);

        if (userError) {
            console.error("Token validation error:", userError.message, userError.status);
            return new Response(
                JSON.stringify({
                    error: "Invalid or expired token",
                    details: userError.message,
                    status: userError.status,
                }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        if (!user) {
            console.error("No user found from token");
            return new Response(
                JSON.stringify({
                    error: "User not found",
                    details: "Token is valid but user doesn't exist",
                }),
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        console.log("Authenticated user:", user.id, user.email);

        // Check if user has admin role
        const { data: roles, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin");

        if (roleError) {
            console.error("Role check error:", roleError);
            return new Response(
                JSON.stringify({
                    error: "Failed to verify admin access",
                    details: roleError.message,
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        if (!roles || roles.length === 0) {
            // Check what roles they have
            const { data: allRoles } = await supabaseAdmin
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id);

            return new Response(
                JSON.stringify({
                    error: "Admin access required",
                    details: `User has roles: ${allRoles?.map((r) => r.role).join(", ") || "none"}`,
                    userId: user.id,
                }),
                {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        console.log("Admin access verified for:", user.email);

        // Parse request body
        let requestData;
        try {
            requestData = await req.json();
        } catch (e) {
            return new Response(
                JSON.stringify({ error: "Invalid JSON in request body" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const { email, password, name, role } = requestData;

        // Validate required fields
        if (!email || !password || !name) {
            return new Response(
                JSON.stringify({
                    error: "Missing required fields",
                    details: "Email, password, and name are required",
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Validate role if provided
        if (role && !["admin", "manager", "supervisor"].includes(role)) {
            return new Response(
                JSON.stringify({
                    error: "Invalid role",
                    details: "Role must be 'admin', 'manager', or 'supervisor'",
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        // Create the user
        const {
            data: newUserData,
            error: createError,
        } = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password: password,
            email_confirm: true,
            user_metadata: { name: name.trim() },
        });

        if (createError) {
            console.error("User creation error:", createError);
            return new Response(
                JSON.stringify({
                    error: "Failed to create user",
                    details: createError.message,
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        if (!newUserData.user) {
            return new Response(
                JSON.stringify({ error: "User creation returned no user data" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const newUserId = newUserData.user.id;

        // Create/update profile
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
                {
                    id: newUserId,
                    name: name.trim(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "id" }
            );

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // Don't fail the request, but log it
        }

        // Assign role if specified
        if (role) {
            const { error: roleInsertError } = await supabaseAdmin
                .from("user_roles")
                .insert({
                    user_id: newUserId,
                    role: role as "admin" | "manager" | "supervisor",
                    created_at: new Date().toISOString(),
                });

            if (roleInsertError) {
                console.error("Role assignment error:", roleInsertError);
                // If role assignment fails, we still created the user, so return partial success
                return new Response(
                    JSON.stringify({
                        success: true,
                        warning: "User created but role assignment failed",
                        user: {
                            id: newUserId,
                            email: newUserData.user.email,
                            name: name.trim(),
                        },
                        error: roleInsertError.message,
                    }),
                    {
                        status: 201,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }
        }

        // Success response
        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: newUserId,
                    email: newUserData.user.email,
                    name: name.trim(),
                    role: role || null,
                },
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: unknown) {
        console.error("Unexpected error:", error);
        const message =
            error instanceof Error ? error.message : "Internal server error";
        return new Response(
            JSON.stringify({ error: "Internal server error", details: message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});

