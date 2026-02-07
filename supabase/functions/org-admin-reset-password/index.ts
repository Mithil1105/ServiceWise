/**
 * Phase 6: Org admin resets any user's password in their org (no email).
 * Platform admin can reset across orgs by passing targetUserId.
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
        const targetUserId = (body.targetUserId as string)?.trim();
        const newPasswordParam = (body.newPassword as string)?.trim();

        if (!targetUserId) {
            return new Response(JSON.stringify({ error: "targetUserId is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: targetProfile } = await supabaseAdmin
            .from("profiles")
            .select("organization_id")
            .eq("id", targetUserId)
            .maybeSingle();

        const callerOrg = await getCallerOrgId(supabaseAdmin, callerData.id);
        const masterAdmin = await isMasterAdmin(supabaseAdmin, callerData.id);

        if (!masterAdmin) {
            if (!callerOrg) {
                return new Response(JSON.stringify({ error: "Your profile has no organization" }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            const orgAdmin = await isOrgAdminForOrg(supabaseAdmin, callerData.id, callerOrg);
            if (!orgAdmin) {
                return new Response(JSON.stringify({ error: "Org admin or master admin access required" }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            if (targetProfile?.organization_id !== callerOrg) {
                return new Response(JSON.stringify({ error: "Target user is not in your organization" }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        const organizationId = targetProfile?.organization_id ?? callerOrg;
        if (!organizationId && !masterAdmin) {
            return new Response(JSON.stringify({ error: "Target user has no organization" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const newPassword = newPasswordParam && newPasswordParam.length >= 6 ? newPasswordParam : generateTempPassword();
        const serverGenerated = !newPasswordParam || newPasswordParam.length < 6;

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPassword });

        if (updateError) {
            return new Response(JSON.stringify({ error: "Failed to update password", details: updateError.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (organizationId) {
            await logOrgAudit(
                supabaseAdmin,
                organizationId,
                callerData.id,
                "reset_password",
                targetUserId,
                null,
                { password_generated: serverGenerated }
            );
        }

        const res: Record<string, unknown> = { success: true, userId: targetUserId };
        if (serverGenerated) {
            res.newPassword = newPassword;
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
