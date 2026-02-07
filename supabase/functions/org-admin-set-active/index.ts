/**
 * Phase 6: Org admin deactivates/activates a user in their org.
 * Cannot deactivate self. Platform admin can set active across orgs.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

        const masterAdmin = await isMasterAdmin(supabaseAdmin, callerData.id);
        if (!masterAdmin && !(await getCallerOrgId(supabaseAdmin, callerData.id))) {
            return new Response(JSON.stringify({ error: "Org admin or master admin access required" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json().catch(() => ({}));
        const targetUserId = (body.targetUserId as string)?.trim();
        const isActive = body.isActive as boolean | undefined;

        if (!targetUserId) {
            return new Response(JSON.stringify({ error: "targetUserId is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (typeof isActive !== "boolean") {
            return new Response(JSON.stringify({ error: "isActive must be true or false" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (targetUserId === callerData.id) {
            return new Response(JSON.stringify({ error: "You cannot deactivate or activate your own account" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: targetProfile, error: fetchError } = await supabaseAdmin
            .from("profiles")
            .select("organization_id, is_active, deactivated_at")
            .eq("id", targetUserId)
            .maybeSingle();

        if (fetchError || !targetProfile) {
            return new Response(JSON.stringify({ error: "Target user not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const callerOrg = await getCallerOrgId(supabaseAdmin, callerData.id);

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
            if (targetProfile.organization_id !== callerOrg) {
                return new Response(JSON.stringify({ error: "Target user is not in your organization" }), {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        const organizationId = targetProfile.organization_id ?? callerOrg;
        if (!organizationId && !platformAdmin) {
            return new Response(JSON.stringify({ error: "Target user has no organization" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const now = new Date().toISOString();
        const beforeState = {
            is_active: targetProfile.is_active,
            deactivated_at: targetProfile.deactivated_at,
        };
        const afterState = {
            is_active: isActive,
            deactivated_at: isActive ? null : now,
        };

        const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({
                is_active: isActive,
                deactivated_at: isActive ? null : now,
                updated_at: now,
            })
            .eq("id", targetUserId);

        if (updateError) {
            return new Response(JSON.stringify({ error: "Failed to update user", details: updateError.message }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (organizationId) {
            await logOrgAudit(
                supabaseAdmin,
                organizationId,
                callerData.id,
                isActive ? "activate_user" : "deactivate_user",
                targetUserId,
                beforeState,
                afterState
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                userId: targetUserId,
                isActive,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
