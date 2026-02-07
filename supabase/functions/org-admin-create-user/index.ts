/**
 * Phase 6: Org admin creates users in their org. Created users are auto-verified and active.
 * Platform admin can optionally pass organizationId to create in any org.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateTempPassword(length = 14): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let s = "";
    for (let i = 0; i < length; i++) {
        s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
}

async function isMasterAdmin(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .is("organization_id", null)
        .eq("role", "admin")
        .maybeSingle();
    return !!data;
}

async function isOrgAdminForOrg(supabaseAdmin: ReturnType<typeof createClient>, userId: string, orgId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["admin", "manager"])
        .maybeSingle();
    return !!data;
}

async function getCallerOrgId(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .maybeSingle();
    return data?.organization_id ?? null;
}

async function logOrgAudit(
    supabaseAdmin: ReturnType<typeof createClient>,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetUserId: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null
) {
    await supabaseAdmin.from("org_user_audit_log").insert({
        organization_id: organizationId,
        actor_user_id: actorUserId,
        action,
        target_user_id: targetUserId,
        before_state: beforeState,
        after_state: afterState,
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        if (!supabaseUrl || !serviceRoleKey) {
            return new Response(JSON.stringify({ error: "Server configuration error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "").trim();
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: serviceRoleKey },
        });
        if (!authResponse.ok) {
            return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const callerData = await authResponse.json();
        if (!callerData?.id) {
            return new Response(JSON.stringify({ error: "User data not found" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json().catch(() => ({}));
        const email = (body.email as string)?.trim()?.toLowerCase();
        const tempPassword = (body.tempPassword as string)?.trim();
        const role = (body.role as "supervisor" | "manager" | "admin") || "supervisor";
        const fullName = (body.fullName as string)?.trim();
        const organizationIdParam = body.organizationId as string | undefined;

        if (!email) {
            return new Response(JSON.stringify({ error: "email is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (role && !["supervisor", "manager", "admin"].includes(role)) {
            return new Response(JSON.stringify({ error: "role must be supervisor, manager, or admin" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const masterAdmin = await isMasterAdmin(supabaseAdmin, callerData.id);
        let organizationId: string;
        let createdVia: "org_admin" | "platform_admin";

        if (masterAdmin && organizationIdParam) {
            const { data: org } = await supabaseAdmin.from("organizations").select("id").eq("id", organizationIdParam).maybeSingle();
            if (!org) {
                return new Response(JSON.stringify({ error: "Organization not found" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            organizationId = org.id;
            createdVia = "platform_admin";
        } else {
            const callerOrg = await getCallerOrgId(supabaseAdmin, callerData.id);
            if (!callerOrg) {
                return new Response(JSON.stringify({ error: "Your profile has no organization. Only master admin can specify organizationId." }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            organizationId = callerOrg;
            createdVia = "org_admin";
        }

        if (!masterAdmin) {
            const orgAdmin = await isOrgAdminForOrg(supabaseAdmin, callerData.id, organizationId);
            if (!orgAdmin) {
                return new Response(JSON.stringify({ error: "Org admin or master admin access required" }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        const password = tempPassword && tempPassword.length >= 6 ? tempPassword : generateTempPassword();
        const serverGeneratedPassword = !tempPassword || tempPassword.length < 6;

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: fullName || email.split("@")[0] },
        });

        if (createError) {
            return new Response(JSON.stringify({ error: "Failed to create user", details: createError.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!newUser.user) {
            return new Response(JSON.stringify({ error: "User creation failed" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const now = new Date().toISOString();
        await supabaseAdmin.from("profiles").upsert(
            {
                id: newUser.user.id,
                organization_id: organizationId,
                name: fullName || (newUser.user.user_metadata?.name ?? email.split("@")[0]),
                is_active: true,
                created_via: createdVia,
                invited_by_user_id: createdVia === "org_admin" ? callerData.id : null,
                created_at: now,
                updated_at: now,
            },
            { onConflict: "id" }
        );

        await supabaseAdmin.from("user_roles").upsert(
            {
                user_id: newUser.user.id,
                organization_id: organizationId,
                role,
                created_at: now,
            },
            { onConflict: "user_id,organization_id" }
        );

        await logOrgAudit(supabaseAdmin, organizationId, callerData.id, "create_user", newUser.user.id, null, {
            email,
            role,
            created_via: createdVia,
            temp_password_used: serverGeneratedPassword,
        });

        const res: Record<string, unknown> = {
            success: true,
            userId: newUser.user.id,
            email: newUser.user.email,
        };
        if (serverGeneratedPassword) {
            res.tempPassword = password;
        }

        return new Response(JSON.stringify(res), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
