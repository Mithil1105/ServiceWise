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

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Debug logging (remove in production)
    console.log("Token received:", token ? "Yes" : "No");
    console.log("Token length:", token?.length || 0);

    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error("Auth error:", authError.message);
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: authError.message,
        hint: "Token validation failed. Please try logging out and back in."
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!requestingUser) {
      console.error("No user found from token");
      return new Response(JSON.stringify({
        error: "Unauthorized",
        details: "User not found from token"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", requestingUser.id, requestingUser.email);

    // Check if requesting user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      console.error("Role query error:", roleError);
      return new Response(JSON.stringify({
        error: "Failed to check admin role",
        details: roleError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!roleData) {
      // Check what roles the user actually has
      const { data: allRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", requestingUser.id);

      console.log("User roles:", allRoles);
      console.log("User ID:", requestingUser.id);

      return new Response(JSON.stringify({
        error: "Admin access required",
        details: `User has roles: ${allRoles?.map(r => r.role).join(", ") || "none"}`,
        userId: requestingUser.id
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Admin role verified for user:", requestingUser.id);

    // Parse request body
    const { email, password, name, role } = await req.json();

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: "Email, password, and name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role
    if (role && !["admin", "manager", "supervisor"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role. Must be 'admin', 'manager', or 'supervisor'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name }
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newUser.user) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure profile exists (trigger should create it, but ensure it exists)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        name: name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: "id"
      });

    if (profileError) {
      console.error("Error creating/updating profile:", profileError);
      // Don't fail the request if profile creation fails, but log it
    }

    // Assign role if specified
    if (role) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: role as "admin" | "manager" | "supervisor" });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        return new Response(
          JSON.stringify({ error: `Failed to assign role: ${roleError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
